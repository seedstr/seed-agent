import { vi, beforeEach, afterEach } from "vitest";

// Mock environment variables for tests
beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-openrouter-key";
  process.env.SOLANA_WALLET_ADDRESS = "TestWalletAddress12345678901234567890";
  process.env.SEEDSTR_API_URL = "https://seedstr.io/api/v1";
  process.env.LOG_LEVEL = "error"; // Suppress logs in tests
});

afterEach(() => {
  vi.clearAllMocks();
});

// Mock fetch globally
global.fetch = vi.fn();
