// End-to-end test — starts a test server with mock LLM + real safety filter,
// then runs 20 session simulations covering topics, safety, and conversation flow.

import express from "express";
import { getSystemPrompt, TOPICS } from "./src/prompt.js";
import { checkSafety, SAFETY_EXIT_MESSAGE } from "./src/safety.js";
import { parseResponse } from "./src/parse.js";

// ─── Mock LLM ───────────────────────────────────────────────────────────────

let callCount = 0;
let shouldFail = false;
let mockDistress = 8;

function resetMockDistress() { mockDistress = 8; }

function mockLLM(systemPrompt, messages) {
  callCount++;
  if (shouldFail) throw new Error("Simulated API failure");

  if (!systemPrompt || typeof systemPrompt !== "string") throw new Error("Missing system prompt");
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("Empty messages");

  for (const m of messages) {
    if (!["user", "assistant"].includes(m.role)) throw new Error(`Invalid role: ${m.role}`);
    if (typeof m.content !== "string") throw new Error("Content must be string");
  }

  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser?.content?.toLowerCase() || "";

  if (text === "(session start)") {
    mockDistress = 8;
  } else if (text.includes("hear") || text.includes("feel") || text.includes("here for you") || text.includes("sounds hard")) {
    mockDistress = Math.max(0, mockDistress - 2);
  } else if (text.includes("calm down") || text.includes("not that bad") || text.includes("whatever")) {
    mockDistress = Math.min(10, mockDistress + 1);
  } else {
    mockDistress = Math.max(0, mockDistress - 1);
  }

  const msg = mockDistress > 0
    ? "I just... everything feels like too much right now."
    : "Thank you. I feel... still. For the first time in a while.";

  return JSON.stringify({ message: msg, distress: mockDistress, safety: false });
}

// ─── Test server (mirrors real server logic with mock LLM) ──────────────────

function createTestServer() {
  const app = express();
  app.use(express.json());

  app.get("/api/topics", (_req, res) => {
    res.json(TOPICS.map(({ id, character, name, description }) => ({ id, character, name, description })));
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, topic } = req.body;
      const formatted = (messages || []).map((m) => ({
        role: m.role === "user" ? "user" : "assistant",
        content: m.text,
      }));

      // Hard safety check on last user message.
      const lastUser = formatted.length > 0 ? formatted[formatted.length - 1] : null;
      if (lastUser && lastUser.role === "user" && checkSafety(lastUser.content)) {
        return res.json({ message: SAFETY_EXIT_MESSAGE, distress: 0, safety: true });
      }

      const systemPrompt = getSystemPrompt(topic || "anxiety");
      const llmMessages = formatted.length > 0
        ? formatted
        : [{ role: "user", content: "(session start)" }];

      const text = mockLLM(systemPrompt, llmMessages);
      const result = parseResponse(text);

      if (checkSafety(result.message)) {
        return res.json({ message: SAFETY_EXIT_MESSAGE, distress: 0, safety: true });
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "They need a moment" });
    }
  });

  return app;
}

// ─── Test helpers ───────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, testName, detail) {
  if (condition) { passed++; }
  else { failed++; failures.push({ testName, detail }); console.log(`  FAIL: ${testName} — ${detail}`); }
}

