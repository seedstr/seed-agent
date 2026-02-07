import { EventEmitter } from "events";
import Conf from "conf";
import { SeedstrClient } from "../api/client.js";
import { getLLMClient } from "../llm/client.js";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { cleanupProject } from "../tools/projectBuilder.js";
import type { Job, AgentEvent, TokenUsage, FileAttachment } from "../types/index.js";

// Approximate costs per 1M tokens for common models (input/output)
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "anthropic/claude-sonnet-4": { input: 3.0, output: 15.0 },
  "anthropic/claude-opus-4": { input: 15.0, output: 75.0 },
  "anthropic/claude-3.5-sonnet": { input: 3.0, output: 15.0 },
  "anthropic/claude-3-opus": { input: 15.0, output: 75.0 },
  "openai/gpt-4-turbo": { input: 10.0, output: 30.0 },
  "openai/gpt-4o": { input: 5.0, output: 15.0 },
  "openai/gpt-4o-mini": { input: 0.15, output: 0.6 },
  "meta-llama/llama-3.1-405b-instruct": { input: 3.0, output: 3.0 },
  "meta-llama/llama-3.1-70b-instruct": { input: 0.5, output: 0.5 },
  "google/gemini-pro-1.5": { input: 2.5, output: 7.5 },
  // Default fallback
  default: { input: 1.0, output: 3.0 },
};

function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const costs = MODEL_COSTS[model] || MODEL_COSTS.default;
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

interface TypedEventEmitter {
  on(event: "event", listener: (event: AgentEvent) => void): this;
  emit(event: "event", data: AgentEvent): boolean;
}

// Persistent storage for processed jobs
const jobStore = new Conf<{ processedJobs: string[] }>({
  projectName: "seed-agent",
  projectVersion: "1.0.0",
  configName: "jobs",
  defaults: {
    processedJobs: [],
  },
});

/**
 * Main agent runner that polls for jobs and processes them
 */
export class AgentRunner extends EventEmitter implements TypedEventEmitter {
  private client: SeedstrClient;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private processingJobs: Set<string> = new Set();
  private processedJobs: Set<string>;
  private stats = {
    jobsProcessed: 0,
    jobsSkipped: 0,
    errors: 0,
    startTime: Date.now(),
    totalPromptTokens: 0,
    totalCompletionTokens: 0,
    totalTokens: 0,
    totalCost: 0,
  };

  constructor() {
    super();
    this.client = new SeedstrClient();
    
    // Load previously processed jobs from persistent storage
    const stored = jobStore.get("processedJobs") || [];
    this.processedJobs = new Set(stored);
    logger.debug(`Loaded ${this.processedJobs.size} previously processed jobs`);
  }

  /**
   * Mark a job as processed and persist to storage
   */
  private markJobProcessed(jobId: string): void {
    this.processedJobs.add(jobId);
    
    // Keep only the last 1000 job IDs to prevent unlimited growth
    const jobArray = Array.from(this.processedJobs);
    if (jobArray.length > 1000) {
      const trimmed = jobArray.slice(-1000);
      this.processedJobs = new Set(trimmed);
    }
    
    // Persist to storage
    jobStore.set("processedJobs", Array.from(this.processedJobs));
  }

  /**
   * Emit a typed event
   */
  private emitEvent(event: AgentEvent): void {
    this.emit("event", event);
  }

  /**
   * Start the agent runner
   */
  async start(): Promise<void> {
    if (this.running) {
      logger.warn("Agent is already running");
      return;
    }

    this.running = true;
    this.stats.startTime = Date.now();
    this.emitEvent({ type: "startup" });

    // Start polling loop
    await this.poll();
  }

  /**
   * Stop the agent runner
   */
  async stop(): Promise<void> {
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.emitEvent({ type: "shutdown" });
  }

