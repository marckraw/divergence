use super::attachments::{
    attachment_kind_from_mime_type, build_attachment_filename, resolve_staged_attachment_path,
    session_attachment_dir, validate_turn_attachments_for_provider,
};
use super::activities::now_ms;
use super::constants::SESSION_UPDATED_EVENT_NAME;
use super::codex::{self, send_codex_message};
use super::opencode;
use super::persistence::{default_persistence_path, load_persisted_sessions};
use super::provider_registry::{normalize_agent_effort, normalize_agent_model};
use super::session_updates::{
    apply_session_failure, build_capabilities, push_runtime_event, summarize_session,
    SessionFailureState,
};
use super::types::{
    AgentAttachment, AgentInteractionMode, AgentMessage, AgentMessageRole,
    AgentMessageStatus, AgentProvider, AgentRequest, AgentRuntimeCapabilities,
    AgentRuntimeSessionUpdatedEvent, AgentRuntimeStatus, AgentSessionNameMode,
    AgentSessionRole, AgentSessionSnapshot, AgentSessionStatus, AgentSessionSummary,
    AgentTurnInvocation, CreateAgentSessionInput, RespondAgentRequestInput,
    StageAgentAttachmentInput, StartAgentTurnInput, UpdateAgentSessionInput,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};
use tokio::time::Duration;
use uuid::Uuid;

pub(crate) type PendingResponseSender = oneshot::Sender<Result<Value, String>>;
pub(crate) type PendingResponseRegistry = Arc<Mutex<HashMap<String, PendingResponseSender>>>;
pub(crate) type TurnCompletionSender = oneshot::Sender<Result<(), String>>;
pub(crate) type TurnCompletionSignal = Arc<Mutex<Option<TurnCompletionSender>>>;

#[derive(Clone)]
pub(crate) enum RunningTransport {
    Claude,
    Cursor,
    Gemini,
    OpenCodeServer,
    CodexAppServer {
        writer: mpsc::UnboundedSender<String>,
    },
}

#[derive(Clone)]
pub(crate) struct RunningSessionHandle {
    pub(crate) child: Arc<AsyncMutex<tokio::process::Child>>,
    pub(crate) transport: RunningTransport,
}

#[derive(Clone)]
pub(crate) enum PendingRequestTransport {
    CodexApproval {
        session_id: String,
        json_rpc_id: Value,
        decisions: HashMap<String, Value>,
    },
    CodexUserInput {
        session_id: String,
        json_rpc_id: Value,
        question_ids: Vec<String>,
    },
    OpenCodePermission {
        session_id: String,
        opencode_session_id: String,
        permission_id: String,
        directory: String,
        base_url: String,
        decisions: HashMap<String, String>,
    },
}

#[derive(Default)]
struct AgentRuntimeInner {
    sessions: Mutex<HashMap<String, AgentSessionSnapshot>>,
    persistence_path: PathBuf,
    capabilities: Mutex<Option<AgentRuntimeCapabilities>>,
    running_sessions: Mutex<HashMap<String, RunningSessionHandle>>,
    pending_requests: Mutex<HashMap<String, PendingRequestTransport>>,
    stopping_sessions: Mutex<HashSet<String>>,
}

#[derive(Clone, Default)]
pub struct AgentRuntimeState {
    inner: Arc<AgentRuntimeInner>,
}

impl AgentRuntimeState {
    pub fn new() -> Self {
        let persistence_path = default_persistence_path();
        let sessions = load_persisted_sessions(&persistence_path);

        Self {
            inner: Arc::new(AgentRuntimeInner {
                sessions: Mutex::new(sessions),
                persistence_path,
                capabilities: Mutex::new(None),
                running_sessions: Mutex::new(HashMap::new()),
                pending_requests: Mutex::new(HashMap::new()),
                stopping_sessions: Mutex::new(HashSet::new()),
            }),
        }
    }

