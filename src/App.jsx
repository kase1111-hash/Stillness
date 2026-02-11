// Top-level component — owns all session state, orchestrates phase transitions,
// topic selection, safety exits, and wires Chat + Environment together.

import { useState, useCallback, useEffect } from "react";
import Chat from "./Chat.jsx";
import Environment from "./Environment.jsx";
import { sendMessage, fetchTopics } from "./api.js";

const INITIAL_DISTRESS = 8;

// Crisis resources shown on the safety exit screen.
const CRISIS_RESOURCES = [
  { name: "988 Suicide & Crisis Lifeline", detail: "Call or text 988 (US)", url: "https://988lifeline.org" },
  { name: "Crisis Text Line", detail: "Text HOME to 741741 (US)", url: "https://www.crisistextline.org" },
  { name: "Childhelp National Hotline", detail: "Call 1-800-422-4453 (US)", url: "https://www.childhelp.org" },
  { name: "International Association for Suicide Prevention", detail: "Directory of crisis centers worldwide", url: "https://www.iasp.info/resources/Crisis_Centres" },
];

export default function App() {
  const [phase, setPhase] = useState("landing");
  // phases: "landing" | "topics" | "active" | "resolved" | "safety"
  const [distress, setDistress] = useState(INITIAL_DISTRESS);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [topic, setTopic] = useState(null);       // selected topic object
  const [topics, setTopics] = useState([]);        // all available topics
  const [safetyMsg, setSafetyMsg] = useState("");  // message shown on safety exit

  // Load topics from the server on mount.
  useEffect(() => {
    fetchTopics()
      .then(setTopics)
      .catch(() => {
        // Fallback — hardcoded topic list if server isn't up yet.
        setTopics([
          { id: "anxiety", character: "Aria", name: "Anxiety", description: "Overwhelmed by worry and fear." },
          { id: "grief", character: "Eliot", name: "Grief", description: "Processing loss." },
          { id: "loneliness", character: "Maya", name: "Loneliness", description: "Feeling isolated." },
          { id: "stress", character: "Jordan", name: "Stress", description: "Crushed under pressure." },
          { id: "self-doubt", character: "Sam", name: "Self-Doubt", description: "Feeling not good enough." },
        ]);
      });
  }, []);

  // Calls the API with the given message history and handles the response.
  async function callCharacter(msgs, currentTopic) {
    setLoading(true);
    setError(false);
    try {
      const { message, distress: newDistress, safety } = await sendMessage(msgs, currentTopic.id);

      if (safety) {
        // Safety triggered — show safety exit with the LLM's/filter's message.
        const charMsg = { role: "character", text: message };
        setMessages([...msgs, charMsg]);
        setSafetyMsg(message);
        setPhase("safety");
        return;
      }

      const charMsg = { role: "character", text: message };
      const updated = [...msgs, charMsg];
      setMessages(updated);
      setDistress(newDistress);

      if (newDistress === 0) {
        setPhase("resolved");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  // Shows topic selection.
  const handleBeginTopics = useCallback(() => {
    setPhase("topics");
  }, []);

  // Starts a session with the selected topic.
  const handleSelectTopic = useCallback((selectedTopic) => {
    setTopic(selectedTopic);
    setPhase("active");
    setDistress(INITIAL_DISTRESS);
    setMessages([]);
    setError(false);
    setSafetyMsg("");
    callCharacter([], selectedTopic);
  }, []);

  // Handles a validated user message from Chat.
  const handleSend = useCallback(
    (text) => {
      const userMsg = { role: "user", text };
      const updated = [...messages, userMsg];
      setMessages(updated);
      callCharacter(updated, topic);
    },
    [messages, topic],
  );

  // Retries the last API call after a failure.
  const handleRetry = useCallback(() => {
    callCharacter(messages, topic);
  }, [messages, topic]);

  // Returns to topic selection (used by resolved + safety screens).
  const handleBackToTopics = useCallback(() => {
    setPhase("topics");
    setMessages([]);
    setDistress(INITIAL_DISTRESS);
    setError(false);
    setTopic(null);
    setSafetyMsg("");
  }, []);

  // ─── Landing ──────────────────────────────────────────────────────────────

  if (phase === "landing") {
    return (
      <div style={styles.centered}>
        <Environment distress={INITIAL_DISTRESS} />
        <div style={styles.overlay}>
          <h1 style={styles.title}>Stillness</h1>
          <p style={styles.subtitle}>
            Practice listening. Practice empathy. Someone needs to be heard.
          </p>
          <button onClick={handleBeginTopics} style={styles.button}>
            Begin
          </button>
        </div>
      </div>
    );
  }

  // ─── Topic selection ──────────────────────────────────────────────────────

  if (phase === "topics") {
    return (
      <div style={styles.centered}>
        <Environment distress={6} />
        <div style={{ ...styles.overlay, maxWidth: "560px" }}>
          <h2 style={{ ...styles.title, fontSize: "32px", marginBottom: "8px" }}>
            Choose a conversation
          </h2>
          <p style={{ ...styles.subtitle, marginBottom: "24px" }}>
            Each person is going through something different. Your role is to listen.
          </p>
          <div style={styles.topicGrid}>
            {topics.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelectTopic(t)}
                style={styles.topicCard}
              >
                <span style={styles.topicCharacter}>{t.character}</span>
                <span style={styles.topicName}>{t.name}</span>
                <span style={styles.topicDesc}>{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Safety exit ──────────────────────────────────────────────────────────

  if (phase === "safety") {
    return (
      <div style={styles.centered}>
        <Environment distress={0} />
        <div style={{ ...styles.overlay, maxWidth: "480px" }}>
          <p style={styles.safetyMessage}>{safetyMsg}</p>
          <div style={styles.resourceList}>
            <p style={styles.resourceHeader}>Real support is available:</p>
            {CRISIS_RESOURCES.map((r) => (
              <a
                key={r.name}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.resourceLink}
              >
                <strong>{r.name}</strong>
                <span style={{ opacity: 0.7, fontSize: "13px" }}>{r.detail}</span>
              </a>
            ))}
          </div>
          <button onClick={handleBackToTopics} style={{ ...styles.button, marginTop: "24px" }}>
            Return to topics
          </button>
        </div>
      </div>
    );
  }

  // ─── Resolved ─────────────────────────────────────────────────────────────

  if (phase === "resolved") {
    return (
      <div style={styles.centered}>
        <Environment distress={0} />
        <div style={styles.overlay}>
          <p style={styles.closing}>
            Stillness reached. Thank you for being here.
          </p>
          <button onClick={handleBackToTopics} style={styles.button}>
            Try another conversation
          </button>
        </div>
      </div>
    );
  }

  // ─── Active session ───────────────────────────────────────────────────────

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
        characterName={topic?.character || "Aria"}
      />
      <button onClick={handleBackToTopics} style={styles.restartBtn}>
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
    maxWidth: "420px",
    marginLeft: "auto",
    marginRight: "auto",
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
  // Topic selection grid.
  topicGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  topicCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "4px",
    padding: "16px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.15)",
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "background-color 0.2s",
  },
  topicCharacter: {
    fontSize: "18px",
    fontWeight: 500,
  },
  topicName: {
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    opacity: 0.5,
  },
  topicDesc: {
    fontSize: "13px",
    opacity: 0.7,
    lineHeight: 1.4,
  },
  // Safety exit.
  safetyMessage: {
    fontSize: "16px",
    lineHeight: 1.6,
    opacity: 0.9,
    margin: "0 0 24px",
  },
  resourceList: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  resourceHeader: {
    fontSize: "14px",
    opacity: 0.6,
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  resourceLink: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 14px",
    borderRadius: "8px",
    backgroundColor: "rgba(255,255,255,0.08)",
    color: "#fff",
    textDecoration: "none",
  },
};
