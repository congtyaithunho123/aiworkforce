---
name: AI Key Routing
description: OPENAI_API_KEY secret may hold a Groq key (gsk_ prefix). ai-service.ts auto-detects and routes to the correct base URL + model.
---

# AI Key Routing

## The rule
The `OPENAI_API_KEY` environment secret may not be a real OpenAI key. The `ai-service.ts` file detects the key prefix and routes accordingly:

| Key prefix | Provider | Base URL | Default model |
|------------|----------|----------|---------------|
| `sk-`      | OpenAI   | (default) | gpt-4o-mini |
| `gsk_`     | Groq     | https://api.groq.com/openai/v1 | llama-3.1-8b-instant |
| `AIza`     | Gemini   | https://generativelanguage.googleapis.com/v1beta/openai/ | gemini-2.0-flash |

Model names in all calling code use OpenAI names (gpt-4o, gpt-4o-mini, etc.) and `resolveModel()` maps them to provider equivalents at runtime.

**Why:** The project's `OPENAI_API_KEY` secret was set to a Groq key (`gsk_`), causing 401s against OpenAI's API and 400s against Gemini's API (wrong model name). The abstraction layer in ai-service.ts handles this transparently.

**How to apply:** Always use OpenAI model names in all callers (`gpt-4o-mini`, `gpt-4o`, etc.). Never hardcode provider-specific model names outside `ai-service.ts`.
