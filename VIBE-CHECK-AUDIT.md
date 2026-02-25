# Stillness — Vibe-Code Detection Audit v2.0

**Date:** 2026-02-25
**Auditor:** Claude Opus 4.6 (automated, following vibe-checkV2.md framework)
**Codebase:** Stillness v1.0.0 — conversational empathy training game
**LOC:** 1,693 (source + tests) across 10 files
**Tests:** 166 assertions, 20 runs, **all passing**
**Build:** Production build succeeds (975ms, 211 KB gzip)

---

## Executive Summary

Stillness is a well-scoped React + Express application where users practice therapeutic communication with AI characters experiencing emotional distress. The code is **entirely AI-authored** (100% of source commits by `Claude <noreply@anthropic.com>`), yet achieves genuine behavioral integrity: complete call chains, working safety systems, and a cohesive visual-feedback mechanic. The provenance signals are unambiguous, but the code itself is functional, not decorative.

**Authenticity Score: 77.6%**
**Vibe-Code Confidence: 22.4%** — *Likely Human-Guided*

The code falls in the "human directed, AI executed" category: a human defined the vision and iteratively reviewed via PRs, while an AI wrote every line. The result works, but carries telltale AI fingerprints in its provenance layer and lacks production hardening.

---

## Domain 1: Surface Provenance (20% weight)

### 1.1 Commit History Markers — Score: 1/3

**Finding:** Every non-merge source commit is authored by `Claude <noreply@anthropic.com>`. The human (Kase Branham) contributed only the initial README and merge commits. 23 of 26 commits landed on a single day (2026-02-11). Branch names follow the pattern `claude/review-repo-with-prompts-ILqmG` — clearly machine-generated session IDs.

Commit messages reference the prompt chain explicitly:
- "Distill README to concise project summary per **01-Idea prompt**"
- "Add requirements spec derived from README per **02-spec prompt**"
- "Add architecture blueprint per **03-architecture prompt**"
- "Implement all source files per **04-implementation prompt**"

This is a textbook AI-generation commit trail.

**Remediation:** Squash intermediate commits. Rewrite messages to describe *what changed and why* rather than *which prompt produced it*. Use co-authored-by trailers if AI assistance is disclosed.

---

### 1.2 Comment Archaeology — Score: 1/3

**Finding:** Comments are thorough and structurally consistent, but every file follows the same template:

```js
// <Component name> — <description>. <Details>. (Reqs N, M, edge:X)
```

No comment in the codebase explains a non-obvious decision ("we do X because Y"). All comments describe *what* the code does, never *why* a choice was made. There are zero `TODO`, `FIXME`, or `HACK` markers — a codebase with zero technical debt markers has never been iterated on by humans under time pressure.

The requirement cross-references in comments (`(Reqs 1, 2, edge:empty, edge:long, edge:rapid)`) are a strong AI tell — humans don't annotate their UI components with spec requirement IDs.

**Remediation:** Remove mechanical spec references from comments. Add "why" comments where decisions aren't obvious (e.g., why 1000 chars? why 30s timeout? why no streaming?). Leave TODO markers for known gaps.

---

### 1.3 Test Quality — Score: 2/3

**Finding:** The test suite is functional and covers the critical paths:

| Coverage Area | Tests | Verdict |
|---|---|---|
| Topic endpoint structure | Run 1 | Passes |
| Session start (all 5 topics) | Runs 2-6 | Passes |
| Full resolution (distress → 0) | Runs 7-9 | Passes |
| Safety filter blocks | Runs 10-12 | Passes |
| False positive avoidance | Runs 13-15 | Passes |
| API failure + recovery | Runs 16-17 | Passes |
| Concurrent requests | Run 18 | Passes |
| Distress bounds | Run 19 | Passes |
| Mixed safety + recovery | Run 20 | Passes |

**Strengths:**
- Custom test runner with no framework dependency — lightweight and self-contained
- Mock LLM simulates keyword-based distress changes
- 166 assertions is solid coverage for the surface area
- Tests the shared `safety.js` module with real regex patterns

