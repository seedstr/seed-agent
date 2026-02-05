import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getConfig, validateConfig } from "../src/config/index.js";

describe("Config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getConfig", () => {
    it("should return default values", () => {
      // Clear LOG_LEVEL set by setup.ts to test actual default
      delete process.env.LOG_LEVEL;

      const config = getConfig();

      expect(config.model).toBe("anthropic/claude-sonnet-4");
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.7);
      expect(config.minBudget).toBe(0.5);
      expect(config.pollInterval).toBe(30);
      expect(config.maxConcurrentJobs).toBe(3);
      expect(config.logLevel).toBe("info");
    });

    it("should use environment variables", () => {
      process.env.OPENROUTER_MODEL = "gpt-4";
      process.env.MAX_TOKENS = "8000";
      process.env.TEMPERATURE = "0.5";
      process.env.MIN_BUDGET = "1.00";
      process.env.POLL_INTERVAL = "60";

      const config = getConfig();

      expect(config.model).toBe("gpt-4");
      expect(config.maxTokens).toBe(8000);
      expect(config.temperature).toBe(0.5);
      expect(config.minBudget).toBe(1.0);
      expect(config.pollInterval).toBe(60);
    });

    it("should enable tools by default", () => {
      const config = getConfig();

      expect(config.tools.webSearchEnabled).toBe(true);
      expect(config.tools.calculatorEnabled).toBe(true);
      expect(config.tools.codeInterpreterEnabled).toBe(true);
    });

    it("should disable tools when set to false", () => {
      process.env.TOOL_WEB_SEARCH_ENABLED = "false";
      process.env.TOOL_CALCULATOR_ENABLED = "false";

      const config = getConfig();

      expect(config.tools.webSearchEnabled).toBe(false);
      expect(config.tools.calculatorEnabled).toBe(false);
    });
  });

  describe("validateConfig", () => {
    it("should return no errors for valid config", () => {
      const config = getConfig();
      const errors = validateConfig(config);

      expect(errors).toHaveLength(0);
    });

    it("should require OPENROUTER_API_KEY", () => {
      process.env.OPENROUTER_API_KEY = "";

      const config = getConfig();
      const errors = validateConfig(config);

      expect(errors).toContain("OPENROUTER_API_KEY is required");
    });

    it("should require SOLANA_WALLET_ADDRESS", () => {
      // Delete the env var to test validation
      delete process.env.SOLANA_WALLET_ADDRESS;

      const config = getConfig();
      // Note: If there's a stored wallet from registration, this test may pass
      // because config falls back to stored.walletAddress
      // We're testing that an empty string triggers the validation
      const testConfig = { ...config, solanaWalletAddress: "" };
      const errors = validateConfig(testConfig);

      expect(errors).toContain("SOLANA_WALLET_ADDRESS is required");
    });
  });
});
