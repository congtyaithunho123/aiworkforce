import OpenAI from "openai";
import { z } from "zod/v4";
import { logger } from "./logger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionOptions = {
  model?: string;
  outputFormat?: "text" | "json";
  outputSchema?: string | null;
};

export type AICompletionResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

const MODEL_COSTS: Record<string, { prompt: number; completion: number }> = {
  "gpt-4o":       { prompt: 0.0025,  completion: 0.01 },
  "gpt-4o-mini":  { prompt: 0.00015, completion: 0.0006 },
  "gpt-4-turbo":  { prompt: 0.01,    completion: 0.03 },
  "gpt-3.5-turbo":{ prompt: 0.0005,  completion: 0.0015 },
};

export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  const rates = MODEL_COSTS[model] ?? { prompt: 0.001, completion: 0.002 };
  return (promptTokens / 1000) * rates.prompt + (completionTokens / 1000) * rates.completion;
}

function buildDynamicZodSchema(schemaSpec: Record<string, string>): z.ZodObject<z.ZodRawShape> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, type] of Object.entries(schemaSpec)) {
    switch (type) {
      case "string":  shape[key] = z.string();  break;
      case "number":  shape[key] = z.number();  break;
      case "boolean": shape[key] = z.boolean(); break;
      case "array":   shape[key] = z.array(z.unknown()); break;
      default:        shape[key] = z.unknown();
    }
  }
  return z.object(shape);
}

export async function runCompletion(
  messages: ChatMessage[],
  options: AICompletionOptions = {},
): Promise<AICompletionResult> {
  const { model = "gpt-4o-mini", outputFormat = "text", outputSchema } = options;
  const isJson = outputFormat === "json";

  logger.debug({ model, messageCount: messages.length, outputFormat }, "Running AI completion");

  const augmentedMessages: ChatMessage[] = isJson
    ? [
        ...messages.slice(0, 1),
        {
          role: "system",
          content: "You must respond with valid JSON only. No markdown, no explanation — raw JSON.",
        },
        ...messages.slice(1),
      ]
    : messages;

  const response = await openai.chat.completions.create({
    model,
    messages: augmentedMessages,
    max_tokens: 4096,
    ...(isJson ? { response_format: { type: "json_object" } } : {}),
  });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error("OpenAI returned an empty response");
  }

  let content = choice.message.content;

  if (isJson) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error(`Agent returned invalid JSON: ${content.slice(0, 200)}`);
    }

    if (outputSchema) {
      try {
        const schemaSpec = JSON.parse(outputSchema) as Record<string, string>;
        const zodSchema = buildDynamicZodSchema(schemaSpec);
        const validated = zodSchema.parse(parsed);
        content = JSON.stringify(validated);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`JSON output failed schema validation: ${msg}`);
      }
    } else {
      content = JSON.stringify(parsed);
    }
  }

  const promptTokens = response.usage?.prompt_tokens ?? 0;
  const completionTokens = response.usage?.completion_tokens ?? 0;

  return {
    content,
    model: response.model,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
  };
}
