#!/usr/bin/env node
/* tools/test_traps.js — every usage trap must catch its own mistake.
   ------------------------------------------------------------------
   For each trap in assets/js/core/usage-traps.js that has a pattern:
     • the pattern must find the mistake in the trap's "wrong" sentence
     • it must NOT fire on the trap's "right" sentence
   And a few everyday correct sentences must pass clean — a red pen that
   marks good English would teach the wrong thing.

       node tools/test_traps.js        (tools/check.py runs it too)
   ------------------------------------------------------------------ */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const ctx = { window: {}, console };
ctx.window.VS = { wordKey: (w) => String(w).trim().toLowerCase().replace(/\s+/g, " ") };
ctx.VS = ctx.window.VS;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, "assets/js/core/usage-traps.js"), "utf8"), ctx);
const VS = ctx.window.VS;

const CLEAN = [
  // Tense traps (soft) must leave real past-and-present English alone.
  "Last week I bought a car and I love it.",
  "I think he left yesterday.",
  "It is colder than yesterday.",
  "I have to finish the report I started last week.",
  "I'm still tired from yesterday.",
  "We met last year, and now we are friends.",
  "I didn't need it, and I didn't feed the cat.",
  "I listen to podcasts on my way to work.",
  "It depends on the weather.",
  "She is married to a doctor and they live in Giza.",
  "We arrived in Cairo at night and went home.",
  "I'm bored, so let's watch a film.",
  "He told me the news yesterday.",
  "I made a mistake, but I learned from it.",
  "Can you lend me your car on Wednesday?",
  "I have lived here since 2020.",
  "I came to Dubai three years ago.",
  "I can swim, and I'm good at English.",
  "Most people enjoy travel.",
  "The weather was lovely, so we had a party.",
  "I go to the gym every day before work.",
  "Please turn on the light and open the window.",
  "Everyday life in Cairo is busy.",
  "I'm interested in history and I find it interesting.",
  "Can I ask a question?",
  "He attended to the patient quickly.",
];

let failed = 0;
const fail = (msg) => { failed++; console.log("  FAIL  " + msg); };

const traps = [];
// Walk the traps through the public API: every key word returns its traps.
const seen = new Set();
const src = fs.readFileSync(path.join(root, "assets/js/core/usage-traps.js"), "utf8");
const keyLines = [...src.matchAll(/^\s*\["([^"]+)",\s*"(\w+)"/gm)].map((m) => m[1].split("|")[0]);
keyLines.forEach((k) => VS.usageTraps({ word: k }).forEach((t) => { if (!seen.has(t)) { seen.add(t); traps.push(t); } }));

if (traps.length !== VS.usageTrapsCount) fail(`only ${traps.length} of ${VS.usageTrapsCount} traps are reachable from their own first key`);

traps.forEach((t) => {
  if (!t.bad) return;
  const wrong = t.wrong.replace(/\s*\(=.*?\)/, "");
  if (!t.bad.test(" " + wrong + " ")) fail(`"${t.keys[0]}": pattern misses its wrong sentence: ${wrong}`);
  if (t.bad.test(" " + t.right + " ")) fail(`"${t.keys[0]}": pattern fires on its right sentence: ${t.right}`);
});

CLEAN.forEach((s) => {
  const hits = VS.findUsageMistakes(s);
  if (hits.length) fail(`clean sentence flagged (${hits.map((h) => h.keys[0]).join(", ")}): ${s}`);
});

console.log(failed ? `traps FAILED: ${failed} problem(s)` : `traps OK: ${traps.length} traps, ${traps.filter((t) => t.bad).length} with patterns`);
process.exit(failed ? 1 : 0);
