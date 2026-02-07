import React, { useState, useEffect } from "react";
import { render, Box, Text, useApp, useInput } from "ink";
import Spinner from "ink-spinner";
import { AgentRunner } from "../agent/runner.js";
import { getConfig, getStoredAgent } from "../config/index.js";
import type { AgentEvent } from "../types/index.js";

interface LogEntry {
  time: string;
  type: string;
  message: string;
  color?: string;
}

interface Stats {
  jobsProcessed: number;
  jobsSkipped: number;
  errors: number;
  uptime: number;
  activeJobs: number;
  totalTokens: number;
  totalCost: number;
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function Header() {
  const stored = getStoredAgent();
  const config = getConfig();

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="cyan" bold>
          🌱 Seed Agent
        </Text>
        <Text color="gray"> │ </Text>
        <Text color="white">{stored.name || "Unnamed Agent"}</Text>
        {stored.isVerified && <Text color="green"> ✓</Text>}
      </Box>
      <Box>
        <Text color="gray">Model: {config.model}</Text>
        <Text color="gray"> │ </Text>
        <Text color="gray">Min: ${config.minBudget}</Text>
        <Text color="gray"> │ </Text>
        <Text color="gray">Poll: {config.pollInterval}s</Text>
      </Box>
    </Box>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`;
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toString();
}

function formatCost(cost: number): string {
  if (cost < 0.01) {
    return `$${cost.toFixed(4)}`;
  }
  return `$${cost.toFixed(2)}`;
}

function StatsPanel({ stats, running }: { stats: Stats; running: boolean }) {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginBottom={1}
    >
      <Box>
        {running ? (
          <Text color="green">
            <Spinner type="dots" /> Running
          </Text>
        ) : (
          <Text color="yellow">Stopped</Text>
        )}
        <Text color="gray"> │ </Text>
        <Text color="white">{formatUptime(stats.uptime)}</Text>
        <Text color="gray"> │ </Text>
        <Text color="green">✓ {stats.jobsProcessed}</Text>
        <Text color="gray"> │ </Text>
        <Text color="yellow">⊘ {stats.jobsSkipped}</Text>
        <Text color="gray"> │ </Text>
        <Text color="red">✗ {stats.errors}</Text>
        <Text color="gray"> │ </Text>
        <Text color="magenta">{formatTokens(stats.totalTokens)} tokens</Text>
        <Text color="gray"> │ </Text>
        <Text color="yellow">{formatCost(stats.totalCost)}</Text>
      </Box>
    </Box>
  );
}

function LogPanel({ logs }: { logs: LogEntry[] }) {
  const visibleLogs = logs.slice(-12);

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      height={14}
    >
      <Text color="cyan" bold>
        Activity Log
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {visibleLogs.length === 0 ? (
          <Text color="gray">Waiting for activity...</Text>
        ) : (
          visibleLogs.map((log, i) => (
            <Box key={i}>
              <Text color="gray">[{log.time}] </Text>
              <Text color={(log.color as Parameters<typeof Text>[0]["color"]) || "white"}>
                {log.message}
              </Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

function HelpBar() {
  return (
    <Box marginTop={1}>
      <Text color="gray">
        Press <Text color="cyan">q</Text> to quit │{" "}
        <Text color="cyan">r</Text> to refresh stats
      </Text>
    </Box>
  );
}

function App() {
  const { exit } = useApp();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stats, setStats] = useState<Stats>({
    jobsProcessed: 0,
    jobsSkipped: 0,
    errors: 0,
    uptime: 0,
    activeJobs: 0,
    totalTokens: 0,
    totalCost: 0,
  });
  const [running, setRunning] = useState(false);
  const [runner] = useState(() => new AgentRunner());

  const addLog = (type: string, message: string, color?: string) => {
    const time = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prev) => [...prev.slice(-50), { time, type, message, color }]);
  };

  useEffect(() => {
    // Handle events from runner
    const handleEvent = (event: AgentEvent) => {
      switch (event.type) {
        case "startup":
          setRunning(true);
          addLog("info", "Agent started", "green");
          break;
        case "polling":
          // Don't log every poll
          break;
        case "job_found":
          addLog("job", `Found job: $${event.job.budget.toFixed(2)} - ${event.job.prompt.substring(0, 40)}...`, "cyan");
          break;
        case "job_processing":
          addLog("job", `Processing: ${event.job.id.substring(0, 8)}...`, "blue");
          break;
        case "job_skipped":
          addLog("skip", `Skipped: ${event.reason}`, "yellow");
          break;
        case "tool_call":
          addLog("tool", `Tool: ${event.tool}`, "magenta");
          break;
        case "response_generated":
          const usageInfo = event.usage 
            ? ` (${formatTokens(event.usage.totalTokens)} tokens, ${formatCost(event.usage.estimatedCost)})`
            : "";
          addLog("gen", `Generated: ${event.preview.substring(0, 40)}...${usageInfo}`, "white");
          break;
        case "project_built":
          addLog("build", `📦 Built project: ${event.files.length} files`, "magenta");
          break;
        case "files_uploading":
          addLog("upload", `⬆️ Uploading ${event.fileCount} file(s)...`, "blue");
          break;
        case "files_uploaded":
          addLog("upload", `✅ Uploaded: ${event.files.map(f => f.name).join(", ")}`, "green");
          break;
        case "response_submitted":
          const fileInfo = event.hasFiles ? " (with files)" : "";
          addLog("done", `Submitted: ${event.responseId.substring(0, 8)}...${fileInfo}`, "green");
          break;
        case "error":
          addLog("error", event.message, "red");
          break;
        case "shutdown":
          setRunning(false);
          addLog("info", "Agent stopped", "yellow");
          break;
      }

      // Update stats
      setStats(runner.getStats());
    };

    runner.on("event", handleEvent);

    // Start the runner
    runner.start();

    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (runner.isRunning()) {
        setStats(runner.getStats());
      }
    }, 1000);

    return () => {
      clearInterval(statsInterval);
      runner.stop();
    };
  }, [runner]);

  useInput((input, key) => {
    if (input === "q" || (key.ctrl && input === "c")) {
      runner.stop().then(() => {
        exit();
      });
    }
    if (input === "r") {
      setStats(runner.getStats());
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Header />
      <StatsPanel stats={stats} running={running} />
      <LogPanel logs={logs} />
      <HelpBar />
    </Box>
  );
}

export function startTUI() {
  render(<App />);
}

export default startTUI;