**Weaknesses:**
- **No unit tests.** Individual functions (`parseResponse`, `extractJSON`, `formatMessages`, `lerp`, `lerpColor`, `generateRain`) are untested in isolation.
- **No component tests.** React components (`Chat`, `Environment`, `App`) have zero render tests. No testing-library, no snapshot tests.
- **Mock LLM is trivial.** Keyword matching (`"hear"` → decrease, `"calm down"` → increase) doesn't test prompt engineering quality or edge cases in JSON parsing.
- **Runs 10-12 are identical.** Three runs of `testSafetyFilterBlocks` with the same inputs — tests quantity, not coverage breadth.
- **No negative tests for `parseResponse`.** Malformed JSON, missing fields, non-numeric distress — the server handles these, but tests don't verify it.

**Remediation:**
1. Add unit tests for `parseResponse` with edge cases: `{response: "text"}` (alternate field), `{distress: "not-a-number"}`, markdown-fenced JSON, empty string
2. Add component tests with React Testing Library for Chat (input validation, disabled states, message rendering)
3. Vary the safety filter test inputs across runs 10-12 instead of repeating identical sets
4. Test `extractJSON` with malformed fences, nested code blocks, no closing fence

---

### 1.4 Dependency Hygiene — Score: 3/3

**Finding:** Minimal and justified dependency tree.

| Dependency | Used In | Justified |
|---|---|---|
| `react` / `react-dom` | All components | Core framework |
| `express` | server.js | API proxy |
| `@anthropic-ai/sdk` | server.js | LLM integration |
| `vite` / `@vitejs/plugin-react` | Build config | Build tool |
| `concurrently` | npm scripts | Dev convenience |

7 total packages, 0 unused. No utility belt libraries (lodash, moment), no CSS framework, no state management library. Every dependency earns its place.

**Remediation:** None needed.

---

### 1.5 Naming Consistency — Score: 3/3

**Finding:** Naming conventions are consistent throughout:

- **Components:** PascalCase (`App`, `Chat`, `Environment`)
- **Functions:** camelCase (`callCharacter`, `handleSend`, `parseResponse`)
- **Constants:** UPPER_SNAKE_CASE (`INITIAL_DISTRESS`, `SAFETY_PATTERNS`, `ALL_RAIN`)
- **Files:** PascalCase for components, camelCase for modules
- **CSS-in-JS keys:** camelCase (`styles.userBubble`, `styles.topicCard`)

No inconsistencies found across the 10 source files.

**Remediation:** None needed.

---

### 1.6 Documentation Accuracy — Score: 2/3

**Finding:** 7 documentation files for ~1,700 LOC is disproportionate:

| File | Lines | Purpose |
|---|---|---|
| README.md | ~60 | User guide |
| SPEC.md | 50 | Requirements |
| ARCHITECTURE.md | 107 | Technical design |
| IMPLEMENTATION_NOTES.md | ~40 | How to run |
| VALIDATION.md | ~30 | Requirements checklist |
| EVALUATION.md | ~50 | Quality self-assessment |
| CHANGELOG.md | ~30 | History |

The documentation is **accurate** — ARCHITECTURE.md correctly describes the file map, data model, component breakdown, and flow. SPEC.md accurately reflects what the code implements.

However, the documentation was generated as sequential prompt outputs (spec → architecture → implementation), not as living documents maintained during development. The EVALUATION.md and VALIDATION.md files are self-referential quality assessments that a human team would never write.

**Remediation:** Consolidate to README.md + ARCHITECTURE.md. Remove VALIDATION.md, EVALUATION.md, and IMPLEMENTATION_NOTES.md — they serve no purpose for a contributor or user. Keep CHANGELOG.md only if you continue development.

---

### 1.7 Dependency Utilization — Score: 3/3

**Finding:** Every import resolves to actual usage. No phantom dependencies.

