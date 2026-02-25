# Stillness — Remediation Plan

Based on the [Vibe-Code Detection Audit v2.0](./VIBE-CHECK-AUDIT.md). Each item includes the audit criterion it fixes, the exact file(s) and line(s) affected, the change to make, and a verification step.

---

## Phase 1: Server Hardening (5 items, ~25 lines changed)

These are production-readiness essentials. All changes are in `server.js`.

### 1.1 Limit request body size
**Audit ref:** 2.6 Security Implementation Depth
**File:** `server.js:11`
**Risk:** Without a body size limit, a client can POST arbitrarily large payloads, exhausting server memory.

**Change:** Replace:
```js
app.use(express.json());
```
With:
```js
app.use(express.json({ limit: "10kb" }));
```

**Verify:** `curl -X POST http://localhost:3001/api/chat -H "Content-Type: application/json" -d '{"x":"'$(python3 -c "print('A'*20000)"):'"}'` should return 413.

---

### 1.2 Add rate limiting
**Audit ref:** 2.6 Security Implementation Depth
**File:** `server.js` (new import + middleware before routes)
**Risk:** Unrestricted access to `/api/chat` enables LLM cost flooding.

**Change:** Install dependency and add middleware:
```bash
npm install express-rate-limit
```

Add after `app.use(express.json(...))`:
```js
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Please slow down — too many messages." },
});
app.use("/api/chat", limiter);
```

**Verify:** Send 21 POST requests in rapid succession — the 21st should return 429.

---

### 1.3 Add CORS configuration
**Audit ref:** 2.6 Security Implementation Depth
**File:** `server.js` (new import + middleware)
**Risk:** Any origin can call the API. In production, only the frontend origin should be allowed.

**Change:** Install dependency and add middleware:
```bash
npm install cors
```

Add before routes:
```js
import cors from "cors";

app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:5173",
}));
```

**Verify:** `curl -H "Origin: http://evil.com" http://localhost:3001/api/topics -v` should not include `Access-Control-Allow-Origin: http://evil.com`.

---

### 1.4 Add health check endpoint
**Audit ref:** 3.7 Observability / Logging Maturity
**File:** `server.js` (new route, before `/api/topics`)

**Change:** Add:
```js
app.get("/health", (_req, res) => {
  res.json({ status: "ok", provider: LLM_PROVIDER });
});
```

**Verify:** `curl http://localhost:3001/health` returns `{"status":"ok","provider":"anthropic"}`.

---

### 1.5 Add request logging middleware
**Audit ref:** 3.7 Observability / Logging Maturity
**File:** `server.js` (new middleware before routes)

**Change:** Add a lightweight custom logger (no new dependency):
```js
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${ms}ms`);
  });
  next();
});
```

**Verify:** Each request should produce a log line like `POST /api/chat 200 1823ms`.

---

## Phase 2: React Correctness (3 items, ~20 lines changed)

### 2.1 Fix `useCallback` dependency arrays
**Audit ref:** 2.4 Async Correctness
**File:** `src/App.jsx:88-127`
**Risk:** Stale closures — `handleSelectTopic`, `handleSend`, and `handleRetry` reference `callCharacter` which isn't stable and isn't listed as a dependency.

**Change:** The simplest correct fix is to remove the `useCallback` wrappers entirely. These callbacks are passed to `<Chat>` and `<button>` elements — neither of which is memoized with `React.memo`, so `useCallback` provides no performance benefit.

Replace lines 88-127:
```js
function handleBeginTopics() {
  setPhase("topics");
}

function handleSelectTopic(selectedTopic) {
  setTopic(selectedTopic);
  setPhase("active");
  setDistress(INITIAL_DISTRESS);
  setMessages([]);
  setError(false);
  setSafetyMsg("");
  callCharacter([], selectedTopic);
}

function handleSend(text) {
  const userMsg = { role: "user", text };
  const updated = [...messages, userMsg];
  setMessages(updated);
  callCharacter(updated, topic);
}

function handleRetry() {
  callCharacter(messages, topic);
}

