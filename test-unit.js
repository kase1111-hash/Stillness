// Unit tests for parseResponse, extractJSON, and limitDistressChange edge cases.
// Covers alternate field names, out-of-range values, missing fields,
// markdown fences, stray prose, malformed input, and distress step limits.

import { extractJSON, parseResponse, limitDistressChange } from "./src/parse.js";

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, name, detail) {
  if (condition) { passed++; }
  else { failed++; failures.push({ name, detail }); console.log(`  FAIL: ${name} — ${detail}`); }
}

function assertThrows(fn, name) {
  try { fn(); failed++; failures.push({ name, detail: "Did not throw" }); console.log(`  FAIL: ${name} — did not throw`); }
  catch { passed++; }
}

// ─── extractJSON tests ──────────────────────────────────────────────────────

console.log("── extractJSON ──\n");

// Plain JSON (no fences)
assert(
  extractJSON('{"message":"hi"}') === '{"message":"hi"}',
  "plain JSON", `Got: ${extractJSON('{"message":"hi"}')}`
);

// Markdown fences with json tag
const fenced = '```json\n{"message":"hi","distress":3}\n```';
assert(
  extractJSON(fenced) === '{"message":"hi","distress":3}',
  "fenced with json tag", `Got: ${extractJSON(fenced)}`
);

// Markdown fences without json tag
const fencedNoTag = '```\n{"message":"hi"}\n```';
assert(
  extractJSON(fencedNoTag) === '{"message":"hi"}',
  "fenced without json tag", `Got: ${extractJSON(fencedNoTag)}`
);

// Leading/trailing whitespace
assert(
  extractJSON('  {"a":1}  ') === '{"a":1}',
  "trims whitespace", `Got: "${extractJSON('  {"a":1}  ')}"`
);

// Text before and after fences
const withSurrounding = 'Here is the response:\n```json\n{"message":"test"}\n```\nDone.';
assert(
  extractJSON(withSurrounding) === '{"message":"test"}',
  "text surrounding fences", `Got: ${extractJSON(withSurrounding)}`
);

// Prose before and after unfenced JSON
const withProse = 'Sure, here you go:\n{"message":"test","distress":4}\nLet me know!';
assert(
  extractJSON(withProse) === '{"message":"test","distress":4}',
  "prose surrounding unfenced JSON", `Got: ${extractJSON(withProse)}`
);

// ─── parseResponse tests ────────────────────────────────────────────────────

console.log("\n── parseResponse ──\n");

// Standard well-formed response
{
  const r = parseResponse('{"message":"hello","distress":5,"safety":false}');
  assert(r.message === "hello", "standard — message", `Got: ${r.message}`);
  assert(r.distress === 5, "standard — distress", `Got: ${r.distress}`);
  assert(r.safety === false, "standard — safety", `Got: ${r.safety}`);
}

// Alternate field name: "response" instead of "message"
{
  const r = parseResponse('{"response":"alt field","distress":4,"safety":false}');
  assert(r.message === "alt field", "alternate field 'response'", `Got: ${r.message}`);
}

// Alternate field name: "text" instead of "message"
{
  const r = parseResponse('{"text":"text field","distress":6,"safety":false}');
  assert(r.message === "text field", "alternate field 'text'", `Got: ${r.message}`);
}

// Missing message field — defaults to "..."
{
  const r = parseResponse('{"distress":5,"safety":false}');
  assert(r.message === "...", "missing message — defaults", `Got: ${r.message}`);
}

// Empty message string — defaults to "..."
{
  const r = parseResponse('{"message":"","distress":5,"safety":false}');
  assert(r.message === "...", "empty message — defaults", `Got: ${r.message}`);
}

// Non-numeric distress — defaults to 8
{
  const r = parseResponse('{"message":"hi","distress":"high","safety":false}');
  assert(r.distress === 8, "non-numeric distress — defaults to 8", `Got: ${r.distress}`);
}

// Missing distress field — defaults to 8
{
  const r = parseResponse('{"message":"hi","safety":false}');
  assert(r.distress === 8, "missing distress — defaults to 8", `Got: ${r.distress}`);
}