    pub fn capabilities(&self) -> Result<AgentRuntimeCapabilities, String> {
        if let Some(cached) = self
            .inner
            .capabilities
            .lock()
            .map_err(|error| format!("Agent runtime capabilities lock poisoned: {error}"))?
            .clone()
        {
            return Ok(cached);
        }

        self.refresh_capabilities()
    }

    pub fn refresh_capabilities(&self) -> Result<AgentRuntimeCapabilities, String> {
        let capabilities = build_capabilities();
        let mut cached = self
            .inner
            .capabilities
            .lock()
            .map_err(|error| format!("Agent runtime capabilities lock poisoned: {error}"))?;
        *cached = Some(capabilities.clone());
        Ok(capabilities)
    }

    pub fn list_sessions(&self) -> Result<Vec<AgentSessionSnapshot>, String> {
        let sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        let mut items: Vec<AgentSessionSnapshot> = sessions.values().cloned().collect();
        items.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        Ok(items)
    }

    pub fn list_session_summaries(&self) -> Result<Vec<AgentSessionSummary>, String> {
        let sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        let mut items: Vec<AgentSessionSummary> =
            sessions.values().map(summarize_session).collect();
        items.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        Ok(items)
    }

    pub fn get_session(&self, session_id: &str) -> Result<Option<AgentSessionSnapshot>, String> {
        let sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        Ok(sessions.get(session_id).cloned())
    }

    pub fn create_session(
        &self,
        app: &AppHandle,
        input: CreateAgentSessionInput,
    ) -> Result<AgentSessionSnapshot, String> {
        if input.workspace_key.trim().is_empty() {
            return Err("workspaceKey is required.".to_string());
        }
        if input.name.trim().is_empty() {
            return Err("name is required.".to_string());
        }
        if input.path.trim().is_empty() {
            return Err("path is required.".to_string());
        }

        let now = now_ms();
        let model = normalize_agent_model(&input.provider, input.model.as_deref());
        let effort = normalize_agent_effort(&input.provider, &model, input.effort.as_deref());
        let snapshot = AgentSessionSnapshot {
            id: format!("agent-{}", Uuid::new_v4()),
            provider: input.provider,
            model,
            effort,
            target_type: input.target_type,
            target_id: input.target_id,
            project_id: input.project_id,
            workspace_owner_id: input.workspace_owner_id,
            workspace_key: input.workspace_key.trim().to_string(),
            session_role: input.session_role.unwrap_or(AgentSessionRole::Default),
            name_mode: input.name_mode.unwrap_or_else(|| {
                if matches!(
                    input.session_role.unwrap_or(AgentSessionRole::Default),
                    AgentSessionRole::ReviewAgent | AgentSessionRole::Manual
                ) {
                    AgentSessionNameMode::Manual
                } else {
                    AgentSessionNameMode::Default
                }
            }),
            name: input.name.trim().to_string(),
            path: input.path.trim().to_string(),
            status: AgentSessionStatus::Idle,
            runtime_status: AgentRuntimeStatus::Idle,
            is_open: true,
            created_at_ms: now,
            updated_at_ms: now,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::new(),
            messages: Vec::new(),
            activities: Vec::new(),
            pending_request: None,
            error_message: None,
        };

        self.persist_snapshot(snapshot.clone())?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(snapshot)
    }

