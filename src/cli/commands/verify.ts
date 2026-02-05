import chalk from "chalk";
import ora from "ora";
import prompts from "prompts";
import { SeedstrClient } from "../../api/client.js";
import {
  isRegistered,
  isVerified,
  saveVerification,
  getStoredAgent,
} from "../../config/index.js";

export async function verifyCommand(): Promise<void> {
  // Check if registered
  if (!isRegistered()) {
    console.log(chalk.red("\n✗ Agent is not registered"));
    console.log(chalk.gray("  Run `npm run register` first"));
    process.exit(1);
  }

  // Check if already verified
  if (isVerified()) {
    console.log(chalk.green("\n✓ Agent is already verified!"));
    return;
  }

  console.log(chalk.cyan("\n🐦 Twitter Verification\n"));

  // Get agent info
  const stored = getStoredAgent();
  const spinner = ora("Fetching verification instructions...").start();

  try {
    const client = new SeedstrClient();
    const agentInfo = await client.getMe();
    spinner.stop();

    if (agentInfo.verification.isVerified) {
      saveVerification(true);
      console.log(chalk.green("✓ Agent is already verified!"));
      console.log(
        chalk.gray(`  Twitter: ${agentInfo.verification.ownerTwitter}`)
      );
      return;
    }

    // Display verification instructions
    const instructions = agentInfo.verification.verificationInstructions;
    if (instructions) {
      console.log(chalk.yellow("To verify your agent, follow these steps:\n"));

      console.log(chalk.white("1. Post this tweet from your agent's Twitter account:\n"));
      console.log(chalk.cyan("─".repeat(50)));
      console.log(chalk.white(`   ${instructions.tweetText}`));
      console.log(chalk.cyan("─".repeat(50)));

      console.log(chalk.white("\n2. After posting, press Enter to verify"));
    } else {
      console.log(chalk.yellow("Post a tweet with your agent ID:"));
      console.log(chalk.cyan(`   Verifying Seedstr agent: ${stored.agentId}`));
    }

    // Wait for user to post tweet
    await prompts({
      type: "confirm",
      name: "posted",
      message: "Have you posted the verification tweet?",
      initial: true,
    });

    // Trigger verification check
    const verifySpinner = ora("Checking for verification tweet...").start();

    const result = await client.verify();

    if (result.isVerified) {
      verifySpinner.succeed("Verification successful!");
      saveVerification(true);

      console.log(chalk.green("\n✓ Agent verified!"));
      console.log(chalk.gray(`  Twitter: ${result.ownerTwitter}`));
      console.log(chalk.cyan("\n🎉 You can now start processing jobs!"));
      console.log(chalk.gray("  Run `npm run start` to begin"));
    } else {
      verifySpinner.fail("Verification failed");
      console.log(chalk.yellow("\n" + result.message));
      console.log(chalk.gray("\nMake sure you:"));
      console.log(chalk.gray("  • Posted the exact verification text"));
      console.log(chalk.gray("  • Posted from a public Twitter account"));
      console.log(chalk.gray("  • Wait a few seconds and try again"));
    }
  } catch (error) {
    spinner.fail("Verification failed");
    console.error(
      chalk.red("\nError:"),
      error instanceof Error ? error.message : "Unknown error"
    );
    process.exit(1);
  }
}
