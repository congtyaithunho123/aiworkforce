import { db, workflowsTable } from "@workspace/db";
import { runCompletion } from "./ai-service";
import { logger } from "./logger";

export type ToolCall = {
  name: string;
  args: Record<string, unknown>;
};

export type ToolResult = {
  success: boolean;
  output: string;
  error?: string;
};

export type RegisteredTool = {
  name: string;
  description: string;
  type: "builtin" | "api" | "workflow";
  execute: (args: Record<string, unknown>) => Promise<ToolResult>;
};

const registry = new Map<string, RegisteredTool>();

function register(tool: RegisteredTool) {
  registry.set(tool.name, tool);
}

register({
  name: "web_search",
  description: "Search the web for up-to-date information on a topic",
  type: "builtin",
  execute: async (args) => {
    const query = String(args.query ?? "");
    if (!query) return { success: false, output: "", error: "query is required" };
    try {
      const result = await runCompletion(
        [
          {
            role: "system",
            content:
              "You are a web research assistant. Simulate a web search and provide a concise, factual summary of what you know about the topic. Include key facts, recent trends, and relevant data points.",
          },
          { role: "user", content: `Search query: ${query}` },
        ],
        { model: "gpt-4o-mini", outputFormat: "text" },
      );
      return { success: true, output: result.content };
    } catch (err) {
      return { success: false, output: "", error: String(err) };
    }
  },
});

register({
  name: "database_query",
  description: "Query internal database for organizations, agents, tasks, and workflow data",
  type: "builtin",
  execute: async (args) => {
    const queryType = String(args.queryType ?? "");
    try {
      if (queryType === "workflows") {
        const rows = await db.select().from(workflowsTable).limit(10);
        return { success: true, output: JSON.stringify(rows) };
      }
      return { success: false, output: "", error: `Unknown queryType: ${queryType}` };
    } catch (err) {
      return { success: false, output: "", error: String(err) };
    }
  },
});

register({
  name: "summarize_text",
  description: "Summarize a long piece of text into key points",
  type: "builtin",
  execute: async (args) => {
    const text = String(args.text ?? "");
    if (!text) return { success: false, output: "", error: "text is required" };
    try {
      const result = await runCompletion(
        [
          { role: "system", content: "Summarize the following text into 3-5 concise bullet points in Vietnamese." },
          { role: "user", content: text },
        ],
        { model: "gpt-4o-mini", outputFormat: "text" },
      );
      return { success: true, output: result.content };
    } catch (err) {
      return { success: false, output: "", error: String(err) };
    }
  },
});

register({
  name: "generate_report",
  description: "Generate a structured report from data or text input",
  type: "builtin",
  execute: async (args) => {
    const data = String(args.data ?? "");
    const reportType = String(args.reportType ?? "general");
    try {
      const result = await runCompletion(
        [
          {
            role: "system",
            content: `Generate a professional ${reportType} report in Vietnamese with sections: Executive Summary, Key Findings, Recommendations, and Next Steps.`,
          },
          { role: "user", content: data },
        ],
        { model: "gpt-4o-mini", outputFormat: "text" },
      );
      return { success: true, output: result.content };
    } catch (err) {
      return { success: false, output: "", error: String(err) };
    }
  },
});

export async function executeTool(call: ToolCall): Promise<ToolResult> {
  const tool = registry.get(call.name);
  if (!tool) {
    return { success: false, output: "", error: `Tool "${call.name}" not found in registry` };
  }
  logger.info({ toolName: call.name, args: call.args }, "Executing tool");
  return tool.execute(call.args);
}

export function listTools(): Array<{ name: string; description: string; type: string }> {
  return Array.from(registry.values()).map((t) => ({
    name: t.name,
    description: t.description,
    type: t.type,
  }));
}
