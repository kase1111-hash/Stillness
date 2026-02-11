// Conversation UI — displays the message list and handles user input.
// Validates input (empty, too long), disables during loading, and scrolls to
// newest messages automatically. (Reqs 1, 2, edge:empty, edge:long, edge:rapid)

import { useState, useRef, useEffect } from "react";

const MAX_LENGTH = 1000;

export default function Chat({ messages, loading, phase, onSend, error, onRetry }) {
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
      {/* Message list */}
      <div style={styles.messages}>
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.bubble,
              ...(msg.role === "user" ? styles.userBubble : styles.ariaBubble),
            }}
          >
            <span style={styles.role}>{msg.role === "user" ? "You" : "Aria"}</span>
            <p style={styles.text}>{msg.text}</p>
          </div>
        ))}

        {/* Loading indicator while waiting for Aria */}
        {loading && (
          <div style={{ ...styles.bubble, ...styles.ariaBubble }}>
            <span style={styles.role}>Aria</span>
            <p style={{ ...styles.text, opacity: 0.5 }}>...</p>
          </div>
        )}

        {/* API error with retry */}
        {error && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>Aria needs a moment...</p>
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
  );
}

// Inline styles — keeps the component self-contained.
const styles = {
  container: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    maxWidth: "640px",
    margin: "0 auto",
    padding: "24px 16px 16px",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    paddingBottom: "8px",
  },
  bubble: {
    marginBottom: "12px",
    padding: "10px 14px",
    borderRadius: "12px",
    maxWidth: "85%",
  },
  userBubble: {
    marginLeft: "auto",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    color: "#fff",
  },
  ariaBubble: {
    marginRight: "auto",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#e8e8e8",
  },
  role: {
    fontSize: "11px",
    textTransform: "uppercase",
    letterSpacing: "1px",
    opacity: 0.6,
    display: "block",
    marginBottom: "4px",
  },
  text: {
    margin: 0,
    fontSize: "15px",
    lineHeight: 1.5,
  },
  form: {
    flexShrink: 0,
    paddingTop: "8px",
  },
  inputRow: {
    display: "flex",
    gap: "8px",
  },
  input: {
    flex: 1,
    padding: "10px 14px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    backgroundColor: "rgba(0,0,0,0.3)",
    color: "#fff",
    outline: "none",
  },
  sendBtn: {
    padding: "10px 20px",
    fontSize: "15px",
    borderRadius: "8px",
    border: "none",
    backgroundColor: "rgba(255,255,255,0.15)",
    color: "#fff",
    cursor: "pointer",
  },
  warning: {
    color: "#ffcc80",
    fontSize: "13px",
    margin: "0 0 6px 4px",
  },
  errorBox: {
    textAlign: "center",
    padding: "12px",
    marginBottom: "12px",
  },
  errorText: {
    color: "#ffcc80",
    fontSize: "14px",
    margin: "0 0 8px",
  },
  retryBtn: {
    padding: "6px 16px",
    fontSize: "13px",
    borderRadius: "6px",
    border: "1px solid rgba(255,255,255,0.3)",
    backgroundColor: "transparent",
    color: "#fff",
    cursor: "pointer",
  },
};
