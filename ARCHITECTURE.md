# Stillness — Architecture

## Technology Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Language | JavaScript (ES modules) | Runs natively in the browser. No compilation required for simple projects. Satisfies platform constraint (web). |
| UI framework | React 19 via npm | Component model fits the three distinct UI regions (chat, environment, landing). Handles re-renders on state change efficiently (reqs 1, 8). |
| Build tool | Vite | Fast dev server, zero-config React support, single command to build for production. |
| LLM provider | Anthropic Claude (default) or Ollama (offline) | Set `LLM_PROVIDER=ollama` to use a local model via Ollama's `/api/chat` endpoint with `format: "json"`. Anthropic is the default for strongest instruction-following (reqs 3, 6, 7). Both are called from the Express proxy. |
| Backend proxy | Express | Keeps the API key server-side. Two endpoints: GET `/api/topics` (topic list) and POST `/api/chat` (LLM proxy with safety filter). No database (storage constraint). |
| Safety system | Two-layer (regex + LLM) | Hard regex filter on server catches clearly dangerous content before the LLM is called. Soft safety instructions in the system prompt handle nuanced/contextual cases via a `safety` boolean in the JSON output. |
| Visual environment | CSS custom properties + CSS transitions | Smooth interpolation of colors and motion within the 200ms performance constraint (req 8). No canvas or WebGL needed — the environment is atmospheric, not rendered. |
| Particles | CSS keyframe animations on span elements | Lightweight, GPU-accelerated, no library needed. Particle count and speed driven by distress value. |

## File Map

| File | Purpose | Reqs |
|------|---------|------|
| `server.js` | Express proxy — GET `/api/topics` + POST `/api/chat`. Hard safety regex filter on input/output. Forwards to Anthropic or Ollama based on `LLM_PROVIDER` env var. | 3, 6, 7, edge:api-failure |
| `src/main.jsx` | React entry point, mounts App | — |
| `src/App.jsx` | Top-level layout, holds all session state, orchestrates phase transitions (landing → topics → active → resolved/safety), topic selection, safety exit with crisis resources | 1, 4, 5, 9, 10 |
| `src/Chat.jsx` | Message list + input field, input validation, loading state. Dynamic character name via prop. | 1, 2, edge:empty, edge:long, edge:rapid |
| `src/Environment.jsx` | Full-screen background layer — gradients, particles, orb — driven by distress prop | 8 |
| `src/api.js` | `fetchTopics()` + `sendMessage(messages, topic)` → calls proxy → returns `{ message, distress, safety }` | 3, 6, 7, edge:api-failure |
| `src/prompt.js` | Topic definitions (5 characters), per-topic system prompts, shared distress/safety/output rules | 3, 6, 7 |
| `index.html` | Shell HTML | — |
| `package.json` | Project metadata, dependencies, and npm scripts | — |
| `vite.config.js` | Vite config — React plugin, dev server proxy from `/api` to Express | — |
| `.gitignore` | Excludes `node_modules/` and `dist/` from version control | — |
| `test-e2e.js` | E2E test suite — mock LLM, safety filter, topic routing, 20 test runs | — |

**12 files total.** Every numbered requirement (1–10) and every edge case appears in at least one file's responsibility list.

## Data Model

**Topic** — A conversation scenario. Fields: `id` (string slug), `character` (display name), `name` (topic label), `description` (short summary), `prompt` (character-specific system prompt text).

**Message** — A single conversational turn. Fields: `role` (either "user" or "character"), `text` (string).

**Session** — The full state of one playthrough. Fields: `messages` (ordered list of Messages), `distress` (integer 0–10), `phase` (one of "landing", "topics", "active", "resolved", "safety"), `loading` (boolean), `error` (boolean), `topic` (selected Topic object), `safetyMsg` (string shown on safety exit).

