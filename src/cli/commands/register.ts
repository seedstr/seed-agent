import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { SeedstrClient } from "../../api/client.js";
import {
  getConfig,
  saveRegistration,
  isRegistered,
  getStoredAgent,
} from "../../config/index.js";
import type { WalletType } from "../../types/index.js";

interface RegisterOptions {
  wallet?: string;
  walletType?: string;
  url?: string;
}

export async function registerCommand(options: RegisterOptions): Promise<void> {
  // Check if already registered
  if (isRegistered()) {
    const stored = getStoredAgent();
    console.log(chalk.yellow("\n⚠ Agent is already registered!"));
    console.log(chalk.gray(`  Agent ID: ${stored.agentId}`));
    console.log(chalk.gray(`  Wallet: ${stored.walletAddress}`));
    console.log(chalk.gray(`  Wallet Type: ${stored.walletType || "ETH"}`));

    const { confirm } = await prompts({
      type: "confirm",
      name: "confirm",
      message: "Do you want to register a new agent? (This will overwrite existing config)",
      initial: false,
    });

    if (!confirm) {
      console.log(chalk.gray("\nRegistration cancelled."));
      return;
    }
  }

  console.log(chalk.cyan("\n📝 Agent Registration\n"));

  // Get wallet type (ETH or SOL)
  let walletType: WalletType;
  if (options.walletType && (options.walletType === "ETH" || options.walletType === "SOL")) {
    walletType = options.walletType;
  } else {
    const response = await prompts({
      type: "select",
      name: "walletType",
      message: "Which wallet type would you like to use for payments?",
      choices: [
        { title: "ETH (Ethereum)", value: "ETH", description: "Receive payments in ETH (default)" },
        { title: "SOL (Solana)", value: "SOL", description: "Receive payments in SOL" },
      ],
      initial: 0,
    });
    walletType = response.walletType;
  }

  if (!walletType) {
    console.log(chalk.red("\n✗ Wallet type selection is required"));
    process.exit(1);
  }

  console.log(chalk.gray(`  Wallet type: ${walletType}\n`));

  // Get wallet address
  let walletAddress = options.wallet;
  if (!walletAddress) {
    const config = getConfig();
    walletAddress = config.walletAddress;

    if (!walletAddress) {
      const addressLabel = walletType === "ETH" ? "Ethereum (0x...)" : "Solana";
      const response = await prompts({
        type: "text",
        name: "wallet",
        message: `Enter your ${addressLabel} wallet address:`,
        validate: (value: string) => {
          if (walletType === "ETH") {
            return /^0x[0-9a-fA-F]{40}$/.test(value) ? true : "Please enter a valid Ethereum address (0x followed by 40 hex characters)";
          }
          return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value) ? true : "Please enter a valid Solana address (32-44 base58 characters)";
        },
      });
      walletAddress = response.wallet;
    } else {
      console.log(chalk.gray(`Using wallet from config: ${walletAddress}\n`));
    }
  }

  if (!walletAddress) {
    console.log(chalk.red("\n✗ Wallet address is required"));
    process.exit(1);
  }

  // Get optional owner URL
  let ownerUrl = options.url;
  if (!ownerUrl) {
    const response = await prompts({
      type: "text",
      name: "url",
      message: "Enter your agent's homepage URL (optional):",
    });
    ownerUrl = response.url || undefined;
  }

  // Register with API
  const spinner = ora("Registering agent...").start();

  try {
    const client = new SeedstrClient("", getConfig().seedstrApiUrl);
    const result = await client.register(walletAddress, walletType, ownerUrl);

    spinner.succeed("Agent registered successfully!");

    // Save registration data
    saveRegistration({
      apiKey: result.apiKey,
      agentId: result.agentId,
      walletAddress,
      walletType,
    });

    console.log("\n" + chalk.green("✓ Registration complete!"));
    console.log(chalk.gray("─".repeat(50)));
    console.log(chalk.white("  Agent ID:      ") + chalk.cyan(result.agentId));
    console.log(chalk.white("  API Key:       ") + chalk.cyan(result.apiKey));
    console.log(chalk.white("  Wallet Type:   ") + chalk.cyan(walletType));
    console.log(chalk.gray("─".repeat(50)));

    console.log(chalk.yellow("\n⚠ Important: Your API key has been saved locally."));
    console.log(chalk.gray("  You can also add it to your .env file as SEEDSTR_API_KEY"));

    console.log(chalk.cyan("\n📋 Next steps:"));
    console.log(chalk.gray("  1. Run `npm run verify` to verify your agent via Twitter"));
    console.log(chalk.gray("  2. Run `npm run profile -- --name \"Your Agent Name\"` to set your profile"));
    console.log(chalk.gray("  3. Run `npm run start` to start processing jobs"));
  } catch (error) {
    spinner.fail("Registration failed");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
