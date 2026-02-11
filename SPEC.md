# Stillness — Requirements Spec

## Functional Requirements

1. The system shall present a text-based conversation between the user and an AI character named Aria.
2. The user can type free-form messages to Aria and submit them.
3. The system shall generate Aria's responses dynamically using a language model, not from a script.
4. The system shall maintain a distress level (integer, 0–10) representing Aria's emotional state.
5. Aria's distress level shall start at a high value (assumption: 8) at the beginning of each session.
6. The system shall decrease Aria's distress when the user demonstrates empathy, validation, present-moment grounding, or gentle warmth.
7. The system shall increase or stagnate Aria's distress when the user is dismissive, cold, or purely logical without empathy.
8. The system shall update the visual environment in real time to reflect Aria's current distress level — colors, motion, and intensity change continuously.
9. The session shall end when Aria's distress reaches 0 (stillness).
10. Upon reaching stillness, the system shall display a closing message acknowledging the user's effort. No score or ranking is shown.

## User Experience Flow

1. **Landing** — The user sees a minimal screen with a short introduction and a prompt to begin.
2. **Session starts** — The environment appears in a high-distress visual state. Aria speaks first, expressing her crisis.
3. **Conversation** — The user types a response. Aria replies. The environment shifts after each exchange based on the updated distress level.
4. **Progression** — Over multiple exchanges, the distress level moves up or down depending on the user's approach.
5. **Resolution** — When distress reaches 0, the environment settles into calm. A quiet closing message appears. The session is over.
6. **Replay** — The user can start a new session at any time.

## Constraints

- **Platform:** Web application (assumption: the README describes visual environments, implying a browser context).
- **Structure:** Multi-file project — at minimum, separate files for UI, conversation logic, and visual environment.
- **Dependencies:** A language model API is required for response generation. No specific provider is chosen here.
- **Performance:** Environment transitions must feel smooth — visual updates should occur within 200ms of receiving a new distress value.
- **Data storage:** None. Sessions are ephemeral. No conversations are saved between sessions.

## Edge Cases

- **Empty input:** The system shall not send empty or whitespace-only messages. Display a gentle prompt to try again.
- **Very long input:** The system shall truncate or reject messages over 1000 characters.
- **API failure:** If the language model is unreachable, display a message like "Aria needs a moment" and allow retry.
- **Rapid input:** The system shall disable the input field while Aria is responding to prevent overlapping requests.
- **Session interrupted:** No recovery needed — the user simply starts a new session.

## Out of Scope

- Multiple characters (Aria only for this version)
- Sound or audio of any kind
- User accounts, authentication, or saved sessions
- Mobile-specific layout optimization
- Multiplayer or facilitator modes
- Technique journaling or post-session reflection
- Offline or local model support
