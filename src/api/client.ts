import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { readFileSync, statSync } from "fs";
import { basename } from "path";
import type {
  AgentInfo,
  Job,
  JobsListResponse,
  RegisterResponse,
  SubmitResponseResult,
  SubmitResponseOptions,
  VerifyResponse,
  UpdateProfileResponse,
  ApiError,
  FileAttachment,
  FileUploadResult,
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
   * Submit a response to a job (text-only, for backward compatibility)
   */
  async submitResponse(
    jobId: string,
    content: string
  ): Promise<SubmitResponseResult> {
    return this.request<SubmitResponseResult>(`/jobs/${jobId}/respond`, {
      method: "POST",
      body: JSON.stringify({ content, responseType: "TEXT" }),
    });
  }

  /**
   * Submit a response with optional file attachments
   */
  async submitResponseWithFiles(
    jobId: string,
    options: SubmitResponseOptions
  ): Promise<SubmitResponseResult> {
    const body: Record<string, unknown> = {
      content: options.content,
      responseType: options.responseType || "TEXT",
    };

    if (options.files && options.files.length > 0) {
      body.files = options.files;
    }

    return this.request<SubmitResponseResult>(`/jobs/${jobId}/respond`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  /**
   * Upload a file to the Seedstr file upload service
   * Returns the file URL and metadata for use in responses
   */
  async uploadFile(filePath: string): Promise<FileAttachment> {
    const config = getConfig();
    
    // Get file info
    const stats = statSync(filePath);
    const fileName = basename(filePath);
    
    // Determine MIME type based on extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      zip: "application/zip",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      json: "application/json",
      html: "text/html",
      css: "text/css",
      js: "text/javascript",
      ts: "text/typescript",
      md: "text/markdown",
      txt: "text/plain",
      tar: "application/x-tar",
      gz: "application/gzip",
    };
    const mimeType = mimeTypes[ext] || "application/octet-stream";

    logger.debug(`Uploading file: ${fileName} (${stats.size} bytes, ${mimeType})`);

    // Read file and convert to base64
    const fileBuffer = readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");

    // Upload to the v1/upload endpoint (server-side upload API)
    const uploadUrl = `${config.seedstrApiUrl}/upload`;
    
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        files: [
          {
            name: fileName,
            content: base64Content,
            type: mimeType,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error(`Upload failed: ${response.status} - ${errorText}`);
      throw new Error(`File upload failed: ${response.status}`);
    }

    const result = (await response.json()) as { success: boolean; files: FileUploadResult[]; failed?: { name: string; error: string }[] };
    
    if (!result.success || !result.files || result.files.length === 0) {
      throw new Error("Upload failed: No files returned");
    }
    
    const fileResult = result.files[0];
    logger.debug(`File uploaded successfully: ${fileResult.url}`);

    return {
      url: fileResult.url,
      name: fileResult.name,
      size: fileResult.size,
      type: fileResult.type,
    };
  }

  /**
   * Upload multiple files and return their attachments
   */
  async uploadFiles(filePaths: string[]): Promise<FileAttachment[]> {
    const attachments: FileAttachment[] = [];
    
    for (const filePath of filePaths) {
      const attachment = await this.uploadFile(filePath);
      attachments.push(attachment);
    }
    
    return attachments;
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
