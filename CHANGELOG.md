# Changelog

## Gameplay Fixes

- **Conversations past the first line**: The server now prepends the `"(session start)"` user turn to every request, not just the first. Previously every reply after the opening line was sent to Claude starting with an assistant message, which the API rejects, so sessions stalled on "needs a moment" after one exchange.
- **Distress memory**: Character turns are replayed to the LLM as the JSON they produced, including `distress`, so the model can see its earlier levels instead of guessing them each turn. The server now also enforces the distress rules: sessions open at 8, change by at most 2 points per exchange, and a missing or `null` distress keeps the previous level (`null` used to read as 0 and end the session).
- **Final words**: The resolved screen shows the character's last reply, which was previously never displayed.
- **Long sessions**: The client sends the most recent 40 messages and the server accepts up to 100kb, so long conversations no longer hit the old 10kb limit and get stuck.
- **Timeouts**: The client's 35s timeout now applies (it was dropped whenever a cancel signal was passed), and the Anthropic call is capped at 30s in total — SDK retries used to stretch it past 90s.
- **"Start over" races**: In-flight replies are cancelled, so a late reply can no longer jump the topic screen to "resolved" or clear the loading state of the next session.
- **Small screens**: Landing, topic, safety, and resolved cards scroll when taller than the viewport, so every character and crisis resource is reachable on phones.
- **Parsing**: JSON wrapped in stray prose is extracted; the reply's text block is found by type rather than assumed to be first.
- **Real-server E2E tests**: `test-e2e.js` now starts `server.js` against a mock Anthropic API that enforces the API's request rules, instead of testing a hand-copied mirror of the server. New runs cover distress rules, LLM context, prose-wrapped output, and request limits. `npm test` runs both suites. `CHAT_RATE_LIMIT` configures the chat rate limit (default 20/min).

## Quality Evaluation Fixes

- **Characters renamed**: Replaced abstract names (Aria, Eliot, Maya, Jordan, Sam) with descriptive therapy archetypes (The New Graduate, The Widowed Parent, The Night-Shift Worker, The Single Parent, The Overworked Office Worker). Each character now has specific life-situation details in their prompt.
- **Safety filter expanded**: Added patterns for suicide planning phrases, self-harm instructions, child exploitation, drug manufacturing, and weapons creation. Extracted to shared module (`src/safety.js`) imported by both `server.js` and `test-e2e.js`.
- **LLM timeout**: Added 30-second timeout to both Anthropic (via SDK `timeout` option) and Ollama (via `AbortSignal.timeout`) calls in `server.js`.
- **SPEC.md updated**: Replaced all "Aria" references with generic "character" language. Marked Ollama as a supported LLM provider. Added LLM timeout edge case.
- **Documentation sync**: Updated README, ARCHITECTURE.md, and CHANGELOG.md to reflect new character names, shared safety module, file count (13), and timeout behavior.

## GUI Redesign — Crisis Hotline / Therapist Office

- **Environment**: Replaced gradient/orb/particle visuals with a therapist-office scene. Warm room background with a 4-pane window showing dynamic weather (stormy sky + rain at high distress, golden clearing at calm), drifting clouds, amber desk lamp glow, and a potted plant silhouette
- **Chat**: Redesigned as a crisis-hotline style frosted cream panel with header bar (green status dot, character name, "Active session"), warm brown user bubbles, white character bubbles, pill-shaped input and send button
- **App screens**: All overlay screens (landing, topics, safety, resolved) now use warm cream cards with serif headings, brown palette, rounded buttons
- **Base styles**: Updated body background to warm dark brown, added custom scrollbar styling, warm input focus states

## Multi-Topic Therapy System

- **5 characters**: Each identified by a descriptive life-situation archetype, with unique personality prompts
- **Topic selection**: New phase between landing and active session with a grid of character cards
- **Per-topic routing**: Server accepts `topic` parameter, loads character-specific system prompt
- **Safety**: Two-layer safety system (hard regex filter + LLM soft safety) with crisis resource display on safety exit
- **Dynamic character name**: Chat header and message labels reflect the selected character

## Ollama Support

- **Offline LLM**: Set `LLM_PROVIDER=ollama` to use a local model via Ollama's `/api/chat` endpoint
- **Configurable**: `OLLAMA_BASE_URL` and `OLLAMA_MODEL` environment variables
- **npm scripts**: `npm run start:ollama` and `npm run server:ollama` for convenience

## E2E Test Suite

- **20 randomized test runs** with a mock LLM server
- **166 assertions** covering topic routing, safety filtering, distress mechanics, API error handling, and edge cases
- **Self-contained**: `node test-e2e.js` — no test framework dependencies

## Initial Implementation

- Text-based conversation with an AI character in crisis
- Distress level (0–10) driven by empathy, validation, grounding
- Visual environment with gradients, orb, and particles reflecting distress
- Express API proxy to Anthropic Claude
- Input validation (empty, too long), loading states, error handling with retry
- Session resolution at distress 0 with closing message

## Documentation Feedback Round

- Fixed 6 issues in ARCHITECTURE.md (CDN → npm, missing files in File Map, expanded Chat interface docs, documented synthetic message, added error to data model)
- Added "Start over" button during active session (spec UX flow step 6)
