// Express API proxy — single POST /api/chat route that forwards conversation
// history to the configured LLM and returns a structured response.
// Includes a hard safety filter on user input and LLM output.
// Supports Anthropic Claude (default) and Ollama for offline use.
// TODO: Add authentication if deployed beyond localhost.

import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { getSystemPrompt, TOPICS, INITIAL_DISTRESS } from "./src/prompt.js";
import { checkSafety, SAFETY_EXIT_MESSAGE } from "./src/safety.js";
import { parseResponse, limitDistressChange } from "./src/parse.js";

const app = express();
// Covers the client's 40-message history window, even at the 1000-character message limit.
app.use(express.json({ limit: "100kb" }));
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));

// Log every request with method, path, status, and duration.
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    // originalUrl, not path: path is relative to the mount point (rate-limited chats would log as "/").
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Rate-limit chat endpoint to prevent LLM cost flooding.
const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: Number(process.env.CHAT_RATE_LIMIT) || 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Please slow down — too many messages." },
});
app.use("/api/chat", chatLimiter);

// LLM provider config.
const LLM_PROVIDER = process.env.LLM_PROVIDER || "anthropic";
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.2";
const LLM_TIMEOUT_MS = 30_000; // 30-second timeout for LLM calls.

// Synthetic first user turn — the character's opening line is generated in reply to it.
const SESSION_START = "(session start)";

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

// Converts internal message format ({role, text, distress}) to LLM format ({role, content}).
// Character turns are replayed as the JSON the model produced, so it can see its own
// earlier distress levels. Every conversation opens with the synthetic session-start
// turn: the opening line was generated from it, and the Anthropic API requires the
// first message to come from the user.
function formatMessages(messages) {
  const turns = messages.map((m) => (m.role === "user"
    ? { role: "user", content: m.text }
    : { role: "assistant", content: JSON.stringify({ message: m.text, distress: m.distress, safety: false }) }));
  return [{ role: "user", content: SESSION_START }, ...turns];
}

// The character's distress after their latest reply, or the starting level before any.
function previousDistress(messages) {
  const d = messages.findLast((m) => m.role !== "user")?.distress;
  return Number.isInteger(d) && d >= 0 && d <= 10 ? d : INITIAL_DISTRESS;
}

// Calls the Anthropic Claude API and returns the raw text response.
async function callAnthropic(systemPrompt, messages) {
  const client = await getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: systemPrompt,
    messages,
  }, {
    // Bounds the whole call, SDK retries included — a per-attempt timeout would allow ~90s.
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error(`No text in response (stop_reason: ${response.stop_reason})`);
  return textBlock.text;
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

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({ status: "ok", provider: LLM_PROVIDER });
});

// Serves the topic list to the client.
app.get("/api/topics", (_req, res) => {
  const list = TOPICS.map(({ id, character, name, description }) => ({
    id, character, name, description,
  }));
  res.json(list);
});

app.post("/api/chat", async (req, res) => {
  try {
    const { messages = [], topic } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Missing topic" });
    }
    if (!Array.isArray(messages) || !messages.every((m) => typeof m?.text === "string")) {
      return res.status(400).json({ error: "Invalid messages" });
    }

    // Hard safety check on the latest user message.
    const lastMsg = messages.at(-1);
    if (lastMsg?.role === "user" && checkSafety(lastMsg.text)) {
      return res.json({
        message: SAFETY_EXIT_MESSAGE,
        distress: 0,
        safety: true,
      });
    }

    const systemPrompt = getSystemPrompt(topic);
    const llmMessages = formatMessages(messages);

    let text;
    try {
      const llmStart = Date.now();
      text = await callLLM(systemPrompt, llmMessages);
      console.log(`LLM call: ${LLM_PROVIDER} ${Date.now() - llmStart}ms topic=${topic}`);
    } catch (llmErr) {
      console.error("LLM error:", llmErr.message);
      return res.status(502).json({ error: "They need a moment" });
    }

    // Enforce the distress rules rather than trusting the model to follow them:
    // sessions open at the starting level and move at most 2 points per exchange.
    const before = previousDistress(messages);
    const result = parseResponse(text, before);
    result.distress = messages.length === 0
      ? INITIAL_DISTRESS
      : limitDistressChange(result.distress, before);

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
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stillness server listening on port ${PORT} (provider: ${LLM_PROVIDER})`);
});