```
react         → useState, useCallback, useEffect, useRef, useMemo (all used)
react-dom     → createRoot (used in main.jsx)
express       → app.get, app.post, express.json (all used)
@anthropic-ai → client.messages.create (used in callAnthropic)
```

No barrel imports. No re-exports. No `import X from Y` where X is never referenced.

**Remediation:** None needed.

---

### Surface Provenance Summary

| Criterion | Score | Max |
|---|---|---|
| Commit History Markers | 1 | 3 |
| Comment Archaeology | 1 | 3 |
| Test Quality | 2 | 3 |
| Dependency Hygiene | 3 | 3 |
| Naming Consistency | 3 | 3 |
| Documentation Accuracy | 2 | 3 |
| Dependency Utilization | 3 | 3 |
| **Total** | **15** | **21** |

**Domain Score: 71.4%**

---

## Domain 2: Behavioral Integrity (50% weight)

### 2.1 Error Handling Authenticity — Score: 2/3

**Finding:** Error handling exists at every boundary but is uniformly shallow.

**Server (`server.js:150-153`):**
```js
catch (err) {
  console.error("API error:", err.message);
  res.status(500).json({ error: "They need a moment" });
}
```
Single catch-all. No distinction between network errors, LLM API errors, JSON parse failures, or timeout errors. All produce the same 500 response.

**Client (`App.jsx:79-81`):**
```js
catch (err) {
  if (err.name === "AbortError") return;
  setError(true);
}
```
`AbortError` is correctly filtered, but all other errors collapse to a boolean. The user sees the same "needs a moment" message whether the API key is invalid, the server is down, or the LLM returned garbage.

**Strengths:**
- AbortController properly cancels stale requests
- `finally` block ensures `loading` state is always cleared
- Timeout is enforced on both client (35s) and server (30s) — staggered correctly
- Ollama error includes status code and body in the thrown error

**Remediation:**
1. Distinguish error types on the server: return 502 for LLM failures, 400 for bad request body, 500 for internal errors
2. Log the full error stack server-side, not just `err.message`
3. On the client, show different messages for network errors vs. server errors vs. timeouts

---

### 2.2 Configuration Wiring — Score: 3/3

**Finding:** Configuration is clean and correctly threaded.

- `LLM_PROVIDER` env var switches between Anthropic and Ollama — dispatched through `callLLM()` (server.js:80-85)
- `ANTHROPIC_MODEL` defaults to `claude-sonnet-4-5-20250929` — current model
- Anthropic client is lazy-loaded (only imported when first API call occurs)
- Vite proxy correctly routes `/api` → `http://localhost:3001` during development
- Topic fallback in App.jsx handles server-down gracefully (hardcoded topic list)
- Port configurable via `PORT` env var with sensible default (3001)

All configuration paths lead to real code. No env vars are read but unused.

**Remediation:** None needed.

---

### 2.3 Complete Call Chains — Score: 3/3

**Finding:** Every exported function is called. Every call chain reaches a real implementation. Traced the critical path end-to-end:

```
User types → Chat.handleSubmit → validates → onSend(trimmed)
  → App.handleSend → appends user msg → callCharacter(msgs, topic)
    → aborts previous, creates new AbortController
    → sendMessage(msgs, topic.id, signal)  [api.js]
      → POST /api/chat  [server.js]
        → formatMessages → safety check → getSystemPrompt
        → callLLM → callAnthropic/callOllama
        → parseResponse → extractJSON → JSON.parse → clamp distress
        → safety check on output → res.json(result)
    → updates messages, distress
    → checks safety → phase "safety"
    → checks distress === 0 → phase "resolved"
  → Environment re-renders with new distress
```

No dead functions. No orphaned callbacks. `handleRetry` → wired to Chat's retry button. `handleBackToTopics` → wired to safety/resolved/active screens. `handleSelectTopic` → wired to topic cards.

The `fetchTopics` path is also complete: `useEffect` → `fetchTopics()` → `GET /api/topics` → server returns TOPICS array → `setTopics`.

**Remediation:** None needed.

---

### 2.4 Async Correctness — Score: 2/3

