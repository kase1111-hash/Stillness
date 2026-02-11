// Top-level component — owns all session state (phase, distress, messages, loading),
// orchestrates phase transitions, and wires Chat + Environment together.
// (Reqs 1, 4, 5, 9, 10)

import { useState, useCallback } from "react";
import Chat from "./Chat.jsx";
import Environment from "./Environment.jsx";
import { sendMessage } from "./api.js";

const INITIAL_DISTRESS = 8;

export default function App() {
  const [phase, setPhase] = useState("landing");     // "landing" | "active" | "resolved"
  const [distress, setDistress] = useState(INITIAL_DISTRESS);
  const [messages, setMessages] = useState([]);       // Array<{role, text}>
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Calls the API with the given message history and handles the response.
  async function callAria(msgs) {
    setLoading(true);
    setError(false);
    try {
      const { message, distress: newDistress } = await sendMessage(msgs);
      const ariaMsg = { role: "aria", text: message };
      const updated = [...msgs, ariaMsg];
      setMessages(updated);
      setDistress(newDistress);

      // Check for resolution (req 9).
      if (newDistress === 0) {
        setPhase("resolved");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Starts a new session — resets state and fetches Aria's opening message.
  const handleBegin = useCallback(() => {
    setPhase("active");
    setDistress(INITIAL_DISTRESS);
    setMessages([]);
    setError(false);
    // Aria speaks first with an empty history (req: UX flow step 2).
    callAria([]);
  }, []);

  // Handles a validated user message from Chat.
  const handleSend = useCallback(
    (text) => {
      const userMsg = { role: "user", text };
      const updated = [...messages, userMsg];
      setMessages(updated);
      callAria(updated);
    },
    [messages],
  );

  // Retries the last API call after a failure.
  const handleRetry = useCallback(() => {
    callAria(messages);
  }, [messages]);

  // --- Landing screen ---
  if (phase === "landing") {
    return (
      <div style={styles.centered}>
        <Environment distress={INITIAL_DISTRESS} />
        <div style={styles.overlay}>
          <h1 style={styles.title}>Stillness</h1>
          <p style={styles.subtitle}>
            Someone needs to be heard. Not fixed — just heard.
          </p>
          <button onClick={handleBegin} style={styles.button}>
            Begin
          </button>
        </div>
      </div>
    );
  }

  // --- Resolved screen ---
  if (phase === "resolved") {
    return (
      <div style={styles.centered}>
        <Environment distress={0} />
        <div style={styles.overlay}>
          <p style={styles.closing}>
            Stillness reached. Thank you for being here.
          </p>
          <button onClick={handleBegin} style={styles.button}>
            Begin again
          </button>
        </div>
      </div>
    );
  }

  // --- Active session ---
  return (
    <>
      <Environment distress={distress} />
      <Chat
        messages={messages}
        loading={loading}
        phase={phase}
        onSend={handleSend}
        error={error}
        onRetry={handleRetry}
      />
      {/* Restart button — spec UX flow 6: user can start a new session at any time. */}
      <button onClick={handleBegin} style={styles.restartBtn}>
        Start over
      </button>
    </>
  );
}

const styles = {
  centered: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
  overlay: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    color: "#fff",
    padding: "40px",
  },
  title: {
    fontSize: "48px",
    fontWeight: 300,
    letterSpacing: "6px",
    margin: "0 0 16px",
  },
  subtitle: {
    fontSize: "16px",
    opacity: 0.7,
    margin: "0 0 32px",
    maxWidth: "360px",
  },
  closing: {
    fontSize: "18px",
    opacity: 0.8,
    margin: "0 0 32px",
    maxWidth: "360px",
    lineHeight: 1.6,
  },
  button: {
    padding: "12px 32px",
    fontSize: "16px",
    letterSpacing: "2px",
    border: "1px solid rgba(255,255,255,0.3)",
    borderRadius: "8px",
    backgroundColor: "transparent",
    color: "#fff",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  restartBtn: {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 2,
    padding: "6px 14px",
    fontSize: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "6px",
    backgroundColor: "transparent",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
  },
};
