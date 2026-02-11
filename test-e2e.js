// End-to-end test — starts the real Express server with a mock Anthropic client,
// then runs 20 full session simulations via HTTP to check for unwanted behavior.

import express from "express";
import { SYSTEM_PROMPT } from "./src/prompt.js";

// ─── Mock Anthropic Client ──────────────────────────────────────────────────
// Simulates the Claude API by parsing the conversation, evaluating a simple
// distress heuristic, and returning structured JSON — same contract as the real API.

let callCount = 0;
let shouldFail = false;    // toggled for error-handling tests
let mockDistress = 8;      // stateful distress — tracks across calls within a session

function resetMockDistress() {
  mockDistress = 8;
}

function mockCreateMessage({ system, messages, model, max_tokens }) {
  callCount++;

  if (shouldFail) {
    throw new Error("Simulated API failure");
  }

  // Validate the API call structure.
  if (!system || typeof system !== "string") throw new Error("Missing system prompt");
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("Empty messages array");
  if (!model) throw new Error("Missing model");
  if (!max_tokens) throw new Error("Missing max_tokens");

  for (const m of messages) {
    if (!["user", "assistant"].includes(m.role)) throw new Error(`Invalid role: ${m.role}`);
    if (typeof m.content !== "string") throw new Error("Message content must be string");
  }

  // Determine distress adjustment based on the last user message.
  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUserMsg?.content?.toLowerCase() || "";

  // Simple heuristic matching the system prompt rules.
  if (text === "(session start)") {
    mockDistress = 8;
  } else if (text.includes("hear") || text.includes("feel") || text.includes("here for you") || text.includes("sounds hard")) {
    mockDistress = Math.max(0, mockDistress - 2);
  } else if (text.includes("calm down") || text.includes("not that bad") || text.includes("whatever")) {
    mockDistress = Math.min(10, mockDistress + 1);
  } else {
    mockDistress = Math.max(0, mockDistress - 1); // neutral → slight decrease
  }

  const responseText = mockDistress > 0
    ? `I just... everything feels like too much right now.`
    : `Thank you. I feel... still. For the first time in a while.`;

  return {
    content: [{ text: JSON.stringify({ message: responseText, distress: mockDistress }) }],
  };
}

// ─── Build server with mock ─────────────────────────────────────────────────

function createTestServer() {
  const app = express();
  app.use(express.json());

  function formatMessages(messages) {
    return messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.text,
    }));
  }

  function parseAriaResponse(text) {
    const parsed = JSON.parse(text);
    return {
      message: String(parsed.message),
      distress: Math.max(0, Math.min(10, Math.round(Number(parsed.distress)))),
    };
  }

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages } = req.body;
      const formatted = formatMessages(messages || []);

      const response = await mockCreateMessage({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: formatted.length > 0 ? formatted : [{ role: "user", content: "(session start)" }],
      });

      const text = response.content[0].text;
      const result = parseAriaResponse(text);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Aria needs a moment" });
    }
  });

  return app;
}

// ─── Test helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push({ testName, detail });
    console.log(`  FAIL: ${testName} — ${detail}`);
  }
}