// Null or empty distress — falls back instead of reading as 0 (which would end the session)
{
  const r = parseResponse('{"message":"hi","distress":null,"safety":false}');
  assert(r.distress === 8, "null distress — defaults to 8", `Got: ${r.distress}`);
}
{
  const r = parseResponse('{"message":"hi","distress":"","safety":false}');
  assert(r.distress === 8, "empty-string distress — defaults to 8", `Got: ${r.distress}`);
}

// Numeric-string distress — parsed
{
  const r = parseResponse('{"message":"hi","distress":"6","safety":false}');
  assert(r.distress === 6, "numeric-string distress — parsed", `Got: ${r.distress}`);
}

// Missing distress — uses the provided fallback
{
  const r = parseResponse('{"message":"hi","safety":false}', 3);
  assert(r.distress === 3, "missing distress — uses fallback", `Got: ${r.distress}`);
}

// Prose-wrapped response
{
  const r = parseResponse('Here is my reply:\n{"message":"wrapped","distress":5,"safety":false}\nHope that helps.');
  assert(r.message === "wrapped", "prose-wrapped response — message", `Got: ${r.message}`);
  assert(r.distress === 5, "prose-wrapped response — distress", `Got: ${r.distress}`);
}

// Distress above 10 — clamped to 10
{
  const r = parseResponse('{"message":"hi","distress":15,"safety":false}');
  assert(r.distress === 10, "distress > 10 — clamped", `Got: ${r.distress}`);
}

// Distress below 0 — clamped to 0
{
  const r = parseResponse('{"message":"hi","distress":-5,"safety":false}');
  assert(r.distress === 0, "distress < 0 — clamped", `Got: ${r.distress}`);
}

// Fractional distress — rounded
{
  const r = parseResponse('{"message":"hi","distress":3.7,"safety":false}');
  assert(r.distress === 4, "fractional distress — rounded", `Got: ${r.distress}`);
}

// Safety true is preserved
{
  const r = parseResponse('{"message":"danger","distress":0,"safety":true}');
  assert(r.safety === true, "safety true preserved", `Got: ${r.safety}`);
}

// Safety non-boolean — defaults to false
{
  const r = parseResponse('{"message":"hi","distress":5,"safety":"yes"}');
  assert(r.safety === false, "safety non-boolean — false", `Got: ${r.safety}`);
}

// Missing safety field — defaults to false
{
  const r = parseResponse('{"message":"hi","distress":5}');
  assert(r.safety === false, "missing safety — false", `Got: ${r.safety}`);
}

// Markdown-fenced response
{
  const r = parseResponse('```json\n{"message":"fenced","distress":2,"safety":false}\n```');
  assert(r.message === "fenced", "fenced response — message", `Got: ${r.message}`);
  assert(r.distress === 2, "fenced response — distress", `Got: ${r.distress}`);
}

// Completely invalid JSON — should throw
assertThrows(
  () => parseResponse("this is not json at all"),
  "invalid JSON — throws"
);

// Empty string — should throw
assertThrows(
  () => parseResponse(""),
  "empty string — throws"
);

// ─── limitDistressChange tests ──────────────────────────────────────────────

console.log("\n── limitDistressChange ──\n");

assert(limitDistressChange(5, 6) === 5, "small drop — unchanged", `Got: ${limitDistressChange(5, 6)}`);
assert(limitDistressChange(7, 6) === 7, "small rise — unchanged", `Got: ${limitDistressChange(7, 6)}`);
assert(limitDistressChange(0, 6) === 4, "large drop — limited to 2", `Got: ${limitDistressChange(0, 6)}`);
assert(limitDistressChange(10, 2) === 4, "large rise — limited to 2", `Got: ${limitDistressChange(10, 2)}`);
assert(limitDistressChange(0, 1) === 0, "drop to 0 within step — allowed", `Got: ${limitDistressChange(0, 1)}`);
assert(limitDistressChange(10, 9) === 10, "rise to 10 within step — allowed", `Got: ${limitDistressChange(10, 9)}`);

// ─── Report ─────────────────────────────────────────────────────────────────

console.log("\n═══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═══════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  • ${f.name}: ${f.detail}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
