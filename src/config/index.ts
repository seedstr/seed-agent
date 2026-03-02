import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import Conf from "conf";
import type { AgentConfig, StoredConfig } from "../types/index.js";

// Get the directory of this module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file from the project root (2 levels up from src/config)
dotenvConfig({ path: resolve(__dirname, "../../.env") });

// Also try loading from current working directory as fallback
dotenvConfig();

/** Anthropic API expects e.g. claude-sonnet-4-6 not claude-sonnet-4.6; normalize dot to hyphen. */
function normalizeAnthropicModelId(modelId: string): string {
  if (modelId.startsWith("claude-") && modelId.includes(".6")) {
    return modelId.replace(".6", "-6");
  }
  return modelId;
}

// Persistent config store for API keys and agent info
export const configStore = new Conf<StoredConfig>({
  projectName: "seed-agent",
  projectVersion: "2.0.0",
  schema: {
    seedstrApiKey: { type: "string" },
    agentId: { type: "string" },
    walletAddress: { type: "string" },
    isVerified: { type: "boolean" },
    name: { type: "string" },
    bio: { type: "string" },
    profilePicture: { type: "string" },
  },
});

/**
 * Get the full agent configuration from environment variables and stored config
 */
export function getConfig(): AgentConfig {
  const stored = configStore.store;

    // Resolve primary provider: explicit env or infer from API keys
    const primaryProviderEnv = process.env.PRIMARY_PROVIDER?.toLowerCase();
    const primaryProvider: AgentConfig["primaryProvider"] =
      primaryProviderEnv === "openai" || primaryProviderEnv === "anthropic"
        ? primaryProviderEnv
        : "anthropic";

    const openaiApiKey = process.env.OPENAI_API_KEY ?? "";
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY ?? "";
    const openaiModel = process.env.OPENAI_MODEL ?? "gpt-4o";
    const anthropicModel = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514";

    // Model for the active provider (so existing code that reads config.model still works)
    const model =
      primaryProvider === "openai" ? openaiModel : anthropicModel;

    // Pipeline per-step models: use .env when set and non-empty; otherwise fall back to provider default
    const defaultModel = primaryProvider === "openai" ? openaiModel : anthropicModel;
    const fromEnv = (key: string) => process.env[key]?.trim() || defaultModel;
    const plannerModel = normalizeAnthropicModelId(fromEnv("PLANNER_MODEL"));
    const builderModel = normalizeAnthropicModelId(fromEnv("BUILDER_MODEL"));
    const verifierModel = normalizeAnthropicModelId(fromEnv("VERIFIER_MODEL"));
    // Text-only tasks: use TEXT_RESPONSE_MODEL from .env; if unset, use primary provider's default (no hardcoded model)
    const textResponseModel = normalizeAnthropicModelId(
      process.env.TEXT_RESPONSE_MODEL?.trim() || defaultModel
    );

  return {
    // API Keys
    openrouterApiKey: process.env.OPENROUTER_API_KEY || "",
    openaiApiKey,
    anthropicApiKey,
    seedstrApiKey: process.env.SEEDSTR_API_KEY || stored.seedstrApiKey || "",
    tavilyApiKey: process.env.TAVILY_API_KEY || "",

    // Wallet
    solanaWalletAddress:
      process.env.SOLANA_WALLET_ADDRESS || stored.walletAddress || "",

    // LLM provider (direct API)
    primaryProvider,
    openaiModel,
    anthropicModel,
    plannerModel,
    builderModel,
    verifierModel,
    textResponseModel,

    // Model settings (active provider's model)
    model,
    maxTokens: parseInt(process.env.MAX_TOKENS || "4096", 10),
    temperature: parseFloat(process.env.TEMPERATURE || "0.7"),

    // Agent behavior
    minBudget: parseFloat(process.env.MIN_BUDGET || "0.50"),
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS || "3", 10),
    pollInterval: parseInt(process.env.POLL_INTERVAL || "1", 10),

    // Tools
    tools: {
      webSearchEnabled: process.env.TOOL_WEB_SEARCH_ENABLED !== "false",
      calculatorEnabled: process.env.TOOL_CALCULATOR_ENABLED !== "false",
      codeInterpreterEnabled:
        process.env.TOOL_CODE_INTERPRETER_ENABLED !== "false",
    },

    // Platform
    seedstrApiUrl: process.env.SEEDSTR_API_URL || "https://www.seedstr.io/api/v1",
    seedstrApiUrlV2: (process.env.SEEDSTR_API_URL || "https://www.seedstr.io/api/v2"),

    // WebSocket (Pusher)
    useWebSocket: process.env.USE_WEBSOCKET !== "false", // enabled by default
    pusherKey: process.env.PUSHER_KEY || "",
    pusherCluster: process.env.PUSHER_CLUSTER || "us2",

    // Logging
    logLevel: (process.env.LOG_LEVEL as AgentConfig["logLevel"]) || "info",
    debug: process.env.DEBUG === "true",

    // LLM retry settings (for recovering from transient tool argument parsing errors)
    llmRetryMaxAttempts: parseInt(process.env.LLM_RETRY_MAX_ATTEMPTS || "3", 10),
    llmRetryBaseDelayMs: parseInt(process.env.LLM_RETRY_BASE_DELAY_MS || "1000", 10),
    llmRetryMaxDelayMs: parseInt(process.env.LLM_RETRY_MAX_DELAY_MS || "10000", 10),
    llmRetryFallbackNoTools: process.env.LLM_RETRY_FALLBACK_NO_TOOLS !== "false",
  };
}

