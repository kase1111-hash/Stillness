# Implementation Notes

## Files

| # | File | Summary |
|---|------|---------|
| 1 | `package.json` | Project metadata, dependencies, and scripts |
| 2 | `vite.config.js` | Vite config with React plugin and API proxy |
| 3 | `index.html` | Shell HTML with global reset styles, warm scrollbar, focus styles |
| 4 | `src/prompt.js` | 5 character-specific system prompts + shared distress/safety/output rules |
| 5 | `src/api.js` | Client-side fetch wrapper for `/api/topics` and `/api/chat` |
| 6 | `src/Environment.jsx` | Full-screen therapist-office scene — window with sky/clouds/rain, desk lamp glow, plant silhouette, all driven by distress |
| 7 | `src/Chat.jsx` | Crisis-hotline style chat panel — header bar, message bubbles, validation, loading/error states |
| 8 | `src/App.jsx` | Session state owner, phase transitions (landing/topics/active/resolved/safety), topic selection, crisis resource display |
| 9 | `src/main.jsx` | React entry point |
| 10 | `server.js` | Express proxy with hard safety filter, Anthropic + Ollama LLM support |
| 11 | `test-e2e.js` | E2E test suite — 20 runs, 166 assertions |

## Design Decisions

1. **Global styles in `index.html`** — Base styles (reset, warm scrollbar, focus rings) are inlined in the HTML `<style>` tag rather than a separate CSS file. All component-level styles are inline JS objects.

2. **Therapist-office environment** — The visual background is a room with a 4-pane window. Sky, clouds, and rain animate based on distress. A desk lamp provides warm ambient light that brightens as calm increases. A potted plant silhouette adds atmosphere. All transitions use CSS `transition` for smooth interpolation.

3. **Crisis-hotline chat UI** — The chat is rendered as a frosted cream card with a header bar showing the character's name and a green "active" status dot. User messages are warm brown with cream text; character messages are white with dark text. Input is pill-shaped to match the professional feel.

4. **Synthetic session-start message** — The Claude API requires at least one user message, so the server sends `"(session start)"` as a synthetic first user message when the history is empty.

5. **Error handling** — On API failure, the user's last message stays in the message history and a "Try again" button re-calls the API with the same messages. This avoids message loss.

6. **Multi-topic system** — 5 characters each have unique personality prompts, but share the same distress mechanics, safety rules, and JSON output format. Topic selection happens before the active session begins.

7. **Dual LLM support** — The server dispatches to Anthropic or Ollama based on the `LLM_PROVIDER` environment variable. Ollama uses `/api/chat` with `format: "json"` for structured output.

## How to Run

### Anthropic (default)

```bash
npm install
export ANTHROPIC_API_KEY=your-key-here
npm start
```

### Ollama (offline)

```bash
npm install
ollama pull llama3.2
npm run start:ollama
```

The app will be available at `http://localhost:5173`. Vite proxies `/api` requests to Express on port 3001.

## Tests

```bash
node test-e2e.js
```

Runs 20 randomized test sessions with a mock LLM, covering topic routing, safety filtering, distress mechanics, and API error handling. 166 assertions total.
