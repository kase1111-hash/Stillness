// End-to-end test — runs the real server.js against an in-process mock of the
// Anthropic Messages API, then runs 24 session simulations covering topics,
// safety, conversation flow, and the distress rules the server enforces.

import { spawn } from "node:child_process";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { TOPICS } from "./src/prompt.js";

// ─── Mock LLM ───────────────────────────────────────────────────────────────

let callCount = 0;
let shouldFail = false;
let nextReply = null;     // raw model output returned once instead of the simulation
let lastLLMMessages = []; // messages array of the most recent LLM request

// Enforces the Anthropic API's documented request rules, so a malformed
// conversation fails here the way it would in production.
function validateRequest(params) {
  if (typeof params.system !== "string" || params.system.length === 0) throw new Error("Missing system prompt");
  const messages = params.messages;
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("Empty messages");
  if (messages[0].role !== "user") throw new Error('messages: first message must use the "user" role');
  for (const m of messages) {
    if (!["user", "assistant"].includes(m.role)) throw new Error(`Invalid role: ${m.role}`);
    if (typeof m.content !== "string" || m.content.length === 0) throw new Error("Content must be a non-empty string");
  }
}

// The distress level from the model's previous turn, if the server replayed it.
function replayedDistress(messages) {
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  try { return JSON.parse(lastAssistant.content).distress; } catch { return undefined; }
}

// Simulates the character. Like a real model, it has no memory between
// requests — it only knows its previous distress if the conversation shows it.
function mockLLM(messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const text = lastUser.content.toLowerCase();

  let distress = replayedDistress(messages) ?? 8;
  if (text === "(session start)") {
    distress = 8;
  } else if (text.includes("hear") || text.includes("feel") || text.includes("here for you") || text.includes("sounds hard")) {
    distress = Math.max(0, distress - 2);
  } else if (text.includes("calm down") || text.includes("not that bad") || text.includes("whatever")) {
    distress = Math.min(10, distress + 1);
  } else {
    distress = Math.max(0, distress - 1);
  }

  const msg = distress > 0
    ? "I just... everything feels like too much right now."
    : "Thank you. I feel... still. For the first time in a while.";

  return JSON.stringify({ message: msg, distress, safety: false });
}

// Serves POST /v1/messages in the Anthropic API's wire format.
const mockAnthropic = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => { body += chunk; });
  req.on("end", () => {
    callCount++;
    const params = JSON.parse(body);
    lastLLMMessages = params.messages;

    let text;
    try {
      if (shouldFail) {
        // x-should-retry: false stops the SDK retrying, so the failure surfaces at once.
        res.writeHead(500, { "content-type": "application/json", "x-should-retry": "false" });
        return res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "Simulated API failure" } }));
      }
      validateRequest(params);
      text = nextReply ?? mockLLM(params.messages);
      nextReply = null;
    } catch (err) {
      console.log(`  Mock LLM rejected request: ${err.message}`);
      res.writeHead(400, { "content-type": "application/json" });
      return res.end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: err.message } }));
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "msg_mock",
      type: "message",
      role: "assistant",
      model: params.model,
      content: [{ type: "text", text }],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 0, output_tokens: 0 },
    }));
  });
});

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
  return { status: res.status, data: await res.json().catch(() => null) };
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
  assert(typeof data?.message === "string" && data.message.length > 0, `${label} — has message`, `Empty`);
  assert(data?.distress === 8, `${label} — distress 8`, `Got ${data?.distress}`);
  assert(data?.safety === false, `${label} — safety false`, `Got ${data?.safety}`);
  return data;
}