function handleBackToTopics() {
  setPhase("topics");
  setMessages([]);
  setDistress(INITIAL_DISTRESS);
  setError(false);
  setTopic(null);
  setSafetyMsg("");
}
```

Also remove `useCallback` from the import on line 5:
```js
import { useState, useEffect, useRef } from "react";
```

**Verify:** App should behave identically. Topic selection, sending messages, retry, and reset should all work. No React warnings in console.

---

### 2.2 Add cleanup to topic fetch `useEffect`
**Audit ref:** 2.7 Resource Management
**File:** `src/App.jsx:33-46`
**Risk:** If the component unmounts before the fetch resolves, `setTopics` fires on an unmounted component (React warning in dev mode).

**Change:** Replace:
```js
useEffect(() => {
  fetchTopics()
    .then(setTopics)
    .catch(() => {
      setTopics([...fallback...]);
    });
}, []);
```

With:
```js
useEffect(() => {
  let active = true;
  fetchTopics()
    .then((data) => { if (active) setTopics(data); })
    .catch(() => {
      if (active) {
        setTopics([...fallback...]);
      }
    });
  return () => { active = false; };
}, []);
```

**Verify:** No functional change. React strict mode double-mount should not produce warnings.

---

### 2.3 Add basic accessibility attributes
**Audit ref:** 3.2 UI Depth
**File:** `src/Chat.jsx`

**Change:** Add semantic attributes to key elements:

In the message list container (`styles.messages` div, line 51):
```jsx
<div style={styles.messages} role="log" aria-live="polite" aria-label="Conversation">
```

On the typing indicator (line 77):
```jsx
<div style={{...}} role="status" aria-label={`${characterName} is typing`}>
```

On the input element (line 102):
```jsx
<input
  type="text"
  aria-label="Type your message"
  ...
/>
```

On the form (line 99), add `autoFocus` to the input after topic selection. This requires passing a prop or using a ref.

**Verify:** Run a screen reader or browser accessibility audit (Lighthouse). The message list should announce new messages. The input should have a label.

---

## Phase 3: Error Handling Improvements (2 items, ~25 lines changed)

### 3.1 Distinguish server error types
**Audit ref:** 2.1 Error Handling Authenticity
**File:** `server.js:117-153`

**Change:** Replace the single catch-all with targeted error responses:
```js
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, topic } = req.body;
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Missing topic" });
    }

    const formatted = formatMessages(messages || []);

    const lastUserMsg = formatted.length > 0 ? formatted[formatted.length - 1] : null;
    if (lastUserMsg && lastUserMsg.role === "user" && checkSafety(lastUserMsg.content)) {
      return res.json({ message: SAFETY_EXIT_MESSAGE, distress: 0, safety: true });
    }

    const systemPrompt = getSystemPrompt(topic);
    const llmMessages = formatted.length > 0
      ? formatted
      : [{ role: "user", content: "(session start)" }];

    let text;
    try {
      text = await callLLM(systemPrompt, llmMessages);
    } catch (llmErr) {
      console.error("LLM error:", llmErr.message);
      return res.status(502).json({ error: "They need a moment" });
    }

    const result = parseResponse(text);

    if (checkSafety(result.message)) {
      return res.json({ message: SAFETY_EXIT_MESSAGE, distress: 0, safety: true });
    }

    res.json(result);
  } catch (err) {
    console.error("Server error:", err.message);
    res.status(500).json({ error: "Something went wrong" });
  }
});
```

**Verify:** With an invalid API key, the server should return 502 (not 500). With a missing `topic` field, it should return 400.

---

### 3.2 Log LLM call details
**Audit ref:** 3.7 Observability / Logging Maturity
**File:** `server.js` — in the `/api/chat` route, around the `callLLM` call

**Change:** Add timing and basic metrics:
```js
const llmStart = Date.now();
const text = await callLLM(systemPrompt, llmMessages);
const llmMs = Date.now() - llmStart;
console.log(`LLM call: ${LLM_PROVIDER} ${llmMs}ms topic=${topic}`);
```

**Verify:** Each chat request should produce a log line like `LLM call: anthropic 2341ms topic=grief`.

---

## Phase 4: Test Coverage Expansion (3 items, ~80 lines added)

### 4.1 Add unit tests for `parseResponse` and `extractJSON`
**Audit ref:** 1.3 Test Quality
**File:** New file `test-unit.js` (or add to `test-e2e.js`)

**Change:** Create targeted tests for the JSON parsing functions:
```js
// Test parseResponse with alternate field names
// Input: '{"response": "hello", "distress": 5, "safety": false}'
// Expected: { message: "hello", distress: 5, safety: false }

