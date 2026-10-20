// Client-side API module — sends conversation history and topic to the Express
// proxy, returns the character's response with distress and safety status.

/**
 * Fetches the available topic list from the server.
 * @returns {Promise<Array<{id, character, name, description}>>}
 */
export async function fetchTopics() {
  const res = await fetch("/api/topics");
  if (!res.ok) throw new Error("Failed to load topics");
  return res.json();
}

// Most recent messages sent per request — keeps long sessions under the server's body limit.
const MAX_HISTORY = 40;

/**
 * Sends the recent message history to /api/chat and returns the response.
 * @param {Array<{role: string, text: string, distress?: number}>} messages
 * @param {string} topic - Topic ID (e.g. "anxiety", "grief")
 * @param {AbortSignal} [signal] - Optional abort signal for request cancellation
 * @returns {Promise<{message: string, distress: number, safety: boolean}>}
 */
export async function sendMessage(messages, topic, signal) {
  const timeoutMs = 35_000;
  // Honor both the caller's cancellation and the timeout (AbortSignal.any is missing in older browsers).
  const timeout = AbortSignal.timeout(timeoutMs);
  const combined = signal && AbortSignal.any
    ? AbortSignal.any([signal, timeout])
    : signal ?? timeout;

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.slice(-MAX_HISTORY), topic }),
    signal: combined,
  });

  if (!res.ok) {
    throw new Error("API request failed");
  }

  const data = await res.json();
  return {
    message: data.message,
    distress: data.distress,
    safety: data.safety || false,
  };
}
