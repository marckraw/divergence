mod claude;
mod codex;
mod cursor;
mod gemini;
mod provider_registry;

use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
use self::codex::send_codex_message;
use self::provider_registry::{
    default_model_for_provider, normalize_agent_model, provider_descriptors,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command as StdCommand, Stdio};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tokio::sync::{mpsc, oneshot, Mutex as AsyncMutex};
use tokio::time::{timeout, Duration};
use uuid::Uuid;

const SESSION_UPDATED_EVENT_NAME: &str = "agent-runtime-session-updated";
const MAX_ACTIVITY_DETAILS_LENGTH: usize = 16_000;
const MAX_RUNTIME_EVENTS: usize = 48;
const DEFAULT_CLAUDE_MODEL: &str = "sonnet";
const DEFAULT_CODEX_MODEL: &str = "gpt-5.4";
const DEFAULT_CURSOR_MODEL: &str = "auto";
const DEFAULT_GEMINI_MODEL: &str = "gemini-2.5-pro";

type PendingResponseSender = oneshot::Sender<Result<Value, String>>;
type PendingResponseRegistry = Arc<Mutex<HashMap<String, PendingResponseSender>>>;
type TurnCompletionSender = oneshot::Sender<Result<(), String>>;
type TurnCompletionSignal = Arc<Mutex<Option<TurnCompletionSender>>>;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeCapabilities {
    pub placeholder_sessions_supported: bool,
    pub live_streaming_supported: bool,
    pub persistent_snapshots_supported: bool,
    pub providers: Vec<AgentRuntimeProviderDescriptor>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeProviderDescriptor {
    pub id: String,
    pub label: String,
    pub transport: AgentRuntimeProviderTransport,
    pub default_model: String,
    pub model_options: Vec<AgentRuntimeModelOption>,
    pub readiness: AgentRuntimeProviderReadiness,
    pub features: AgentRuntimeProviderFeatures,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum AgentRuntimeProviderTransport {
    CliHeadless,
    AppServer,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeProviderReadiness {
    pub status: AgentRuntimeProviderReadinessStatus,
    pub summary: String,
    pub details: Vec<String>,
    pub binary_candidates: Vec<String>,
    pub detected_command: Option<String>,
    pub auth_status: AgentRuntimeProviderAuthStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentRuntimeProviderReadinessStatus {
    Ready,
    Partial,
    SetupRequired,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentRuntimeProviderAuthStatus {
    Authenticated,
    Missing,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeProviderFeatures {
    pub streaming: bool,
    pub resume: bool,
    pub structured_requests: bool,
    pub plan_mode: bool,
    pub image_attachments: bool,
    pub structured_plan_ui: bool,
    pub usage_inspection: bool,
    pub provider_extras: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeModelOption {
    pub slug: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentProvider {
    Claude,
    Codex,
    Cursor,
    Gemini,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentTargetType {
    Project,
    Divergence,
    Workspace,
    WorkspaceDivergence,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentSessionRole {
    Default,
    ReviewAgent,
    Manual,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AgentSessionNameMode {
    Default,
    Auto,
    Manual,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentSessionStatus {
    Idle,
    Active,
    Busy,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentRuntimeStatus {
    Idle,
    Running,
    Waiting,
    Error,
    Stopped,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentInteractionMode {
    Default,
    Plan,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentMessageRole {
    User,
    Assistant,
    System,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentMessageStatus {
    Streaming,
    Done,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAttachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentMessage {
    pub id: String,
    pub role: AgentMessageRole,
    pub content: String,
    pub status: AgentMessageStatus,
    pub created_at_ms: i64,
    #[serde(default)]
    pub interaction_mode: Option<AgentInteractionMode>,
    #[serde(default)]
    pub attachments: Option<Vec<AgentAttachment>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AgentActivityStatus {
    Running,
    Completed,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentActivity {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub status: AgentActivityStatus,
    pub details: Option<String>,
    pub started_at_ms: i64,
    pub completed_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeDebugEvent {
    pub id: String,
    pub at_ms: i64,
    pub phase: String,
    pub message: String,
    #[serde(default)]
    pub details: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequestOption {
    pub id: String,
    pub label: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequestQuestion {
    pub id: String,
    pub header: String,
    pub question: String,
    pub is_other: bool,
    pub is_secret: bool,
    pub options: Option<Vec<AgentRequestOption>>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum AgentRequestKind {
    Approval,
    UserInput,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentRequestStatus {
    Open,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRequest {
    pub id: String,
    pub kind: AgentRequestKind,
    pub title: String,
    pub description: Option<String>,
    #[serde(default)]
    pub options: Option<Vec<AgentRequestOption>>,
    #[serde(default)]
    pub questions: Option<Vec<AgentRequestQuestion>>,
    pub status: AgentRequestStatus,
    pub opened_at_ms: i64,
    pub resolved_at_ms: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSnapshot {
    pub id: String,
    pub provider: AgentProvider,
    #[serde(default)]
    pub model: String,
    pub target_type: AgentTargetType,
    pub target_id: i64,
    pub project_id: i64,
    pub workspace_owner_id: Option<i64>,
    pub workspace_key: String,
    pub session_role: AgentSessionRole,
    #[serde(default = "default_agent_session_name_mode")]
    pub name_mode: AgentSessionNameMode,
    pub name: String,
    pub path: String,
    pub status: AgentSessionStatus,
    pub runtime_status: AgentRuntimeStatus,
    #[serde(default = "default_true")]
    pub is_open: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub thread_id: Option<String>,
    #[serde(default)]
    pub current_turn_started_at_ms: Option<i64>,
    #[serde(default)]
    pub last_runtime_event_at_ms: Option<i64>,
    #[serde(default)]
    pub runtime_phase: Option<String>,
    #[serde(default)]
    pub runtime_events: Vec<AgentRuntimeDebugEvent>,
    pub messages: Vec<AgentMessage>,
    pub activities: Vec<AgentActivity>,
    pub pending_request: Option<AgentRequest>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateAgentSessionInput {
    pub provider: AgentProvider,
    pub target_type: AgentTargetType,
    pub target_id: i64,
    pub project_id: i64,
    pub workspace_owner_id: Option<i64>,
    pub workspace_key: String,
    pub session_role: Option<AgentSessionRole>,
    pub name_mode: Option<AgentSessionNameMode>,
    pub model: Option<String>,
    pub name: String,
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StartAgentTurnInput {
    pub session_id: String,
    pub prompt: String,
    pub interaction_mode: Option<AgentInteractionMode>,
    #[serde(default)]
    pub attachments: Option<Vec<AgentAttachment>>,
    pub claude_oauth_token: Option<String>,
    pub automation_mode: Option<bool>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StageAgentAttachmentInput {
    pub session_id: String,
    pub name: String,
    pub mime_type: String,
    pub base64_content: String,
}

#[derive(Debug, Clone)]
pub(super) struct AgentTurnInvocation {
    pub prompt: String,
    pub attachments: Vec<AgentAttachment>,
    pub interaction_mode: AgentInteractionMode,
    pub claude_oauth_token: String,
    pub automation_mode: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RespondAgentRequestInput {
    pub session_id: String,
    pub request_id: String,
    pub decision: Option<String>,
    pub answers: Option<Vec<String>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAgentSessionInput {
    pub session_id: String,
    pub is_open: Option<bool>,
    pub model: Option<String>,
    pub name: Option<String>,
    pub name_mode: Option<AgentSessionNameMode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeSessionUpdatedEvent {
    pub session_id: String,
    pub snapshot: AgentSessionSnapshot,
}

#[derive(Clone)]
enum RunningTransport {
    Claude,
    Cursor,
    Gemini,
    CodexAppServer {
        writer: mpsc::UnboundedSender<String>,
    },
}

#[derive(Clone)]
struct RunningSessionHandle {
    child: Arc<AsyncMutex<tokio::process::Child>>,
    transport: RunningTransport,
}

#[derive(Clone)]
enum PendingRequestTransport {
    CodexApproval {
        session_id: String,
        json_rpc_id: Value,
        decisions: HashMap<String, Value>,
    },
    CodexUserInput {
        session_id: String,
        json_rpc_id: Value,
        question_count: usize,
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
        let snapshot = AgentSessionSnapshot {
            id: format!("agent-{}", Uuid::new_v4()),
            provider: input.provider,
            model,
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

        let interaction_mode = input.interaction_mode.unwrap_or(AgentInteractionMode::Default);
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
            if !matches!(session.provider, AgentProvider::Codex) {
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
            let run_result = runtime
                .run_turn_process(
                    &app,
                    &session_id,
                    &turn,
                )
                .await;

            if let Err(error) = run_result {
                if !runtime.is_session_stopping(&session_id) {
                    runtime.fail_session(&app, &session_id, &error);
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
        let has_name_update = input.name.is_some();
        let has_name_mode_update = input.name_mode.is_some();
        if !has_open_update && !has_model_update && !has_name_update && !has_name_mode_update {
            return self
                .get_session(&input.session_id)?
                .ok_or_else(|| format!("Agent session not found: {}", input.session_id));
        }

        let snapshot = self.mutate_session(&input.session_id, |session| {
            if matches!(session.runtime_status, AgentRuntimeStatus::Running | AgentRuntimeStatus::Waiting)
                && has_model_update
            {
                return Err("Cannot change the model while an agent turn is running.".to_string());
            }

            if let Some(is_open) = input.is_open {
                session.is_open = is_open;
            }

            if let Some(model) = input.model.as_deref() {
                session.model = normalize_agent_model(&session.provider, Some(model));
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
                    return Err("Pending approval request does not belong to this session.".to_string());
                }
                let Some(decision_id) = input.decision.as_deref() else {
                    return Err("decision is required for approval requests.".to_string());
                };
                let decision = decisions
                    .get(decision_id)
                    .cloned()
                    .ok_or_else(|| format!("Unknown approval decision: {decision_id}"))?;
                let writer = self.codex_writer_for_session(&session_id)?;
                send_codex_message(&writer, json!({
                    "id": json_rpc_id,
                    "result": {
                        "decision": decision,
                    },
                }))?;
                self.resolve_pending_request(app, &session_id)
            }
            PendingRequestTransport::CodexUserInput {
                session_id,
                json_rpc_id,
                question_count,
            } => {
                if session_id != input.session_id {
                    return Err("Pending input request does not belong to this session.".to_string());
                }
                let answers = input.answers.unwrap_or_default();
                if answers.len() != question_count {
                    return Err(format!(
                        "Expected {question_count} answer(s), received {}.",
                        answers.len()
                    ));
                }
                let writer = self.codex_writer_for_session(&session_id)?;
                send_codex_message(&writer, json!({
                    "id": json_rpc_id,
                    "result": {
                        "answers": answers,
                    },
                }))?;
                self.resolve_pending_request(app, &session_id)
            }
        }?;

        Ok(snapshot)
    }

    async fn run_turn_process(
        &self,
        app: &AppHandle,
        session_id: &str,
        turn: &AgentTurnInvocation,
    ) -> Result<(), String> {
        let Some(session) = self.get_session(session_id)? else {
            return Err(format!("Agent session not found: {session_id}"));
        };

        if matches!(session.provider, AgentProvider::Cursor) && !turn.attachments.is_empty() {
            return Err(
                "Cursor image attachments are not supported in Divergence yet.".to_string(),
            );
        }

        match session.provider {
            AgentProvider::Claude => {
                self.run_claude_turn_process(
                    app,
                    &session,
                    session_id,
                    turn,
                )
                .await
            }
            AgentProvider::Codex => {
                self.run_codex_turn_process(
                    app,
                    &session,
                    session_id,
                    turn,
                )
                .await
            }
            AgentProvider::Cursor => {
                self.run_cursor_turn_process(app, &session, session_id, turn)
                    .await
            }
            AgentProvider::Gemini => {
                self.run_gemini_turn_process(
                    app,
                    &session,
                    session_id,
                    turn,
                )
                .await
            }
        }
    }

    fn fail_session(&self, app: &AppHandle, session_id: &str, error_message: &str) {
        self.clear_pending_transport_for_session(session_id);
        let update_result = self.mutate_session(session_id, |session| {
            if let Some(message) = last_assistant_message_mut(session) {
                message.status = AgentMessageStatus::Error;
                if message.content.trim().is_empty() {
                    message.content = error_message.to_string();
                }
            }
            session.status = AgentSessionStatus::Idle;
            session.runtime_status = AgentRuntimeStatus::Error;
            session.updated_at_ms = now_ms();
            session.runtime_phase = Some("Errored".to_string());
            push_runtime_event(
                session,
                "Errored",
                error_message,
                None,
            );
            session.pending_request = None;
            session.error_message = Some(error_message.to_string());
            Ok(())
        });

        if let Ok(snapshot) = update_result {
            self.emit_snapshot_update(app, &snapshot);
        }
    }

    fn open_pending_request(
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

    fn resolve_pending_request(
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

    fn emit_runtime_event(
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

    fn register_running_session(
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

    fn remove_running_session(&self, session_id: &str) {
        if let Ok(mut running_sessions) = self.inner.running_sessions.lock() {
            running_sessions.remove(session_id);
        }
    }

    fn take_running_session(&self, session_id: &str) -> Option<RunningSessionHandle> {
        self.inner
            .running_sessions
            .lock()
            .ok()
            .and_then(|mut running_sessions| running_sessions.remove(session_id))
    }

    async fn stop_running_handle(&self, handle: RunningSessionHandle) {
        let mut child = handle.child.lock().await;
        let _ = child.kill().await;
    }

    fn store_pending_request_transport(
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

    fn take_pending_request_transport(&self, request_id: &str) -> Option<PendingRequestTransport> {
        self.inner
            .pending_requests
            .lock()
            .ok()
            .and_then(|mut pending_requests| pending_requests.remove(request_id))
    }

    fn clear_pending_transport_for_session(&self, session_id: &str) {
        if let Ok(mut pending_requests) = self.inner.pending_requests.lock() {
            pending_requests.retain(|_, transport| match transport {
                PendingRequestTransport::CodexApproval { session_id: pending_session_id, .. }
                | PendingRequestTransport::CodexUserInput { session_id: pending_session_id, .. } => {
                    pending_session_id != session_id
                }
            });
        }
    }

    fn codex_writer_for_session(
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
            RunningTransport::Claude | RunningTransport::Cursor | RunningTransport::Gemini => {
                Err("This pending request is not backed by Codex App Server.".to_string())
            }
        }
    }

    fn mark_session_stopping(&self, session_id: &str) {
        if let Ok(mut stopping_sessions) = self.inner.stopping_sessions.lock() {
            stopping_sessions.insert(session_id.to_string());
        }
    }

    fn clear_session_stopping(&self, session_id: &str) {
        if let Ok(mut stopping_sessions) = self.inner.stopping_sessions.lock() {
            stopping_sessions.remove(session_id);
        }
    }

    fn is_session_stopping(&self, session_id: &str) -> bool {
        self.inner
            .stopping_sessions
            .lock()
            .map(|stopping_sessions| stopping_sessions.contains(session_id))
            .unwrap_or(false)
    }

    fn mutate_session<F>(&self, session_id: &str, mutator: F) -> Result<AgentSessionSnapshot, String>
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

    fn persist_snapshot(&self, snapshot: AgentSessionSnapshot) -> Result<(), String> {
        let mut sessions = self
            .inner
            .sessions
            .lock()
            .map_err(|error| format!("Agent runtime lock poisoned: {error}"))?;
        sessions.insert(snapshot.id.clone(), snapshot);
        self.persist_locked(&sessions)
    }

    fn persist_locked(
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

    fn emit_snapshot_update(&self, app: &AppHandle, snapshot: &AgentSessionSnapshot) {
        let _ = app.emit(
            SESSION_UPDATED_EVENT_NAME,
            AgentRuntimeSessionUpdatedEvent {
                session_id: snapshot.id.clone(),
                snapshot: snapshot.clone(),
            },
        );
    }
}

fn build_capabilities() -> AgentRuntimeCapabilities {
    AgentRuntimeCapabilities {
        placeholder_sessions_supported: false,
        live_streaming_supported: true,
        persistent_snapshots_supported: true,
        providers: provider_descriptors(),
    }
}

fn default_persistence_path() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("divergence").join("agent-runtime").join("sessions.json")
}

fn default_attachment_base_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("divergence").join("agent-runtime").join("attachments")
}

fn session_attachment_dir(session_id: &str) -> PathBuf {
    default_attachment_base_dir().join(session_id)
}

fn sanitize_attachment_name(name: &str) -> String {
    let trimmed = name.trim();
    let mut sanitized = trimmed
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while sanitized.contains("--") {
        sanitized = sanitized.replace("--", "-");
    }
    sanitized.trim_matches('-').to_string()
}

fn build_attachment_filename(attachment_id: &str, name: &str) -> String {
    let sanitized_name = sanitize_attachment_name(name);
    if sanitized_name.is_empty() {
        attachment_id.to_string()
    } else {
        format!("{attachment_id}-{sanitized_name}")
    }
}

fn resolve_staged_attachment_path(session_id: &str, attachment_id: &str) -> Result<PathBuf, String> {
    let attachment_dir = session_attachment_dir(session_id);
    let entries = fs::read_dir(&attachment_dir)
        .map_err(|error| format!("Failed to read staged attachments for session {session_id}: {error}"))?;
    for entry in entries {
        let entry = entry.map_err(|error| format!("Failed to inspect staged attachment: {error}"))?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if file_name.starts_with(attachment_id) {
            return Ok(path);
        }
    }
    Err(format!(
        "Staged attachment not found for session {session_id}: {attachment_id}"
    ))
}

fn default_true() -> bool {
    true
}

fn default_agent_session_name_mode() -> AgentSessionNameMode {
    AgentSessionNameMode::Default
}

fn load_persisted_sessions(path: &Path) -> HashMap<String, AgentSessionSnapshot> {
    let Ok(raw) = fs::read_to_string(path) else {
        return HashMap::new();
    };

    let Ok(items) = serde_json::from_str::<Vec<AgentSessionSnapshot>>(&raw) else {
        return HashMap::new();
    };

    items
        .into_iter()
        .map(normalize_persisted_session)
        .map(|item| (item.id.clone(), item))
        .collect()
}

fn normalize_persisted_session(mut session: AgentSessionSnapshot) -> AgentSessionSnapshot {
    if session.model.trim().is_empty() {
        session.model = default_model_for_provider(&session.provider).to_string();
    }
    if matches!(session.session_role, AgentSessionRole::ReviewAgent | AgentSessionRole::Manual)
        && !matches!(session.name_mode, AgentSessionNameMode::Manual)
    {
        session.name_mode = AgentSessionNameMode::Manual;
    }
    if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
        let keep_from = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
        session.runtime_events = session.runtime_events.split_off(keep_from);
    }
    if matches!(
        session.runtime_status,
        AgentRuntimeStatus::Running | AgentRuntimeStatus::Waiting
    ) {
        session.status = AgentSessionStatus::Idle;
        session.runtime_status = AgentRuntimeStatus::Stopped;
        session.pending_request = None;
        session.runtime_phase = Some("Interrupted".to_string());
        if session.error_message.is_none() {
            session.error_message = Some("Agent runtime was interrupted when Divergence closed.".to_string());
        }
        if session.current_turn_started_at_ms.is_some() {
            let at_ms = session
                .last_runtime_event_at_ms
                .unwrap_or(session.updated_at_ms);
            session.last_runtime_event_at_ms = Some(at_ms);
            session.runtime_events.push(AgentRuntimeDebugEvent {
                id: format!("runtime-event-{}", Uuid::new_v4()),
                at_ms,
                phase: "Interrupted".to_string(),
                message: "Agent runtime was interrupted when Divergence closed.".to_string(),
                details: None,
            });
            if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
                let overflow = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
                session.runtime_events.drain(0..overflow);
            }
        }
    }
    session
}

fn push_runtime_event(
    session: &mut AgentSessionSnapshot,
    phase: &str,
    message: &str,
    details: Option<String>,
) {
    let at_ms = now_ms();
    session.runtime_phase = Some(phase.to_string());
    session.last_runtime_event_at_ms = Some(at_ms);
    session.updated_at_ms = at_ms;
    if let Some(last_event) = session.runtime_events.last_mut() {
        if last_event.phase == phase && last_event.message == message {
            last_event.at_ms = at_ms;
            if details.is_some() {
                last_event.details = details;
            }
            return;
        }
    }
    session.runtime_events.push(AgentRuntimeDebugEvent {
        id: format!("runtime-event-{}", Uuid::new_v4()),
        at_ms,
        phase: phase.to_string(),
        message: message.to_string(),
        details,
    });
    if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
        let overflow = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
        session.runtime_events.drain(0..overflow);
    }
}

fn read_provider_thread_id(value: &Value) -> Option<String> {
    value
        .get("session_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| value.get("chat_id").and_then(Value::as_str).map(str::to_string))
        .or_else(|| value.get("chatId").and_then(Value::as_str).map(str::to_string))
        .or_else(|| value.get("conversation_id").and_then(Value::as_str).map(str::to_string))
}

fn read_provider_content_text(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.to_string()),
        Value::Object(map) => map
            .get("text")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| map.get("content").and_then(read_provider_content_text)),
        Value::Array(items) => {
            let text_parts: Vec<String> = items
                .iter()
                .filter_map(read_provider_content_text)
                .filter(|item| !item.is_empty())
                .collect();
            (!text_parts.is_empty()).then(|| text_parts.join(""))
        }
        _ => None,
    }
}

fn read_provider_text_delta(value: &Value) -> Option<String> {
    value
        .get("text")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| value.get("content").and_then(read_provider_content_text))
        .or_else(|| {
            value
                .get("delta")
                .and_then(|delta| delta.get("text"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("message")
                .and_then(|message| message.get("content"))
                .and_then(read_provider_content_text)
        })
}

fn read_provider_activity_id(value: &Value) -> Option<String> {
    value
        .get("tool_call_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| value.get("toolCallId").and_then(Value::as_str).map(str::to_string))
        .or_else(|| value.get("id").and_then(Value::as_str).map(str::to_string))
}

fn read_provider_activity_title(value: &Value) -> Option<String> {
    value
        .get("tool_name")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| value.get("toolName").and_then(Value::as_str).map(str::to_string))
        .or_else(|| value.get("name").and_then(Value::as_str).map(str::to_string))
}

fn last_assistant_message_mut(
    session: &mut AgentSessionSnapshot,
) -> Option<&mut AgentMessage> {
    let index = last_assistant_message_index(session)?;
    session.messages.get_mut(index)
}

fn assistant_message_mut<'a>(
    session: &'a mut AgentSessionSnapshot,
    item_id: Option<&str>,
) -> Option<&'a mut AgentMessage> {
    if let Some(item_id) = item_id {
        if let Some(index) = session
            .messages
            .iter()
            .position(|message| {
                matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
            })
        {
            return session.messages.get_mut(index);
        }
    }

    last_assistant_message_mut(session)
}

fn ensure_assistant_message<'a>(
    session: &'a mut AgentSessionSnapshot,
    item_id: Option<&str>,
) -> &'a mut AgentMessage {
    if let Some(item_id) = item_id {
        if let Some(index) = session
            .messages
            .iter()
            .position(|message| {
                matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
            })
        {
            return session
                .messages
                .get_mut(index)
                .expect("assistant message index should be valid");
        }

        session.messages.push(AgentMessage {
            id: item_id.to_string(),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
        let last_index = session.messages.len().saturating_sub(1);
        return session
            .messages
            .get_mut(last_index)
            .expect("assistant message should exist after push");
    }

    if last_assistant_message_index(session).is_none() {
        session.messages.push(AgentMessage {
            id: format!("message-{}", Uuid::new_v4()),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
    }

    let last_index = last_assistant_message_index(session)
        .expect("assistant message should exist after initialization");
    let should_split_existing_message = session
        .messages
        .get(last_index)
        .map(|message| has_activity_after_assistant_message(session, message))
        .unwrap_or(false);

    if should_split_existing_message {
        let existing_message = session
            .messages
            .get_mut(last_index)
            .expect("assistant message index should be valid");
        if existing_message.content.trim().is_empty() {
            existing_message.created_at_ms = now_ms();
            existing_message.status = AgentMessageStatus::Streaming;
            return session
                .messages
                .get_mut(last_index)
                .expect("assistant message index should stay valid");
        }

        if matches!(existing_message.status, AgentMessageStatus::Streaming) {
            existing_message.status = AgentMessageStatus::Done;
        }

        session.messages.push(AgentMessage {
            id: format!("message-{}", Uuid::new_v4()),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
    }

    last_assistant_message_mut(session).expect("assistant message should exist")
}

fn append_assistant_text(session: &mut AgentSessionSnapshot, item_id: Option<&str>, text: &str) {
    let message = ensure_assistant_message(session, item_id);
    if !matches!(message.status, AgentMessageStatus::Streaming) {
        message.status = AgentMessageStatus::Streaming;
    }
    message.content.push_str(text);
}

fn append_assistant_paragraph(session: &mut AgentSessionSnapshot, item_id: Option<&str>, text: &str) {
    let message = ensure_assistant_message(session, item_id);
    if !matches!(message.status, AgentMessageStatus::Streaming) {
        message.status = AgentMessageStatus::Streaming;
    }
    if !message.content.trim().is_empty() {
        message.content.push_str("\n\n");
    }
    message.content.push_str(text.trim());
}

fn assistant_message_text<'a>(session: &'a AgentSessionSnapshot, item_id: Option<&str>) -> &'a str {
    if let Some(item_id) = item_id {
        if let Some(message) = session
            .messages
            .iter()
            .find(|message| {
                matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
            })
        {
            return message.content.as_str();
        }
    }

    last_assistant_message_text(session)
}

fn last_assistant_message_text(session: &AgentSessionSnapshot) -> &str {
    session
        .messages
        .iter()
        .rev()
        .find(|message| matches!(message.role, AgentMessageRole::Assistant))
        .map(|message| message.content.as_str())
        .unwrap_or("")
}

fn last_assistant_message_index(session: &AgentSessionSnapshot) -> Option<usize> {
    session
        .messages
        .iter()
        .enumerate()
        .rev()
        .find(|(_, message)| matches!(message.role, AgentMessageRole::Assistant))
        .map(|(index, _)| index)
}

fn has_activity_after_assistant_message(
    session: &AgentSessionSnapshot,
    message: &AgentMessage,
) -> bool {
    session.activities.iter().any(|activity| {
        activity.started_at_ms > message.created_at_ms
            || activity
                .completed_at_ms
                .map(|completed_at_ms| completed_at_ms > message.created_at_ms)
                .unwrap_or(false)
    })
}

fn complete_activity(
    session: &mut AgentSessionSnapshot,
    activity_id: &str,
    details: Option<String>,
    status: AgentActivityStatus,
) {
    let completed_at_ms = now_ms();
    if let Some(activity) = session.activities.iter_mut().find(|item| item.id == activity_id) {
        activity.status = status;
        activity.completed_at_ms = Some(completed_at_ms);
        if let Some(details) = details {
            activity.details = Some(details);
        }
        return;
    }

    session.activities.push(AgentActivity {
        id: activity_id.to_string(),
        kind: "tool".to_string(),
        title: activity_id.to_string(),
        status,
        details,
        started_at_ms: completed_at_ms,
        completed_at_ms: Some(completed_at_ms),
    });
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn truncate_details(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.chars().count() <= MAX_ACTIVITY_DETAILS_LENGTH {
        return trimmed.to_string();
    }

    let truncated: String = trimmed.chars().take(MAX_ACTIVITY_DETAILS_LENGTH).collect();
    format!("{truncated}\n...[truncated]")
}

fn truncate_json_details(input: &Value) -> String {
    truncate_details(&input.to_string())
}