/**
 * Validate that required configuration is present.
 * For LLM: at least the primary provider's API key is required (OPENAI_API_KEY or ANTHROPIC_API_KEY).
 */
export function validateConfig(config: AgentConfig): string[] {
  const errors: string[] = [];

  const hasOpenAI = !!config.openaiApiKey?.trim();
  const hasAnthropic = !!config.anthropicApiKey?.trim();

  if (config.primaryProvider === "openai" && !hasOpenAI) {
    errors.push("OPENAI_API_KEY is required when PRIMARY_PROVIDER=openai");
  }
  if (config.primaryProvider === "anthropic" && !hasAnthropic) {
    errors.push("ANTHROPIC_API_KEY is required when PRIMARY_PROVIDER=anthropic");
  }
  if (!hasOpenAI && !hasAnthropic) {
    errors.push("At least one of OPENAI_API_KEY or ANTHROPIC_API_KEY is required");
  }

  if (!config.solanaWalletAddress) {
    errors.push("SOLANA_WALLET_ADDRESS is required");
  }

  return errors;
}

/**
 * Check if the agent is registered
 */
export function isRegistered(): boolean {
  return !!configStore.get("seedstrApiKey");
}

/**
 * Check if the agent is verified
 */
export function isVerified(): boolean {
  return configStore.get("isVerified") === true;
}

/**
 * Save registration data
 */
export function saveRegistration(data: {
  apiKey: string;
  agentId: string;
  walletAddress: string;
}): void {
  configStore.set("seedstrApiKey", data.apiKey);
  configStore.set("agentId", data.agentId);
  configStore.set("walletAddress", data.walletAddress);
}

/**
 * Save verification status
 */
export function saveVerification(isVerified: boolean): void {
  configStore.set("isVerified", isVerified);
}

/**
 * Save profile data
 */
export function saveProfile(data: {
  name?: string;
  bio?: string;
  profilePicture?: string;
}): void {
  if (data.name) configStore.set("name", data.name);
  if (data.bio) configStore.set("bio", data.bio);
  if (data.profilePicture) configStore.set("profilePicture", data.profilePicture);
}

/**
 * Get stored agent info
 */
export function getStoredAgent(): StoredConfig {
  return configStore.store;
}

/**
 * Clear all stored configuration
 */
export function clearConfig(): void {
  configStore.clear();
}

export default {
  getConfig,
  validateConfig,
  configStore,
  isRegistered,
  isVerified,
  saveRegistration,
  saveVerification,
  saveProfile,
  getStoredAgent,
  clearConfig,
};
