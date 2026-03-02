use std::net::SocketAddr;
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use tauri::{Emitter, Manager};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::broadcast;
use tokio::sync::Mutex as TokioMutex;
use tokio_tungstenite::tungstenite::Message;

use crate::git;
use crate::ws_auth;
use crate::ws_mdns;

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct RpcRequest {
    jsonrpc: Option<String>,
    method: String,
    id: Option<serde_json::Value>,
    params: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct RpcResponse {
    jsonrpc: &'static str,
    id: serde_json::Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<RpcError>,
}

#[derive(Debug, Serialize)]
struct RpcError {
    code: i32,
    message: String,
}

impl RpcResponse {
    fn success(id: serde_json::Value, result: serde_json::Value) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: Some(result),
            error: None,
        }
    }

    fn error(id: serde_json::Value, code: i32, message: impl Into<String>) -> Self {
        Self {
            jsonrpc: "2.0",
            id,
            result: None,
            error: Some(RpcError {
                code,
                message: message.into(),
            }),
        }
    }

    fn method_not_found(id: serde_json::Value) -> Self {
        Self::error(id, -32601, "Method not found")
    }

    fn invalid_request(id: serde_json::Value, msg: impl Into<String>) -> Self {
        Self::error(id, -32600, msg)
    }

    fn invalid_params(id: serde_json::Value, msg: impl Into<String>) -> Self {
        Self::error(id, -32602, msg)
    }

    fn internal_error(id: serde_json::Value, msg: impl Into<String>) -> Self {
        Self::error(id, -32603, msg)
    }
}

// ---------------------------------------------------------------------------
// JSON-RPC Notification (server → client push, no id field)
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
struct RpcNotification {
    jsonrpc: &'static str,
    method: String,
    params: serde_json::Value,
}

impl RpcNotification {
    fn state_changed(entity: &str, id: Option<i64>) -> Self {
        let mut params = serde_json::json!({ "entity": entity });
        if let Some(id) = id {
            params["id"] = serde_json::json!(id);
        }
        Self {
            jsonrpc: "2.0",
            method: "state.changed".to_string(),
            params,
        }
    }

    fn automation_finished(automation_id: i64, run_id: i64, status: &str) -> Self {
        Self {
            jsonrpc: "2.0",
            method: "automation.finished".to_string(),
            params: serde_json::json!({
                "automationId": automation_id,
                "runId": run_id,
                "status": status,
            }),
        }
    }
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default)]
struct ClientState {
    authenticated: bool,
    device_name: Option<String>,
}

struct ServerState {
    db: std::sync::Mutex<Connection>,
    broadcast_tx: broadcast::Sender<String>,
    app_handle: tauri::AppHandle,
}

// ---------------------------------------------------------------------------
// Helper: run a DB closure on the shared connection
// ---------------------------------------------------------------------------

fn with_db<F, T>(state: &ServerState, f: F) -> Result<T, String>
where
    F: FnOnce(&Connection) -> Result<T, String>,
{
    let conn = state.db.lock().map_err(|e| format!("DB lock poisoned: {e}"))?;
    f(&conn)
}

// ---------------------------------------------------------------------------
// Server entry point
// ---------------------------------------------------------------------------

