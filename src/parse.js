// Extracts and parses structured JSON from LLM responses.
// Shared by server.js (production) and test files.

// Extracts JSON from an LLM response that may be wrapped in markdown code fences
// or surrounded by stray prose.
export function extractJSON(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) return text.slice(start, end + 1);
  return text.trim();
}

// Parses the LLM's JSON response and clamps distress to 0–10.
// A missing or non-numeric distress falls back to fallbackDistress.
export function parseResponse(text, fallbackDistress = 8) {
  const cleaned = extractJSON(text);
  const parsed = JSON.parse(cleaned);
  const msg = parsed.message ?? parsed.response ?? parsed.text;
  // parseFloat, not Number: Number(null) and Number("") are 0, which would end the session.
  const dist = parseFloat(parsed.distress);
  return {
    message: typeof msg === "string" && msg.length > 0 ? msg : "...",
    distress: Number.isFinite(dist) ? Math.max(0, Math.min(10, Math.round(dist))) : fallbackDistress,
    safety: parsed.safety === true,
  };
}

// Limits a distress change to the gradual step the prompt promises (at most 2 per exchange).
export function limitDistressChange(next, previous, maxStep = 2) {
  return Math.max(previous - maxStep, Math.min(previous + maxStep, next));
}
