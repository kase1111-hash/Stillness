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

/**
 * Sends the full message history to /api/chat and returns the response.
 * @param {Array<{role: string, text: string}>} messages
 * @param {string} topic - Topic ID (e.g. "anxiety", "grief")
 * @returns {Promise<{message: string, distress: number, safety: boolean}>}
 */
export async function sendMessage(messages, topic) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, topic }),
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