pub async fn start_ws_server(app_handle: tauri::AppHandle) {
    let db_path = match app_handle.path().app_data_dir() {
        Ok(dir) => dir.join("divergence.db"),
        Err(e) => {
            eprintln!("[ws_server] Cannot resolve app data dir: {e}");
            return;
        }
    };

    eprintln!("[ws_server] DB path: {}", db_path.display());

    let conn = match Connection::open(&db_path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[ws_server] Failed to open database: {e}");
            return;
        }
    };

    if let Err(e) = conn.pragma_update(None, "journal_mode", "WAL") {
        eprintln!("[ws_server] Failed to set WAL mode: {e}");
    }

    if let Err(e) = ws_auth::bootstrap_auth_tables(&conn) {
        eprintln!("[ws_server] Failed to bootstrap auth tables: {e}");
        return;
    }

    if !ws_auth::is_remote_access_enabled(&conn) {
        eprintln!("[ws_server] Remote access is disabled. WebSocket server will not start.");
        return;
    }

    let port = ws_auth::get_remote_access_port(&conn);

    let (broadcast_tx, _) = broadcast::channel::<String>(64);

    let state = Arc::new(ServerState {
        db: std::sync::Mutex::new(conn),
        broadcast_tx,
        app_handle: app_handle.clone(),
    });

    let addr: SocketAddr = ([0, 0, 0, 0], port).into();
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(e) => {
            eprintln!("[ws_server] Failed to bind to {addr}: {e}");
            return;
        }
    };

    eprintln!("[ws_server] Listening on ws://{addr}");

    tokio::spawn(ws_mdns::advertise_mdns(port));

    loop {
        match listener.accept().await {
            Ok((stream, peer)) => {
                let state = Arc::clone(&state);
                tokio::spawn(handle_connection(stream, peer, state));
            }
            Err(e) => {
                eprintln!("[ws_server] Accept error: {e}");
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Per-connection handler
// ---------------------------------------------------------------------------

async fn handle_connection(stream: TcpStream, peer: SocketAddr, state: Arc<ServerState>) {
    eprintln!("[ws_server] New connection from {peer}");

    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            eprintln!("[ws_server] WebSocket handshake failed for {peer}: {e}");
            return;
        }
    };

    let (write, read) = ws_stream.split();
    let write = Arc::new(TokioMutex::new(write));
    let client = Arc::new(TokioMutex::new(ClientState::default()));

    // Subscribe to broadcast channel for server push events
    let mut broadcast_rx = state.broadcast_tx.subscribe();
    let broadcast_write = Arc::clone(&write);
    let broadcast_client = Arc::clone(&client);
    let broadcast_handle = tokio::spawn(async move {
        while let Ok(payload) = broadcast_rx.recv().await {
            // Only forward to authenticated clients
            let is_authed = {
                let cs = broadcast_client.lock().await;
                cs.authenticated
            };
            if is_authed {
                let mut w = broadcast_write.lock().await;
                if w.send(Message::Text(payload.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    read.for_each(|msg_result| {
        let write = Arc::clone(&write);
        let client = Arc::clone(&client);
        let state = Arc::clone(&state);

        async move {
            let msg = match msg_result {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("[ws_server] Read error from {peer}: {e}");
                    return;
                }
            };

            match msg {
                Message::Text(text) => {
                    let response = process_message(&text, &client, &state).await;
                    if let Some(resp) = response {
                        let payload = match serde_json::to_string(&resp) {
                            Ok(s) => s,
                            Err(e) => {
                                eprintln!("[ws_server] Serialize error: {e}");
                                return;
                            }
                        };
                        let mut w = write.lock().await;
                        if let Err(e) = w.send(Message::Text(payload.into())).await {
                            eprintln!("[ws_server] Write error to {peer}: {e}");
                        }
                    }
                }
                Message::Ping(data) => {
                    let mut w = write.lock().await;
                    let _ = w.send(Message::Pong(data)).await;
                }
                Message::Close(_) => {
                    eprintln!("[ws_server] Connection closed by {peer}");
                }
                _ => {}
            }
        }
    })
    .await;

    broadcast_handle.abort();
    eprintln!("[ws_server] Connection ended for {peer}");
}

// ---------------------------------------------------------------------------
// Message dispatch
// ---------------------------------------------------------------------------

async fn process_message(
    text: &str,
    client: &Arc<TokioMutex<ClientState>>,
    state: &Arc<ServerState>,
) -> Option<RpcResponse> {
    let req: RpcRequest = match serde_json::from_str(text) {
        Ok(r) => r,
        Err(e) => {
            return Some(RpcResponse::error(
                serde_json::Value::Null,
                -32700,
                format!("Parse error: {e}"),
            ));
        }
    };

    if req.jsonrpc.as_deref() != Some("2.0") {
        return Some(RpcResponse::invalid_request(
            req.id.unwrap_or(serde_json::Value::Null),
            "Invalid or missing jsonrpc version",
        ));
    }

    let id = req.id.unwrap_or(serde_json::Value::Null);

    match req.method.as_str() {
        "handshake" => Some(handle_handshake(id, state)),
        "auth" => Some(handle_auth(id, req.params, client, state).await),
        "ping" => Some(RpcResponse::success(
            id,
            serde_json::json!({ "pong": true, "serverTime": now_millis() }),
        )),
        _ => {
            // All other methods require authentication.
            let is_authed = {
                let cs = client.lock().await;
                cs.authenticated
            };
            if !is_authed {
                return Some(RpcResponse::error(id, -32000, "Not authenticated"));
            }

            match req.method.as_str() {
                "tmux.sessions" => Some(handle_tmux_sessions(id).await),
                "tmux.paneStatus" => Some(handle_tmux_pane_status(id, req.params).await),
                "projects.list" => Some(handle_projects_list(id, state)),
                "divergences.list" => Some(handle_divergences_list(id, req.params, state)),
                "workspaces.list" => Some(handle_workspaces_list(id, state)),
                "workspaceDivergences.list" => Some(handle_workspace_divergences_list(id, req.params, state)),
                "automations.list" => Some(handle_automations_list(id, req.params, state)),
                "terminal.capture" => Some(handle_terminal_capture(id, req.params).await),
                "tmux.sendKeys" => Some(handle_tmux_send_keys(id, req.params, state).await),
                "promptQueue.list" => Some(handle_prompt_queue_list(id, req.params, state)),
                "promptQueue.add" => Some(handle_prompt_queue_add(id, req.params, state)),
                "promptQueue.delete" => Some(handle_prompt_queue_delete(id, req.params, state)),
                "notify.automationFinished" => Some(handle_notify_automation_finished(id, req.params, state)),
                _ => Some(RpcResponse::method_not_found(id)),
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

fn handle_handshake(id: serde_json::Value, state: &Arc<ServerState>) -> RpcResponse {
    // Notify the frontend that a mobile device just connected and may need pairing
    let _ = state.app_handle.emit("mobile-handshake", ());

    RpcResponse::success(
        id,
        serde_json::json!({
            "protocol": 1,
            "server": "divergence-desktop",
            "serverVersion": env!("CARGO_PKG_VERSION"),
            "capabilities": ["tmux", "projects", "divergences", "workspaces", "workspaceDivergences", "automations", "promptQueue", "pushEvents"]
        }),
    )
}

async fn handle_auth(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    client: &Arc<TokioMutex<ClientState>>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct AuthParams {
        pairing_code: Option<String>,
        session_token: Option<String>,
        device_name: Option<String>,
    }

    let params: AuthParams = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad auth params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    // Try session token first (fast path for already-paired clients).
    if let Some(ref token) = params.session_token {
        let token = token.clone();
        // DB access is fully synchronous — lock, query, drop guard before any .await
        let result = with_db(state, |conn| ws_auth::validate_session_token(conn, &token));

        match result {
            Ok(true) => {
                let mut cs = client.lock().await;
                cs.authenticated = true;
                cs.device_name = params.device_name.clone();
                return RpcResponse::success(id, serde_json::json!({ "ok": true }));
            }
            Ok(false) => {
                return RpcResponse::error(id, -32001, "Invalid session token");
            }
            Err(e) => {
                return RpcResponse::internal_error(id, format!("Auth error: {e}"));
            }
        }
    }

    // Try pairing code.
    if let Some(ref code) = params.pairing_code {
        let device_name = params
            .device_name
            .clone()
            .unwrap_or_else(|| "Unknown device".to_string());

        let code = code.clone();
        let result = with_db(state, |conn| ws_auth::validate_pairing_code(conn, &code));

        match result {
            Ok(true) => {
                let session_token = uuid::Uuid::new_v4().to_string();
                let session_token_hash = session_token.clone();

                let create_result = with_db(state, |conn| {
                    ws_auth::create_session(conn, &device_name, &session_token_hash)
                });

                match create_result {
                    Ok(_session_id) => {
                        let mut cs = client.lock().await;
                        cs.authenticated = true;
                        cs.device_name = Some(device_name);

                        RpcResponse::success(
                            id,
                            serde_json::json!({
                                "ok": true,
                                "sessionToken": session_token,
                            }),
                        )
                    }
                    Err(e) => RpcResponse::internal_error(
                        id,
                        format!("Failed to create session: {e}"),
                    ),
                }
            }
            Ok(false) => RpcResponse::error(id, -32001, "Invalid pairing code"),
            Err(e) => RpcResponse::error(id, -32001, e),
        }
    } else {
        RpcResponse::invalid_params(id, "Provide either sessionToken or pairingCode")
    }
}

async fn handle_tmux_sessions(id: serde_json::Value) -> RpcResponse {
    let result = tokio::task::spawn_blocking(git::list_tmux_sessions).await;

    match result {
        Ok(Ok(sessions)) => {
            let serialized: Vec<serde_json::Value> = sessions
                .into_iter()
                .map(|s| {
                    serde_json::json!({
                        "name": s.name,
                        "created": s.created,
                        "attached": s.attached,
                        "windowCount": s.window_count,
                        "activity": s.activity,
                    })
                })
                .collect();
            RpcResponse::success(id, serde_json::json!({ "sessions": serialized }))
        }
        Ok(Err(e)) => RpcResponse::internal_error(id, format!("tmux error: {e}")),
        Err(e) => RpcResponse::internal_error(id, format!("Task join error: {e}")),
    }
}

async fn handle_tmux_pane_status(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct PaneStatusParams {
        session_name: String,
    }

    let params: PaneStatusParams = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => {
                return RpcResponse::invalid_params(id, format!("Bad params: {e}"));
            }
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let session_name = params.session_name;
    let result =
        tokio::task::spawn_blocking(move || git::query_tmux_pane_status(&session_name)).await;

    match result {
        Ok(Ok(status)) => RpcResponse::success(
            id,
            serde_json::json!({
                "alive": status.alive,
                "exitCode": status.exit_code,
            }),
        ),
        Ok(Err(e)) => RpcResponse::internal_error(id, format!("tmux error: {e}")),
        Err(e) => RpcResponse::internal_error(id, format!("Task join error: {e}")),
    }
}

// ---------------------------------------------------------------------------
// Phase 2A: DB-backed method handlers
// ---------------------------------------------------------------------------

fn handle_projects_list(id: serde_json::Value, state: &Arc<ServerState>) -> RpcResponse {
    let result = with_db(state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, name, path, created_at FROM projects ORDER BY name")
            .map_err(|e| format!("DB error: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "path": row.get::<_, String>(2)?,
                    "createdAt": row.get::<_, String>(3)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let projects: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(projects)
    });

    match result {
        Ok(projects) => RpcResponse::success(id, serde_json::json!({ "projects": projects })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_divergences_list(id: serde_json::Value, params: Option<serde_json::Value>, state: &Arc<ServerState>) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        project_id: i64,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let result = with_db(state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, project_id, name, branch, path, created_at, has_diverged FROM divergences WHERE project_id = ?1 ORDER BY created_at")
            .map_err(|e| format!("DB error: {e}"))?;
        let rows = stmt
            .query_map([params.project_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "projectId": row.get::<_, i64>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "branch": row.get::<_, String>(3)?,
                    "path": row.get::<_, String>(4)?,
                    "createdAt": row.get::<_, String>(5)?,
                    "hasDiverged": row.get::<_, bool>(6)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let divergences: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(divergences)
    });

    match result {
        Ok(divergences) => RpcResponse::success(id, serde_json::json!({ "divergences": divergences })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_workspaces_list(id: serde_json::Value, state: &Arc<ServerState>) -> RpcResponse {
    let result = with_db(state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, name, slug, description, folder_path, created_at_ms, updated_at_ms FROM workspaces ORDER BY name")
            .map_err(|e| format!("DB error: {e}"))?;
        let rows = stmt
            .query_map([], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "slug": row.get::<_, String>(2)?,
                    "description": row.get::<_, Option<String>>(3)?,
                    "folderPath": row.get::<_, String>(4)?,
                    "createdAtMs": row.get::<_, i64>(5)?,
                    "updatedAtMs": row.get::<_, i64>(6)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let workspaces: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(workspaces)
    });

    match result {
        Ok(workspaces) => RpcResponse::success(id, serde_json::json!({ "workspaces": workspaces })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_workspace_divergences_list(id: serde_json::Value, params: Option<serde_json::Value>, state: &Arc<ServerState>) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        workspace_id: i64,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let result = with_db(state, |conn| {
        let mut stmt = conn
            .prepare("SELECT id, workspace_id, name, branch, folder_path, created_at_ms FROM workspace_divergences WHERE workspace_id = ?1 ORDER BY name")
            .map_err(|e| format!("DB error: {e}"))?;
        let rows = stmt
            .query_map([params.workspace_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "workspaceId": row.get::<_, i64>(1)?,
                    "name": row.get::<_, String>(2)?,
                    "branch": row.get::<_, String>(3)?,
                    "folderPath": row.get::<_, String>(4)?,
                    "createdAtMs": row.get::<_, i64>(5)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let divergences: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(divergences)
    });

    match result {
        Ok(divergences) => RpcResponse::success(id, serde_json::json!({ "divergences": divergences })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_automations_list(id: serde_json::Value, params: Option<serde_json::Value>, state: &Arc<ServerState>) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        project_id: Option<i64>,
    }

    let params: Params = params
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or(Params { project_id: None });

    let result = with_db(state, |conn| {
        let (sql, param_values): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match params.project_id {
            Some(pid) => (
                "SELECT a.id, a.name, a.project_id, a.agent, a.prompt, a.interval_hours, a.run_mode, a.enabled, a.last_run_at_ms, a.next_run_at_ms, a.created_at_ms, a.updated_at_ms, a.workspace_id, (SELECT ar.status FROM automation_runs ar WHERE ar.automation_id = a.id ORDER BY ar.id DESC LIMIT 1) as last_run_status FROM automations a WHERE a.project_id = ?1 ORDER BY a.name".to_string(),
                vec![Box::new(pid) as Box<dyn rusqlite::types::ToSql>],
            ),
            None => (
                "SELECT a.id, a.name, a.project_id, a.agent, a.prompt, a.interval_hours, a.run_mode, a.enabled, a.last_run_at_ms, a.next_run_at_ms, a.created_at_ms, a.updated_at_ms, a.workspace_id, (SELECT ar.status FROM automation_runs ar WHERE ar.automation_id = a.id ORDER BY ar.id DESC LIMIT 1) as last_run_status FROM automations a ORDER BY a.name".to_string(),
                vec![],
            ),
        };

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("DB error: {e}"))?;
        let param_refs: Vec<&dyn rusqlite::types::ToSql> = param_values.iter().map(|b| b.as_ref()).collect();
        let rows = stmt
            .query_map(param_refs.as_slice(), |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "name": row.get::<_, String>(1)?,
                    "projectId": row.get::<_, i64>(2)?,
                    "agent": row.get::<_, String>(3)?,
                    "prompt": row.get::<_, String>(4)?,
                    "intervalHours": row.get::<_, i64>(5)?,
                    "runMode": row.get::<_, String>(6)?,
                    "enabled": row.get::<_, bool>(7)?,
                    "lastRunAtMs": row.get::<_, Option<i64>>(8)?,
                    "nextRunAtMs": row.get::<_, Option<i64>>(9)?,
                    "createdAtMs": row.get::<_, i64>(10)?,
                    "updatedAtMs": row.get::<_, i64>(11)?,
                    "workspaceId": row.get::<_, Option<i64>>(12)?,
                    "lastRunStatus": row.get::<_, Option<String>>(13)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let automations: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(automations)
    });

    match result {
        Ok(automations) => RpcResponse::success(id, serde_json::json!({ "automations": automations })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
// Phase 2B: Terminal capture & send keys
// ---------------------------------------------------------------------------

async fn handle_terminal_capture(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct CaptureParams {
        session_name: String,
        lines: Option<u32>,
    }

    let params: CaptureParams = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let session_name = params.session_name;
    let lines = params.lines.unwrap_or(200);
    let result =
        tokio::task::spawn_blocking(move || git::tmux_capture_pane(&session_name, lines)).await;

    match result {
        Ok(Ok(output)) => RpcResponse::success(id, serde_json::json!({ "output": output })),
        Ok(Err(e)) => RpcResponse::internal_error(id, format!("tmux error: {e}")),
        Err(e) => RpcResponse::internal_error(id, format!("Task join error: {e}")),
    }
}

async fn handle_tmux_send_keys(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct SendKeysParams {
        session_name: String,
        keys: String,
    }

    let params: SendKeysParams = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let session_name = params.session_name;
    let keys = params.keys;
    let result =
        tokio::task::spawn_blocking(move || git::tmux_send_keys(&session_name, &keys)).await;

    match result {
        Ok(Ok(())) => {
            broadcast_state_changed(state, "terminal", None);
            RpcResponse::success(id, serde_json::json!({ "ok": true }))
        }
        Ok(Err(e)) => RpcResponse::internal_error(id, format!("tmux error: {e}")),
        Err(e) => RpcResponse::internal_error(id, format!("Task join error: {e}")),
    }
}

// ---------------------------------------------------------------------------
// Phase 2C: Prompt queue handlers
// ---------------------------------------------------------------------------

fn handle_prompt_queue_list(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        scope_type: String,
        scope_id: i64,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let result = with_db(state, |conn| {
        let mut stmt = conn
            .prepare(
                "SELECT id, scope_type, scope_id, prompt, created_at_ms \
                 FROM prompt_queue_items \
                 WHERE scope_type = ?1 AND scope_id = ?2 \
                 ORDER BY created_at_ms ASC, id ASC",
            )
            .map_err(|e| format!("DB error: {e}"))?;
        let rows = stmt
            .query_map(rusqlite::params![params.scope_type, params.scope_id], |row| {
                Ok(serde_json::json!({
                    "id": row.get::<_, i64>(0)?,
                    "scopeType": row.get::<_, String>(1)?,
                    "scopeId": row.get::<_, i64>(2)?,
                    "prompt": row.get::<_, String>(3)?,
                    "createdAtMs": row.get::<_, i64>(4)?,
                }))
            })
            .map_err(|e| format!("DB error: {e}"))?;
        let items: Vec<serde_json::Value> = rows.filter_map(|r| r.ok()).collect();
        Ok(items)
    });

    match result {
        Ok(items) => RpcResponse::success(id, serde_json::json!({ "items": items })),
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_prompt_queue_add(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        scope_type: String,
        scope_id: i64,
        prompt: String,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let now_ms = now_millis();
    let result = with_db(state, |conn| {
        conn.execute(
            "INSERT INTO prompt_queue_items (scope_type, scope_id, prompt, created_at_ms) \
             VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![params.scope_type, params.scope_id, params.prompt, now_ms],
        )
        .map_err(|e| format!("DB error: {e}"))?;
        Ok(conn.last_insert_rowid())
    });

    match result {
        Ok(new_id) => {
            broadcast_state_changed(state, "promptQueue", Some(new_id));
            RpcResponse::success(id, serde_json::json!({ "id": new_id }))
        }
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

fn handle_prompt_queue_delete(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        item_id: i64,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    let result = with_db(state, |conn| {
        conn.execute(
            "DELETE FROM prompt_queue_items WHERE id = ?1",
            [params.item_id],
        )
        .map_err(|e| format!("DB error: {e}"))?;
        Ok(())
    });

    match result {
        Ok(()) => {
            broadcast_state_changed(state, "promptQueue", None);
            RpcResponse::success(id, serde_json::json!({ "ok": true }))
        }
        Err(e) => RpcResponse::internal_error(id, e),
    }
}

// ---------------------------------------------------------------------------
// Notify handler: allows Desktop frontend to push events to mobile clients
// ---------------------------------------------------------------------------

fn handle_notify_automation_finished(
    id: serde_json::Value,
    params: Option<serde_json::Value>,
    state: &Arc<ServerState>,
) -> RpcResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Params {
        automation_id: i64,
        run_id: i64,
        status: String,
    }

    let params: Params = match params {
        Some(v) => match serde_json::from_value(v) {
            Ok(p) => p,
            Err(e) => return RpcResponse::invalid_params(id, format!("Bad params: {e}")),
        },
        None => return RpcResponse::invalid_params(id, "Missing params"),
    };

    broadcast_automation_finished(state, params.automation_id, params.run_id, &params.status);
    RpcResponse::success(id, serde_json::json!({ "ok": true }))
}

// ---------------------------------------------------------------------------
// Server push event broadcasting
// ---------------------------------------------------------------------------

fn broadcast_state_changed(state: &ServerState, entity: &str, id: Option<i64>) {
    let notification = RpcNotification::state_changed(entity, id);
    if let Ok(payload) = serde_json::to_string(&notification) {
        let _ = state.broadcast_tx.send(payload);
    }
}

fn broadcast_automation_finished(state: &ServerState, automation_id: i64, run_id: i64, status: &str) {
    let notification = RpcNotification::automation_finished(automation_id, run_id, status);
    if let Ok(payload) = serde_json::to_string(&notification) {
        let _ = state.broadcast_tx.send(payload);
    }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

fn now_millis() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
