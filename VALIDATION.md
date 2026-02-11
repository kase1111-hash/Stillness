# Validation Report

## 1. Requirement Walkthrough

| Req | Description | File(s) | Status | Notes |
|-----|-------------|---------|--------|-------|
| 1 | Text-based conversation between user and AI character | `Chat.jsx`, `App.jsx` | PASS | Messages rendered with "You" / character name labels. 5 characters available via topic selection. |
| 2 | User can type free-form messages and submit | `Chat.jsx` | PASS | Input field + form submit handler. `onSend` callback passes validated text to App. |
| 3 | Responses generated dynamically via LLM | `server.js`, `api.js`, `prompt.js` | PASS | Server calls Anthropic or Ollama with per-character system prompt. No scripted responses. |
| 4 | Maintain distress level (integer 0–10) | `App.jsx`, `server.js` | PASS | `distress` state in App. Server clamps to 0–10 via `Math.max(0, Math.min(10, ...))`. |
| 5 | Distress starts at 8 | `App.jsx`, `prompt.js` | PASS | `INITIAL_DISTRESS = 8`. System prompt also tells the model "It starts at 8." |
| 6 | Decrease distress on empathy/validation/grounding/warmth | `prompt.js` | PASS | System prompt lists specific behaviors that decrease distress by 1–2 points. |
| 7 | Increase/stagnate distress on dismissive/cold/logical | `prompt.js` | PASS | System prompt lists specific behaviors that increase or maintain distress. |
| 8 | Update visual environment in real time | `Environment.jsx` | PASS | Therapist-office scene — window sky/clouds/rain, lamp glow, plant all driven by distress. CSS transitions start within one frame (~16ms), well within 200ms constraint. |
| 9 | Session ends when distress reaches 0 | `App.jsx` | PASS | `if (newDistress === 0) { setPhase("resolved"); }` |
| 10 | Display closing message, no score/ranking | `App.jsx` | PASS | Resolved screen: "Stillness reached. Thank you for being here." No scores. |

**Result: 10/10 PASS**

## 2. Flow Test

| UX Flow Step | Code Path | Status |
|--------------|-----------|--------|
| 1. **Landing** — minimal screen with intro and begin prompt | `App.jsx`: renders title, subtitle, "Begin" button over high-distress Environment in warm cream card | PASS |
| 2. **Topic selection** — choose from 5 characters | `App.jsx`: topic grid with character cards, each showing name, topic, description | PASS |
| 3. **Session starts** — high-distress visuals, character speaks first | `handleSelectTopic` → sets phase "active", distress 8, calls `callCharacter([])` → server sends synthetic start → character's opening message returned | PASS |
| 4. **Conversation** — user types, character replies, environment shifts | `handleSend` → appends user message → `callCharacter(updated)` → API returns → character message appended → distress updated → Environment re-renders | PASS |
| 5. **Progression** — distress moves over exchanges | Model adjusts distress per system prompt rules; server clamps value; Environment interpolates all visual elements | PASS |
| 6. **Resolution** — distress 0, calm environment, closing message | `newDistress === 0` → phase "resolved" → Environment at 0 (golden sky, warm lamp, no rain), closing text, "Try another conversation" button | PASS |
| 7. **Replay** — user can start new session or switch character | "Try another conversation" on resolved screen, "Start over" during active session, "Return to topics" on safety exit | PASS |

**Result: 7/7 PASS**

## 3. Edge Case Check

| Edge Case | Handling | File | Status |
|-----------|----------|------|--------|
| **Empty input** | `handleSubmit` trims input, rejects empty with "Take a moment — then try saying something." | `Chat.jsx` | PASS |
| **Very long input** | Rejects if trimmed length > 1000 characters. HTML `maxLength` on input as soft cap. | `Chat.jsx` | PASS |
| **API failure** | `callCharacter` catch sets `error: true`. Chat shows "needs a moment..." with "Try again" button. Server returns 500 with error message. | `App.jsx`, `Chat.jsx`, `server.js` | PASS |
| **Rapid input** | Input and send button disabled when `loading` is true. | `Chat.jsx` | PASS |
| **Session interrupted** | No recovery needed per spec. State is in-memory React state, lost on page close. | — | PASS |

**Result: 5/5 PASS**

## 4. Integration Check

| Interface | Architecture Definition | Implementation | Status |
|-----------|------------------------|---------------|--------|
| App → Chat | Props: `messages, loading, phase, onSend, error, onRetry, characterName` | Passes all seven props | PASS |
| App → Environment | Props: `distress` (number) | `distress={distress}` in active, `distress={INITIAL_DISTRESS}` in landing, `distress={6}` in topics, `distress={0}` in resolved/safety | PASS |
| App → api.js | `sendMessage(messages, topic)` → `{message, distress, safety}` | Correct — sends message array + topic ID, returns parsed object or throws | PASS |
| api.js → server.js | POST `/api/chat` with `{messages, topic}` body | Correct — Vite proxy forwards to Express on port 3001 | PASS |
| api.js → server.js | GET `/api/topics` | Returns array of `{id, character, name, description}` | PASS |
| server.js → prompt.js | `getSystemPrompt(topicId)` + `TOPICS` | Imports and uses both correctly | PASS |
| Data model: Message | `{role: "user"|"character", text: string}` | App creates both roles correctly | PASS |

**Result: 7/7 PASS**

## 5. Build Test

```
$ npm install    → 183 packages, 0 vulnerabilities
$ npx vite build → ✓ 32 modules transformed, built successfully
$ node test-e2e.js → 166 passed, 0 failed
```

Production build succeeds. All E2E tests pass. Full runtime testing requires an `ANTHROPIC_API_KEY` or Ollama.

## 6. Safety Check

| Layer | Mechanism | Status |
|-------|-----------|--------|
| Hard regex filter | 6 patterns catch violence, self-harm methods, sexual content, assault before LLM call | PASS |
| LLM soft safety | System prompt instructs `"safety": true` for out-of-scope content | PASS |
| Output filter | LLM output also checked against hard regex patterns | PASS |
| Safety exit screen | Compassionate message + 4 real crisis resources (988, Crisis Text Line, Childhelp, IASP) with clickable links | PASS |

## Final Status

**READY**

All 10 functional requirements pass. All 5 edge cases handled. All 7 UX flow steps verified. All component interfaces match. Build and tests succeed. Two-layer safety system operational.
