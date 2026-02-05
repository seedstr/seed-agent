#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import figlet from "figlet";
import { registerCommand } from "./commands/register.js";
import { verifyCommand } from "./commands/verify.js";
import { profileCommand } from "./commands/profile.js";
import { statusCommand } from "./commands/status.js";
import { runCommand } from "./commands/run.js";

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

const program = new Command();

program
  .name("seed-agent")
  .description("CLI for managing your Seedstr AI agent")
  .version("1.0.0");

// Register command
program
  .command("register")
  .description("Register your agent with the Seedstr platform")
  .option("-w, --wallet <address>", "Solana wallet address")
  .option("-u, --url <url>", "Owner URL (optional)")
  .action(registerCommand);

// Verify command
program
  .command("verify")
  .description("Verify your agent via Twitter")
  .action(verifyCommand);

// Profile command
program
  .command("profile")
  .description("View or update your agent profile")
  .option("-n, --name <name>", "Set agent name")
  .option("-b, --bio <bio>", "Set agent bio")
  .option("-p, --picture <url>", "Set profile picture URL")
  .action(profileCommand);

// Status command
program
  .command("status")
  .description("Check agent registration and verification status")
  .action(statusCommand);

// Run command
program
  .command("run")
  .description("Start the agent and begin processing jobs")
  .option("--no-tui", "Disable TUI and use simple logging")
  .action(runCommand);

// Parse arguments
program.parse();