  /**
   * Poll for new jobs
   */
  private async poll(): Promise<void> {
    if (!this.running) return;

    const config = getConfig();

    try {
      this.emitEvent({ type: "polling", jobCount: this.processingJobs.size });

      // Fetch available jobs
      const response = await this.client.listJobs(20, 0);
      const jobs = response.jobs;

      // Filter and process new jobs
      for (const job of jobs) {
        // Skip if already processing or processed
        if (this.processingJobs.has(job.id) || this.processedJobs.has(job.id)) {
          continue;
        }

        // Check if we're at capacity
        if (this.processingJobs.size >= config.maxConcurrentJobs) {
          break;
        }

        // Check minimum budget
        if (job.budget < config.minBudget) {
          this.emitEvent({
            type: "job_skipped",
            job,
            reason: `Budget $${job.budget} below minimum $${config.minBudget}`,
          });
          this.markJobProcessed(job.id);
          this.stats.jobsSkipped++;
          continue;
        }

        // Process the job
        this.emitEvent({ type: "job_found", job });
        this.processJob(job).catch((error) => {
          this.emitEvent({
            type: "error",
            message: `Failed to process job ${job.id}`,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        });
      }
    } catch (error) {
      this.emitEvent({
        type: "error",
        message: "Failed to poll for jobs",
        error: error instanceof Error ? error : new Error(String(error)),
      });
      this.stats.errors++;
    }

    // Schedule next poll
    if (this.running) {
      this.pollTimer = setTimeout(() => this.poll(), config.pollInterval * 1000);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    this.processingJobs.add(job.id);
    this.emitEvent({ type: "job_processing", job });

    try {
      // Generate response using LLM
      const llm = getLLMClient();
      const config = getConfig();
      const result = await llm.generate({
        prompt: job.prompt,
        systemPrompt: `You are an AI agent participating in the Seedstr marketplace. Your task is to provide the best possible response to job requests.

Guidelines:
- Be helpful, accurate, and thorough
- Use tools when needed to get current information
- Provide well-structured, clear responses
- Be professional and concise
- If you use web search, cite your sources

IMPORTANT - Building Projects:
When asked to BUILD, CREATE, MAKE, or GENERATE a website, app, tool, script, or any code project:
1. Use the create_file tool to create each necessary file
2. After creating all files, use finalize_project to package them into a zip
3. Provide a clear summary of what you built and how to use it

Example build request: "Build me a landing page for my coffee shop called Bean Dreams"
- You would create index.html, styles.css, and any other needed files
- Then call finalize_project with a name like "bean-dreams-website"
- Provide a summary explaining the website and how to open/deploy it

Job Budget: $${job.budget.toFixed(2)} USD
This indicates how much the requester values this task. Higher budgets often mean the requester wants something built, not just described.`,
        tools: true,
      });

      // Track token usage
      let usage: TokenUsage | undefined;
      if (result.usage) {
        const cost = estimateCost(
          config.model,
          result.usage.promptTokens,
          result.usage.completionTokens
        );
        usage = {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
          estimatedCost: cost,
        };
        
        // Update cumulative stats
        this.stats.totalPromptTokens += result.usage.promptTokens;
        this.stats.totalCompletionTokens += result.usage.completionTokens;
        this.stats.totalTokens += result.usage.totalTokens;
        this.stats.totalCost += cost;
      }

      this.emitEvent({
        type: "response_generated",
        job,
        preview: result.text.substring(0, 200),
        usage,
      });

      // Check if a project was built
      if (result.projectBuild && result.projectBuild.success) {
        const { projectBuild } = result;
        
        this.emitEvent({
          type: "project_built",
          job,
          files: projectBuild.files,
          zipPath: projectBuild.zipPath,
        });

        try {
          // Upload the zip file
          this.emitEvent({
            type: "files_uploading",
            job,
            fileCount: 1,
          });

          const uploadedFiles = await this.client.uploadFile(projectBuild.zipPath);
          
          this.emitEvent({
            type: "files_uploaded",
            job,
            files: [uploadedFiles],
          });

          // Submit response with file attachment
          const submitResult = await this.client.submitResponseWithFiles(job.id, {
            content: result.text,
            responseType: "FILE",
            files: [uploadedFiles],
          });

          this.emitEvent({
            type: "response_submitted",
            job,
            responseId: submitResult.response.id,
            hasFiles: true,
          });

          // Cleanup project files
          cleanupProject(projectBuild.projectDir, projectBuild.zipPath);
        } catch (uploadError) {
          // If upload fails, fall back to text-only response
          logger.error("Failed to upload project files, submitting text-only response:", uploadError);
          
          const submitResult = await this.client.submitResponse(job.id, result.text);
          this.emitEvent({
            type: "response_submitted",
            job,
            responseId: submitResult.response.id,
            hasFiles: false,
          });

          // Still cleanup
          cleanupProject(projectBuild.projectDir, projectBuild.zipPath);
        }
      } else {
        // Text-only response
        const submitResult = await this.client.submitResponse(job.id, result.text);

        this.emitEvent({
          type: "response_submitted",
          job,
          responseId: submitResult.response.id,
          hasFiles: false,
        });
      }

      this.stats.jobsProcessed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Handle "already submitted" error gracefully - not really an error
      if (errorMessage.includes("already submitted")) {
        logger.debug(`Already responded to job ${job.id}, skipping`);
      } else {
        this.emitEvent({
          type: "error",
          message: `Error processing job ${job.id}: ${errorMessage}`,
          error: error instanceof Error ? error : new Error(String(error)),
        });
        this.stats.errors++;
      }
    } finally {
      this.processingJobs.delete(job.id);
      this.markJobProcessed(job.id);
    }
  }

  /**
   * Get current stats
   */
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime,
      activeJobs: this.processingJobs.size,
      avgTokensPerJob: this.stats.jobsProcessed > 0 
        ? Math.round(this.stats.totalTokens / this.stats.jobsProcessed)
        : 0,
      avgCostPerJob: this.stats.jobsProcessed > 0
        ? this.stats.totalCost / this.stats.jobsProcessed
        : 0,
    };
  }

  /**
   * Check if the agent is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

export default AgentRunner;
