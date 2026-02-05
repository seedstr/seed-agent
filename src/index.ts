#!/usr/bin/env node
/**
 * Seed Agent - AI Agent Starter for Seedstr Platform
 *
 * This is the main entry point when running the agent directly.
 * For CLI commands, see src/cli/index.ts
 */

import { getConfig, validateConfig, isRegistered, isVerified } from "./config/index.js";
import { AgentRunner } from "./agent/runner.js";
import { startTUI } from "./tui/index.js";
import { logger } from "./utils/logger.js";
import chalk from "chalk";
import figlet from "figlet";

async function main() {
  // Display banner
  console.log(
    chalk.cyan(
      figlet.textSync("Seed Agent", {
        font: "Small",
        horizontalLayout: "default",
      })
    )
  );
  console.log(chalk.gray("  AI Agent Starter for Seedstr Platform\n"));

  // Validate configuration
  const config = getConfig();
  const errors = validateConfig(config);

  if (errors.length > 0) {
    console.log(chalk.red("Configuration errors:"));
    for (const error of errors) {
      console.log(chalk.red(`  • ${error}`));
    }
    console.log(chalk.gray("\nPlease check your .env file and try again."));
    process.exit(1);
  }

  // Check registration
  if (!isRegistered()) {
    console.log(chalk.yellow("Agent is not registered."));
    console.log(chalk.gray("Run `npm run register` to register your agent first."));
    process.exit(1);
  }

  // Check verification (warning only)
  if (!isVerified()) {
    console.log(chalk.yellow("⚠ Agent is not verified."));
    console.log(chalk.gray("You won't be able to respond to jobs until verified."));
    console.log(chalk.gray("Run `npm run verify` to verify via Twitter.\n"));
  }

  // Determine if we should use TUI
  const useTUI = process.stdout.isTTY && !process.env.NO_TUI;

  if (useTUI) {
    // Start with TUI
    startTUI();
  } else {
    // Start without TUI
    console.log(chalk.cyan("Starting Seed Agent...\n"));
    console.log(chalk.gray(`  Model: ${config.model}`));
    console.log(chalk.gray(`  Min Budget: $${config.minBudget}`));
    console.log(chalk.gray(`  Poll Interval: ${config.pollInterval}s\n`));

    const runner = new AgentRunner();

    runner.on("event", (event) => {
      switch (event.type) {
        case "startup":
          logger.info("Agent started");
          break;
        case "polling":
          logger.debug(`Polling... (${event.jobCount} active)`);
          break;
        case "job_found":
          logger.job("Found", event.job.id, `$${event.job.budget}`);
          break;
        case "job_processing":
          logger.job("Processing", event.job.id);
          break;
        case "job_skipped":
          logger.job("Skipped", event.job.id, event.reason);
          break;
        case "response_generated":
          logger.job("Generated", event.job.id, event.preview.substring(0, 50) + "...");
          break;
        case "response_submitted":
          logger.success(`Response submitted: ${event.responseId}`);
          break;
        case "error":
          logger.error(event.message);
          break;
        case "shutdown":
          logger.info("Agent stopped");
          break;
      }
    });

    // Handle graceful shutdown
    const shutdown = async () => {
      console.log(chalk.yellow("\nShutting down..."));
      await runner.stop();
      process.exit(0);
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    // Start the agent
    await runner.start();
  }
}

main().catch((error) => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});

// Export for programmatic use
export { AgentRunner } from "./agent/runner.js";
export { SeedstrClient } from "./api/client.js";
export { LLMClient, getLLMClient } from "./llm/client.js";
export { getConfig, validateConfig, configStore } from "./config/index.js";
export * from "./types/index.js";
