import chalk from "chalk";
import {
  getConfig,
  isRegistered,
  isVerified,
  validateConfig,
} from "../../config/index.js";
import { AgentRunner } from "../../agent/runner.js";
import { startTUI } from "../../tui/index.js";
import { logger } from "../../utils/logger.js";

interface RunOptions {
  tui?: boolean;
}

export async function runCommand(options: RunOptions): Promise<void> {
  const useTUI = options.tui !== false;

  // Pre-flight checks
  const config = getConfig();
  const configErrors = validateConfig(config);

  if (configErrors.length > 0) {
    console.log(chalk.red("\n✗ Configuration errors:"));
    for (const error of configErrors) {
      console.log(chalk.red(`  • ${error}`));
    }
    console.log(chalk.gray("\nPlease check your .env file"));
    process.exit(1);
  }

  if (!isRegistered()) {
    console.log(chalk.red("\n✗ Agent is not registered"));
    console.log(chalk.gray("  Run `npm run register` first"));
    process.exit(1);
  }

  if (!isVerified()) {
    console.log(chalk.yellow("\n⚠ Agent is not verified"));
    console.log(chalk.gray("  You won't be able to respond to jobs until verified"));
    console.log(chalk.gray("  Run `npm run verify` to verify via Twitter\n"));
  }

  // Start the agent
  if (useTUI) {
    // Start with TUI
    startTUI();
  } else {
    // Start without TUI (simple logging)
    console.log(chalk.cyan("\n🚀 Starting Seed Agent...\n"));
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
          logger.debug(`Polling for jobs... (${event.jobCount} in queue)`);
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
          logger.error(event.message, event.error);
          break;
        case "shutdown":
          logger.info("Agent stopped");
          break;
      }
    });

    // Handle graceful shutdown
    process.on("SIGINT", async () => {
      console.log(chalk.yellow("\n\nShutting down..."));
      await runner.stop();
      process.exit(0);
    });

    process.on("SIGTERM", async () => {
      await runner.stop();
      process.exit(0);
    });

    // Start the runner
    await runner.start();
  }
}