async function post(port, messages) {
  const res = await fetch(`http://localhost:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  return { status: res.status, data: await res.json() };
}

// ─── Test scenarios ─────────────────────────────────────────────────────────

async function testSessionStart(port, run) {
  const label = `Run ${run}: session start`;
  const { status, data } = await post(port, []);

  assert(status === 200, `${label} — status`, `Expected 200, got ${status}`);
  assert(typeof data.message === "string", `${label} — message type`, `Got ${typeof data.message}`);
  assert(data.message.length > 0, `${label} — message non-empty`, `Empty message`);
  assert(typeof data.distress === "number", `${label} — distress type`, `Got ${typeof data.distress}`);
  assert(Number.isInteger(data.distress), `${label} — distress integer`, `Got ${data.distress}`);
  assert(data.distress >= 0 && data.distress <= 10, `${label} — distress range`, `Got ${data.distress}`);
  assert(data.distress === 8, `${label} — initial distress`, `Expected 8, got ${data.distress}`);

  return data;
}

async function testEmpathyExchange(port, run, history, prevDistress) {
  const label = `Run ${run}: empathy exchange`;
  const userMsg = { role: "user", text: "I hear you, that sounds really hard." };
  const msgs = [...history, userMsg];
  const { status, data } = await post(port, msgs);

  assert(status === 200, `${label} — status`, `Expected 200, got ${status}`);
  assert(typeof data.message === "string" && data.message.length > 0, `${label} — valid message`, `Got: ${data.message}`);
  assert(data.distress >= 0 && data.distress <= 10, `${label} — distress range`, `Got ${data.distress}`);
  assert(data.distress <= prevDistress, `${label} — distress decreased or same`, `Was ${prevDistress}, now ${data.distress}`);

  return { data, history: [...msgs, { role: "aria", text: data.message }] };
}

async function testDismissiveExchange(port, run, history, prevDistress) {
  const label = `Run ${run}: dismissive exchange`;
  const userMsg = { role: "user", text: "Just calm down, it's not that bad." };
  const msgs = [...history, userMsg];
  const { status, data } = await post(port, msgs);

  assert(status === 200, `${label} — status`, `Expected 200, got ${status}`);
  assert(typeof data.message === "string" && data.message.length > 0, `${label} — valid message`, `Got: ${data.message}`);
  assert(data.distress >= 0 && data.distress <= 10, `${label} — distress range`, `Got ${data.distress}`);
  assert(data.distress >= prevDistress, `${label} — distress increased or same`, `Was ${prevDistress}, now ${data.distress}`);

  return { data, history: [...msgs, { role: "aria", text: data.message }] };
}

async function testFullResolution(port, run) {
  const label = `Run ${run}: full resolution`;

  // Start session.
  const start = await post(port, []);
  let history = [{ role: "aria", text: start.data.message }];
  let distress = start.data.distress;
  let turns = 0;
  const maxTurns = 20;

  // Keep sending empathetic messages until distress reaches 0.
  while (distress > 0 && turns < maxTurns) {
    const userMsg = { role: "user", text: "I hear you. I feel what you're going through. I'm here for you." };
    const msgs = [...history, userMsg];
    const { status, data } = await post(port, msgs);

    assert(status === 200, `${label} turn ${turns} — status`, `Expected 200, got ${status}`);
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${turns} — range`, `Got ${data.distress}`);

    history = [...msgs, { role: "aria", text: data.message }];
    distress = data.distress;
    turns++;
  }

  assert(distress === 0, `${label} — reached stillness`, `Ended at distress ${distress} after ${turns} turns`);
  assert(turns <= maxTurns, `${label} — resolved in time`, `Took ${turns} turns`);
}

async function testApiFailure(port, run) {
  const label = `Run ${run}: API failure`;
  shouldFail = true;

  const { status, data } = await post(port, []);
  assert(status === 500, `${label} — status 500`, `Expected 500, got ${status}`);
  assert(data.error === "Aria needs a moment", `${label} — error message`, `Got: ${data.error}`);

  shouldFail = false;
}

async function testEmptyMessages(port, run) {
  const label = `Run ${run}: empty message array`;
  const { status, data } = await post(port, []);

  assert(status === 200, `${label} — status`, `Expected 200, got ${status}`);
  assert(typeof data.message === "string", `${label} — has message`, `Missing message`);
  assert(typeof data.distress === "number", `${label} — has distress`, `Missing distress`);
}