**Finding:** Mostly correct with one notable React hooks issue.

**Correct patterns:**
- `AbortController` cancels in-flight requests before starting new ones (App.jsx:51-53)
- Post-abort check prevents stale state updates (App.jsx:60)
- `try/catch/finally` ensures `loading` is always cleared
- `AbortSignal.timeout(30_000)` on Ollama prevents hanging
- Anthropic SDK receives timeout option correctly

**Issue — stale closure in `useCallback`:**

```js
// App.jsx:93-101
const handleSelectTopic = useCallback((selectedTopic) => {
  // ...
  callCharacter([], selectedTopic);  // callCharacter is NOT in deps
}, []);  // empty dependency array
```

`handleSelectTopic` has an empty dependency array but references `callCharacter`, which is a regular function that closes over component state. This works by accident because `callCharacter` doesn't read stale state from the closure (it uses `setState` calls and the passed arguments), but it's a React hooks anti-pattern.

Similarly, `handleSend` and `handleRetry` list `[messages, topic]` as deps but reference `callCharacter` which isn't stable:
```js
const handleSend = useCallback((text) => {
  // reads messages and topic from closure — correctly listed
  // calls callCharacter — NOT listed as dep
}, [messages, topic]);
```

**Remediation:**
1. Wrap `callCharacter` in `useCallback` with appropriate dependencies, or
2. Use `useRef` for the latest messages/topic to avoid stale closures, or
3. Remove `useCallback` wrappers entirely — premature optimization for this component tree size. React re-renders are cheap here.

---

### 2.5 State Management Coherence — Score: 3/3

**Finding:** State model is clean, minimal, and correctly synchronized.

| State | Type | Transitions | Correct |
|---|---|---|---|
| `phase` | string | landing→topics→active→resolved/safety→topics | Yes |
| `distress` | number | Set from API response, clamped 0-10 server-side | Yes |
| `messages` | array | Append-only during session, cleared on reset | Yes |
| `loading` | boolean | true on API call, false in finally | Yes |
| `error` | boolean | true on catch, false on new send | Yes |
| `topic` | object | Set on selection, null on reset | Yes |
| `safetyMsg` | string | Set on safety trigger, cleared on reset | Yes |

