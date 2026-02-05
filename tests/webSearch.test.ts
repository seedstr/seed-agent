import { describe, it, expect, vi, beforeEach } from "vitest";
import { webSearch } from "../src/tools/webSearch.js";

describe("Web Search Tool", () => {
  beforeEach(() => {
    vi.mocked(global.fetch).mockReset();
  });

  describe("DuckDuckGo Search (default)", () => {
    it("should return search results from DuckDuckGo", async () => {
      const mockDDGResponse = {
        Abstract: "Test abstract content",
        AbstractURL: "https://example.com",
        Heading: "Test Heading",
        RelatedTopics: [
          {
            Text: "Related topic 1 - Description",
            FirstURL: "https://example.com/1",
          },
          {
            Text: "Related topic 2 - Description",
            FirstURL: "https://example.com/2",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockDDGResponse,
      } as Response);

      const results = await webSearch("test query");

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("api.duckduckgo.com")
      );
      expect(results).toHaveLength(3); // 1 abstract + 2 related topics
      expect(results[0].title).toBe("Test Heading");
      expect(results[0].snippet).toBe("Test abstract content");
    });

    it("should handle empty DuckDuckGo response", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      const results = await webSearch("no results query");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("No instant results available");
    });

    it("should handle DuckDuckGo API errors gracefully", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      const results = await webSearch("error query");

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Search unavailable");
    });
  });

  describe("Tavily Search", () => {
    it("should use Tavily when API key is provided", async () => {
      // Set Tavily API key
      process.env.TAVILY_API_KEY = "test-tavily-key";

      const mockTavilyResponse = {
        results: [
          {
            title: "Tavily Result 1",
            url: "https://tavily.com/1",
            content: "Content from Tavily",
          },
          {
            title: "Tavily Result 2",
            url: "https://tavily.com/2",
            content: "More content from Tavily",
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockTavilyResponse,
      } as Response);

      const results = await webSearch("tavily test");

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.tavily.com/search",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("tavily test"),
        })
      );
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe("Tavily Result 1");

      // Clean up
      delete process.env.TAVILY_API_KEY;
    });

    it("should fall back to DuckDuckGo when Tavily fails", async () => {
      process.env.TAVILY_API_KEY = "test-tavily-key";

      // Tavily fails
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      // DuckDuckGo succeeds
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Abstract: "Fallback result",
          AbstractURL: "https://fallback.com",
          Heading: "Fallback",
        }),
      } as Response);

      const results = await webSearch("fallback test");

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(results[0].title).toBe("Fallback");

      delete process.env.TAVILY_API_KEY;
    });
  });
});
