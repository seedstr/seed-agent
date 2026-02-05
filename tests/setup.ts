import { vi, beforeEach, afterEach } from "vitest";

// Store original env
const originalEnv = { ...process.env };

// Mock environment variables for tests
beforeEach(() => {
  // Clear all env vars that might interfere
  delete process.env.MAX_CONCURRENT_JOBS;
  delete process.env.MIN_BUDGET;
  delete process.env.POLL_INTERVAL;
  delete process.env.TEMPERATURE;
  delete process.env.MAX_TOKENS;
  delete process.env.OPENROUTER_MODEL;
  delete process.env.DEBUG;
  delete process.env.TAVILY_API_KEY;
  delete process.env.TOOL_WEB_SEARCH_ENABLED;
  delete process.env.TOOL_CALCULATOR_ENABLED;
  delete process.env.TOOL_CODE_INTERPRETER_ENABLED;
  
  // Set test values
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.SOLANA_WALLET_ADDRESS = "TestWalletAddress12345678901234567890";
  process.env.SEEDSTR_API_URL = "https://www.seedstr.io/api/v1";
  process.env.LOG_LEVEL = "error"; // Suppress logs in tests
});

afterEach(() => {
  vi.clearAllMocks();
});

// Mock fetch globally
global.fetch = vi.fn();