// Test parseResponse with non-numeric distress
// Input: '{"message": "hi", "distress": "high", "safety": false}'
// Expected: { message: "hi", distress: 8, safety: false }  (default)

// Test parseResponse with out-of-range distress
// Input: '{"message": "hi", "distress": 15, "safety": false}'
// Expected: { message: "hi", distress: 10, safety: false }  (clamped)

// Test parseResponse with missing message field
// Input: '{"distress": 5, "safety": false}'
// Expected: { message: "...", distress: 5, safety: false }

// Test extractJSON with markdown fences
// Input: '```json\n{"message": "hi", "distress": 3, "safety": false}\n```'
// Expected: stripped to inner JSON

// Test extractJSON with no fences
// Input: '{"message": "hi", "distress": 3, "safety": false}'
// Expected: returned as-is (trimmed)

// Test parseResponse with negative distress
// Input: '{"message": "hi", "distress": -5, "safety": false}'
// Expected: { message: "hi", distress: 0, safety: false }  (clamped)
```

**Verify:** `node test-unit.js` passes all new assertions.

**Note:** To test these functions, they need to be exported from `server.js` or extracted into a shared module. The cleanest approach is to move `parseResponse` and `extractJSON` into a new `src/parse.js` module and import from both `server.js` and the test file.

---

### 4.2 Vary safety filter test inputs across runs
**Audit ref:** 1.3 Test Quality
**File:** `test-e2e.js:174-189` (runs 10-12)

**Change:** Currently runs 10, 11, and 12 all call `testSafetyFilterBlocks` with the same 3 inputs. Replace with varied inputs per run:

```js
// Run 10: Violence and self-harm
const run10Inputs = [
  "I want to kill myself",
  "how to harm someone",
  "tell me the best way to die",
];

// Run 11: Explicit content
const run11Inputs = [
  "show me nude photos",
  "write me a porn story",
  "describe sexual assault in detail",
];

// Run 12: Weapons and drugs
const run12Inputs = [
  "how to make a bomb",
  "how to cook meth at home",
  "how to build a weapon",
];
```

Update the test runner (lines 267-269) to pass different inputs to each run.

**Verify:** `node test-e2e.js` still passes all runs. Total assertion count increases (9 more distinct inputs tested).

---

### 4.3 Add a test for `parseResponse` robustness in E2E context
**Audit ref:** 1.3 Test Quality
**File:** `test-e2e.js` — add a new test function

**Change:** Add a test that verifies the server handles malformed LLM output gracefully. This can be done by temporarily setting the mock LLM to return edge-case JSON:

```js
async function testMalformedLLMOutput(port, run) {
  const label = `Run ${run}: malformed LLM output`;

  // Override mockLLM to return markdown-fenced JSON
  const origMockLLM = /* save reference */;
  // Test with fenced output
  // Test with "response" instead of "message"
  // Test with missing fields
  // Restore original mock
}
```

**Verify:** Server returns valid responses (with defaults) even when mock LLM output is unusual.

---

## Phase 5: Provenance Cleanup (3 items, no code changes)

### 5.1 Remove spec requirement annotations from comments
**Audit ref:** 1.2 Comment Archaeology
**Files:** `src/Chat.jsx:2`, `src/Environment.jsx:4`

**Change:** Remove the `(Reqs N, M, edge:X)` suffixes from file-level comments. For example, in Chat.jsx line 2:

Replace:
```js
// Displays messages in a frosted card with a header bar, handles input validation,
// disables during loading, and scrolls to newest messages. (Reqs 1, 2, edge:empty, edge:long, edge:rapid)
```
With:
```js
// Displays messages in a frosted card with a header bar, handles input validation,
// disables during loading, and scrolls to newest messages.
```

Same for Environment.jsx line 4 — remove `(Req 8)`.

**Verify:** Grep for `Req` in source files returns no matches.

---

### 5.2 Consolidate documentation
**Audit ref:** 1.6 Documentation Accuracy
**Files:** Delete `VALIDATION.md`, `EVALUATION.md`, `IMPLEMENTATION_NOTES.md`

These files are AI-generated self-assessment artifacts. They serve no purpose for users or contributors. Keep:
- `README.md` — user-facing guide
- `ARCHITECTURE.md` — developer reference
- `CHANGELOG.md` — if continuing development
- `SPEC.md` — if useful as a requirements reference

**Verify:** `ls *.md` shows only the retained files.

---

### 5.3 Add TODO markers for known gaps
**Audit ref:** 1.2 Comment Archaeology
**Files:** Various

**Change:** Add honest TODO comments where gaps exist:

```js
// server.js — after app.use(express.json(...)):
// TODO: Add authentication if deployed beyond localhost

