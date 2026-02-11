# Stillness — Architecture

## Technology Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Language | JavaScript (ES modules) | Runs natively in the browser. No compilation required for simple projects. Satisfies platform constraint (web). |
| UI framework | React 19 via npm | Component model fits the three distinct UI regions (chat, environment, landing). Handles re-renders on state change efficiently (reqs 1, 8). |
| Build tool | Vite | Fast dev server, zero-config React support, single command to build for production. |
| LLM provider | Anthropic Claude API (Sonnet) | Strong instruction-following for structured JSON output (reqs 3, 6, 7). Called from a lightweight backend proxy to keep API keys off the client. |
| Backend proxy | Express (single route) | Needed solely to keep the API key server-side. One POST endpoint, no database (storage constraint). |
| Visual environment | CSS custom properties + CSS transitions | Smooth interpolation of colors and motion within the 200ms performance constraint (req 8). No canvas or WebGL needed — the environment is atmospheric, not rendered. |
| Particles | CSS keyframe animations on span elements | Lightweight, GPU-accelerated, no library needed. Particle count and speed driven by distress value. |

## File Map

| File | Purpose | Reqs |
|------|---------|------|
| `server.js` | Express proxy — single POST `/api/chat` route that forwards to Claude API | 3, 6, 7, edge:api-failure |
| `src/main.jsx` | React entry point, mounts App | — |
| `src/App.jsx` | Top-level layout, holds all session state, orchestrates phase transitions | 1, 4, 5, 9, 10 |
| `src/Chat.jsx` | Message list + input field, input validation, loading state | 1, 2, edge:empty, edge:long, edge:rapid |
| `src/Environment.jsx` | Full-screen background layer — gradients, particles, orb — driven by distress prop | 8 |
| `src/api.js` | `sendMessage(messages)` → calls proxy → returns `{ message, distress }` | 3, 6, 7, edge:api-failure |
| `src/prompt.js` | Aria's system prompt — personality, distress rules, JSON output format | 3, 6, 7 |
| `index.html` | Shell HTML | — |
| `package.json` | Project metadata, dependencies, and npm scripts | — |
| `vite.config.js` | Vite config — React plugin, dev server proxy from `/api` to Express | — |
| `.gitignore` | Excludes `node_modules/` and `dist/` from version control | — |

**11 files total.** Every numbered requirement (1–10) and every edge case appears in at least one file's responsibility list.

## Data Model

**Message** — A single conversational turn. Fields: `role` (either "user" or "aria"), `text` (string).

**Session** — The full state of one playthrough. Fields: `messages` (ordered list of Messages), `distress` (integer 0–10), `phase` (one of "landing", "active", "resolved"), `loading` (boolean, true while awaiting API response), `error` (boolean, true when the last API call failed).

**API Response** — What the LLM returns per turn. Fields: `message` (string, Aria's reply), `distress` (integer, her updated level). Parsed from structured JSON in the model output.

## Component Breakdown

**App** — Owns session state. Receives nothing from outside. Produces the page layout and passes state down to children. Talks to: Chat, Environment, api.js.

**Chat** — Displays the conversation and handles user input. Receives: `messages`, `loading`, `phase`, `onSend` callback, `error`, `onRetry` callback. Produces: validated user messages via `onSend`, or retry trigger via `onRetry`. Talks to: App (via callbacks).

**Environment** — Renders the visual atmosphere. Receives: `distress` (number). Produces: visual output only (no data). Talks to: nobody — it's a pure display component.

**api.sendMessage** — Handles LLM communication. Receives: full message history. Produces: `{ message, distress }` or throws on failure. Talks to: server.js proxy.

## Flow Diagram

1. User opens app → App renders in `phase: "landing"`.
2. User clicks "Begin" → App sets `phase: "active"`, `distress: 8`.
3. App calls `api.sendMessage([])` with empty history → server injects a synthetic `"(session start)"` user message (Claude API requires at least one) → Aria's opening message arrives.
4. App appends Aria's message to `messages`, updates `distress` → Environment transitions.
5. User types a message in Chat, submits → Chat validates (non-empty, under 1000 chars), calls `onSend`.
6. App appends user message to `messages`, sets `loading: true` → Chat disables input.
7. App calls `api.sendMessage(messages)` → server proxies to Claude → response returns.
8. If API fails → App shows retry prompt, keeps `loading: false`.
9. App appends Aria's response, updates `distress`, sets `loading: false`.
10. If `distress === 0` → App sets `phase: "resolved"`, closing message displays (req 10).
11. User can click "Begin again" → state resets to step 2.

## State Management

All state lives in `App.jsx` via React `useState`. No external store.

| State | Type | Initial | Changed by |
|-------|------|---------|------------|
| `phase` | string | `"landing"` | "Begin" button → `"active"`, distress hitting 0 → `"resolved"`, replay → `"active"` |
| `distress` | number | `8` | Every API response updates it |
| `messages` | array | `[]` | Appended on each user submit and each API response |
| `loading` | boolean | `false` | `true` when API call in flight, `false` on response or error |
| `error` | boolean | `false` | `true` when API call fails, cleared on next send or retry |

No conflicting requirements were found. No requirement is unusually expensive — the costliest element is the LLM API call, which is inherent to the project and cannot be simplified away.
