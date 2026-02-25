// Extracts and parses structured JSON from LLM responses.
// Shared by server.js (production) and test files.

// Extracts JSON from an LLM response that may be wrapped in markdown code fences.
export function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  return text.trim();
}

// Parses the LLM's JSON response and clamps distress to 0–10.
export function parseResponse(text) {
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
