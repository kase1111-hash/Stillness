// Express API proxy — single POST /api/chat route that forwards conversation
// history to the Claude API and returns Aria's structured response.
// Keeps the API key server-side. (Reqs 3, 6, 7, edge:api-failure)

import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./src/prompt.js";

const app = express();
app.use(express.json());

// Initialize the Anthropic client. Reads ANTHROPIC_API_KEY from environment.
const client = new Anthropic();

// Converts our internal message format to the Claude API format.
function formatMessages(messages) {
  return messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));
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

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: formatted.length > 0 ? formatted : [{ role: "user", content: "(session start)" }],
    });

    const text = response.content[0].text;
    const result = parseAriaResponse(text);
    res.json(result);
  } catch (err) {
    console.error("API error:", err.message);
    res.status(500).json({ error: "Aria needs a moment" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Stillness server listening on port ${PORT}`);
});