**API Response** — What the LLM returns per turn. Fields: `message` (string, character's reply), `distress` (integer, updated level), `safety` (boolean, true if safety line crossed). Parsed from structured JSON.

**Topics** (5 built-in):
| ID | Character | Theme |
|----|-----------|-------|
| `anxiety` | Aria | Overwhelmed by worry and fear |
| `grief` | Eliot | Processing loss |
| `loneliness` | Maya | Feeling isolated |
| `stress` | Jordan | Crushed under pressure |
| `self-doubt` | Sam | Feeling not good enough |

## Component Breakdown

**App** — Owns session state. Receives nothing from outside. Produces the page layout and passes state down to children. Manages topic selection, safety exits with crisis resources, and phase transitions. Talks to: Chat, Environment, api.js.

**Chat** — Displays the conversation and handles user input. Receives: `messages`, `loading`, `phase`, `onSend` callback, `error`, `onRetry` callback, `characterName`. Produces: validated user messages via `onSend`, or retry trigger via `onRetry`. Talks to: App (via callbacks).

**Environment** — Renders the visual atmosphere. Receives: `distress` (number). Produces: visual output only (no data). Talks to: nobody — it's a pure display component.

**api.fetchTopics** — Loads available topics. Produces: array of `{ id, character, name, description }`. Talks to: server.js GET `/api/topics`.

**api.sendMessage** — Handles LLM communication. Receives: full message history, topic ID. Produces: `{ message, distress, safety }` or throws on failure. Talks to: server.js POST `/api/chat`.

## Flow Diagram

1. User opens app → App renders in `phase: "landing"`.
2. User clicks "Begin" → App sets `phase: "topics"`, shows topic selection grid.
3. User selects a topic → App sets `phase: "active"`, `distress: 8`, stores selected topic.
4. App calls `api.sendMessage([], topicId)` with empty history → server injects a synthetic `"(session start)"` user message (Claude API requires at least one) → character's opening message arrives.
5. App appends character's message to `messages`, updates `distress` → Environment transitions.
6. User types a message in Chat, submits → Chat validates (non-empty, under 1000 chars), calls `onSend`.
7. App appends user message to `messages`, sets `loading: true` → Chat disables input.
8. App calls `api.sendMessage(messages, topicId)` → server runs hard safety filter → if safe, proxies to LLM → response returns.
9. If hard safety filter or LLM `safety: true` → App sets `phase: "safety"`, shows crisis resources.
10. If API fails → App shows retry prompt, keeps `loading: false`.
11. App appends character's response, updates `distress`, sets `loading: false`.
12. If `distress === 0` → App sets `phase: "resolved"`, closing message displays (req 10).
13. User can click "Try another conversation" or "Start over" → returns to topic selection.

## State Management

All state lives in `App.jsx` via React `useState`. No external store.

| State | Type | Initial | Changed by |
|-------|------|---------|------------|
| `phase` | string | `"landing"` | "Begin" → `"topics"`, select topic → `"active"`, distress 0 → `"resolved"`, safety → `"safety"`, restart → `"topics"` |
| `distress` | number | `8` | Every API response updates it |
| `messages` | array | `[]` | Appended on each user submit and each API response |
| `loading` | boolean | `false` | `true` when API call in flight, `false` on response or error |
| `error` | boolean | `false` | `true` when API call fails, cleared on next send or retry |
| `topic` | object | `null` | Set when user selects a topic, cleared on restart |
| `topics` | array | `[]` | Loaded from `/api/topics` on mount (hardcoded fallback) |
| `safetyMsg` | string | `""` | Set when safety exit is triggered |

## Safety Architecture

**Layer 1 — Hard regex filter (server.js):** Six regex patterns catch clearly dangerous content (violence toward specific targets, self-harm methods, sexual content, assault) before the LLM is ever called. Returns a compassionate exit message and `safety: true`.

**Layer 2 — LLM soft safety (system prompt):** The system prompt instructs the LLM to set `"safety": true` in its JSON output if the user's message is outside the scope of supportive conversation. This handles nuanced/contextual cases the regex can't catch.

**Safety exit screen (App.jsx):** When either layer triggers, the app shows the safety message plus clickable links to real crisis resources (988 Lifeline, Crisis Text Line, Childhelp, IASP). The user can return to topic selection afterward.

No conflicting requirements were found. No requirement is unusually expensive — the costliest element is the LLM API call, which is inherent to the project and cannot be simplified away.
