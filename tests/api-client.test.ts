import { describe, it, expect, vi, beforeEach } from "vitest";
import { SeedstrClient } from "../src/api/client.js";

describe("SeedstrClient", () => {
  let client: SeedstrClient;

  beforeEach(() => {
    client = new SeedstrClient("test-api-key", "https://seedstr.io/api/v1");
    vi.mocked(global.fetch).mockReset();
  });

  describe("register", () => {
    it("should register a new agent", async () => {
      const mockResponse = {
        success: true,
        apiKey: "mj_test_key",
        agentId: "agent_123",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.register("TestWalletAddress123456789012345678901234");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/register",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("TestWalletAddress"),
        })
      );
      expect(result.apiKey).toBe("mj_test_key");
      expect(result.agentId).toBe("agent_123");
    });

    it("should include ownerUrl when provided", async () => {
      const mockResponse = {
        success: true,
        apiKey: "mj_test_key",
        agentId: "agent_123",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await client.register("TestWalletAddress123456789012345678901234", "https://myagent.com");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/register",
        expect.objectContaining({
          body: expect.stringContaining("https://myagent.com"),
        })
      );
    });
  });

  describe("getMe", () => {
    it("should fetch agent info", async () => {
      const mockAgent = {
        id: "agent_123",
        walletAddress: "TestWallet",
        name: "Test Agent",
        bio: "A test agent",
        profilePicture: "/default-avatar.svg",
        reputation: 100,
        jobsCompleted: 5,
        jobsDeclined: 0,
        totalEarnings: 50.0,
        createdAt: "2024-01-01T00:00:00.000Z",
        verification: {
          isVerified: true,
          ownerTwitter: "@testagent",
          verificationRequired: false,
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockAgent,
      } as Response);

      const result = await client.getMe();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/me",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-api-key",
          }),
        })
      );
      expect(result.name).toBe("Test Agent");
      expect(result.verification.isVerified).toBe(true);
    });
  });

  describe("updateProfile", () => {
    it("should update agent profile", async () => {
      const mockResponse = {
        success: true,
        agent: {
          id: "agent_123",
          name: "Updated Name",
          bio: "Updated bio",
          profilePicture: "https://example.com/avatar.png",
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.updateProfile({
        name: "Updated Name",
        bio: "Updated bio",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/me",
        expect.objectContaining({
          method: "PATCH",
          body: expect.stringContaining("Updated Name"),
        })
      );
      expect(result.agent.name).toBe("Updated Name");
    });
  });

  describe("verify", () => {
    it("should trigger verification", async () => {
      const mockResponse = {
        success: true,
        message: "Agent verified successfully!",
        isVerified: true,
        ownerTwitter: "@testagent",
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.verify();

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/verify",
        expect.objectContaining({
          method: "POST",
        })
      );
      expect(result.isVerified).toBe(true);
    });
  });

  describe("listJobs", () => {
    it("should list available jobs", async () => {
      const mockResponse = {
        jobs: [
          {
            id: "job_1",
            prompt: "Write a haiku",
            budget: 5.0,
            status: "OPEN",
            expiresAt: "2024-01-02T00:00:00.000Z",
            createdAt: "2024-01-01T00:00:00.000Z",
            responseCount: 2,
          },
        ],
        pagination: {
          limit: 20,
          offset: 0,
          hasMore: false,
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.listJobs(10, 5);

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/jobs?limit=10&offset=5",
        expect.anything()
      );
      expect(result.jobs).toHaveLength(1);
      expect(result.jobs[0].budget).toBe(5.0);
    });
  });

  describe("submitResponse", () => {
    it("should submit a job response", async () => {
      const mockResponse = {
        success: true,
        response: {
          id: "response_123",
          content: "My response",
          status: "PENDING",
          createdAt: "2024-01-01T00:00:00.000Z",
          jobId: "job_1",
        },
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.submitResponse("job_1", "My response");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://seedstr.io/api/v1/jobs/job_1/respond",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("My response"),
        })
      );
      expect(result.response.id).toBe("response_123");
    });
  });

  describe("error handling", () => {
    it("should throw on API error", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: "unauthorized",
          message: "Invalid API key",
        }),
      } as Response);

      await expect(client.getMe()).rejects.toThrow("Invalid API key");
    });
  });
});
