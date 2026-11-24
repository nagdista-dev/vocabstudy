#!/usr/bin/env node
/* vocabstudy-mcp — lets an AI app on this computer (Claude Desktop, Claude
   Code, opencode, Cursor…) add and edit words in VocabStudy.
   ------------------------------------------------------------------------
   The learner's words live inside their browser (localStorage), and nothing
   outside the browser can open that. So this program is only a MESSENGER:

     AI app  ──MCP (stdin/stdout)──▶  this program  ──127.0.0.1──▶  the open VocabStudy tab
                                                                   (it saves, as always)

   • No server, no account, no cloud: it listens on 127.0.0.1 only, and only
     the VocabStudy page (an allowed Origin) may connect. Words never leave
     the computer through it.
   • The app connects only after the learner turns it on: Settings → App &
     data → AI assistant. Every change shows in the app with Undo. There is
     no delete tool.
   • No dependencies: plain Node (18+). MCP over stdio is newline-delimited
     JSON-RPC; the bridge is Server-Sent Events + POST.

   Two AI apps at once (Claude and opencode): the first one to start owns the
   port; the others pass their calls to it over 127.0.0.1 (POST /call, which
   no web page can use — a browser always sends an Origin header).

   Run:  node mcp/server.js        (the AI app starts it; see mcp/README.md)
   Env:  VOCABSTUDY_PORT=47821      VOCABSTUDY_ORIGINS=https://my.copy.example
   ------------------------------------------------------------------------ */
"use strict";
const http = require("http");
const crypto = require("crypto");

const VERSION = "1.0.0";
const PORT = Number(process.env.VOCABSTUDY_PORT) || 47821;
const ORIGINS = new Set([
  "https://vocabstudy.nagdista.com",
  "http://127.0.0.1:8791", "http://localhost:8791",        // the dev server (tools/build.py preview)
  ...String(process.env.VOCABSTUDY_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean),
]);
const CALL_TIMEOUT = 20000;    // the app answers in well under a second; this covers a busy tab
const WAIT_FOR_APP = 4000;     // a tab that is reconnecting gets a moment before we give up

const log = (...a) => process.stderr.write("[vocabstudy-mcp] " + a.join(" ") + "\n");

/* ── The tools the AI sees ────────────────────────────────────────────
   Read, add, edit, and add a sentence. Deliberately no delete and no
   progress changes: an assistant can help build the library, but the
   learner's memory (the recall schedule) is theirs. */
