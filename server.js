// Express API proxy — single POST /api/chat route that forwards conversation
// history to the configured LLM and returns Aria's structured response.
// Supports Anthropic Claude (default) and Ollama for offline use.
// (Reqs 3, 6, 7, edge:api-failure)

import express from "express";
import { SYSTEM_PROMPT } from "./src/prompt.js";

const app = express();
app.use(express.json());

// LLM provider config — set LLM_PROVIDER=ollama to use a local model.
const LLM_PROVIDER = process.env.LLM_PROVIDER || "anthropic";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";

// Lazy-load the Anthropic client only when needed, so Ollama users
// don't need an ANTHROPIC_API_KEY set.
let anthropicClient = null;
async function getAnthropicClient() {
  if (!anthropicClient) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// Converts our internal message format ({role, text}) to LLM API format ({role, content}).
function formatMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

// Calls the Anthropic Claude API and returns the raw text response.
async function callAnthropic(messages) {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages,
  });
  return response.content[0].text;
}

// Calls the Ollama /api/chat endpoint and returns the raw text response.
// Uses format: "json" to enforce structured JSON output.
async function callOllama(messages) {
  const ollamaMessages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages,
  ];

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: ollamaMessages,
      stream: false,
      format: "json",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.message.content;
}

// Dispatches to the configured LLM provider.
async function callLLM(messages) {
  if (LLM_PROVIDER === "ollama") {
    return callOllama(messages);
  }
  return callAnthropic(messages);
}

// Attempts to parse Aria's JSON response from the model output.
function parseAriaResponse(text) {
  const parsed = JSON.parse(text);
  return {
    message: String(parsed.message),
    distress: Math.max(0, Math.min(10, Math.round(Number(parsed.distress)))),
  };
}

app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const formatted = formatMessages(messages || []);
    const llmMessages = formatted.length > 0
      ? formatted
      : [{ role: "user", content: "(session start)" }];

    const text = await callLLM(llmMessages);
    const result = parseAriaResponse(text);
    res.json(result);
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "Aria needs a moment" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stillness server listening on port ${PORT} (provider: ${LLM_PROVIDER})`);
});