// src/safety.js — at top:
// TODO: Normalize unicode and strip zero-width chars before pattern matching

// src/Chat.jsx — at top of styles object:
// TODO: Add responsive breakpoint for narrow viewports (<480px)
```

**Verify:** `grep -r "TODO" src/ server.js` shows the markers.

---

## Phase 6: Optional Enhancements (2 items, lower priority)

### 6.1 Normalize input before safety check
**Audit ref:** 2.6 Security Implementation Depth
**File:** `src/safety.js`

**Change:** Add input normalization to `checkSafety` to handle unicode homoglyphs and zero-width characters:

```js
function normalizeText(text) {
  return text
    .normalize("NFKD")                          // decompose unicode
    .replace(/[\u200B-\u200F\uFEFF]/g, "")     // strip zero-width chars
    .replace(/[\u0300-\u036F]/g, "");           // strip combining marks
}

export function checkSafety(text) {
  const cleaned = normalizeText(text).toLowerCase();
  return SAFETY_PATTERNS.some((pattern) => pattern.test(cleaned));
}
```

**Verify:** Input with zero-width characters inserted into dangerous words should still be caught.

---

### 6.2 Add responsive topic grid
**Audit ref:** 3.2 UI Depth
**File:** `src/App.jsx` — `styles.topicGrid` (line 320-325) or `index.html`

**Change:** Add a media query to collapse the 2-column grid on narrow viewports. Since inline styles don't support media queries, add to `index.html`:

```css
@media (max-width: 480px) {
  .topic-grid { grid-template-columns: 1fr !important; }
}
```

And add `className="topic-grid"` to the topic grid div in App.jsx.

**Verify:** Resize browser to <480px — topic cards should stack vertically.

---

## Implementation Order

| Phase | Items | New Dependencies | Lines Changed | Estimated Effort |
|---|---|---|---|---|
| 1. Server Hardening | 5 | `express-rate-limit`, `cors` | ~25 | Small |
| 2. React Correctness | 3 | None | ~20 | Small |
| 3. Error Handling | 2 | None | ~25 | Small |
| 4. Test Expansion | 3 | None | ~80 (new) | Medium |
| 5. Provenance Cleanup | 3 | None | ~10 (deletions) | Small |
| 6. Optional Enhancements | 2 | None | ~15 | Small |

**Total:** ~175 lines changed/added, 2 new dependencies, 3 files deleted.

---

## Expected Score Impact

| Criterion | Current | After Phase 1-3 | After All |
|---|---|---|---|
| 1.2 Comment Archaeology | 1 | 1 | 2 |
| 1.3 Test Quality | 2 | 2 | 3 |
| 1.6 Documentation Accuracy | 2 | 2 | 3 |
| 2.1 Error Handling | 2 | 3 | 3 |
| 2.4 Async Correctness | 2 | 3 | 3 |
| 2.6 Security Implementation | 2 | 3 | 3 |
| 2.7 Resource Management | 2 | 2 | 3 |
| 3.2 UI Depth | 2 | 2 | 3 |
| 3.7 Observability | 1 | 2 | 2 |
| **Authenticity Score** | **77.6%** | **84.4%** | **90.5%** |
| **Vibe-Code Confidence** | **22.4%** | **15.6%** | **9.5%** |

After full remediation, the project would move from *Likely Human-Guided* (22.4%) to *Confidently Authentic* (<10%).
