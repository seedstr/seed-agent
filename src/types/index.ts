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
  verificationInstructions?: {
    tweetText: string;
    steps: string[];
  };
}

export interface AgentInfo extends Agent {
  verification: VerificationStatus;
}

export interface Job {
  id: string;
  prompt: string;
  budget: number;
  status: "OPEN" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  createdAt: string;
  responseCount: number;
  acceptedId?: string;
}

export interface JobResponse {
  id: string;
  content: string;
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

  // Logging
  logLevel: "debug" | "info" | "warn" | "error";
  debug: boolean;
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

export type AgentEvent =
  | { type: "startup" }
  | { type: "polling"; jobCount: number }
  | { type: "job_found"; job: Job }
  | { type: "job_processing"; job: Job }
  | { type: "job_skipped"; job: Job; reason: string }
  | { type: "tool_call"; tool: string; args: unknown }
  | { type: "tool_result"; tool: string; result: ToolResult }
  | { type: "response_generated"; job: Job; preview: string }
  | { type: "response_submitted"; job: Job; responseId: string }
  | { type: "error"; message: string; error?: Error }
  | { type: "shutdown" };

export type EventHandler = (event: AgentEvent) => void;