const WORD_FIELDS = {
  arabic: { type: "string", description: "One Arabic meaning, short and Egyptian-friendly. To keep another meaning of the same English word, add it as a second item with its own arabic." },
  definition: { type: "string", description: "One simple English definition (learner-dictionary style)." },
  example: { type: "string", description: "One natural example sentence, 14 words or fewer, that uses the word." },
  type: { type: "string", description: "Part of speech: Noun, Verb, Adjective, Adverb, Phrasal verb, Phrase…" },
  level: { type: "string", description: "CEFR level if known: A1, A2, B1, B2, C1 or C2." },
  ipa: { type: "string", description: "Pronunciation in IPA between slashes, e.g. /ˈbɒrəʊ/." },
  synonyms: { type: "array", items: { type: "string" }, description: "Up to 6 synonyms." },
  tags: { type: "array", items: { type: "string" }, description: "Tags such as IELTS, work." },
  context: { type: "string", description: "The sentence where the learner met the word (their own memory cue)." },
  source: { type: "string", description: "Where they met it: a series, an article, an email…" },
};
const TOOLS = [
  {
    name: "get_overview",
    description: "The learner's VocabStudy at a glance: how many words, how many are due for recall today, new words left today, streak and daily goal. Call this first to understand where they are.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_words",
    description: "List words in the learner's library, newest first. Filter by text, status or tag.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search English, Arabic, definitions, examples, tags and notes." },
        status: { type: "string", enum: ["all", "new", "learning", "mastered", "due"], description: "Default all. 'due' = due for recall today." },
        tag: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200, description: "Default 50." },
        offset: { type: "integer", minimum: 0 },
      },
      additionalProperties: false,
    },
  },
  {
    name: "get_word",
    description: "Everything about one word: meanings, example, where they met it, their own sentences, their note, and where it stands on the recall schedule.",
    inputSchema: {
      type: "object",
      properties: { word: { type: "string" }, sense: { type: "string", description: "Only when the library has the word twice with different senses." },
        arabic: { type: "string", description: "One meaning, when the same English word is kept twice with different Arabic meanings (e.g. bank = ضفة / بنك)." } },
      required: ["word"], additionalProperties: false,
    },
  },
  {
    name: "add_words",
    description: "Add new words to the learner's library (up to 50 at once). Give at least the English word; anything you leave out is filled in by the app's own dictionaries. One English word can be kept twice only when its Arabic meaning differs: give arabic for each meaning. The same word with the same Arabic is skipped. The learner sees what was added and can undo it.",
    inputSchema: {
      type: "object",
      properties: {
        words: {
          type: "array", minItems: 1, maxItems: 50,
          items: {
            type: "object",
            properties: Object.assign({ word: { type: "string", description: "The English word or phrase, base form (borrow, not borrowed)." },
              sense: { type: "string", description: "Only to tell two meanings apart, e.g. 'river' for bank." } }, WORD_FIELDS),
            required: ["word"], additionalProperties: false,
          },
        },
      },
      required: ["words"], additionalProperties: false,
    },
  },
  {
    name: "update_word",
    description: "Correct or improve one word that is already in the library (meaning, definition, example, type, tags…). The headword itself can't be renamed here. The learner sees the change and can undo it.",
    inputSchema: {
      type: "object",
      properties: {
        word: { type: "string" },
        sense: { type: "string" },
        arabic: { type: "string", description: "Choose one meaning when the same word is kept with several Arabic meanings." },
        changes: { type: "object", properties: Object.assign({ note: { type: "string", description: "The learner's personal note on this word (a memory trick)." } }, WORD_FIELDS), additionalProperties: false },
      },
      required: ["word", "changes"], additionalProperties: false,
    },
  },
  {
    name: "add_sentence",
    description: "Save a sentence the learner wrote with a word (their 'Use it' sentences, which come back as Recall cues). The app checks it first: if it has a mistake Arab learners often make, it is NOT saved and the problems are returned so you can help them fix it.",
    inputSchema: {
      type: "object",
      properties: { word: { type: "string" }, sense: { type: "string" },
        arabic: { type: "string", description: "Choose one meaning when the same word is kept with several Arabic meanings." },
        sentence: { type: "string" } },
      required: ["word", "sentence"], additionalProperties: false,
    },
  },
];

const INSTRUCTIONS =
  "VocabStudy is a vocabulary app for Arabic-speaking adults learning English. Its data lives only in the learner's " +
  "browser; these tools reach it through the open VocabStudy tab on this computer. Use get_overview first. " +
  "When adding words, give the base form, a short Arabic meaning (Egyptian Arabic is welcome), one simple " +
  "definition and one short natural example. Never invent where the learner met a word. If a tool says the app " +
  "isn't connected, tell the learner to open VocabStudy in Chrome or Edge and turn on Settings → App & data → AI assistant.";

/* ── The bridge to the browser tab ──────────────────────────────────── */
let tab = null;                 // the connected VocabStudy page: { res, id }
const pending = new Map();      // call id → { resolve, timer }
let waiting = [];               // calls waiting for a tab to connect

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && ORIGINS.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    // Chrome asks before a public page talks to 127.0.0.1 (Private / Local Network Access).
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > 1e6) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

const json = (res, code, body) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(body)); };

/** Send one tool call to the tab and wait for its answer. */
function callTab(tool, args, client) {
  return new Promise((resolve) => {
    const send = () => {
      const id = crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(id); resolve({ ok: false, error: "VocabStudy did not answer in time. Is its tab still open?" }); }, CALL_TIMEOUT);
      pending.set(id, { resolve, timer });
      tab.res.write("event: call\ndata: " + JSON.stringify({ id, tool, args: args || {}, client }) + "\n\n");
    };
    if (tab) return send();
    const entry = { send, timer: setTimeout(() => {
      waiting = waiting.filter((x) => x !== entry);
      resolve({ ok: false, error: "VocabStudy isn't connected. Ask the learner to open VocabStudy (vocabstudy.nagdista.com) in Chrome or Edge on this computer, " +
        "turn on Settings → App & data → AI assistant, and keep the tab open." });
    }, WAIT_FOR_APP) };
    waiting.push(entry);
  });
}

