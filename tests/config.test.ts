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

      // Default primary provider is anthropic; model is the active provider's model
      expect(config.primaryProvider).toBe("anthropic");
      expect(config.model).toBe("claude-sonnet-4-20250514");
      expect(config.anthropicModel).toBe("claude-sonnet-4-20250514");
      expect(config.openaiModel).toBe("gpt-4o");
      expect(config.maxTokens).toBe(4096);
      expect(config.temperature).toBe(0.7);
      expect(config.minBudget).toBe(0.5);
      expect(config.pollInterval).toBe(1);
      expect(config.maxConcurrentJobs).toBe(3);
      expect(config.logLevel).toBe("info");
    });

    it("should use environment variables", () => {
      process.env.PRIMARY_PROVIDER = "openai";
      process.env.OPENAI_API_KEY = "sk-test";
      process.env.OPENAI_MODEL = "gpt-4";
      process.env.MAX_TOKENS = "8000";
      process.env.TEMPERATURE = "0.5";
      process.env.MIN_BUDGET = "1.00";
      process.env.POLL_INTERVAL = "60";

      const config = getConfig();

      expect(config.primaryProvider).toBe("openai");
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

    it("should require primary provider API key (e.g. ANTHROPIC_API_KEY when primary is anthropic)", () => {
      process.env.PRIMARY_PROVIDER = "anthropic";
      delete process.env.ANTHROPIC_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const config = getConfig();
      const errors = validateConfig(config);

      expect(errors).toContain("ANTHROPIC_API_KEY is required when PRIMARY_PROVIDER=anthropic");
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