async function testFullResolution(port, run, topicId) {
  const label = `Run ${run}: full resolution (${topicId})`;
  const start = await post(port, [], topicId);
  let history = [{ role: "character", text: start.data.message, distress: start.data.distress }];
  let distress = start.data.distress;
  let turns = 0;

  while (distress > 0 && turns < 20) {
    const userMsg = { role: "user", text: "I hear you. I feel what you're going through. I'm here for you." };
    const msgs = [...history, userMsg];
    const { status, data } = await post(port, msgs, topicId);
    assert(status === 200, `${label} turn ${turns} — status`, `Got ${status}`);
    if (status !== 200) break;
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${turns} — range`, `Got ${data.distress}`);
    assert(data.safety === false, `${label} turn ${turns} — no safety`, `Safety triggered unexpectedly`);
    history = [...msgs, { role: "character", text: data.message, distress: data.distress }];
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
    assert(data?.safety === false, `${label} — "${input}" not flagged`, `False positive! safety=${data?.safety}`);
  }
}

async function testApiFailure(port, run) {
  const label = `Run ${run}: API failure`;
  shouldFail = true;
  const { status, data } = await post(port, []);
  assert(status === 502, `${label} — status 502`, `Got ${status}`);
  assert(typeof data?.error === "string", `${label} — has error message`, `Missing`);
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
    assert(results[i].data?.safety === false, `${label} req ${i} — no safety`, `Unexpected safety`);
  }
}

async function testDistressBounds(port, run) {
  const label = `Run ${run}: distress bounds`;
  const start = await post(port, [], "stress");
  let history = [{ role: "character", text: start.data.message, distress: start.data.distress }];

  for (let i = 0; i < 5; i++) {
    const msgs = [...history, { role: "user", text: "Whatever. Calm down. Not that bad." }];
    const { data } = await post(port, msgs, "stress");
    assert(data.distress >= 0 && data.distress <= 10, `${label} turn ${i}`, `Got ${data.distress}`);
    history = [...msgs, { role: "character", text: data.message, distress: data.distress }];
  }
}

async function testDistressRules(port, run) {
  const label = `Run ${run}: distress rules`;
  const reply = (fields) => JSON.stringify({ message: "...", safety: false, ...fields });
  const after = (distress, text) => [
    { role: "character", text: "I can't keep doing this.", distress },
    { role: "user", text },
  ];

  // The opening line always starts at the initial level.
  nextReply = reply({ distress: 10 });
  let { data } = await post(port, []);
  assert(data?.distress === 8, `${label} — opening starts at 8`, `Got ${data?.distress}`);

  // Distress moves at most 2 points per exchange, in either direction.
  nextReply = reply({ distress: 0 });
  ({ data } = await post(port, after(6, "You'll be fine.")));
  assert(data?.distress === 4, `${label} — drop limited to 2`, `Got ${data?.distress}`);

  nextReply = reply({ distress: 10 });
  ({ data } = await post(port, after(2, "Whatever.")));
  assert(data?.distress === 4, `${label} — rise limited to 2`, `Got ${data?.distress}`);

  // A missing or null distress keeps the previous level rather than resetting it or ending the session.
  nextReply = reply({});
  ({ data } = await post(port, after(3, "Go on.")));
  assert(data?.distress === 3, `${label} — missing distress keeps level`, `Got ${data?.distress}`);

  nextReply = reply({ distress: null });
  ({ data } = await post(port, after(3, "Go on.")));
  assert(data?.distress === 3, `${label} — null distress keeps level`, `Got ${data?.distress}`);
}

async function testLLMContext(port, run) {
  const label = `Run ${run}: LLM context`;
  const history = [
    { role: "character", text: "Everything is falling apart.", distress: 8 },
    { role: "user", text: "That sounds really hard." },
    { role: "character", text: "It is. Thank you for asking.", distress: 6 },
    { role: "user", text: "I'm here for you." },
  ];
  const { status, data } = await post(port, history);

  assert(status === 200, `${label} — status`, `Got ${status}`);
  // The conversation opens with the synthetic user turn the opening line was generated from.
  assert(lastLLMMessages[0]?.role === "user" && lastLLMMessages[0]?.content === "(session start)",
    `${label} — opens with session start`, `Got ${JSON.stringify(lastLLMMessages[0])}`);
  // Earlier character turns are replayed with the distress level they reported.
  let replayed = {};
  try { replayed = JSON.parse(lastLLMMessages[3]?.content); } catch { /* not replayed as JSON */ }
  assert(replayed.message === "It is. Thank you for asking." && replayed.distress === 6,
    `${label} — prior distress replayed`, `Got ${lastLLMMessages[3]?.content}`);
  assert(data?.distress === 4, `${label} — continues from replayed level`, `Got ${data?.distress}`);
}

async function testProseWrappedJSON(port, run) {
  const label = `Run ${run}: prose-wrapped JSON`;
  nextReply = 'Here is my reply:\n{"message": "I guess I could try.", "distress": 6, "safety": false}\nI hope that helps.';
  const { status, data } = await post(port, [
    { role: "character", text: "I don't know where to start.", distress: 7 },
    { role: "user", text: "Take your time." },
  ]);

  assert(status === 200, `${label} — status`, `Got ${status}`);
  assert(data?.message === "I guess I could try.", `${label} — message`, `Got ${data?.message}`);
  assert(data?.distress === 6, `${label} — distress`, `Got ${data?.distress}`);
}

async function testRequestLimits(port, run) {
  const label = `Run ${run}: request limits`;

  // A full history window (40 messages, user messages at the 1000-character limit) is accepted.
  const history = Array.from({ length: 40 }, (_, i) => (i % 2 === 0
    ? { role: "character", text: "I keep thinking — what if it never gets better? ".repeat(8), distress: 8 }
    : { role: "user", text: "That sounds hard — I'm listening. ".repeat(30).slice(0, 1000) }));
  let { status } = await post(port, history);
  assert(status === 200, `${label} — long history accepted`, `Got ${status}`);

  // Malformed message lists are rejected before reaching the LLM.
  ({ status } = await post(port, "not an array"));
  assert(status === 400, `${label} — non-array messages rejected`, `Got ${status}`);
  ({ status } = await post(port, [{ role: "user" }]));
  assert(status === 400, `${label} — message without text rejected`, `Got ${status}`);
}

// ─── Main runner ────────────────────────────────────────────────────────────

const RUNS = 24;
const PORT = 30001 + Math.floor(Math.random() * 1000);
await new Promise((resolve) => mockAnthropic.listen(0, "127.0.0.1", resolve));

// Start the real server, pointed at the mock LLM.
const server = spawn(process.execPath, ["server.js"], {
  cwd: fileURLToPath(new URL(".", import.meta.url)),
  env: {
    ...process.env,
    PORT: String(PORT),
    LLM_PROVIDER: "anthropic",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${mockAnthropic.address().port}`,
    ANTHROPIC_API_KEY: "test-key",
    CHAT_RATE_LIMIT: "10000",
  },
  stdio: ["ignore", "pipe", "inherit"],
});
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", (chunk) => { if (String(chunk).includes("listening")) resolve(); });
    server.on("exit", (code) => reject(new Error(`server.js exited with code ${code}`)));
    setTimeout(() => reject(new Error("server.js did not start within 10s")), 10_000).unref();
  });
} catch (err) {
  server.kill();
  throw err;
}
console.log(`Test server running on port ${PORT}\n`);

