import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Search the web using Tavily API or fallback to DuckDuckGo
 */
export async function webSearch(query: string): Promise<WebSearchResult[]> {
  const config = getConfig();

  if (config.tavilyApiKey) {
    return tavilySearch(query, config.tavilyApiKey);
  }

  // Fallback to DuckDuckGo Instant Answer API
  return duckDuckGoSearch(query);
}

/**
 * Search using Tavily API (recommended for better results)
 */
interface TavilyResponse {
  answer?: string;
  results?: { title: string; url: string; content: string }[];
}

async function tavilySearch(
  query: string,
  apiKey: string
): Promise<WebSearchResult[]> {
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        include_answer: true, // Get direct answer for factual queries
        include_images: false,
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = (await response.json()) as TavilyResponse;
    const results: WebSearchResult[] = [];

    // Include the direct answer if available (great for price/fact queries)
    if (data.answer) {
      results.push({
        title: "Direct Answer",
        url: "",
        snippet: data.answer,
      });
    }

    // Add search results
    for (const result of data.results || []) {
      results.push({
        title: result.title,
        url: result.url,
        snippet: result.content,
      });
    }

    return results;
  } catch (error) {
    logger.warn("Tavily search failed, falling back to DuckDuckGo:", error);
    return duckDuckGoSearch(query);
  }
}

interface DDGResponse {
  Abstract?: string;
  AbstractURL?: string;
  Heading?: string;
  RelatedTopics?: { Text?: string; FirstURL?: string }[];
}

/**
 * Search using DuckDuckGo Instant Answer API (free, no API key required)
 */
async function duckDuckGoSearch(query: string): Promise<WebSearchResult[]> {
  try {
    const encodedQuery = encodeURIComponent(query);
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodedQuery}&format=json&no_html=1&skip_disambig=1`
    );

    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = (await response.json()) as DDGResponse;
    const results: WebSearchResult[] = [];

    // Abstract (main result)
    if (data.Abstract && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.Abstract,
      });
    }

    // Related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      for (const topic of data.RelatedTopics.slice(0, 4)) {
        if (topic.Text && topic.FirstURL) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text.substring(0, 50),
            url: topic.FirstURL,
            snippet: topic.Text,
          });
        }
      }
    }

    // If no results, provide a helpful message
    if (results.length === 0) {
      results.push({
        title: "No instant results available",
        url: `https://duckduckgo.com/?q=${encodedQuery}`,
        snippet: `No instant answer available for "${query}". Try a web search for more detailed results.`,
      });
    }

    return results;
  } catch (error) {
    logger.error("DuckDuckGo search failed:", error);
    return [
      {
        title: "Search unavailable",
        url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        snippet: "Web search is temporarily unavailable. Please try again later.",
      },
    ];
  }
}

export default webSearch;
