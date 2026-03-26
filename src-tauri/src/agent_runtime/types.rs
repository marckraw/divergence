use serde::{Deserialize, Serialize};

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
    Opencode,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
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
pub(crate) struct AgentTurnInvocation {
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

fn default_true() -> bool {
    true
}

fn default_agent_session_name_mode() -> AgentSessionNameMode {
    AgentSessionNameMode::Default
}
