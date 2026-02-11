// Client-side API module — sends conversation history to the Express proxy
// and returns Aria's response with updated distress level. (Reqs 3, 6, 7, edge:api-failure)

/**
 * Sends the full message history to /api/chat and returns Aria's response.
 * @param {Array<{role: string, text: string}>} messages - Conversation history
 * @returns {Promise<{message: string, distress: number}>}
 * @throws {Error} If the server is unreachable or returns an error
 */
export async function sendMessage(messages) {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    throw new Error("API request failed");
  }

  const data = await res.json();
  return { message: data.message, distress: data.distress };
}
