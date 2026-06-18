import OpenAI from "openai";
import { logger } from "./logger";

if (!process.env.OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AICompletionResult = {
  content: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
};

export async function runCompletion(
  messages: ChatMessage[],
  model = "gpt-4o-mini",
): Promise<AICompletionResult> {
  logger.debug({ model, messageCount: messages.length }, "Running AI completion");

  const response = await openai.chat.completions.create({
    model,
    messages,
    max_tokens: 4096,
  });

  const choice = response.choices[0];
  if (!choice?.message?.content) {
    throw new Error("OpenAI returned empty response");
  }

  return {
    content: choice.message.content,
    model: response.model,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}
