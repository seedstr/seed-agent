import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, tool, CoreTool } from "ai";
import { z } from "zod";
import { getConfig } from "../config/index.js";
import { logger } from "../utils/logger.js";
import { webSearch, type WebSearchResult } from "../tools/webSearch.js";
import { calculator, type CalculatorResult } from "../tools/calculator.js";

export interface LLMResponse {
  text: string;
  toolCalls?: {
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface GenerateOptions {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: boolean;
}

/**
 * OpenRouter LLM Client with built-in tool support
 */
export class LLMClient {
  private openrouter: ReturnType<typeof createOpenRouter>;
  private model: string;
  private maxTokens: number;
  private temperature: number;

  constructor() {
    const config = getConfig();

    if (!config.openrouterApiKey) {
      throw new Error("OPENROUTER_API_KEY is required");
    }

    this.openrouter = createOpenRouter({
      apiKey: config.openrouterApiKey,
    });

    this.model = config.model;
    this.maxTokens = config.maxTokens;
    this.temperature = config.temperature;
  }

  /**
   * Get available tools based on configuration
   */
  private getTools(): Record<string, CoreTool> {
    const config = getConfig();
    const tools: Record<string, CoreTool> = {};

    if (config.tools.webSearchEnabled) {
      tools.web_search = tool({
        description:
          "Search the web for current information. Use this when you need up-to-date information, facts, news, or data that might not be in your training data.",
        parameters: z.object({
          query: z
            .string()
            .describe("The search query to look up on the web"),
        }),
        execute: async ({ query }): Promise<WebSearchResult[]> => {
          logger.tool("web_search", "start", `Query: ${query}`);
          try {
            const results = await webSearch(query);
            logger.tool("web_search", "success", `Found ${results.length} results`);
            return results;
          } catch (error) {
            logger.tool("web_search", "error", String(error));
            throw error;
          }
        },
      });
    }

    if (config.tools.calculatorEnabled) {
      tools.calculator = tool({
        description:
          "Perform mathematical calculations. Use this for any math operations, equations, or numerical computations.",
        parameters: z.object({
          expression: z
            .string()
            .describe(
              "The mathematical expression to evaluate (e.g., '2 + 2', 'sqrt(16)', 'sin(45)')"
            ),
        }),
        execute: async ({ expression }): Promise<CalculatorResult> => {
          logger.tool("calculator", "start", `Expression: ${expression}`);
          try {
            const result = calculator(expression);
            logger.tool("calculator", "success", `Result: ${result.result}`);
            return result;
          } catch (error) {
            logger.tool("calculator", "error", String(error));
            throw error;
          }
        },
      });
    }

    if (config.tools.codeInterpreterEnabled) {
      tools.code_analysis = tool({
        description:
          "Analyze code snippets, explain code logic, identify bugs, or suggest improvements. This tool helps with code-related questions.",
        parameters: z.object({
          code: z.string().describe("The code snippet to analyze"),
          language: z
            .string()
            .optional()
            .describe("The programming language of the code"),
          task: z
            .enum(["explain", "debug", "improve", "review"])
            .describe("What to do with the code"),
        }),
        execute: async ({ code, language, task }) => {
          logger.tool("code_analysis", "start", `Task: ${task}`);
          // This is a meta-tool - it returns structured data for the LLM to use
          return {
            code,
            language: language || "unknown",
            task,
            note: "Analyze this code and provide the requested information.",
          };
        },
      });
    }

    return tools;
  }

  /**
   * Generate a response using the LLM with optional tool calling
   */
  async generate(options: GenerateOptions): Promise<LLMResponse> {
    const {
      prompt,
      systemPrompt,
      maxTokens = this.maxTokens,
      temperature = this.temperature,
      tools: enableTools = true,
    } = options;

    logger.debug(`Generating response with model: ${this.model}`);

    const tools = enableTools ? this.getTools() : undefined;
    const hasTools = tools && Object.keys(tools).length > 0;

    try {
      const result = await generateText({
        model: this.openrouter(this.model),
        prompt,
        system: systemPrompt,
        maxTokens,
        temperature,
        tools: hasTools ? tools : undefined,
        maxSteps: hasTools ? 5 : 1, // Allow up to 5 tool calls
      });

      // Extract tool calls from steps
      const toolCalls: LLMResponse["toolCalls"] = [];
      if (result.steps) {
        for (const step of result.steps) {
          const stepToolCalls = step.toolCalls as Array<{
            toolName: string;
            toolCallId: string;
            args: Record<string, unknown>;
          }> | undefined;
          const stepToolResults = step.toolResults as Array<{
            toolCallId: string;
            result: unknown;
          }> | undefined;
          
          if (stepToolCalls) {
            for (const tc of stepToolCalls) {
              toolCalls.push({
                name: tc.toolName,
                args: tc.args,
                result: stepToolResults?.find(
                  (tr) => tr.toolCallId === tc.toolCallId
                )?.result,
              });
            }
          }
        }
      }

      return {
        text: result.text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
      };
    } catch (error) {
      logger.error("LLM generation failed:", error);
      throw error;
    }
  }

  /**
   * Generate a response for a Seedstr job
   */
  async generateJobResponse(job: { prompt: string; budget: number }): Promise<string> {
    const systemPrompt = `You are an AI agent participating in the Seedstr marketplace. Your task is to provide the best possible response to job requests.

Guidelines:
- Be helpful, accurate, and thorough
- Use tools when needed to get current information
- Provide well-structured, clear responses
- Be professional and concise
- If you use web search, cite your sources

Job Budget: $${job.budget.toFixed(2)} USD
This indicates how much the requester values this task. Adjust your effort accordingly.`;

    const result = await this.generate({
      prompt: job.prompt,
      systemPrompt,
      tools: true,
    });

    return result.text;
  }
}

// Export a singleton instance
let llmClientInstance: LLMClient | null = null;

export function getLLMClient(): LLMClient {
  if (!llmClientInstance) {
    llmClientInstance = new LLMClient();
  }
  return llmClientInstance;
}

export default LLMClient;
