# Stillness

A conversational game where you talk someone through a crisis — using only empathy, patience, and presence.

## What It Is

Someone is in crisis. They're spiraling, frightened, overwhelmed. Your only tool is conversation. There are no puzzles, no timers, no weapons. You just talk to them, and the room around you shifts to reflect how they're feeling.

The techniques that help are real therapeutic skills: active listening, validation, grounding, sitting with uncertainty. You learn them not through instruction but through practice.

## Features

- **5 unique characters** — Aria (anxiety), Eliot (grief), Maya (loneliness), Jordan (stress), Sam (self-doubt), each with distinct personalities and emotional needs
- **Dynamic environment** — A therapist's office with a window to the outside. The sky darkens and rain falls during high distress; clouds part and golden light fills the room as calm returns
- **Crisis hotline UI** — Chat interface styled as a warm, professional support session with status indicators and clean message bubbles
- **Real therapeutic mechanics** — Distress level (0–10) responds to empathy, validation, and grounding. Dismissiveness and cold logic make things worse
- **Two-layer safety system** — Hard regex filter + LLM-based contextual safety detection. Triggers a compassionate exit with real crisis resources (988 Lifeline, Crisis Text Line, and more)
- **Offline support** — Run locally with Ollama instead of the Anthropic API

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- An [Anthropic API key](https://console.anthropic.com/) **or** [Ollama](https://ollama.com/) installed locally

### Install

```bash
git clone https://github.com/kase1111-hash/Stillness.git
cd Stillness
npm install
```

### Run with Anthropic (default)

```bash
export ANTHROPIC_API_KEY=your-key-here
npm start
```

### Run with Ollama (offline)

```bash
# Make sure Ollama is running with a model pulled (e.g. llama3.2)
ollama pull llama3.2
npm run start:ollama
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | Required when using Anthropic provider |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` | Which Anthropic model to use |
| `LLM_PROVIDER` | `anthropic` | Set to `ollama` for local models |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama server URL |
| `OLLAMA_MODEL` | `llama3.2` | Which Ollama model to use |
| `PORT` | `3001` | Express server port |

The app runs at `http://localhost:5173`. Vite proxies `/api` requests to Express on port 3001.

## How to Play

1. **Landing** — Read the intro and click **Begin**
2. **Choose a conversation** — Pick one of 5 characters, each dealing with a different struggle
3. **Listen** — The character speaks first. Read what they say. Pay attention
4. **Respond** — Type what you'd say to someone in pain. There are no right answers, but empathy works better than advice
5. **Watch the room** — Rain on the window, dark clouds, dim lighting mean high distress. As you help, the sky clears, warm light fills the room
6. **Reach stillness** — When distress reaches 0, the session resolves peacefully

### What helps

- Empathetic statements: *"That sounds really hard"*
- Validating feelings: *"It makes sense you feel that way"*
- Grounding: *"Can you tell me what you see around you right now?"*
- Patience and warmth: *"I'm here with you, take your time"*

### What doesn't help

- Dismissing: *"Just calm down"*, *"It's not that bad"*
- Cold logic without emotion
- Unsolicited advice or problem-solving
- Changing the subject

## Architecture

```
index.html          Shell HTML with global styles
src/main.jsx        React entry point
src/App.jsx         Session state, phase transitions, screen layouts
src/Chat.jsx        Crisis-hotline chat panel with message bubbles
src/Environment.jsx Therapist office scene — window, sky, rain, lamp, plant
src/api.js          Client-side fetch wrapper for /api endpoints
src/prompt.js       5 character prompts + shared distress/safety/output rules
server.js           Express proxy with safety filter, Anthropic + Ollama support
test-e2e.js         E2E test suite — 20 runs, 166 assertions
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full technical breakdown.

## Tech Stack

- **Frontend:** React 19, Vite
- **Backend:** Express (API proxy, no database)
- **LLM:** Anthropic Claude (default) or Ollama (offline)
- **Styling:** Inline CSS with JS-driven transitions
- **Tests:** Custom E2E runner with mock LLM

## License

[MIT](LICENSE)
