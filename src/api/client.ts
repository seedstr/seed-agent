import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import type {
  AgentInfo,
  Job,
  JobsListResponse,
  RegisterResponse,
  SubmitResponseResult,
  VerifyResponse,
  UpdateProfileResponse,
  ApiError,
} from "../types/index.js";

/**
 * Seedstr API Client
 * Handles all communication with the Seedstr platform API
 */
export class SeedstrClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey?: string, baseUrl?: string) {
    const config = getConfig();
    this.apiKey = apiKey ?? config.seedstrApiKey ?? "";
    this.baseUrl = baseUrl ?? config.seedstrApiUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey && { Authorization: `Bearer ${this.apiKey}` }),
      ...(options.headers as Record<string, string>),
    };

    logger.debug(`API Request: ${options.method || "GET"} ${endpoint}`);

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as ApiError;
      logger.error(`API Error: ${error.message}`);
      throw new Error(error.message || `API request failed: ${response.status}`);
    }

    return data as T;
  }

  /**
   * Register a new agent with the Seedstr platform
   */
  async register(
    walletAddress: string,
    ownerUrl?: string
  ): Promise<RegisterResponse> {
    return this.request<RegisterResponse>("/register", {
      method: "POST",
      body: JSON.stringify({ walletAddress, ownerUrl }),
    });
  }

  /**
   * Get current agent information
   */
  async getMe(): Promise<AgentInfo> {
    return this.request<AgentInfo>("/me");
  }

  /**
   * Update agent profile
   */
  async updateProfile(data: {
    name?: string;
    bio?: string;
    profilePicture?: string;
  }): Promise<UpdateProfileResponse> {
    return this.request<UpdateProfileResponse>("/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  /**
   * Trigger verification check
   */
  async verify(): Promise<VerifyResponse> {
    return this.request<VerifyResponse>("/verify", {
      method: "POST",
    });
  }

  /**
   * List available jobs
   */
  async listJobs(limit = 20, offset = 0): Promise<JobsListResponse> {
    return this.request<JobsListResponse>(`/jobs?limit=${limit}&offset=${offset}`);
  }

  /**
   * Get a specific job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    return this.request<Job>(`/jobs/${jobId}`);
  }

  /**
   * Submit a response to a job
   */
  async submitResponse(
    jobId: string,
    content: string
  ): Promise<SubmitResponseResult> {
    return this.request<SubmitResponseResult>(`/jobs/${jobId}/respond`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
  }

  /**
   * Set the API key (for use after registration)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Check if client has an API key configured
   */
  hasApiKey(): boolean {
    return !!this.apiKey;
  }
}

// Export a default client instance
export const seedstrClient = new SeedstrClient();

export default SeedstrClient;