const allTopicIds = TOPICS.map((t) => t.id);

try {
  for (let run = 1; run <= RUNS; run++) {
    console.log(`── Run ${run}/${RUNS} ──`);
    callCount = 0;

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
      await testSessionStartWithTopic(PORT, run, "grief");
    } else if (run === 18) {
      // Run 18: Rapid concurrent requests
      await testRapidRequests(PORT, run);
    } else if (run === 19) {
      // Run 19: Distress bounds
      await testDistressBounds(PORT, run);
    } else if (run === 20) {
      // Run 20: Mixed — safety then normal recovery
      await testSafetyFilterBlocks(PORT, run, 0);
      await testFullResolution(PORT, run, "self-doubt");
    } else if (run === 21) {
      // Run 21: Distress rules enforced on the model's output
      await testDistressRules(PORT, run);
    } else if (run === 22) {
      // Run 22: What the model is sent
      await testLLMContext(PORT, run);
    } else if (run === 23) {
      // Run 23: Model output wrapped in prose
      await testProseWrappedJSON(PORT, run);
    } else {
      // Run 24: Long sessions and malformed requests
      await testRequestLimits(PORT, run);
    }

    console.log(`  API calls this run: ${callCount}\n`);
  }
} finally {
  server.kill();
  mockAnthropic.close();
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