function onTabConnected() {
  const now = waiting; waiting = [];
  now.forEach((e) => { clearTimeout(e.timer); e.send(); });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const origin = req.headers.origin;
  cors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(origin && ORIGINS.has(origin) ? 204 : 403); return res.end(); }

  // The app's side: only the VocabStudy page may listen and answer.
  if (url.pathname === "/events" || url.pathname === "/reply") {
    if (!origin || !ORIGINS.has(origin)) return json(res, 403, { error: "not an allowed page" });
    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
      res.write("retry: 3000\n\n");
      if (tab) { try { tab.res.end(); } catch (e) {} }             // the newest tab takes over
      const me = { res, id: crypto.randomUUID() };
      tab = me;
      res.write("event: hello\ndata: " + JSON.stringify({ version: VERSION }) + "\n\n");
      const beat = setInterval(() => res.write(": keep-alive\n\n"), 15000);
      req.on("close", () => { clearInterval(beat); if (tab === me) tab = null; log("app disconnected"); });
      log("app connected from " + origin);
      onTabConnected();
      return;
    }
    if (url.pathname === "/reply" && req.method === "POST") {
      try {
        const body = await readBody(req);
        const p = pending.get(body.id);
        if (p) { clearTimeout(p.timer); pending.delete(body.id); p.resolve(body.ok ? { ok: true, result: body.result } : { ok: false, error: String(body.error || "failed") }); }
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 400, { error: "bad reply" }); }
    }
    return json(res, 405, {});
  }

  // Other AI apps on this computer (a second messenger): never a web page.
  if (url.pathname === "/call" && req.method === "POST") {
    if (origin) return json(res, 403, { error: "web pages can't call tools" });
    try {
      const body = await readBody(req);
      return json(res, 200, await callTab(body.tool, body.args, body.client));
    } catch (e) { return json(res, 400, { error: "bad call" }); }
  }
  if (url.pathname === "/status" && req.method === "GET" && !origin) return json(res, 200, { app: !!tab, version: VERSION });
  json(res, 404, {});
});

/* Owner of the port, or a follower that passes calls to the owner. */
let leader = false;
function listen() {
  return new Promise((resolve) => {
    server.once("error", (e) => {
      if (e.code === "EADDRINUSE") { log("port " + PORT + " in use: passing calls to the messenger already running"); resolve(false); }
      else { log("bridge error: " + e.message); resolve(false); }
    });
    server.listen(PORT, "127.0.0.1", () => { leader = true; log("listening on 127.0.0.1:" + PORT); resolve(true); });
  });
}

function forward(tool, args, client) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ tool, args, client });
    const req = http.request({ host: "127.0.0.1", port: PORT, path: "/call", method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(data) }, timeout: CALL_TIMEOUT + 5000 }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (e) { resolve({ ok: false, error: "bad answer from the other messenger" }); } });
    });
    req.on("error", () => resolve(null));        // the owner went away: take the port ourselves
    req.on("timeout", () => { req.destroy(); resolve({ ok: false, error: "VocabStudy did not answer in time." }); });
    req.end(data);
  });
}

async function runTool(tool, args, client) {
  if (!TOOLS.some((t) => t.name === tool)) return { ok: false, error: "Unknown tool: " + tool };
  if (leader) return callTab(tool, args, client);
  const r = await forward(tool, args, client);
  if (r) return r;
  server.removeAllListeners("error");
  if (await listen()) return callTab(tool, args, client);
  return { ok: false, error: "The VocabStudy messenger couldn't open its port (" + PORT + ")." };
}

/* ── MCP over stdio: one JSON-RPC message per line ──────────────────── */
let clientName = "";
const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  const isRequest = id !== undefined && id !== null;
  try {
    switch (method) {
      case "initialize":
        clientName = (params && params.clientInfo && params.clientInfo.name) || "";
        return reply(id, {
          protocolVersion: (params && params.protocolVersion) || "2025-06-18",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "vocabstudy", title: "VocabStudy", version: VERSION },
          instructions: INSTRUCTIONS,
        });
      case "ping": return reply(id, {});
      case "tools/list": return reply(id, { tools: TOOLS });
      case "tools/call": {
        const r = await runTool(params && params.name, (params && params.arguments) || {}, clientName);
        return reply(id, {
          content: [{ type: "text", text: r.ok ? JSON.stringify(r.result, null, 2) : r.error }],
          isError: !r.ok,
        });
      }
      default:
        if (isRequest) fail(id, -32601, "Method not found: " + method);      // notifications are just ignored
    }
  } catch (e) {
    if (isRequest) fail(id, -32603, e.message);
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (e) { send({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }); continue; }
    if (Array.isArray(msg)) msg.forEach(handle); else handle(msg);
  }
});
process.stdin.on("end", () => process.exit(0));      // the AI app closed us

listen();
