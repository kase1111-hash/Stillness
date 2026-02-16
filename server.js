// Express API proxy — single POST /api/chat route that forwards conversation
// history to the configured LLM and returns a structured response.
// Includes a hard safety filter on user input and LLM output.
// Supports Anthropic Claude (default) and Ollama for offline use.

import express from "express";
import { getSystemPrompt, TOPICS } from "./src/prompt.js";
import { checkSafety, SAFETY_EXIT_MESSAGE } from "./src/safety.js";

const app = express();
app.use(express.json());

// LLM provider config.
const LLM_PROVIDER = process.env.LLM_PROVIDER || "anthropic";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const LLM_TIMEOUT_MS = 30_000; // 30-second timeout for LLM calls.

// Lazy-load the Anthropic client only when needed.
let anthropicClient = null;
async function getAnthropicClient() {
  if (!anthropicClient) {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    anthropicClient = new Anthropic();
  }
  return anthropicClient;
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

// Converts internal message format ({role, text}) to LLM format ({role, content}).
function formatMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
}

// Calls the Anthropic Claude API and returns the raw text response.
async function callAnthropic(systemPrompt, messages) {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  }, { timeout: LLM_TIMEOUT_MS });
  return response.content[0].text;
}

// Calls the Ollama /api/chat endpoint and returns the raw text response.
async function callOllama(systemPrompt, messages) {
  const ollamaMessages = [
    { role: "system", content: systemPrompt },
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
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama returned ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data.message.content;
}

// Dispatches to the configured LLM provider.
async function callLLM(systemPrompt, messages) {
  if (LLM_PROVIDER === "ollama") {
    return callOllama(systemPrompt, messages);
  }
  return callAnthropic(systemPrompt, messages);
}

// Extracts JSON from an LLM response that may be wrapped in markdown code fences.
function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

// Parses the LLM's JSON response and clamps distress to 0–10.
function parseResponse(text) {
  const cleaned = extractJSON(text);
  const parsed = JSON.parse(cleaned);
  const msg = parsed.message ?? parsed.response ?? parsed.text;
  const dist = Number(parsed.distress);
  return {
    message: typeof msg === "string" && msg.length > 0 ? msg : "...",
    distress: Number.isFinite(dist) ? Math.max(0, Math.min(10, Math.round(dist))) : 8,
    safety: parsed.safety === true,
  };
}

// ─── Routes ─────────────────────────────────────────────────────────────────

// Serves the topic list to the client.
app.get("/api/topics", (_req, res) => {
  const list = TOPICS.map(({ id, character, name, description }) => ({
    id, character, name, description,
  }));
  res.json(list);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, topic } = req.body;
    const formatted = formatMessages(messages || []);

    // Hard safety check on the latest user message.
    const lastUserMsg = formatted.length > 0 ? formatted[formatted.length - 1] : null;
    if (lastUserMsg && lastUserMsg.role === "user" && checkSafety(lastUserMsg.content)) {
      return res.json({
        message: SAFETY_EXIT_MESSAGE,
        distress: 0,
        safety: true,
      });
    }

    const systemPrompt = getSystemPrompt(topic || "anxiety");
    const llmMessages = formatted.length > 0
      ? formatted
      : [{ role: "user", content: "(session start)" }];

    const text = await callLLM(systemPrompt, llmMessages);
    const result = parseResponse(text);

    // Safety check on LLM output.
    if (checkSafety(result.message)) {
      return res.json({
        message: SAFETY_EXIT_MESSAGE,
        distress: 0,
        safety: true,
      });
    }

    res.json(result);
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "They need a moment" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stillness server listening on port ${PORT} (provider: ${LLM_PROVIDER})`);
});
