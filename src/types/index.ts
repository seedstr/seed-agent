// ===========================================
// Seedstr API Types
// ===========================================

export interface Agent {
  id: string;
  walletAddress: string;
  name: string;
  bio: string;
  profilePicture: string;
  reputation: number;
  jobsCompleted: number;
  jobsDeclined: number;
  totalEarnings: number;
  createdAt: string;
  isVerified: boolean;
  ownerTwitter: string | null;
  ownerUrl: string | null;
}

export interface VerificationStatus {
  isVerified: boolean;
  ownerTwitter: string | null;
  verificationRequired: boolean;
  verificationInstructions?: string;
}

export interface AgentInfo extends Agent {
  skills: string[];
  verification: VerificationStatus;
}

export type JobType = "STANDARD" | "SWARM";

export interface Job {
  id: string;
  prompt: string;
  budget: number;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  createdAt: string;
  responseCount: number;
  acceptedId?: string;
  // V2 fields
  routerVersion?: number;
  jobType?: JobType;
  maxAgents?: number | null;
  budgetPerAgent?: number | null;
  requiredSkills?: string[];
  minReputation?: number | null;
  acceptedCount?: number;
}

export interface AcceptJobResult {
  success: boolean;
  acceptance: {
    id: string;
    jobId: string;
    status: string;
    responseDeadline: string;
    budgetPerAgent: number | null;
  };
  slotsRemaining: number;
  isFull: boolean;
}

export interface DeclineJobResult {
  success: boolean;
  message: string;
}

/** Pusher job:new event payload */
export interface WebSocketJobEvent {
  jobId: string;
  prompt: string;
  budget: number;
  jobType: JobType;
  maxAgents: number | null;
  budgetPerAgent: number | null;
  requiredSkills: string[];
  expiresAt: string;
}

export type ResponseType = "TEXT" | "FILE";

export interface FileAttachment {
  url: string;
  name: string;
  size: number;
  type: string; // MIME type
}

export interface JobResponse {
  id: string;
  content: string;
  responseType: ResponseType;
  files?: FileAttachment[] | null;
  status: "PENDING" | "ACCEPTED" | "REJECTED";
  createdAt: string;
  jobId: string;
}

export interface JobsListResponse {
  jobs: Job[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface RegisterResponse {
  success: boolean;
  apiKey: string;
  agentId: string;
}

export interface SubmitResponseResult {
  success: boolean;
  response: JobResponse;
}

export interface SubmitResponseOptions {
  content: string;
  responseType?: ResponseType;
  files?: FileAttachment[];
}

export interface FileUploadResult {
  uploadedBy: string;
  url: string;
  name: string;
  size: number;
  type: string;
}

export interface VerifyResponse {
  success: boolean;
  message: string;
  isVerified: boolean;
  ownerTwitter?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  agent: {
    id: string;
    name: string;
    bio: string;
    profilePicture: string;
  };
}

export interface ApiError {
  error: string;
  message: string;
}

// ===========================================
// Agent Configuration Types
// ===========================================

export interface AgentConfig {
  // API Keys
  openrouterApiKey: string;
  seedstrApiKey?: string;
  tavilyApiKey?: string;

  // Wallet
  solanaWalletAddress: string;

  // Model settings
  model: string;
  maxTokens: number;
  temperature: number;

  // Agent behavior
  minBudget: number;
  maxConcurrentJobs: number;
  pollInterval: number;

  // Tools
  tools: {
    webSearchEnabled: boolean;
    calculatorEnabled: boolean;
    codeInterpreterEnabled: boolean;
  };

  // Platform
  seedstrApiUrl: string;
  seedstrApiUrlV2: string;

  // WebSocket (Pusher)
  useWebSocket: boolean;
  pusherKey: string;
  pusherCluster: string;

  // Logging
  logLevel: "debug" | "info" | "warn" | "error";
  debug: boolean;

  // LLM retry settings (for recovering from transient tool argument parsing errors)
  llmRetryMaxAttempts: number;
  llmRetryBaseDelayMs: number;
  llmRetryMaxDelayMs: number;
  llmRetryFallbackNoTools: boolean;
}

export interface StoredConfig {
  seedstrApiKey?: string;
  agentId?: string;
  walletAddress?: string;
  isVerified?: boolean;
  name?: string;
  bio?: string;
  profilePicture?: string;
}

// ===========================================
// Tool Types
// ===========================================

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface CalculatorResult {
  expression: string;
  result: number;
}

// ===========================================
// Event Types
// ===========================================

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

export type AgentEvent =
  | { type: "startup" }
  | { type: "polling"; jobCount: number }
  | { type: "websocket_connected" }
  | { type: "websocket_disconnected"; reason?: string }
  | { type: "websocket_job"; jobId: string }
  | { type: "job_found"; job: Job }
  | { type: "job_accepted"; job: Job; budgetPerAgent: number | null }
  | { type: "job_processing"; job: Job }
  | { type: "job_skipped"; job: Job; reason: string }
  | { type: "tool_call"; tool: string; args: unknown }
  | { type: "tool_result"; tool: string; result: ToolResult }
  | { type: "response_generated"; job: Job; preview: string; usage?: TokenUsage }
  | { type: "project_built"; job: Job; files: string[]; zipPath: string }
  | { type: "files_uploading"; job: Job; fileCount: number }
  | { type: "files_uploaded"; job: Job; files: FileAttachment[] }
  | { type: "response_submitted"; job: Job; responseId: string; hasFiles?: boolean }
  | { type: "error"; message: string; error?: Error }
  | { type: "shutdown" };

export type EventHandler = (event: AgentEvent) => void;
