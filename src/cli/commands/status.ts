import chalk from "chalk";
import ora from "ora";
import { SeedstrClient } from "../../api/client.js";
import {
  getConfig,
  isRegistered,
  getStoredAgent,
  validateConfig,
} from "../../config/index.js";

export async function statusCommand(): Promise<void> {
  console.log(chalk.cyan("\n🔍 Agent Status\n"));

  const config = getConfig();
  const stored = getStoredAgent();

  // Configuration check
  console.log(chalk.white("Configuration:"));
  console.log(chalk.gray("─".repeat(50)));

  const configErrors = validateConfig(config);

  // OpenRouter API Key
  if (config.openrouterApiKey) {
    console.log(
      chalk.green("  ✓ ") +
        chalk.white("OpenRouter API Key: ") +
        chalk.gray(config.openrouterApiKey.substring(0, 20) + "...")
    );
  } else {
    console.log(
      chalk.red("  ✗ ") +
        chalk.white("OpenRouter API Key: ") +
        chalk.red("Not set")
    );
  }

  // Wallet Address
  if (config.solanaWalletAddress) {
    console.log(
      chalk.green("  ✓ ") +
        chalk.white("Wallet Address: ") +
        chalk.gray(config.solanaWalletAddress.substring(0, 20) + "...")
    );
  } else {
    console.log(
      chalk.red("  ✗ ") +
        chalk.white("Wallet Address: ") +
        chalk.red("Not set")
    );
  }

  // Model
  console.log(
    chalk.green("  ✓ ") + chalk.white("Model: ") + chalk.gray(config.model)
  );

  // Tools
  const enabledTools = [];
  if (config.tools.webSearchEnabled) enabledTools.push("Web Search");
  if (config.tools.calculatorEnabled) enabledTools.push("Calculator");
  if (config.tools.codeInterpreterEnabled) enabledTools.push("Code Analysis");

  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Tools: ") +
      chalk.gray(enabledTools.join(", ") || "None")
  );

  console.log(chalk.gray("─".repeat(50)));

  // Registration check
  console.log(chalk.white("\nRegistration:"));
  console.log(chalk.gray("─".repeat(50)));

  if (!isRegistered()) {
    console.log(
      chalk.red("  ✗ ") + chalk.white("Status: ") + chalk.red("Not registered")
    );
    console.log(chalk.gray("\n  Run `npm run register` to register your agent"));
    console.log(chalk.gray("─".repeat(50)));

    if (configErrors.length > 0) {
      console.log(chalk.yellow("\n⚠ Configuration issues:"));
      for (const error of configErrors) {
        console.log(chalk.yellow(`  • ${error}`));
      }
    }
    return;
  }

  console.log(
    chalk.green("  ✓ ") + chalk.white("Status: ") + chalk.green("Registered")
  );
  console.log(
    chalk.green("  ✓ ") +
      chalk.white("Agent ID: ") +
      chalk.gray(stored.agentId || "Unknown")
  );

  // Fetch live status from API
  const spinner = ora("Checking verification status...").start();

  try {
    const client = new SeedstrClient();
    const agentInfo = await client.getMe();
    spinner.stop();

    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white("\nVerification:"));
    console.log(chalk.gray("─".repeat(50)));

    if (agentInfo.verification.isVerified) {
      console.log(
        chalk.green("  ✓ ") + chalk.white("Status: ") + chalk.green("Verified")
      );
      console.log(
        chalk.green("  ✓ ") +
          chalk.white("Twitter: ") +
          chalk.cyan(agentInfo.verification.ownerTwitter || "Unknown")
      );
    } else {
      console.log(
        chalk.yellow("  ✗ ") +
          chalk.white("Status: ") +
          chalk.yellow("Not verified")
      );
      console.log(
        chalk.gray("\n  Run `npm run verify` to verify via Twitter")
      );
    }

    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white("\nStats:"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(
      chalk.white("  Reputation:     ") + chalk.cyan(agentInfo.reputation)
    );
    console.log(
      chalk.white("  Jobs Completed: ") + chalk.cyan(agentInfo.jobsCompleted)
    );
    console.log(
      chalk.white("  Jobs Declined:  ") + chalk.gray(agentInfo.jobsDeclined)
    );
    console.log(
      chalk.white("  Total Earnings: ") +
        chalk.green(`$${agentInfo.totalEarnings.toFixed(2)}`)
    );
    console.log(chalk.gray("─".repeat(50)));

    // Ready check
    console.log(chalk.white("\nReady to run:"));
    console.log(chalk.gray("─".repeat(50)));

    const issues = [];
    if (configErrors.length > 0) {
      issues.push(...configErrors);
    }
    if (!agentInfo.verification.isVerified) {
      issues.push("Agent is not verified (run `npm run verify`)");
    }

    if (issues.length === 0) {
      console.log(
        chalk.green("  ✓ ") +
          chalk.white("All checks passed! ") +
          chalk.gray("Run `npm run start` to begin")
      );
    } else {
      console.log(chalk.yellow("  ⚠ Issues to resolve:"));
      for (const issue of issues) {
        console.log(chalk.yellow(`    • ${issue}`));
      }
    }
    console.log(chalk.gray("─".repeat(50)));
  } catch (error) {
    spinner.fail("Failed to fetch status");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}
