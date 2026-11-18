#!/usr/bin/env node
/* mcp/test.js — start the messenger the way an AI app does and talk MCP to it.
   ------------------------------------------------------------------------
     node mcp/test.js            protocol + security checks (no app needed)
     node mcp/test.js --app      also call the tools through an open VocabStudy
                                 tab with Settings → AI assistant turned on.
                                 This ADDS a test word ("serendipitous") and
                                 edits its example — undo it in the app after.
   ------------------------------------------------------------------------ */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const path = require("path");

const PORT = Number(process.env.VOCABSTUDY_PORT) || 47821;
const withApp = process.argv.includes("--app");
let failed = 0;
const ok = (cond, what) => { console.log((cond ? "  ok   " : "  FAIL ") + what); if (!cond) failed++; };

const child = spawn(process.execPath, [path.join(__dirname, "server.js")], { stdio: ["pipe", "pipe", "inherit"] });
let buf = ""; let nextId = 1; const waiting = new Map();
child.stdout.on("data", (c) => {
  buf += c;
  let nl;
  while ((nl = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, nl); buf = buf.slice(nl + 1);
    const msg = JSON.parse(line);
    const w = waiting.get(msg.id); if (w) { waiting.delete(msg.id); w(msg); }
  }
});
const rpc = (method, params) => new Promise((resolve) => {
  const id = nextId++; waiting.set(id, resolve);
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
});
const tool = async (name, args) => {
  const r = await rpc("tools/call", { name, arguments: args });
  const t = r.result.content[0].text;
  return { error: r.result.isError, text: t, data: r.result.isError ? null : JSON.parse(t) };
};
const req = (method, p, headers, body) => new Promise((resolve) => {
  const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method, headers }, (res) => { res.resume(); resolve(res.statusCode); });
  r.on("error", () => resolve(0)); r.end(body || "");
});
const status = () => new Promise((resolve) => {
  http.get({ host: "127.0.0.1", port: PORT, path: "/status" }, (res) => {
    let d = ""; res.on("data", (c) => (d += c)); res.on("end", () => resolve(JSON.parse(d)));
  }).on("error", () => resolve({ app: false }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(300);
  console.log("MCP protocol");
  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-code", version: "test" } });
  ok(init.result && init.result.serverInfo.name === "vocabstudy", "initialize answers as vocabstudy");
  ok(!!init.result.instructions, "initialize gives the AI instructions");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  const list = await rpc("tools/list", {});
  const names = list.result.tools.map((t) => t.name).sort().join(",");
  ok(names === "add_sentence,add_words,get_overview,get_word,list_words,update_word", "six tools, no delete: " + names);
  const unknown = await rpc("does/not/exist", {});
  ok(unknown.error && unknown.error.code === -32601, "unknown method → -32601");

  console.log("Security (127.0.0.1 only, VocabStudy pages only)");
  ok(await req("GET", "/events", { Origin: "https://evil.example" }) === 403, "another website can't listen");
  ok(await req("POST", "/reply", { Origin: "https://evil.example", "Content-Type": "application/json" }, "{}") === 403, "another website can't answer");
  ok(await req("POST", "/call", { Origin: "https://vocabstudy.nagdista.com", "Content-Type": "application/json" }, "{}") === 403, "no web page can call tools, not even VocabStudy");
  ok(await req("OPTIONS", "/events", { Origin: "https://evil.example" }) === 403, "preflight refused for other sites");

  if (!withApp) {
    // Only meaningful when no VocabStudy tab is listening (a real one may be open with the assistant on).
    if (!(await status()).app) {
      const r = await tool("get_overview", {});
      // A tab with the assistant on may connect mid-test (it retries every 3 s): then the call simply works.
      ok(r.error ? /isn't connected/.test(r.text) : true, "no tab open → a clear message for the AI");
    }
  } else {
    console.log("Through the open app");
    let s = await status();
    for (let i = 0; i < 20 && !s.app; i++) { await sleep(500); s = await status(); }
    ok(s.app, "the VocabStudy tab is connected");
    const o = await tool("get_overview", {});
    ok(!o.error && typeof o.data.words === "number", "get_overview: " + (o.data ? o.data.words + " words, " + o.data.due_for_recall_today + " due" : o.text));
    const l = await tool("list_words", { status: "learning", limit: 3 });
    ok(!l.error && Array.isArray(l.data.words), "list_words learning: " + (l.data ? l.data.words.map((w) => w.word).join(", ") : l.text));
    const g = await tool("get_word", { word: "borrow" });
    ok(!g.error && g.data.word === "borrow", "get_word borrow → " + (g.data ? g.data.arabic : g.text));
    const a = await tool("add_words", { words: [
      { word: "serendipitous", arabic: "بالصدفة الحلوة", definition: "Happening by lucky chance.", example: "It was a serendipitous meeting.", type: "Adjective", tags: ["test"] },
      { word: "borrow" },
      { word: "يستلف" },
    ] });
    ok(!a.error && a.data.added.includes("serendipitous"), "add_words adds the new word");
    ok(!a.error && a.data.skipped.some((x) => x.word === "borrow") && a.data.skipped.some((x) => /Arabic/.test(x.reason)), "…skips one already there and Arabic");
    const u = await tool("update_word", { word: "serendipitous", changes: { example: "Finding that café was serendipitous." } });
    ok(!u.error && u.data.changed.includes("example"), "update_word changes the example");
    const bad = await tool("update_word", { word: "serendipitous", changes: { arabic: "lucky" } });
    ok(bad.error, "update_word refuses an 'Arabic' meaning that isn't Arabic");
    const sBad = await tool("add_sentence", { word: "borrow", sentence: "Yesterday I borrow a book from the library." });
    ok(!sBad.error && sBad.data.saved === false && sBad.data.problems.length, "add_sentence refuses a sentence with a mistake and says why");
    const missing = await tool("get_word", { word: "zzzznotaword" });
    ok(missing.error, "get_word on a missing word → a clear error");
    console.log("  (In the app: undo the added word, or delete “serendipitous”.)");
  }

  child.stdin.end();
  setTimeout(() => { console.log(failed ? `mcp FAILED: ${failed}` : "mcp OK"); process.exit(failed ? 1 : 0); }, 200);
})();