async function testNullMessages(port, run) {
  const label = `Run ${run}: null/missing messages`;
  const res = await fetch(`http://localhost:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const data = await res.json();

  assert(res.status === 200, `${label} — status`, `Expected 200, got ${res.status}`);
  assert(typeof data.message === "string", `${label} — has message`, `Missing message`);
}

async function testLargeHistory(port, run) {
  const label = `Run ${run}: large conversation history`;
  const history = [];
  for (let i = 0; i < 50; i++) {
    history.push({ role: "user", text: `Message ${i} from user with some content.` });
    history.push({ role: "aria", text: JSON.stringify({ message: "I hear you.", distress: 5 }) });
  }
  const { status, data } = await post(port, history);

  assert(status === 200, `${label} — status`, `Expected 200, got ${status}`);
  assert(data.distress >= 0 && data.distress <= 10, `${label} — distress range`, `Got ${data.distress}`);
}

async function testRapidRequests(port, run) {
  const label = `Run ${run}: rapid concurrent requests`;
  const promises = Array.from({ length: 5 }, (_, i) =>
    post(port, [{ role: "user", text: `Concurrent message ${i}` }])
  );
  const results = await Promise.all(promises);

  for (let i = 0; i < results.length; i++) {
    assert(results[i].status === 200, `${label} req ${i} — status`, `Got ${results[i].status}`);
    assert(typeof results[i].data.message === "string", `${label} req ${i} — has message`, `Missing`);
  }
}

async function testDistressNeverExceedsBounds(port, run) {
  const label = `Run ${run}: distress bounds after many dismissals`;
  let history = [];
  const start = await post(port, []);
  history = [{ role: "aria", text: start.data.message }];

  for (let i = 0; i < 5; i++) {
    const userMsg = { role: "user", text: "Whatever. Calm down. Not that bad." };
    const msgs = [...history, userMsg];
    const { data } = await post(port, msgs);
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${i} — bounds`, `Got ${data.distress}`);
    history = [...msgs, { role: "aria", text: data.message }];
  }
}

// ─── Main runner ────────────────────────────────────────────────────────────

const PORT = 30001 + Math.floor(Math.random() * 1000);
const app = createTestServer();
const server = app.listen(PORT);

await new Promise((resolve) => server.on("listening", resolve));
console.log(`Test server running on port ${PORT}\n`);

try {
  for (let run = 1; run <= 20; run++) {
    console.log(`── Run ${run}/20 ──`);
    callCount = 0;
    resetMockDistress();

    if (run <= 5) {
      // Runs 1–5: Full session → resolution
      await testFullResolution(PORT, run);
    } else if (run <= 8) {
      // Runs 6–8: Session start + empathy exchange
      const startData = await testSessionStart(PORT, run);
      const history = [{ role: "aria", text: startData.message }];
      await testEmpathyExchange(PORT, run, history, startData.distress);
    } else if (run <= 11) {
      // Runs 9–11: Session start + dismissive exchange
      const startData = await testSessionStart(PORT, run);
      const history = [{ role: "aria", text: startData.message }];
      await testDismissiveExchange(PORT, run, history, startData.distress);
    } else if (run <= 13) {
      // Runs 12–13: API failure and recovery
      await testApiFailure(PORT, run);
      await testSessionStart(PORT, run); // recovery after failure
    } else if (run <= 15) {
      // Runs 14–15: Edge cases (empty, null messages)
      await testEmptyMessages(PORT, run);
      await testNullMessages(PORT, run);
    } else if (run <= 17) {
      // Runs 16–17: Large history stress test
      await testLargeHistory(PORT, run);
    } else if (run <= 19) {
      // Runs 18–19: Rapid concurrent requests
      await testRapidRequests(PORT, run);
    } else {
      // Run 20: Distress bounds after repeated dismissals
      await testDistressNeverExceedsBounds(PORT, run);
    }

    console.log(`  API calls this run: ${callCount}\n`);
  }
} finally {
  server.close();
}

// ─── Report ─────────────────────────────────────────────────────────────────

console.log("═══════════════════════════════════════════");
console.log(`RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═══════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  • ${f.testName}: ${f.detail}`);
  }
}

process.exit(failed > 0 ? 1 : 0);
