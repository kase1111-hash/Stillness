// Unit tests for parseResponse and extractJSON edge cases.
// Covers alternate field names, out-of-range values, missing fields,
// markdown fences, and malformed input.

import { extractJSON, parseResponse } from "./src/parse.js";

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