    pub fn stage_attachment(
        &self,
        input: StageAgentAttachmentInput,
    ) -> Result<AgentAttachment, String> {
        let session = self
            .get_session(&input.session_id)?
            .ok_or_else(|| format!("Agent session not found: {}", input.session_id))?;

        let trimmed_name = input.name.trim();
        if trimmed_name.is_empty() {
            return Err("Attachment name is required.".to_string());
        }
        let trimmed_mime_type = input.mime_type.trim();
        if trimmed_mime_type.is_empty() {
            return Err("Attachment mimeType is required.".to_string());
        }
        let attachment_kind = attachment_kind_from_mime_type(trimmed_mime_type)?;

        let bytes = BASE64_STANDARD
            .decode(input.base64_content.trim())
            .map_err(|error| format!("Failed to decode attachment payload: {error}"))?;
        let attachment_id = format!("attachment-{}", Uuid::new_v4());
        let attachment_dir = session_attachment_dir(&session.id);
        fs::create_dir_all(&attachment_dir)
            .map_err(|error| format!("Failed to create agent attachment directory: {error}"))?;

        let attachment_path =
            attachment_dir.join(build_attachment_filename(&attachment_id, trimmed_name));
        fs::write(&attachment_path, bytes.as_slice())
            .map_err(|error| format!("Failed to stage agent attachment: {error}"))?;

        Ok(AgentAttachment {
            id: attachment_id,
            name: trimmed_name.to_string(),
            mime_type: trimmed_mime_type.to_string(),
            size_bytes: bytes.len(),
            kind: attachment_kind,
        })
    }

    pub fn discard_attachment(&self, session_id: &str, attachment_id: &str) -> Result<(), String> {
        let attachment_path = resolve_staged_attachment_path(session_id, attachment_id)?;
        if attachment_path.exists() {
            fs::remove_file(&attachment_path)
                .map_err(|error| format!("Failed to remove staged attachment: {error}"))?;
        }
        Ok(())
    }

    pub fn start_turn(
        &self,
        app: AppHandle,
        input: StartAgentTurnInput,
    ) -> Result<AgentSessionSnapshot, String> {
        let prompt = input.prompt.trim().to_string();
        if prompt.is_empty() {
            return Err("Prompt is required.".to_string());
        }

        let interaction_mode = input
            .interaction_mode
            .unwrap_or(AgentInteractionMode::Default);
        let attachments = input.attachments.unwrap_or_default();
        let turn = AgentTurnInvocation {
            prompt: prompt.clone(),
            attachments: attachments.clone(),
            interaction_mode,
            claude_oauth_token: input.claude_oauth_token.unwrap_or_default(),
            automation_mode: input.automation_mode.unwrap_or(false),
        };
        let session_id = input.session_id;

        let snapshot = self.mutate_session(&session_id, |session| {
            if matches!(session.runtime_status, AgentRuntimeStatus::Running) {
                return Err("This agent session is already running.".to_string());
            }

            let now = now_ms();
            session.status = AgentSessionStatus::Busy;
            session.runtime_status = AgentRuntimeStatus::Running;
            session.updated_at_ms = now;
            session.current_turn_started_at_ms = Some(now);
            session.last_runtime_event_at_ms = Some(now);
            session.runtime_phase = Some("Queued turn".to_string());
            session.runtime_events.clear();
            session.pending_request = None;
            session.error_message = None;
            session.messages.push(AgentMessage {
                id: format!("message-{}", Uuid::new_v4()),
                role: AgentMessageRole::User,
                content: prompt.clone(),
                status: AgentMessageStatus::Done,
                created_at_ms: now,
                interaction_mode: Some(interaction_mode),
                attachments: (!attachments.is_empty()).then_some(attachments.clone()),
            });
            if !matches!(
                session.provider,
                AgentProvider::Codex | AgentProvider::Opencode
            ) {
                session.messages.push(AgentMessage {
                    id: format!("message-{}", Uuid::new_v4()),
                    role: AgentMessageRole::Assistant,
                    content: String::new(),
                    status: AgentMessageStatus::Streaming,
                    created_at_ms: now,
                    interaction_mode: None,
                    attachments: None,
                });
            }
            push_runtime_event(
                session,
                "Queued turn",
                "Prompt accepted and waiting for provider runtime startup.",
                None,
            );
            Ok(())
        })?;
        self.emit_snapshot_update(&app, &snapshot);

        let runtime = self.clone();
        tauri::async_runtime::spawn(async move {
            runtime.clear_session_stopping(&session_id);
            let run_result = runtime.run_turn_process(&app, &session_id, &turn).await;

            if let Err(error) = run_result {
                if !runtime.is_session_stopping(&session_id) {
                    runtime.fail_session(&app, &session_id, &error, None);
                }
            }
            runtime.remove_running_session(&session_id);
            runtime.clear_session_stopping(&session_id);
        });

        Ok(snapshot)
    }