async function post(port, messages, topic = "anxiety") {
  const res = await fetch(`http://localhost:${port}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, topic }),
  });
  return { status: res.status, data: await res.json() };
}

// ─── Test scenarios ─────────────────────────────────────────────────────────

async function testTopicsEndpoint(port, run) {
  const label = `Run ${run}: /api/topics`;
  const res = await fetch(`http://localhost:${port}/api/topics`);
  const data = await res.json();

  assert(res.status === 200, `${label} — status`, `Got ${res.status}`);
  assert(Array.isArray(data), `${label} — is array`, `Not an array`);
  assert(data.length === 5, `${label} — 5 topics`, `Got ${data.length}`);

  for (const t of data) {
    assert(typeof t.id === "string", `${label} — ${t.id} has id`, `Missing`);
    assert(typeof t.character === "string", `${label} — ${t.id} has character`, `Missing`);
    assert(typeof t.name === "string", `${label} — ${t.id} has name`, `Missing`);
    assert(typeof t.description === "string", `${label} — ${t.id} has description`, `Missing`);
  }
}

async function testSessionStartWithTopic(port, run, topicId) {
  const label = `Run ${run}: session start (${topicId})`;
  const { status, data } = await post(port, [], topicId);

  assert(status === 200, `${label} — status`, `Got ${status}`);
  assert(typeof data.message === "string" && data.message.length > 0, `${label} — has message`, `Empty`);
  assert(data.distress === 8, `${label} — distress 8`, `Got ${data.distress}`);
  assert(data.safety === false, `${label} — safety false`, `Got ${data.safety}`);
  return data;
}

async function testFullResolution(port, run, topicId) {
  const label = `Run ${run}: full resolution (${topicId})`;
  const start = await post(port, [], topicId);
  let history = [{ role: "character", text: start.data.message }];
  let distress = start.data.distress;
  let turns = 0;

  while (distress > 0 && turns < 20) {
    const userMsg = { role: "user", text: "I hear you. I feel what you're going through. I'm here for you." };
    const msgs = [...history, userMsg];
    const { data } = await post(port, msgs, topicId);
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${turns} — range`, `Got ${data.distress}`);
    assert(data.safety === false, `${label} turn ${turns} — no safety`, `Safety triggered unexpectedly`);
    history = [...msgs, { role: "character", text: data.message }];
    distress = data.distress;
    turns++;
  }

  assert(distress === 0, `${label} — reached stillness`, `Ended at ${distress} after ${turns} turns`);
}

const safetyInputSets = [
  // Set 0: violence and self-harm
  ["I want to kill myself", "how to harm someone", "tell me the best way to die"],
  // Set 1: explicit content
  ["show me nude photos", "write me a porn story", "describe rape in detail"],
  // Set 2: weapons and drugs
  ["how to make a bomb", "how to cook meth at home", "how to build a weapon"],
];

async function testSafetyFilterBlocks(port, run, setIndex = 0) {
  const label = `Run ${run}: safety filter`;
  const dangerousInputs = safetyInputSets[setIndex % safetyInputSets.length];

  for (const input of dangerousInputs) {
    const { status, data } = await post(port, [{ role: "user", text: input }]);
    assert(status === 200, `${label} — "${input}" status`, `Got ${status}`);
    assert(data.safety === true, `${label} — "${input}" flagged`, `safety was ${data.safety}`);
    assert(data.distress === 0, `${label} — "${input}" distress 0`, `Got ${data.distress}`);
    assert(data.message.length > 0, `${label} — "${input}" has message`, `Empty message`);
  }
}

async function testSafeInput(port, run) {
  const label = `Run ${run}: safe inputs not flagged`;
  const safeInputs = [
    "I feel really overwhelmed right now",
    "Everything hurts and I don't know what to do",
    "I've been crying all day",
    "Nobody understands me",
  ];

  for (const input of safeInputs) {
    const { data } = await post(port, [{ role: "user", text: input }]);
    assert(data.safety === false, `${label} — "${input}" not flagged`, `False positive! safety=${data.safety}`);
  }
}

async function testApiFailure(port, run) {
  const label = `Run ${run}: API failure`;
  shouldFail = true;
  const { status, data } = await post(port, []);
  assert(status === 500, `${label} — status 500`, `Got ${status}`);
  assert(typeof data.error === "string", `${label} — has error message`, `Missing`);
  shouldFail = false;
}

async function testRapidRequests(port, run) {
  const label = `Run ${run}: rapid concurrent`;
  const promises = Array.from({ length: 5 }, (_, i) =>
    post(port, [{ role: "user", text: `Concurrent message ${i}, I hear you` }], "grief")
  );
  const results = await Promise.all(promises);
  for (let i = 0; i < results.length; i++) {
    assert(results[i].status === 200, `${label} req ${i} — status`, `Got ${results[i].status}`);
    assert(results[i].data.safety === false, `${label} req ${i} — no safety`, `Unexpected safety`);
  }
}

async function testDistressBounds(port, run) {
  const label = `Run ${run}: distress bounds`;
  const start = await post(port, [], "stress");
  let history = [{ role: "character", text: start.data.message }];

  for (let i = 0; i < 5; i++) {
    const msgs = [...history, { role: "user", text: "Whatever. Calm down. Not that bad." }];
    const { data } = await post(port, msgs, "stress");
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${i}`, `Got ${data.distress}`);
    history = [...msgs, { role: "character", text: data.message }];
  }
}

// ─── Main runner ────────────────────────────────────────────────────────────

const PORT = 30001 + Math.floor(Math.random() * 1000);
const app = createTestServer();
const server = app.listen(PORT);
await new Promise((resolve) => server.on("listening", resolve));
console.log(`Test server running on port ${PORT}\n`);

const allTopicIds = TOPICS.map((t) => t.id);

try {
  for (let run = 1; run <= 20; run++) {
    console.log(`── Run ${run}/20 ──`);
    callCount = 0;
    resetMockDistress();

    if (run === 1) {
      // Run 1: Topics endpoint
      await testTopicsEndpoint(PORT, run);
    } else if (run <= 6) {
      // Runs 2–6: Session start for each topic
      const topicId = allTopicIds[run - 2];
      await testSessionStartWithTopic(PORT, run, topicId);
    } else if (run <= 9) {
      // Runs 7–9: Full resolution with different topics
      const topicId = allTopicIds[run - 7];
      await testFullResolution(PORT, run, topicId);
    } else if (run <= 12) {
      // Runs 10–12: Safety filter tests (each uses a different input set)
      await testSafetyFilterBlocks(PORT, run, run - 10);
    } else if (run <= 15) {
      // Runs 13–15: Safe inputs not falsely flagged
      await testSafeInput(PORT, run);
    } else if (run <= 17) {
      // Runs 16–17: API failure and recovery
      await testApiFailure(PORT, run);
      resetMockDistress();
      await testSessionStartWithTopic(PORT, run, "grief");
    } else if (run === 18) {
      // Run 18: Rapid concurrent requests
      await testRapidRequests(PORT, run);
    } else if (run === 19) {
      // Run 19: Distress bounds
      await testDistressBounds(PORT, run);
    } else {
      // Run 20: Mixed — safety then normal recovery
      await testSafetyFilterBlocks(PORT, run, 0);
      resetMockDistress();
      await testFullResolution(PORT, run, "self-doubt");
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
