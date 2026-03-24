mod claude;
mod codex;
mod cursor;
mod gemini;
mod provider_registry;
pub mod skills;

use self::codex::send_codex_message;
use self::provider_registry::{
    default_effort_for_provider_model, default_model_for_provider, normalize_agent_effort,
    normalize_agent_model, provider_descriptors,
};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine as _};
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

#[derive(Debug, Clone)]
struct SessionFailureState<'a> {
    message: &'a str,
    details: Option<String>,
}

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
    pub detected_version: Option<String>,
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
    pub attachment_kinds: Vec<AgentAttachmentKind>,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentMessageStatus {
    Streaming,
    Done,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentConversationContextStatus {
    Available,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentConversationContextSource {
    Codex,
    Unavailable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConversationContext {
    pub status: AgentConversationContextStatus,
    pub label: String,
    #[serde(default)]
    pub fraction_used: Option<f64>,
    #[serde(default)]
    pub fraction_remaining: Option<f64>,
    #[serde(default)]
    pub detail: Option<String>,
    pub source: AgentConversationContextSource,
}

#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentAttachmentKind {
    #[default]
    Image,
    Pdf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentAttachment {
    pub id: String,
    pub name: String,
    pub mime_type: String,
    pub size_bytes: usize,
    #[serde(default)]
    pub kind: AgentAttachmentKind,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub subject: Option<String>,
    #[serde(default)]
    pub group_key: Option<String>,
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
    #[serde(default)]
    pub effort: Option<String>,
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
    pub conversation_context: Option<AgentConversationContext>,
    #[serde(default)]
    pub runtime_events: Vec<AgentRuntimeDebugEvent>,
    pub messages: Vec<AgentMessage>,
    pub activities: Vec<AgentActivity>,
    pub pending_request: Option<AgentRequest>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentSessionSummary {
    pub id: String,
    pub provider: AgentProvider,
    pub model: String,
    pub effort: Option<String>,
    pub target_type: AgentTargetType,
    pub target_id: i64,
    pub project_id: i64,
    pub workspace_owner_id: Option<i64>,
    pub workspace_key: String,
    pub session_role: AgentSessionRole,
    pub name_mode: AgentSessionNameMode,
    pub name: String,
    pub path: String,
    pub status: AgentSessionStatus,
    pub runtime_status: AgentRuntimeStatus,
    pub is_open: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
    pub thread_id: Option<String>,
    pub current_turn_started_at_ms: Option<i64>,
    pub last_runtime_event_at_ms: Option<i64>,
    pub runtime_phase: Option<String>,
    pub pending_request: Option<AgentRequest>,
    pub error_message: Option<String>,
    pub latest_assistant_message_interaction_mode: Option<AgentInteractionMode>,
    pub latest_assistant_message_status: Option<AgentMessageStatus>,
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
    pub effort: Option<String>,
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
    pub effort: Option<String>,
    pub name: Option<String>,
    pub name_mode: Option<AgentSessionNameMode>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentRuntimeSessionUpdatedEvent {
    pub session_id: String,
    pub snapshot: AgentSessionSnapshot,
}

fn summarize_session(session: &AgentSessionSnapshot) -> AgentSessionSummary {
    let latest_assistant_message = session
        .messages
        .iter()
        .rev()
        .find(|message| matches!(message.role, AgentMessageRole::Assistant));

    AgentSessionSummary {
        id: session.id.clone(),
        provider: session.provider.clone(),
        model: session.model.clone(),
        effort: session.effort.clone(),
        target_type: session.target_type,
        target_id: session.target_id,
        project_id: session.project_id,
        workspace_owner_id: session.workspace_owner_id,
        workspace_key: session.workspace_key.clone(),
        session_role: session.session_role,
        name_mode: session.name_mode,
        name: session.name.clone(),
        path: session.path.clone(),
        status: session.status,
        runtime_status: session.runtime_status,
        is_open: session.is_open,
        created_at_ms: session.created_at_ms,
        updated_at_ms: session.updated_at_ms,
        thread_id: session.thread_id.clone(),
        current_turn_started_at_ms: session.current_turn_started_at_ms,
        last_runtime_event_at_ms: session.last_runtime_event_at_ms,
        runtime_phase: session.runtime_phase.clone(),
        pending_request: session.pending_request.clone(),
        error_message: session.error_message.clone(),
        latest_assistant_message_interaction_mode: latest_assistant_message
            .and_then(|message| message.interaction_mode),
        latest_assistant_message_status: latest_assistant_message.map(|message| message.status),
    }
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
        question_ids: Vec<String>,
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
                    "Cannot change model or effort while an agent turn is running.".to_string()
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
        }
    }

    fn fail_session(
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

    fn session_has_pending_request(&self, session_id: &str) -> Result<bool, String> {
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

    async fn wait_for_pending_request_resolution(&self, session_id: &str) -> Result<(), String> {
        while self.session_has_pending_request(session_id)? {
            if self.is_session_stopping(session_id) {
                return Ok(());
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        Ok(())
    }

    fn clear_pending_transport_for_session(&self, session_id: &str) {
        if let Ok(mut pending_requests) = self.inner.pending_requests.lock() {
            pending_requests.retain(|_, transport| match transport {
                PendingRequestTransport::CodexApproval {
                    session_id: pending_session_id,
                    ..
                }
                | PendingRequestTransport::CodexUserInput {
                    session_id: pending_session_id,
                    ..
                } => pending_session_id != session_id,
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

    fn mutate_session<F>(
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
    base.join("divergence")
        .join("agent-runtime")
        .join("sessions.json")
}

fn default_attachment_base_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("divergence")
        .join("agent-runtime")
        .join("attachments")
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

fn attachment_kind_from_mime_type(mime_type: &str) -> Result<AgentAttachmentKind, String> {
    let normalized_mime_type = mime_type.trim().to_ascii_lowercase();
    if normalized_mime_type.starts_with("image/") {
        return Ok(AgentAttachmentKind::Image);
    }
    if normalized_mime_type == "application/pdf" {
        return Ok(AgentAttachmentKind::Pdf);
    }
    Err(format!(
        "Unsupported attachment type '{mime_type}'. Only image and PDF attachments are supported."
    ))
}

fn validate_turn_attachments_for_provider(
    provider: &AgentProvider,
    attachments: &[AgentAttachment],
) -> Result<(), String> {
    for attachment in attachments {
        let is_supported = match provider {
            AgentProvider::Codex | AgentProvider::Claude => {
                matches!(attachment.kind, AgentAttachmentKind::Image)
            }
            AgentProvider::Cursor => false,
            AgentProvider::Gemini => matches!(
                attachment.kind,
                AgentAttachmentKind::Image | AgentAttachmentKind::Pdf
            ),
        };
        if is_supported {
            continue;
        }

        let provider_label = match provider {
            AgentProvider::Claude => "Claude",
            AgentProvider::Codex => "Codex",
            AgentProvider::Cursor => "Cursor",
            AgentProvider::Gemini => "Gemini",
        };

        let kind_label = match attachment.kind {
            AgentAttachmentKind::Image => "image",
            AgentAttachmentKind::Pdf => "PDF",
        };

        return Err(format!(
            "{provider_label} does not support {kind_label} attachments in Divergence yet."
        ));
    }

    Ok(())
}

fn build_attachment_filename(attachment_id: &str, name: &str) -> String {
    let sanitized_name = sanitize_attachment_name(name);
    if sanitized_name.is_empty() {
        attachment_id.to_string()
    } else {
        format!("{attachment_id}-{sanitized_name}")
    }
}

fn resolve_staged_attachment_path(
    session_id: &str,
    attachment_id: &str,
) -> Result<PathBuf, String> {
    let attachment_dir = session_attachment_dir(session_id);
    let entries = fs::read_dir(&attachment_dir).map_err(|error| {
        format!("Failed to read staged attachments for session {session_id}: {error}")
    })?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to inspect staged attachment: {error}"))?;
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

    let Ok(items) = serde_json::from_str::<Vec<Value>>(&raw) else {
        eprintln!(
            "[agent_runtime] Failed to parse persisted session snapshot array at {}",
            path.display()
        );
        return HashMap::new();
    };

    items
        .into_iter()
        .filter_map(
            |item| match serde_json::from_value::<AgentSessionSnapshot>(item) {
                Ok(session) => Some(normalize_persisted_session(session)),
                Err(error) => {
                    eprintln!(
                        "[agent_runtime] Skipping unreadable persisted session in {}: {}",
                        path.display(),
                        error
                    );
                    None
                }
            },
        )
        .map(|item| (item.id.clone(), item))
        .collect()
}

fn normalize_persisted_session(mut session: AgentSessionSnapshot) -> AgentSessionSnapshot {
    if session.model.trim().is_empty() {
        session.model = default_model_for_provider(&session.provider).to_string();
    }
    session.effort = normalize_agent_effort(
        &session.provider,
        &session.model,
        session.effort.as_deref(),
    );
    if matches!(
        session.session_role,
        AgentSessionRole::ReviewAgent | AgentSessionRole::Manual
    ) && !matches!(session.name_mode, AgentSessionNameMode::Manual)
    {
        session.name_mode = AgentSessionNameMode::Manual;
    }
    if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
        let keep_from = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
        session.runtime_events = session.runtime_events.split_off(keep_from);
    }
    for message in &mut session.messages {
        if let Some(attachments) = &mut message.attachments {
            for attachment in attachments {
                if let Ok(kind) = attachment_kind_from_mime_type(&attachment.mime_type) {
                    attachment.kind = kind;
                }
            }
        }
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
            session.error_message =
                Some("Agent runtime was interrupted when Divergence closed.".to_string());
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

fn apply_session_failure(session: &mut AgentSessionSnapshot, failure: SessionFailureState<'_>) {
    if let Some(message) = last_assistant_message_mut(session) {
        message.status = AgentMessageStatus::Error;
        if message.content.trim().is_empty() {
            message.content = failure.message.to_string();
        }
    }
    session.status = AgentSessionStatus::Idle;
    session.runtime_status = AgentRuntimeStatus::Error;
    session.updated_at_ms = now_ms();
    session.runtime_phase = Some("Errored".to_string());
    push_runtime_event(session, "Errored", failure.message, failure.details);
    session.pending_request = None;
    session.error_message = Some(failure.message.to_string());
}

fn read_provider_thread_id(value: &Value) -> Option<String> {
    value
        .get("session_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("chat_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("chatId")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("conversation_id")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
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

#[derive(Debug)]
enum ProviderOutputChunk {
    Text(String),
    Json(Value),
}

fn split_provider_output_chunks(input: &str) -> Vec<ProviderOutputChunk> {
    let mut chunks = Vec::new();
    let mut current_text_start = 0usize;
    let mut json_start: Option<usize> = None;
    let mut depth = 0usize;
    let mut in_string = false;
    let mut escaped = false;

    for (index, character) in input.char_indices() {
        if json_start.is_some() {
            if in_string {
                if escaped {
                    escaped = false;
                    continue;
                }
                match character {
                    '\\' => escaped = true,
                    '"' => in_string = false,
                    _ => {}
                }
                continue;
            }

            match character {
                '"' => in_string = true,
                '{' => depth += 1,
                '}' => {
                    depth = depth.saturating_sub(1);
                    if depth == 0 {
                        let start = json_start.expect("json start should be set when parsing");
                        if current_text_start < start {
                            let text = input[current_text_start..start].trim();
                            if !text.is_empty() {
                                chunks.push(ProviderOutputChunk::Text(text.to_string()));
                            }
                        }

                        let end = index + character.len_utf8();
                        let candidate = &input[start..end];
                        if let Ok(value) = serde_json::from_str::<Value>(candidate) {
                            chunks.push(ProviderOutputChunk::Json(value));
                            current_text_start = end;
                        }
                        json_start = None;
                        in_string = false;
                        escaped = false;
                    }
                }
                _ => {}
            }
            continue;
        }

        if character == '{' {
            json_start = Some(index);
            depth = 1;
            in_string = false;
            escaped = false;
        }
    }

    if json_start.is_some() || current_text_start < input.len() {
        let text = input[current_text_start..].trim();
        if !text.is_empty() {
            chunks.push(ProviderOutputChunk::Text(text.to_string()));
        }
    }

    chunks
}

fn read_provider_activity_id(value: &Value) -> Option<String> {
    value
        .get("tool_call_id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("toolCallId")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| value.get("id").and_then(Value::as_str).map(str::to_string))
}

fn read_provider_activity_title(value: &Value) -> Option<String> {
    value
        .get("tool_name")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("toolName")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
        .or_else(|| {
            value
                .get("name")
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}

fn last_assistant_message_mut(session: &mut AgentSessionSnapshot) -> Option<&mut AgentMessage> {
    let index = last_assistant_message_index(session)?;
    session.messages.get_mut(index)
}

fn assistant_message_mut<'a>(
    session: &'a mut AgentSessionSnapshot,
    item_id: Option<&str>,
) -> Option<&'a mut AgentMessage> {
    if let Some(item_id) = item_id {
        if let Some(index) = session.messages.iter().position(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
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
        if let Some(index) = session.messages.iter().position(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
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

fn append_assistant_paragraph(
    session: &mut AgentSessionSnapshot,
    item_id: Option<&str>,
    text: &str,
) {
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
        if let Some(message) = session.messages.iter().find(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
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
    if let Some(activity) = session
        .activities
        .iter_mut()
        .find(|item| item.id == activity_id)
    {
        let had_metadata = activity.summary.is_some()
            || activity.subject.is_some()
            || activity.group_key.is_some();
        activity.status = status;
        activity.completed_at_ms = Some(completed_at_ms);
        if let Some(details) = details {
            activity.details = Some(details);
        }
        if !had_metadata {
            refresh_activity_metadata(activity);
        }
        return;
    }

    session.activities.push(create_activity(
        activity_id.to_string(),
        "tool".to_string(),
        activity_id.to_string(),
        status,
        details,
        completed_at_ms,
        Some(completed_at_ms),
    ));
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn create_activity(
    id: String,
    kind: String,
    title: String,
    status: AgentActivityStatus,
    details: Option<String>,
    started_at_ms: i64,
    completed_at_ms: Option<i64>,
) -> AgentActivity {
    let (summary, subject, group_key) = derive_activity_metadata(&kind, &title, details.as_deref());

    AgentActivity {
        id,
        kind,
        title,
        summary,
        subject,
        group_key,
        status,
        details,
        started_at_ms,
        completed_at_ms,
    }
}

fn refresh_activity_metadata(activity: &mut AgentActivity) {
    let (summary, subject, group_key) =
        derive_activity_metadata(&activity.kind, &activity.title, activity.details.as_deref());
    activity.summary = summary;
    activity.subject = subject;
    activity.group_key = group_key;
}

fn derive_activity_metadata(
    kind: &str,
    title: &str,
    details: Option<&str>,
) -> (Option<String>, Option<String>, Option<String>) {
    let trimmed_title = title.trim();
    let normalized_title = trimmed_title.to_ascii_lowercase();
    let normalized_kind = kind.trim().to_ascii_lowercase();
    let is_command_like = normalized_kind == "command_execution"
        || matches!(normalized_title.as_str(), "bash" | "shell" | "command");
    let subject = if is_command_like {
        compact_command(trimmed_title)
            .or_else(|| details.and_then(extract_activity_command_subject))
    } else {
        details.and_then(extract_activity_subject)
    };
    let subject_ref = subject.as_deref();

    let (summary, group_key) = if is_command_like {
        (
            Some(format!(
                "Ran {}",
                subject_ref
                    .map(str::to_string)
                    .unwrap_or_else(|| trimmed_title.to_string())
            )),
            Some("command".to_string()),
        )
    } else if normalized_kind == "mcp_tool" {
        (
            Some(format!("Ran {}", compact_label(trimmed_title))),
            Some(format!("mcp:{}", normalized_title)),
        )
    } else if normalized_title == "read" {
        (
            Some(match subject_ref {
                Some(subject) => format!("Read {subject}"),
                None => "Read file".to_string(),
            }),
            Some("read".to_string()),
        )
    } else if matches!(
        normalized_title.as_str(),
        "edit" | "multiedit" | "write" | "filechange"
    ) || normalized_kind == "file_change"
    {
        (
            Some(match subject_ref {
                Some(subject) => format!("Edited {subject}"),
                None => "Edited file".to_string(),
            }),
            Some("edit".to_string()),
        )
    } else if normalized_title == "todowrite" {
        (
            Some("Updated todo list".to_string()),
            Some("todo".to_string()),
        )
    } else if matches!(normalized_title.as_str(), "search" | "grep" | "glob" | "ls") {
        (
            Some(match subject_ref {
                Some(subject) => format!("Searched {subject}"),
                None => format!("Ran {}", compact_label(trimmed_title)),
            }),
            Some("search".to_string()),
        )
    } else if normalized_kind == "skill" {
        (
            Some(format!("Ran skill {}", compact_label(trimmed_title))),
            Some(format!("skill:{}", normalized_title)),
        )
    } else if normalized_title == "thinking" || normalized_kind == "thought_process" {
        (Some("Thinking".to_string()), Some("thinking".to_string()))
    } else {
        (
            Some(compact_label(trimmed_title)),
            Some(format!("{}:{}", normalized_kind, normalized_title)),
        )
    };

    (summary, subject, group_key)
}

fn extract_activity_subject(details: &str) -> Option<String> {
    let trimmed = details.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return extract_activity_subject_from_value(&value);
    }

    compact_subject(trimmed)
}

fn extract_activity_command_subject(details: &str) -> Option<String> {
    let trimmed = details.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        for key in ["command", "cmd"] {
            if let Some(subject) = extract_stringish_value(value.get(key)) {
                return compact_command(&subject);
            }
        }
        return extract_activity_subject_from_value(&value);
    }

    compact_command(trimmed)
}

fn extract_activity_subject_from_value(value: &Value) -> Option<String> {
    let path_keys = [
        "file_path",
        "path",
        "paths",
        "filename",
        "file",
        "relative_workspace_path",
    ];
    for key in path_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_subject(&subject);
        }
    }

    let command_keys = ["command", "cmd"];
    for key in command_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_command(&subject);
        }
    }

    let query_keys = ["pattern", "query", "term", "glob"];
    for key in query_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_subject(&subject);
        }
    }

    None
}

fn extract_stringish_value(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => Some(text.to_string()),
        Some(Value::Array(items)) => items.iter().find_map(|item| match item {
            Value::String(text) => Some(text.to_string()),
            _ => None,
        }),
        _ => None,
    }
}

fn compact_subject(subject: &str) -> Option<String> {
    let trimmed = subject.trim();
    if trimmed.is_empty() {
        return None;
    }

    let display = if trimmed.contains('/') || trimmed.contains('\\') {
        let basename = trimmed.rsplit(['/', '\\']).next().unwrap_or(trimmed).trim();
        if basename.is_empty() {
            trimmed
        } else {
            basename
        }
    } else {
        trimmed
    };

    Some(truncate_inline(display, 48))
}

fn compact_command(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(truncate_inline(strip_shell_wrapper(trimmed), 56))
}

fn compact_label(label: &str) -> String {
    truncate_inline(label.trim(), 56)
}

fn truncate_inline(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim().trim_end_matches("...[truncated]").trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let mut output: String = trimmed.chars().take(max_chars.saturating_sub(1)).collect();
    output.push('…');
    output
}

fn strip_shell_wrapper(command: &str) -> &str {
    const PREFIXES: [&str; 6] = [
        "/bin/zsh -lc ",
        "zsh -lc ",
        "/bin/bash -lc ",
        "bash -lc ",
        "/bin/sh -lc ",
        "sh -lc ",
    ];

    for prefix in PREFIXES {
        if let Some(rest) = command.strip_prefix(prefix) {
            return rest
                .strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'))
                .or_else(|| {
                    rest.strip_prefix('\'')
                        .and_then(|value| value.strip_suffix('\''))
                })
                .unwrap_or(rest)
                .trim();
        }
    }

    command
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

#[cfg(test)]
mod tests {
    use super::{
        apply_session_failure, complete_activity, create_activity, derive_activity_metadata,
        split_provider_output_chunks, strip_shell_wrapper, AgentActivityStatus, AgentMessage,
        AgentMessageRole, AgentMessageStatus, AgentProvider, AgentRequest, AgentRequestKind,
        AgentRequestStatus, AgentRuntimeState, SessionFailureState,
        AgentRuntimeDebugEvent, AgentRuntimeStatus, AgentSessionNameMode, AgentSessionRole,
        AgentSessionSnapshot, AgentSessionStatus, AgentTargetType, ProviderOutputChunk,
    };
    use serde_json::Value;
    use tokio::time::Duration;

    #[test]
    fn strip_shell_wrapper_removes_common_shell_prefixes() {
        assert_eq!(
            strip_shell_wrapper("/bin/zsh -lc \"sed -n '1,220p' package.json\""),
            "sed -n '1,220p' package.json"
        );
        assert_eq!(
            strip_shell_wrapper("bash -lc 'rg --files src'"),
            "rg --files src"
        );
        assert_eq!(strip_shell_wrapper("pnpm lint"), "pnpm lint");
    }

    #[test]
    fn derive_activity_metadata_treats_bash_as_command() {
        let (summary, subject, group_key) = derive_activity_metadata(
            "tool",
            "Bash",
            Some(r#"{"command":"/bin/zsh -lc \"sed -n '1,220p' package.json\""}"#),
        );

        assert_eq!(summary.as_deref(), Some("Ran sed -n '1,220p' package.json"));
        assert_eq!(subject.as_deref(), Some("sed -n '1,220p' package.json"));
        assert_eq!(group_key.as_deref(), Some("command"));
    }

    #[test]
    fn complete_activity_preserves_existing_summary_metadata() {
        let mut session = AgentSessionSnapshot {
            id: "session-1".to_string(),
            provider: AgentProvider::Claude,
            model: "sonnet".to_string(),
            effort: Some("medium".to_string()),
            target_type: AgentTargetType::Project,
            target_id: 1,
            project_id: 1,
            workspace_owner_id: None,
            workspace_key: "project:1".to_string(),
            session_role: AgentSessionRole::Default,
            name_mode: AgentSessionNameMode::Default,
            name: "Session".to_string(),
            path: "/tmp/project".to_string(),
            status: AgentSessionStatus::Active,
            runtime_status: AgentRuntimeStatus::Running,
            is_open: true,
            created_at_ms: 1,
            updated_at_ms: 1,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::<AgentRuntimeDebugEvent>::new(),
            messages: Vec::<AgentMessage>::new(),
            activities: vec![create_activity(
                "activity-1".to_string(),
                "tool".to_string(),
                "Bash".to_string(),
                AgentActivityStatus::Running,
                Some(r#"{"command":"ls apps"}"#.to_string()),
                1,
                None,
            )],
            pending_request: Option::<AgentRequest>::None,
            error_message: None,
        };

        complete_activity(
            &mut session,
            "activity-1",
            Some("/tmp/project/apps\n/tmp/project/apps/api".to_string()),
            AgentActivityStatus::Completed,
        );

        let activity = &session.activities[0];
        assert_eq!(activity.summary.as_deref(), Some("Ran ls apps"));
        assert_eq!(activity.group_key.as_deref(), Some("command"));
        assert_eq!(
            activity.details.as_deref(),
            Some("/tmp/project/apps\n/tmp/project/apps/api")
        );
    }

    #[test]
    fn split_provider_output_chunks_extracts_inline_json_objects() {
        let chunks = split_provider_output_chunks(
            r#"MCP issues detected. Run /mcp list for status.{"type":"init","session_id":"session-123"}Hello! How can I help you today?"#,
        );

        assert_eq!(chunks.len(), 3);
        match &chunks[0] {
            ProviderOutputChunk::Text(text) => {
                assert_eq!(text, "MCP issues detected. Run /mcp list for status.");
            }
            ProviderOutputChunk::Json(_) => panic!("expected provider notice text chunk"),
        }
        match &chunks[1] {
            ProviderOutputChunk::Json(value) => {
                assert_eq!(value.get("type").and_then(Value::as_str), Some("init"));
                assert_eq!(
                    value.get("session_id").and_then(Value::as_str),
                    Some("session-123")
                );
            }
            ProviderOutputChunk::Text(_) => panic!("expected structured JSON chunk"),
        }
        match &chunks[2] {
            ProviderOutputChunk::Text(text) => {
                assert_eq!(text, "Hello! How can I help you today?");
            }
            ProviderOutputChunk::Json(_) => panic!("expected trailing assistant text chunk"),
        }
    }
    fn make_test_session(session_id: &str, pending_request: Option<AgentRequest>) -> AgentSessionSnapshot {
        AgentSessionSnapshot {
            id: session_id.to_string(),
            provider: AgentProvider::Codex,
            model: "gpt-5.4".to_string(),
            effort: Some("medium".to_string()),
            target_type: AgentTargetType::Project,
            target_id: 1,
            project_id: 1,
            workspace_owner_id: None,
            workspace_key: "project:1".to_string(),
            session_role: AgentSessionRole::Default,
            name_mode: AgentSessionNameMode::Default,
            name: "Session".to_string(),
            path: "/tmp/project".to_string(),
            status: AgentSessionStatus::Busy,
            runtime_status: AgentRuntimeStatus::Waiting,
            is_open: true,
            created_at_ms: 1,
            updated_at_ms: 1,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::<AgentRuntimeDebugEvent>::new(),
            messages: Vec::<AgentMessage>::new(),
            activities: Vec::new(),
            pending_request,
            error_message: None,
        }
    }

    #[tokio::test]
    async fn wait_for_pending_request_resolution_returns_immediately_without_pending_request() {
        let runtime = AgentRuntimeState::default();
        let session_id = "session-1";
        runtime
            .inner
            .sessions
            .lock()
            .expect("sessions lock")
            .insert(session_id.to_string(), make_test_session(session_id, None));

        runtime
            .wait_for_pending_request_resolution(session_id)
            .await
            .expect("wait should succeed");
        assert!(
            !runtime
                .session_has_pending_request(session_id)
                .expect("pending request state")
        );
    }

    #[tokio::test]
    async fn wait_for_pending_request_resolution_blocks_until_request_clears() {
        let runtime = AgentRuntimeState::default();
        let session_id = "session-2";
        runtime
            .inner
            .sessions
            .lock()
            .expect("sessions lock")
            .insert(
                session_id.to_string(),
                make_test_session(
                    session_id,
                    Some(AgentRequest {
                        id: "request-1".to_string(),
                        kind: AgentRequestKind::Approval,
                        title: "Approve tool".to_string(),
                        description: None,
                        options: None,
                        questions: None,
                        status: AgentRequestStatus::Open,
                        opened_at_ms: 1,
                        resolved_at_ms: None,
                    }),
                ),
            );

        let runtime_for_clear = runtime.clone();
        let session_id_for_clear = session_id.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(10)).await;
            runtime_for_clear
                .mutate_session(&session_id_for_clear, |session| {
                    session.pending_request = None;
                    Ok(())
                })
                .expect("clear pending request");
        });

        runtime
            .wait_for_pending_request_resolution(session_id)
            .await
            .expect("wait should succeed");
        assert!(
            !runtime
                .session_has_pending_request(session_id)
                .expect("pending request state")
        );
    }

    #[test]
    fn apply_session_failure_populates_empty_assistant_message_with_sanitized_error() {
        let mut session = make_test_session("session-3", None);
        session.messages.push(AgentMessage {
            id: "message-1".to_string(),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: 1,
            interaction_mode: None,
            attachments: None,
        });

        apply_session_failure(
            &mut session,
            SessionFailureState {
                message: "Gemini hit a rate limit before it produced a response.",
                details: Some("RESOURCE_EXHAUSTED: 429 ...".to_string()),
            },
        );

        let message = session.messages.last().expect("assistant message");
        assert_eq!(message.status, AgentMessageStatus::Error);
        assert_eq!(
            message.content,
            "Gemini hit a rate limit before it produced a response."
        );
        assert_eq!(
            session.error_message.as_deref(),
            Some("Gemini hit a rate limit before it produced a response.")
        );
        assert_eq!(session.runtime_status, AgentRuntimeStatus::Error);
        assert!(session
            .runtime_events
            .last()
            .and_then(|event| event.details.as_deref())
            .is_some_and(|details| details.contains("RESOURCE_EXHAUSTED")));
    }

    #[test]
    fn apply_session_failure_preserves_partial_assistant_output() {
        let mut session = make_test_session("session-4", None);
        session.messages.push(AgentMessage {
            id: "message-1".to_string(),
            role: AgentMessageRole::Assistant,
            content: "Partial streamed answer".to_string(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: 1,
            interaction_mode: None,
            attachments: None,
        });

        apply_session_failure(
            &mut session,
            SessionFailureState {
                message: "Gemini CLI failed before it produced a response (exit code 17). Check Runtime Debug for provider details.",
                details: Some("stack trace".to_string()),
            },
        );

        let message = session.messages.last().expect("assistant message");
        assert_eq!(message.status, AgentMessageStatus::Error);
        assert_eq!(message.content, "Partial streamed answer");
        assert_eq!(
            session.error_message.as_deref(),
            Some("Gemini CLI failed before it produced a response (exit code 17). Check Runtime Debug for provider details.")
        );
    }
}
