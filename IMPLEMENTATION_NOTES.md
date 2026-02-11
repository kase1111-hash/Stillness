# Implementation Notes

## Files Created

| # | File | Summary |
|---|------|---------|
| 1 | `package.json` | Project metadata, dependencies, and scripts |
| 2 | `vite.config.js` | Vite config with React plugin and API proxy |
| 3 | `index.html` | Shell HTML with global reset styles |
| 4 | `src/prompt.js` | Aria's system prompt — personality, distress rules, JSON output format |
| 5 | `src/api.js` | Client-side fetch wrapper for `/api/chat` |
| 6 | `src/Environment.jsx` | Full-screen visual layer — gradient, orb, particles driven by distress |
| 7 | `src/Chat.jsx` | Message list, input field, validation, loading/error states |
| 8 | `src/App.jsx` | Session state owner, phase transitions, wires Chat + Environment |
| 9 | `src/main.jsx` | React entry point |
| 10 | `server.js` | Express proxy forwarding to Claude API |

## Feedback for Earlier Steps

### Architecture gaps (files not in the File Map)

- **`package.json`** — Required for dependency management. Not listed in architecture.
- **`vite.config.js`** — Required for the Vite dev server proxy to Express. Not listed in architecture.
- Both are standard config files, but the architecture's File Map should include them to be truly "run without modification."

### Design decisions made during implementation

1. **Global styles in `index.html`** — Rather than creating a separate CSS file, base styles (reset, font, background) are inlined in the HTML `<style>` tag. This avoids adding a file not in the architecture.

2. **Aria's opening message** — The architecture's flow says "App calls `api.sendMessage([])` with empty history." The Claude API requires at least one user message, so the server sends `"(session start)"` as a synthetic first user message when the history is empty.

3. **Error handling approach** — On API failure, the user's last message stays in the message history and a "Try again" button re-calls the API with the same messages. This avoids message loss.

### No issues blocking the build

- No spec requirements were orphaned — all 10 functional requirements and all 5 edge cases are addressed.
- No file exceeds 300 lines (largest is `Chat.jsx` at ~160 lines).
- No conflicting requirements were encountered.

## How to Run

```bash
npm install
# Set your API key
export ANTHROPIC_API_KEY=your-key-here
# Start both the Express server and Vite dev server
npm start
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies `/api` requests to Express on port 3001.