    pub async fn stop_session(&self, app: &AppHandle, session_id: &str) -> Result<(), String> {
        self.mark_session_stopping(session_id);
        self.clear_pending_transport_for_session(session_id);
        if let Some(handle) = self.take_running_session(session_id) {
            self.stop_running_handle(handle).await;
        }

        let snapshot = self.mutate_session(session_id, |session| {
            session.status = AgentSessionStatus::Idle;
            session.runtime_status = AgentRuntimeStatus::Stopped;
            session.updated_at_ms = now_ms();
            session.runtime_phase = Some("Stopped".to_string());
            push_runtime_event(
                session,
                "Stopped",
                "Agent turn was stopped by the user.",
                None,
            );
            session.pending_request = None;
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(())
    }

    pub async fn delete_session(&self, session_id: &str) -> Result<(), String> {
        self.clear_pending_transport_for_session(session_id);
        if let Some(handle) = self.take_running_session(session_id) {
            self.mark_session_stopping(session_id);
            self.stop_running_handle(handle).await;
            self.clear_session_stopping(session_id);
        }
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        if sessions.remove(session_id).is_none() {
            return Err(format!("Agent session not found: {session_id}"));
        }
        self.persist_locked(&sessions)?;
        let attachment_dir = session_attachment_dir(session_id);
        if attachment_dir.exists() {
            let _ = fs::remove_dir_all(attachment_dir);
        }
        Ok(())
    }

    pub fn update_session(
        &self,
        app: &AppHandle,
        input: UpdateAgentSessionInput,
    ) -> Result<AgentSessionSnapshot, String> {
        let has_open_update = input.is_open.is_some();
        let has_model_update = input.model.is_some();
        let has_effort_update = input.effort.is_some();
        let has_name_update = input.name.is_some();
        let has_name_mode_update = input.name_mode.is_some();
        if !has_open_update
            && !has_model_update
            && !has_effort_update
            && !has_name_update
            && !has_name_mode_update
        {
            return self
                .get_session(&input.session_id)?
                .ok_or_else(|| format!("Agent session not found: {}", input.session_id));
        }

        let snapshot = self.mutate_session(&input.session_id, |session| {
            if matches!(
                session.runtime_status,
                AgentRuntimeStatus::Running | AgentRuntimeStatus::Waiting
            ) && (has_model_update || has_effort_update)
            {
                return Err(
                    "Cannot change model or effort while an agent turn is running.".to_string(),
                );
            }

            if let Some(is_open) = input.is_open {
                session.is_open = is_open;
            }

            let next_model = if let Some(model) = input.model.as_deref() {
                normalize_agent_model(&session.provider, Some(model))
            } else {
                session.model.clone()
            };

            if has_model_update {
                session.model = next_model.clone();
            }

            if has_model_update || has_effort_update {
                session.effort = normalize_agent_effort(
                    &session.provider,
                    &next_model,
                    input.effort.as_deref().or(session.effort.as_deref()),
                );
            }

            if let Some(name) = input.name.as_deref() {
                let trimmed_name = name.trim();
                if trimmed_name.is_empty() {
                    return Err("Session name cannot be empty.".to_string());
                }
                session.name = trimmed_name.to_string();
            }

            if let Some(name_mode) = input.name_mode {
                session.name_mode = name_mode;
            }

            session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(snapshot)
    }

    pub fn respond_to_request(
        &self,
        app: &AppHandle,
        input: RespondAgentRequestInput,
    ) -> Result<AgentSessionSnapshot, String> {
        let pending_transport = self
            .take_pending_request_transport(&input.request_id)
            .ok_or_else(|| format!("Pending request not found: {}", input.request_id))?;

        let snapshot = match pending_transport {
            PendingRequestTransport::CodexApproval {
                session_id,
                json_rpc_id,
                decisions,
            } => {
                if session_id != input.session_id {
                    return Err(
                        "Pending approval request does not belong to this session.".to_string()
                    );
                }
                let Some(decision_id) = input.decision.as_deref() else {
                    return Err("decision is required for approval requests.".to_string());
                };
                let decision = decisions
                    .get(decision_id)
                    .cloned()
                    .ok_or_else(|| format!("Unknown approval decision: {decision_id}"))?;
                let writer = self.codex_writer_for_session(&session_id)?;
                send_codex_message(
                    &writer,
                    json!({
                        "id": json_rpc_id,
                        "result": {
                            "decision": decision,
                        },
                    }),
                )?;
                self.resolve_pending_request(app, &session_id)
            }
            PendingRequestTransport::CodexUserInput {
                session_id,
                json_rpc_id,
                question_ids,
            } => {
                if session_id != input.session_id {
                    return Err(
                        "Pending input request does not belong to this session.".to_string()
                    );
                }
                let answers = input.answers.unwrap_or_default();
                if answers.len() != question_ids.len() {
                    return Err(format!(
                        "Expected {} answer(s), received {}.",
                        question_ids.len(),
                        answers.len()
                    ));
                }
                let writer = self.codex_writer_for_session(&session_id)?;
                send_codex_message(
                    &writer,
                    json!({
                        "id": json_rpc_id,
                        "result": codex::build_codex_user_input_response(&question_ids, &answers),
                    }),
                )?;
                self.resolve_pending_request(app, &session_id)
            }
            PendingRequestTransport::OpenCodePermission {
                session_id,
                opencode_session_id,
                permission_id,
                directory,
                base_url,
                decisions,
            } => {
                if session_id != input.session_id {
                    return Err(
                        "Pending approval request does not belong to this session.".to_string()
                    );
                }
                let Some(decision_id) = input.decision.as_deref() else {
                    return Err("decision is required for approval requests.".to_string());
                };
                let decision = decisions
                    .get(decision_id)
                    .cloned()
                    .ok_or_else(|| format!("Unknown approval decision: {decision_id}"))?;
                tauri::async_runtime::block_on(async {
                    opencode::respond_to_opencode_permission(
                        &base_url,
                        &directory,
                        &opencode_session_id,
                        &permission_id,
                        &decision,
                    )
                    .await
                })?;
                self.resolve_pending_request(app, &session_id)
            }
        }?;

        Ok(snapshot)
    }

    pub(crate) async fn run_turn_process(
        &self,
        app: &AppHandle,
        session_id: &str,
        turn: &AgentTurnInvocation,
    ) -> Result<(), String> {
        let Some(session) = self.get_session(session_id)? else {
            return Err(format!("Agent session not found: {session_id}"));
        };

        validate_turn_attachments_for_provider(&session.provider, &turn.attachments)?;

        if matches!(session.provider, AgentProvider::Cursor) && !turn.attachments.is_empty() {
            return Err("Cursor attachments are not supported in Divergence yet.".to_string());
        }

        match session.provider {
            AgentProvider::Claude => {
                self.run_claude_turn_process(app, &session, session_id, turn)
                    .await
            }
            AgentProvider::Codex => {
                self.run_codex_turn_process(app, &session, session_id, turn)
                    .await
            }
            AgentProvider::Cursor => {
                self.run_cursor_turn_process(app, &session, session_id, turn)
                    .await
            }
            AgentProvider::Gemini => {
                self.run_gemini_turn_process(app, &session, session_id, turn)
                    .await
            }
            AgentProvider::Opencode => {
                self.run_opencode_turn_process(app, &session, session_id, turn)
                    .await
            }
        }
    }

    pub(crate) fn fail_session(
        &self,
        app: &AppHandle,
        session_id: &str,
        error_message: &str,
        error_details: Option<String>,
    ) {
        self.clear_pending_transport_for_session(session_id);
        let update_result = self.mutate_session(session_id, |session| {
            apply_session_failure(
                session,
                SessionFailureState {
                    message: error_message,
                    details: error_details.clone(),
                },
            );
            Ok(())
        });

        if let Ok(snapshot) = update_result {
            self.emit_snapshot_update(app, &snapshot);
        }
    }

    pub(crate) fn open_pending_request(
        &self,
        app: &AppHandle,
        session_id: &str,
        request: AgentRequest,
    ) -> Result<AgentSessionSnapshot, String> {
        let snapshot = self.mutate_session(session_id, |session| {
            session.pending_request = Some(request.clone());
            session.runtime_status = AgentRuntimeStatus::Waiting;
            session.updated_at_ms = now_ms();
            push_runtime_event(
                session,
                "Waiting on input",
                &request.title,
                request.description.clone(),
            );
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(snapshot)
    }

    pub(crate) fn resolve_pending_request(
        &self,
        app: &AppHandle,
        session_id: &str,
    ) -> Result<AgentSessionSnapshot, String> {
        let snapshot = self.mutate_session(session_id, |session| {
            session.pending_request = None;
            session.runtime_status = AgentRuntimeStatus::Running;
            session.updated_at_ms = now_ms();
            push_runtime_event(
                session,
                "Resumed turn",
                "Pending request resolved. Provider runtime resumed.",
                None,
            );
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(snapshot)
    }

    pub(crate) fn emit_runtime_event(
        &self,
        app: &AppHandle,
        session_id: &str,
        phase: &str,
        message: &str,
        details: Option<String>,
    ) -> Result<AgentSessionSnapshot, String> {
        let snapshot = self.mutate_session(session_id, |session| {
            push_runtime_event(session, phase, message, details);
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(snapshot)
    }

    pub(crate) fn register_running_session(
        &self,
        session_id: &str,
        handle: RunningSessionHandle,
    ) -> Result<(), String> {
        let mut running_sessions = self
            .inner
            .running_sessions
            .lock()
            .map_err(|error| format!("Running session lock poisoned: {error}"))?;
        running_sessions.insert(session_id.to_string(), handle);
        Ok(())
    }

    pub(crate) fn remove_running_session(&self, session_id: &str) {
        if let Ok(mut running_sessions) = self.inner.running_sessions.lock() {
            running_sessions.remove(session_id);
        }
    }

    pub(crate) fn take_running_session(&self, session_id: &str) -> Option<RunningSessionHandle> {
        self.inner
            .running_sessions
            .lock()
            .ok()
            .and_then(|mut running_sessions| running_sessions.remove(session_id))
    }

    pub(crate) async fn stop_running_handle(&self, handle: RunningSessionHandle) {
        let mut child = handle.child.lock().await;
        let _ = child.kill().await;
    }

    pub(crate) fn store_pending_request_transport(
        &self,
        request_id: &str,
        transport: PendingRequestTransport,
    ) -> Result<(), String> {
        let mut pending_requests = self
            .inner
            .pending_requests
            .lock()
            .map_err(|error| format!("Pending request lock poisoned: {error}"))?;
        pending_requests.insert(request_id.to_string(), transport);
        Ok(())
    }

    pub(crate) fn take_pending_request_transport(&self, request_id: &str) -> Option<PendingRequestTransport> {
        self.inner
            .pending_requests
            .lock()
            .ok()
            .and_then(|mut pending_requests| pending_requests.remove(request_id))
    }

    pub(crate) fn session_has_pending_request(&self, session_id: &str) -> Result<bool, String> {
        let sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        Ok(sessions
            .get(session_id)
            .and_then(|session| session.pending_request.as_ref())
            .is_some())
    }

    pub(crate) async fn wait_for_pending_request_resolution(&self, session_id: &str) -> Result<(), String> {
        while self.session_has_pending_request(session_id)? {
            if self.is_session_stopping(session_id) {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        Ok(())
    }

    pub(crate) fn clear_pending_transport_for_session(&self, session_id: &str) {
        if let Ok(mut pending_requests) = self.inner.pending_requests.lock() {
            pending_requests.retain(|_, transport| match transport {
                PendingRequestTransport::CodexApproval {
                    session_id: pending_session_id,
                    ..
                }
                | PendingRequestTransport::CodexUserInput {
                    session_id: pending_session_id,
                    ..
                }
                | PendingRequestTransport::OpenCodePermission {
                    session_id: pending_session_id,
                    ..
                } => pending_session_id != session_id,
            });
        }
    }

    pub(crate) fn codex_writer_for_session(
        &self,
        session_id: &str,
    ) -> Result<mpsc::UnboundedSender<String>, String> {
        let running_sessions = self
            .inner
            .running_sessions
            .lock()
            .map_err(|error| format!("Running session lock poisoned: {error}"))?;
        let Some(handle) = running_sessions.get(session_id) else {
            return Err(format!("No running session found for {session_id}."));
        };
        match &handle.transport {
            RunningTransport::CodexAppServer { writer } => Ok(writer.clone()),
            RunningTransport::Claude
            | RunningTransport::Cursor
            | RunningTransport::Gemini
            | RunningTransport::OpenCodeServer => {
                Err("This pending request is not backed by Codex App Server.".to_string())
            }
        }
    }

    pub(crate) fn mark_session_stopping(&self, session_id: &str) {
        if let Ok(mut stopping_sessions) = self.inner.stopping_sessions.lock() {
            stopping_sessions.insert(session_id.to_string());
        }
    }

    pub(crate) fn clear_session_stopping(&self, session_id: &str) {
        if let Ok(mut stopping_sessions) = self.inner.stopping_sessions.lock() {
            stopping_sessions.remove(session_id);
        }
    }

    pub(crate) fn is_session_stopping(&self, session_id: &str) -> bool {
        self.inner
            .stopping_sessions
            .lock()
            .map(|stopping_sessions| stopping_sessions.contains(session_id))
            .unwrap_or(false)
    }

    pub(crate) fn mutate_session<F>(
        &self,
        session_id: &str,
        mutator: F,
    ) -> Result<AgentSessionSnapshot, String>
    where
        F: FnOnce(&mut AgentSessionSnapshot) -> Result<(), String>,
    {
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        let session = sessions
            .get_mut(session_id)
            .ok_or_else(|| format!("Agent session not found: {session_id}"))?;
        mutator(session)?;
        let snapshot = session.clone();
        self.persist_locked(&sessions)?;
        Ok(snapshot)
    }

    pub(crate) fn persist_snapshot(&self, snapshot: AgentSessionSnapshot) -> Result<(), String> {
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        sessions.insert(snapshot.id.clone(), snapshot);
        self.persist_locked(&sessions)
    }

    pub(crate) fn persist_locked(
        &self,
        sessions: &HashMap<String, AgentSessionSnapshot>,
    ) -> Result<(), String> {
        let parent = self
            .inner
            .persistence_path
            .parent()
            .ok_or_else(|| "Agent runtime persistence path had no parent.".to_string())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("Failed to create agent runtime directory: {error}"))?;

        let mut items: Vec<AgentSessionSnapshot> = sessions.values().cloned().collect();
        items.sort_by(|left, right| right.updated_at_ms.cmp(&left.updated_at_ms));
        let encoded = serde_json::to_string_pretty(&items)
            .map_err(|error| format!("Failed to encode agent runtime snapshots: {error}"))?;
        fs::write(&self.inner.persistence_path, encoded)
            .map_err(|error| format!("Failed to persist agent runtime snapshots: {error}"))?;
        Ok(())
    }

    pub(crate) fn emit_snapshot_update(&self, app: &AppHandle, snapshot: &AgentSessionSnapshot) {
        let _ = app.emit(
            SESSION_UPDATED_EVENT_NAME,
            AgentRuntimeSessionUpdatedEvent {
                session_id: snapshot.id.clone(),
                snapshot: snapshot.clone(),
            },
        );
    }
}
