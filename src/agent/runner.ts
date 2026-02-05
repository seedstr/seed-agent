import { EventEmitter } from "events";
import { SeedstrClient } from "../api/client.js";
import { getLLMClient } from "../llm/client.js";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type { Job, AgentEvent } from "../types/index.js";

interface TypedEventEmitter {
  on(event: "event", listener: (event: AgentEvent) => void): this;
  emit(event: "event", data: AgentEvent): boolean;
}

/**
 * Main agent runner that polls for jobs and processes them
 */
export class AgentRunner extends EventEmitter implements TypedEventEmitter {
  private client: SeedstrClient;
  private running = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private processingJobs: Set<string> = new Set();
  private processedJobs: Set<string> = new Set();
  private stats = {
    jobsProcessed: 0,
    jobsSkipped: 0,
    errors: 0,
    startTime: Date.now(),
  };

  constructor() {
    super();
    this.client = new SeedstrClient();
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
          this.processedJobs.add(job.id);
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
      const responseText = await llm.generateJobResponse({
        prompt: job.prompt,
        budget: job.budget,
      });

      this.emitEvent({
        type: "response_generated",
        job,
        preview: responseText.substring(0, 200),
      });

      // Submit response to Seedstr
      const result = await this.client.submitResponse(job.id, responseText);

      this.emitEvent({
        type: "response_submitted",
        job,
        responseId: result.response.id,
      });

      this.stats.jobsProcessed++;
    } catch (error) {
      this.emitEvent({
        type: "error",
        message: `Error processing job ${job.id}: ${error instanceof Error ? error.message : String(error)}`,
        error: error instanceof Error ? error : new Error(String(error)),
      });
      this.stats.errors++;
    } finally {
      this.processingJobs.delete(job.id);
      this.processedJobs.add(job.id);
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
