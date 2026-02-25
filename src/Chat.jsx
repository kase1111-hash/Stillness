// Conversation UI — crisis-hotline style chat panel with a warm, professional feel.
// Displays messages in a frosted card with a header bar, handles input validation,
// disables during loading, and scrolls to newest messages. (Reqs 1, 2, edge:empty, edge:long, edge:rapid)

import { useState, useRef, useEffect } from "react";

const MAX_LENGTH = 1000;

export default function Chat({ messages, loading, phase, onSend, error, onRetry, characterName = "Someone" }) {
  const [input, setInput] = useState("");
  const [warning, setWarning] = useState("");
  const bottomRef = useRef(null);

  // Auto-scroll to the newest message whenever messages change.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Validates and submits the user's message.
  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = input.trim();

    if (!trimmed) {
      setWarning("Take a moment — then try saying something.");
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setWarning(`Messages can be up to ${MAX_LENGTH} characters.`);
      return;
    }

    setWarning("");
    setInput("");
    onSend(trimmed);
  }

  const disabled = loading || phase === "resolved";

  return (
    <div style={styles.container}>
      <div style={styles.panel}>
        {/* Header bar — crisis-hotline style with status indicator */}
        <div style={styles.header}>
          <div style={styles.statusDot} />
          <span style={styles.headerName}>{characterName}</span>
          <span style={styles.headerStatus}>Active session</span>
        </div>

        {/* Message list */}
        <div style={styles.messages} role="log" aria-live="polite" aria-label="Conversation">
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                ...styles.bubble,
                ...(msg.role === "user" ? styles.userBubble : styles.charBubble),
              }}
            >
              <span style={{
                ...styles.role,
                ...(msg.role === "user" ? styles.userRole : styles.charRole),
              }}>
                {msg.role === "user" ? "You" : characterName}
              </span>
              <p style={{
                ...styles.text,
                ...(msg.role === "user" ? styles.userText : styles.charText),
              }}>
                {msg.text}
              </p>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div style={{ ...styles.bubble, ...styles.charBubble }} role="status" aria-label={`${characterName} is typing`}>
              <span style={{ ...styles.role, ...styles.charRole }}>{characterName}</span>
              <p style={{ ...styles.text, ...styles.charText, opacity: 0.45 }}>
                typing...
              </p>
            </div>
          )}

          {/* API error with retry */}
          {error && (
            <div style={styles.errorBox}>
              <p style={styles.errorText}>{characterName} needs a moment...</p>
              <button onClick={onRetry} style={styles.retryBtn}>
                Try again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {warning && <p style={styles.warning}>{warning}</p>}
          <div style={styles.inputRow}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={disabled ? "" : "Say something..."}
              aria-label="Type your message"
              disabled={disabled}
              maxLength={MAX_LENGTH + 1}
              style={{
                ...styles.input,
                opacity: disabled ? 0.4 : 1,
              }}
            />
            <button
              type="submit"
              disabled={disabled}
              style={{
                ...styles.sendBtn,
                opacity: disabled ? 0.4 : 1,
              }}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Warm crisis-hotline aesthetic — frosted cream panel, rounded bubbles, soft contrast.
const styles = {
  container: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: "640px",
    margin: "0 auto",
    padding: "16px",
  },
  panel: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "rgba(245, 240, 232, 0.93)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.1)",
    overflow: "hidden",
  },
  header: {
    padding: "12px 18px",
    borderBottom: "1px solid rgba(0,0,0,0.07)",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    backgroundColor: "#5a9e5f",
    boxShadow: "0 0 4px rgba(90,158,95,0.4)",
  },
  headerName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#2a2118",
    fontFamily: "Georgia, 'Times New Roman', serif",
  },
  headerStatus: {
    fontSize: "11px",
    color: "#9e8b78",
    marginLeft: "auto",
    letterSpacing: "0.5px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "16px",
  },
  bubble: {
    marginBottom: "10px",
    padding: "10px 14px",
    borderRadius: "14px",
    maxWidth: "82%",
  },
  userBubble: {
    marginLeft: "auto",
    backgroundColor: "#5c4a3a",
    borderBottomRightRadius: "4px",
  },
  charBubble: {
    marginRight: "auto",
    backgroundColor: "#fff",
    borderBottomLeftRadius: "4px",
    border: "1px solid rgba(0,0,0,0.05)",
  },
  role: {
    fontSize: "10px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    display: "block",
    marginBottom: "3px",
  },
  userRole: {
    color: "rgba(255,255,255,0.5)",
  },
  charRole: {
    color: "#9e8b78",
  },
  text: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.55,
  },
  userText: {
    color: "#f5f0e8",
  },
  charText: {
    color: "#2a2118",
  },
  form: {
    flexShrink: 0,
    padding: "10px 16px 14px",
    borderTop: "1px solid rgba(0,0,0,0.07)",
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
  },
  input: {
    flex: 1,
    padding: "10px 16px",
    fontSize: "15px",
    borderRadius: "24px",
    border: "1px solid rgba(0,0,0,0.1)",
    backgroundColor: "#fff",
    color: "#2a2118",
    outline: "none",
  },
  sendBtn: {
    padding: "10px 22px",
    fontSize: "14px",
    fontWeight: 500,
    borderRadius: "24px",
    border: "none",
    backgroundColor: "#5c4a3a",
    color: "#f5f0e8",
    cursor: "pointer",
    transition: "background-color 0.15s",
  },
  warning: {
    color: "#b8722a",
    fontSize: "13px",
    margin: "0 0 6px 16px",
  },
  errorBox: {
    textAlign: "center",
    padding: "14px",
    marginBottom: "10px",
    backgroundColor: "rgba(0,0,0,0.03)",
    borderRadius: "10px",
  },
  errorText: {
    color: "#9e6b3a",
    fontSize: "14px",
    margin: "0 0 8px",
  },
  retryBtn: {
    padding: "6px 18px",
    fontSize: "13px",
    borderRadius: "18px",
    border: "1px solid rgba(0,0,0,0.12)",
    backgroundColor: "#fff",
    color: "#5c4a3a",
    cursor: "pointer",
  },
};
