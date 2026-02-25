// Top-level component — owns all session state, orchestrates phase transitions,
// topic selection, safety exits, and wires Chat + Environment together.
// Styled with a warm therapist-office / crisis-hotline aesthetic.

import { useState, useEffect, useRef } from "react";
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
  const abortRef = useRef(null);                   // cancels in-flight API requests

  // Load topics from the server on mount.
  useEffect(() => {
    let active = true;
    fetchTopics()
      .then((data) => { if (active) setTopics(data); })
      .catch(() => {
        // Fallback — hardcoded topic list if server isn't up yet.
        if (active) {
          setTopics([
            { id: "anxiety", character: "The New Graduate", name: "Anxiety", description: "Terrified of the future after finishing school." },
            { id: "grief", character: "The Widowed Parent", name: "Grief", description: "Lost a partner, raising kids alone." },
            { id: "loneliness", character: "The Night-Shift Worker", name: "Loneliness", description: "Drifting further from connection every day." },
            { id: "stress", character: "The Single Parent", name: "Stress", description: "Juggling everything with no help." },
            { id: "self-doubt", character: "The Overworked Office Worker", name: "Self-Doubt", description: "Passed over again, questioning everything." },
          ]);
        }
      });
    return () => { active = false; };
  }, []);

  // Calls the API with the given message history and handles the response.
  // Aborts any in-flight request first to prevent stale responses from overwriting state.
  async function callCharacter(msgs, currentTopic) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(false);
    try {
      const { message, distress: newDistress, safety } = await sendMessage(msgs, currentTopic.id, controller.signal);

      if (controller.signal.aborted) return;

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
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function handleBeginTopics() {
    setPhase("topics");
  }

  function handleSelectTopic(selectedTopic) {
    setTopic(selectedTopic);
    setPhase("active");
    setDistress(INITIAL_DISTRESS);
    setMessages([]);
    setError(false);
    setSafetyMsg("");
    callCharacter([], selectedTopic);
  }

  function handleSend(text) {
    const userMsg = { role: "user", text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    callCharacter(updated, topic);
  }

  function handleRetry() {
    callCharacter(messages, topic);
  }

  function handleBackToTopics() {
    setPhase("topics");
    setMessages([]);
    setDistress(INITIAL_DISTRESS);
    setError(false);
    setTopic(null);
    setSafetyMsg("");
  }

  // ─── Landing ──────────────────────────────────────────────────────────────

  if (phase === "landing") {
    return (
      <div style={styles.centered}>
        <Environment distress={INITIAL_DISTRESS} />
        <div style={styles.card}>
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
        <div style={{ ...styles.card, maxWidth: "540px" }}>
          <h2 style={{ ...styles.title, fontSize: "28px", marginBottom: "6px" }}>
            Choose a conversation
          </h2>
          <p style={{ ...styles.subtitle, marginBottom: "20px" }}>
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
        <div style={{ ...styles.card, maxWidth: "480px" }}>
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
                <strong style={{ color: "#2a2118" }}>{r.name}</strong>
                <span style={{ color: "#6b5d50", fontSize: "13px" }}>{r.detail}</span>
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
        <div style={styles.card}>
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
        characterName={topic?.character || "Someone"}
      />
      <button onClick={handleBackToTopics} style={styles.restartBtn}>
        Start over
      </button>
    </>
  );
}

// Warm therapist-office aesthetic — cream cards, serif headings, soft browns.
const styles = {
  centered: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
  },
  card: {
    position: "relative",
    zIndex: 1,
    textAlign: "center",
    padding: "36px 40px",
    backgroundColor: "rgba(245, 240, 232, 0.93)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1)",
    margin: "0 16px",
    maxWidth: "460px",
  },
  title: {
    fontSize: "40px",
    fontWeight: 400,
    letterSpacing: "4px",
    margin: "0 0 12px",
    color: "#2a2118",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  subtitle: {
    fontSize: "15px",
    color: "#6b5d50",
    margin: "0 0 28px",
    lineHeight: 1.6,
    maxWidth: "380px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  closing: {
    fontSize: "17px",
    color: "#3a2e22",
    margin: "0 0 24px",
    maxWidth: "340px",
    lineHeight: 1.6,
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  button: {
    padding: "12px 32px",
    fontSize: "15px",
    letterSpacing: "1px",
    border: "none",
    borderRadius: "24px",
    backgroundColor: "#5c4a3a",
    color: "#f5f0e8",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  restartBtn: {
    position: "fixed",
    top: "16px",
    right: "16px",
    zIndex: 2,
    padding: "8px 16px",
    fontSize: "12px",
    border: "1px solid rgba(245,240,232,0.25)",
    borderRadius: "20px",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "rgba(245,240,232,0.7)",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  },
  // Topic selection grid.
  topicGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    textAlign: "left",
  },
  topicCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: "3px",
    padding: "14px 16px",
    borderRadius: "12px",
    border: "1px solid rgba(0,0,0,0.07)",
    backgroundColor: "#fff",
    color: "#2a2118",
    cursor: "pointer",
    textAlign: "left",
    transition: "background-color 0.2s, box-shadow 0.2s",
  },
  topicCharacter: {
    fontSize: "17px",
    fontWeight: 600,
    color: "#2a2118",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  topicName: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "1.5px",
    color: "#9e8b78",
  },
  topicDesc: {
    fontSize: "13px",
    color: "#6b5d50",
    lineHeight: 1.4,
  },
  // Safety exit.
  safetyMessage: {
    fontSize: "15px",
    lineHeight: 1.7,
    color: "#3a2e22",
    margin: "0 0 20px",
    textAlign: "left",
  },
  resourceList: {
    textAlign: "left",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  resourceHeader: {
    fontSize: "12px",
    color: "#9e8b78",
    margin: "0 0 4px",
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  resourceLink: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    padding: "10px 14px",
    borderRadius: "10px",
    backgroundColor: "rgba(92, 74, 58, 0.06)",
    textDecoration: "none",
    border: "1px solid rgba(0,0,0,0.05)",
    transition: "background-color 0.15s",
  },
};