No derived state that could drift. No impossible state combinations (loading + error can't coexist due to `setError(false)` at call start). Phase transitions are deterministic.

`handleBackToTopics` correctly resets all 6 mutable state variables:
```js
setPhase("topics");
setMessages([]);
setDistress(INITIAL_DISTRESS);
setError(false);
setTopic(null);
setSafetyMsg("");
```

**Remediation:** None needed.

---

### 2.6 Security Implementation Depth — Score: 2/3

**Finding:** The safety system is thoughtful but the server lacks production hardening.

**What's good:**
- **Two-layer safety:** 13 regex patterns catch dangerous content *before* LLM call (saves cost + latency). LLM instructions handle nuanced cases.
- **Bidirectional filtering:** Safety check on both user input AND LLM output (server.js:124, 141)
- **API key isolation:** Key stays server-side, never exposed to client
- **React XSS protection:** Default JSX escaping prevents injection
- **External links:** `rel="noopener noreferrer"` on crisis resource links
- **Compassionate safety exit:** Not punitive, directs to real resources

**What's missing:**
- **No rate limiting.** A client can flood `/api/chat` with expensive LLM calls.
- **No request body size limit.** `express.json()` with no `limit` option accepts arbitrarily large payloads.
- **No CORS configuration.** Any origin can call the API.
- **No security headers.** No `helmet`, no Content-Security-Policy, no X-Frame-Options.
- **No input sanitization on server.** Beyond the safety regex, raw strings pass through to the LLM.
- **Safety regex bypasses possible.** Unicode homoglyphs, zero-width characters, and leetspeak could bypass simple regex patterns.

**Remediation:**
1. Add `express.json({ limit: '10kb' })` to prevent payload abuse
2. Add rate limiting (`express-rate-limit`) — 20 requests/minute per IP is reasonable
3. Add CORS whitelist for the Vite dev origin
4. Add `helmet()` middleware for security headers
5. Consider normalizing input (strip zero-width chars, normalize unicode) before safety check

---

### 2.7 Resource Management — Score: 2/3

**Finding:** Resources are generally well-managed with one gap.

**Correct:**
- `AbortController` cancels stale requests (prevents wasted network + LLM compute)
- Anthropic client is lazy-loaded (no SDK initialization if Ollama is used)
- `useMemo` on rain elements prevents unnecessary DOM recalculations
- No `setInterval`/`setTimeout` that could leak
- CSS animations handle visual transitions (no JS animation loops)

**Gap:**
- `abortRef.current` is never cleaned up on component unmount. If the component unmounts during an in-flight request, the abort doesn't fire. In practice this is harmless (the app is a single page), but it's a correctness gap.
- The `useEffect` that calls `fetchTopics` doesn't handle component unmount — if the component unmounts before the fetch resolves, `setTopics` fires on an unmounted component.

**Remediation:**
1. Add cleanup to the topics fetch `useEffect`:
   ```js
   useEffect(() => {
     let cancelled = false;
     fetchTopics().then(t => { if (!cancelled) setTopics(t); }).catch(/* ... */);
     return () => { cancelled = true; };
   }, []);
   ```
2. Add abort cleanup on unmount (though practically unnecessary for this SPA).

---

### Behavioral Integrity Summary

| Criterion | Score | Max |
|---|---|---|
| Error Handling Authenticity | 2 | 3 |
| Configuration Wiring | 3 | 3 |
| Complete Call Chains | 3 | 3 |
| Async Correctness | 2 | 3 |
| State Management Coherence | 3 | 3 |
| Security Implementation Depth | 2 | 3 |
| Resource Management | 2 | 3 |
| **Total** | **17** | **21** |

**Domain Score: 81.0%**

---

## Domain 3: Interface Authenticity (30% weight)

### 3.1 API Consistency — Score: 3/3

**Finding:** Two endpoints, consistent contracts, correct HTTP semantics.

| Endpoint | Method | Request | Response | Status |
|---|---|---|---|---|
| `/api/topics` | GET | — | `[{id, character, name, description}]` | 200 |
| `/api/chat` | POST | `{messages, topic}` | `{message, distress, safety}` | 200/500 |

Error response format is consistent: `{error: "message"}` with 500 status. The safety response reuses the same shape as a normal response (`{message, distress: 0, safety: true}`) — no special error format needed.

**Remediation:** None needed.

---

### 3.2 UI Depth — Score: 2/3

**Finding:** The UI is visually polished and thematically cohesive, but lacks accessibility fundamentals.

**Strengths:**
- 5 distinct screens (landing, topics, active, resolved, safety) with consistent warm aesthetic
- Chat panel has genuine UX details: typing indicator, error state with retry, disabled-during-loading, auto-scroll, input validation warnings
- Environment component creates a convincing therapist-office atmosphere with dynamic weather
- Topic cards are well-designed with character name, topic label, and description
- Custom scrollbar styling matches the theme

**Gaps:**
- **No ARIA labels.** Screen readers can't distinguish message bubbles, status indicators, or phases.
- **No focus management.** After topic selection, focus doesn't move to the chat input. After error, focus doesn't move to the retry button.
- **No keyboard navigation.** Topic cards aren't keyboard-accessible beyond default button behavior.
- **No `<main>`, `<nav>`, `<article>` landmarks.** All content is in generic `<div>` elements.
- **Color contrast.** `#9e8b78` text on `#f5f0e8` background (topic name, header status) may fail WCAG AA contrast requirements.
- **No responsive breakpoints.** The 2-column topic grid doesn't collapse on narrow viewports.

**Remediation:**
1. Add `aria-label` to message bubbles (`role="log"` for the message list, `aria-live="polite"` for new messages)
2. Add `role="status"` to the typing indicator
3. Use `autoFocus` on the chat input after topic selection
4. Add `@media (max-width: 480px)` to collapse the topic grid to 1 column
5. Verify color contrast ratios with a WCAG checker

---

### 3.3 State Management Architecture — Score: 3/3

**Finding:** Single-component state via `useState` is the right choice for this scope.

- 8 state variables in one component — manageable
- No prop drilling beyond one level (App → Chat, App → Environment)
- No need for Context, Redux, or external stores
- Phase-based rendering is a clean pattern: `if (phase === "X") return <X />`

The state model is proportional to the application complexity. No over-engineering.

**Remediation:** None needed.

---

### 3.4 Security Infrastructure — Score: 2/3

**Finding:** (Overlaps with Behavioral Integrity 2.6 — evaluated here from the user-facing perspective.)

- Safety exit screen shows real, verified crisis resources with correct URLs
- Safety message is compassionate: "you deserve real support from someone who can truly help"
- Crisis resources include phone, text, and web options (988, Crisis Text Line, Childhelp, IASP)
- External links open in new tab with `noopener noreferrer`
- No user data is collected, stored, or transmitted beyond the LLM API call

**Gap:** The safety system is one-directional — once triggered, the user must return to topics. There's no way to report a false positive or continue the conversation if the regex was overly aggressive.

**Remediation:** Consider adding a "this was flagged incorrectly" option that logs the false positive (anonymously) for pattern refinement.

---

### 3.5 WebSocket / Real-time Patterns — Score: 2/3

**Finding:** Not applicable. The application uses standard HTTP request/response, which is the correct choice for this interaction pattern (one user message → one character response, with seconds of latency for LLM processing).

Streaming the LLM response would improve perceived latency but adds complexity that isn't justified at this scale. Scored at 2/3 as neutral — no WebSocket is needed, and none is used.

**Remediation (optional):** If LLM response times exceed ~3 seconds consistently, consider streaming the response character-by-character using SSE (Server-Sent Events) for better perceived performance. This would require changes to server.js (stream mode) and Chat.jsx (progressive text rendering).

---

### 3.6 Error UX — Score: 3/3

**Finding:** Error states are user-friendly and consistent with the application's therapeutic tone.

- **Loading:** "typing..." indicator in a character bubble — matches the chat metaphor
- **API failure:** "[character name] needs a moment..." with "Try again" button — empathetic, not technical
- **Safety exit:** Compassionate message + crisis resources — the most important error path is handled with care
- **Input validation:** "Take a moment — then try saying something." / "Messages can be up to 1000 characters." — gentle, not scolding
- **No technical jargon** ever surfaces to the user. No stack traces, HTTP codes, or error IDs.

**Remediation:** None needed.

---

### 3.7 Observability / Logging Maturity — Score: 1/3

**Finding:** Minimal logging. No observability infrastructure.

The entire server has two log statements:
```js
console.error("API error:", err.message);        // server.js:151
console.log(`Server listening on port ${PORT}`);  // server.js:158
```

**Missing:**
- No request logging (method, path, duration, status)
- No structured log format (JSON logs for aggregation)
- No request IDs or correlation IDs
- No health check endpoint (`GET /health`)
- No metrics (request count, LLM latency, safety trigger rate)
- No log levels (debug/info/warn/error)
- No LLM call logging (model, tokens used, latency)

**Remediation:**
1. Add a request logger middleware (morgan or custom) with method, path, status, duration
2. Add a `GET /health` endpoint returning `{status: "ok", provider: LLM_PROVIDER}`
3. Log LLM calls: model, prompt tokens, completion tokens, latency
4. Log safety triggers: pattern matched, input hash (not full content, for privacy)

---

### Interface Authenticity Summary

| Criterion | Score | Max |
|---|---|---|
| API Consistency | 3 | 3 |
| UI Depth | 2 | 3 |
| State Management Architecture | 3 | 3 |
| Security Infrastructure | 2 | 3 |
| WebSocket / Real-time Patterns | 2 | 3 |
| Error UX | 3 | 3 |
| Observability / Logging Maturity | 1 | 3 |
| **Total** | **16** | **21** |

**Domain Score: 76.2%**

---

## Final Scoring

| Domain | Weight | Raw Score | Percentage | Weighted |
|---|---|---|---|---|
| Surface Provenance | 20% | 15/21 | 71.4% | 14.3% |
| Behavioral Integrity | 50% | 17/21 | 81.0% | 40.5% |
| Interface Authenticity | 30% | 16/21 | 76.2% | 22.9% |
| **Authenticity Score** | | **48/63** | | **77.6%** |

**Vibe-Code Confidence: 22.4%**

### Classification: *Likely Human-Guided* (16–35% range)

The code is AI-generated in its entirety, but directed by a human who iteratively reviewed and merged via pull requests. The behavioral layer — where it matters most — is strong: complete call chains, working safety systems, correct state management, and real LLM integration. The provenance layer is where AI signals concentrate: formulaic comments, prompt-chain commit messages, ceremonial documentation, and zero technical debt markers.

---

## Priority Remediation List

### High Priority (affects production readiness)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 1 | Add request body size limit | server.js | 1 line |
| 2 | Add rate limiting | server.js | ~10 lines |
| 3 | Add CORS configuration | server.js | ~5 lines |
| 4 | Add health check endpoint | server.js | ~5 lines |
| 5 | Add security headers (helmet) | server.js | 2 lines |

### Medium Priority (affects code quality)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 6 | Fix `useCallback` dependency arrays | App.jsx | ~15 lines |
| 7 | Add unit tests for `parseResponse`/`extractJSON` | test-e2e.js or new file | ~50 lines |
| 8 | Add ARIA labels and focus management | Chat.jsx, App.jsx | ~30 lines |
| 9 | Add request logging middleware | server.js | ~10 lines |
| 10 | Distinguish error types (502 vs 400 vs 500) | server.js | ~20 lines |

### Low Priority (polish)

| # | Issue | File(s) | Effort |
|---|---|---|---|
| 11 | Consolidate docs (remove VALIDATION/EVALUATION) | *.md | Deletion |
| 12 | Add responsive breakpoint for topic grid | App.jsx | ~5 lines |
| 13 | Normalize input before safety check | safety.js | ~10 lines |
| 14 | Add cleanup to `useEffect` for topic fetch | App.jsx | ~5 lines |
| 15 | Remove spec requirement references from comments | All source files | ~10 lines |

---

## Genuine Engineering Credit

The following aspects demonstrate real engineering depth, not decorative scaffolding:

1. **Deterministic rain generation** (Environment.jsx:41-53): Rain drops use `(i * offset + seed) % max` to produce stable positions across re-renders. This is a deliberate performance decision, not something a generator would produce by default.

2. **Two-layer safety architecture** (safety.js + prompt.js): Server-side regex catches obvious dangerous content before the LLM is called (saving cost and latency), while soft safety instructions in the system prompt handle contextual nuance. Both input and output are checked.

3. **Staggered timeouts** (api.js:22, server.js:17): Client timeout (35s) > server timeout (30s) ensures the server has time to return a proper error response rather than the client seeing a raw timeout.

4. **Abort-before-start pattern** (App.jsx:51-53): Cancelling the previous in-flight request before starting a new one prevents race conditions where a slow response overwrites a fast one.

5. **`parseResponse` resilience** (server.js:95-105): Handles multiple JSON field names (`message`, `response`, `text`), markdown code fences, non-numeric distress values, and missing fields. This is defensive programming against real LLM output variation.

6. **Compassionate error UX** (Chat.jsx, App.jsx): Every error state uses therapeutic language ("needs a moment", "take a moment", "you deserve real support"). The safety exit screen provides 4 real crisis resources with phone, text, and web options. This demonstrates genuine care for the domain, not just functional completeness.

---

*Audit performed using the [Vibe-Code Detection Audit v2.0](https://github.com/kase1111-hash/Claude-prompts/blob/main/vibe-checkV2.md) framework.*
