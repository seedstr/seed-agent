import chalk from "chalk";
import { getConfig } from "../config/index.js";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const config = getConfig();
  return LOG_LEVELS[level] >= LOG_LEVELS[config.logLevel];
}

function timestamp(): string {
  return new Date().toISOString().substring(11, 19);
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (shouldLog("debug")) {
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.magenta("[DEBUG]"),
        message,
        ...args
      );
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.blue("[INFO]"),
        message,
        ...args
      );
    }
  },

  success(message: string, ...args: unknown[]): void {
    if (shouldLog("info")) {
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.green("[SUCCESS]"),
        message,
        ...args
      );
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (shouldLog("warn")) {
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.yellow("[WARN]"),
        message,
        ...args
      );
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (shouldLog("error")) {
      console.error(
        chalk.gray(`[${timestamp()}]`),
        chalk.red("[ERROR]"),
        message,
        ...args
      );
    }
  },

  // Special formatting for agent events
  job(action: string, jobId: string, details?: string): void {
    if (shouldLog("info")) {
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.cyan("[JOB]"),
        chalk.bold(action),
        chalk.dim(jobId.substring(0, 8) + "..."),
        details ? chalk.gray(details) : ""
      );
    }
  },

  tool(name: string, status: "start" | "success" | "error", details?: string): void {
    if (shouldLog("debug")) {
      const statusIcon =
        status === "start" ? "⚡" : status === "success" ? "✓" : "✗";
      const statusColor =
        status === "start"
          ? chalk.yellow
          : status === "success"
          ? chalk.green
          : chalk.red;
      console.log(
        chalk.gray(`[${timestamp()}]`),
        chalk.magenta("[TOOL]"),
        statusColor(statusIcon),
        chalk.bold(name),
        details ? chalk.gray(details) : ""
      );
    }
  },
};

export default logger;
