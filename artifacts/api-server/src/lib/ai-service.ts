import OpenAI from "openai";
import { z } from "zod/v4";
import { logger } from "./logger";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (_openai) return _openai;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Please add your OpenAI API key to secrets.");
  }

  const isGroqKey   = apiKey.startsWith("gsk_");
  const isGeminiKey = apiKey.startsWith("AIza");

  function getBaseURL(): string | undefined {
    if (isGroqKey)   return "https://api.groq.com/openai/v1";
    if (isGeminiKey) return "https://generativelanguage.googleapis.com/v1beta/openai/";
    return undefined;
  }

  _openai = new OpenAI({
    apiKey,
    ...(getBaseURL() ? { baseURL: getBaseURL() } : {}),
  });
  return _openai;
}

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

function isGroqKey(apiKey: string): boolean { return apiKey.startsWith("gsk_"); }
function isGeminiKey(apiKey: string): boolean { return apiKey.startsWith("AIza"); }

const GROQ_MODEL_MAP: Record<string, string> = {
  "gpt-4o":        "llama-3.3-70b-versatile",
  "gpt-4o-mini":   "llama-3.1-8b-instant",
  "gpt-4-turbo":   "llama-3.3-70b-versatile",
  "gpt-3.5-turbo": "llama-3.1-8b-instant",
};

const GEMINI_MODEL_MAP: Record<string, string> = {
  "gpt-4o":        "gemini-2.0-flash",
  "gpt-4o-mini":   "gemini-2.0-flash",
  "gpt-4-turbo":   "gemini-1.5-pro",
  "gpt-3.5-turbo": "gemini-1.5-flash",
};

function resolveModel(requested: string): string {
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (isGroqKey(apiKey))   return GROQ_MODEL_MAP[requested]   ?? "llama-3.1-8b-instant";
  if (isGeminiKey(apiKey)) return GEMINI_MODEL_MAP[requested] ?? "gemini-2.0-flash";
  return requested;
}

export async function runCompletion(
  messages: ChatMessage[],
  options: AICompletionOptions = {},
): Promise<AICompletionResult> {
  const openai = getOpenAI();
  const { model: requestedModel = "gpt-4o-mini", outputFormat = "text", outputSchema } = options;
  const model = resolveModel(requestedModel);
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
