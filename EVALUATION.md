# PROJECT EVALUATION REPORT

**Primary Classification:** Full-Featured & Coherent

**Secondary Tags:** None

---

## CONCEPT ASSESSMENT

**What real problem does this solve?**
Empathy is a skill. Most people have no safe way to practice it under pressure. Therapy training programs use role-play, but they're inaccessible to the general public. Stillness creates a low-stakes, private environment where anyone can practice active listening, validation, and grounding on AI characters experiencing realistic emotional crises.

**Who is the user? Is the pain real or optional?**
Anyone interested in developing emotional support skills — students, aspiring counselors, curious adults, people preparing to support a friend in crisis. The pain is optional (this is educational, not clinical), but the skill gap is real: most people default to advice-giving or dismissiveness when someone is distressed, and there's no existing consumer product that trains this.

**Is this solved better elsewhere?**
No direct competitor exists at this intersection. Clinical training sims (like Shadow Health) are expensive and gated behind institutions. AI chatbot companions (Character.AI, Replika) optimize for engagement, not therapeutic skill-building. Stillness occupies a genuinely uncontested niche: structured empathy practice with a feedback loop (distress level) and a clear win condition (stillness).

**Value prop in one sentence:**
Practice talking someone through a crisis using real therapeutic techniques, with an AI character whose emotional state responds to how well you listen.

**Verdict:** Sound. The concept is specific, defensible, and under-served. It's not trying to replace therapy — it's a training tool for a skill most people lack. The distress mechanic as a feedback signal is the key insight that separates this from a chatbot.

---

## EXECUTION ASSESSMENT

**Architecture complexity vs actual needs:**
Exactly right. 1,694 LOC across 13 files. React for the three UI regions (chat, environment, overlays), Express as a thin proxy to keep the API key server-side, no database because sessions are ephemeral. No state management library — `useState` in `App.jsx` is sufficient for the scope. No CSS framework — inline styles are consistent and appropriate for 3 components. This is one of those rare cases where the architecture is precisely calibrated to the problem.

**Feature completeness vs code stability:**
Complete. Every feature in the README exists in the code. Every spec requirement (14/14 in SPEC.md) is verified. Build passes. 166 E2E assertions pass. No dead code. No half-implemented features. No TODO comments.

**Evidence of premature optimization or over-engineering:**
None. The temptations are obvious — streaming responses, session persistence, a database, a CSS-in-JS library, a state management library, TypeScript — and the author resisted all of them. The `useMemo` in `Environment.jsx:105` for rain elements is justified optimization, not premature.

**Signs of rushed/hacked/inconsistent implementation:**
None. Pattern consistency is high throughout:
- All components use function components + hooks
- All files use ES modules
- All styling is inline JS objects
- All files have header comments explaining purpose
- Naming conventions are consistent (`handleX` for callbacks, `callX` for API functions)

The one area with visible iteration is the safety system, which was recently extracted to a shared module (`src/safety.js`) and expanded. That's evidence of deliberate improvement, not rushing.

**Tech stack appropriateness:**
React 19, Express 4, Vite 6, Anthropic SDK — all standard, current, and justified. 4 runtime dependencies, 3 dev dependencies. Ollama support as an alternative LLM provider is a smart addition for offline development and demos. No bloat.

**Verdict:** Execution matches ambition. The codebase is the right size, the right complexity, and the right tech stack for exactly what it claims to be. Nothing is missing. Nothing is extra.

---

## SCOPE ANALYSIS

**Core Feature:** Distress-responsive conversation with an AI character in crisis — the empathy feedback loop.

This is the one thing. User types empathetic (or not) message → LLM responds in character → distress goes up or down → environment shifts → repeat until stillness. Every other feature exists to serve this loop.

**Supporting:**
- `Environment.jsx` — Visual feedback that makes the distress number *felt*, not just read. The therapist-office metaphor (rain clearing, lamp warming, sky brightening) is the emotional equivalent of a progress bar. Directly serves core loop.
- `src/safety.js` + LLM soft safety — Two-layer safety system. Non-negotiable for anything involving crisis-adjacent conversation. The compassionate exit with real crisis resources (`App.jsx:13-18`) is responsible design, not feature creep.
- `server.js` — Express proxy. Required to keep the API key server-side and to run safety filtering before/after the LLM call. Minimal surface area: 2 routes, nothing else.
- Topic selection with 5 characters (`prompt.js`) — Directly supports replayability and variety of the core loop. Each character exercises different empathy skills (sitting with grief vs. validating anxiety vs. seeing someone who feels invisible).

**Nice-to-Have:**
- Ollama offline support (`callOllama` in `server.js:52-77`) — Valuable for demos and development without an API key, but not essential to the core experience. Clean implementation though — same interface, just a different provider behind `callLLM`.

**Distractions:**
- None found. Every file, every function, every UI element traces back to the core loop or safety.

**Wrong Product:**
- None. This is a single, focused product.

**Scope Verdict:** Focused. This is a disciplined codebase. 5 characters is the right number — enough variety without diluting quality. The author clearly knew when to stop adding features. There is no admin panel, no analytics, no sharing, no leaderboard, no "premium" tier, no social features. Just the loop.

---

## RECOMMENDATIONS

**CUT:**
- Nothing. There is nothing in this codebase that doesn't serve the core product. Cutting anything would make it worse.

**DEFER:**
- TypeScript migration — would improve long-term maintainability but the codebase is small enough (1,694 LOC) that it doesn't need it yet. Defer until the project grows past ~3,000 LOC.
- Component-level tests (React Testing Library) — E2E tests cover the critical path, but as the UI grows, component tests would catch rendering regressions. Defer until there's a reason to change the components.
- CI/CD pipeline — no automated build/test on push. Low-priority for a solo project, but defer to the first time someone else contributes.

**DOUBLE DOWN:**
- **Character writing quality.** The recent rename from generic names (Aria, Eliot) to descriptive archetypes (The New Graduate, The Widowed Parent, The Night-Shift Worker) was the right move. The prompts now include situation-specific details (student loans, empty side of the bed, eating dinner at 3 AM, daycare bills). This is where the product differentiates — each character should feel like a real person, not a template. More specificity in the prompts (backstory details, speech patterns, emotional triggers) will directly improve the gameplay experience.
- **The distress-to-environment mapping.** `Environment.jsx` is the emotional core of the UX. The therapist-office metaphor is strong. More environmental detail (sound would be transformative but is out of scope) or additional visual elements responding to distress would deepen immersion. The current implementation (sky, clouds, rain, lamp, plant) is good but has room for more nuance.
- **More characters/scenarios.** The architecture (`prompt.js` TOPICS array, `server.js` topic routing, `App.jsx` topic selection) trivially supports adding more characters. The 5 current archetypes cover major emotional territories, but adding 3-5 more (e.g., The Deployed Soldier, The Caregiver, The Teenager Being Bullied) would significantly increase replay value and skill range.

**FINAL VERDICT:** Continue.

This is a finished, coherent product. The concept is sound, the execution matches the ambition, and the scope is disciplined. It does one thing — empathy training through distress-responsive conversation — and does it well. Ship it.

**Next Step:** Add 2-3 more character archetypes to increase replay value. The architecture already supports it — it's purely a writing task in `prompt.js`.
