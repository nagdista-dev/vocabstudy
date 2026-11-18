You are a senior product designer and front-end engineer (35+ years of UI/UX). Your job: implement the v10 plan for VocabStudy so it becomes the most trusted, clearest and most distinctive English-vocabulary app for Arab learners — professional enough to compete with Duolingo, Anki, Memrise and Quizlet, calm on the eyes in long sessions, and unmistakably its own.

## Project
- Repo: /home/nagdista/Documents/programming/vocabstudy — plain HTML/CSS/JS PWA, no framework, no build step beyond `python3 tools/build.py` (it generates index.html and sw.js; never edit those two by hand).
- Read first, fully: `PRODUCT.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, and in `docs/PLAN.md` the sections **v9** (what was just shipped and why) and **v10** (sections 17–19: the review, the discussion, and the task list V0–V6). The v10 task list is your spec. It was written by the reviewer; you review it too — if a task is wrong or there's a better way, decide, do it, and write why in PLAN.md.
- Run the app: `.claude/launch.json` has "vocab" (python http.server on 127.0.0.1:8791). Use the browser preview tools to verify.
- Realistic data for every check: run the body of `tools/seed_learner.js` in the page (needs internet; ~40 s). It gives a learner two weeks in (22 words, 8 due, 3 mastered, notes, own sentences, an unsure sentence, a "Which meaning?" word).

## Skills you should use (global, in /home/nagdista/.agents/skills)
- `impeccable` (read SKILL.md; run its `scripts/impeccable context` once; read `reference/craft-floor.md` before any UI edit; use its polish/layout/typeset/clarify/harden/adapt playbooks as the task fits; finish with a dual-agent `critique`).
- `accessibility`, `web-design-guidelines`, `ui-taste`, `design-mobile-apps`, `arabic-rtl-fixer-ai-skill` (for Arabic/bidi), `humanizer` (copy).
- Install anything else you need globally into ~/.agents/skills.

## Order and rules
1. Work phase by phase: **V0 → V1 → V2 → V3 → V4 → V5 → V6** (V6 = dark mode, last, by the owner's decision). Inside a phase, P0/P1 items first.
2. After each phase:
   - `python3 tools/build.py` passes.
   - `python3 tools/check.py` passes.
   - `node tools/test_traps.js` passes.
   - No console errors.
   - Verify in the browser at 375×812 and 1280×800 with the seed, and look at screenshots, not just the DOM.
   - Tick the boxes in `docs/PLAN.md` and add a short "what was done + what was measured" note under the phase, in Egyptian Arabic like the rest of the file.
   - Make one commit per phase with a descriptive message ending in the repo's Co-Authored-By line.
   - Do not push; the owner approves pushes.
3. Keep the product's principles: one next step per screen; English interface, Arabic only where it teaches; nothing leaves the device except what README's privacy table lists (update that table if you add a call); plain readable code with the header comments the codebase already uses.
4. Content trust (V0) beats visuals. Never ship a screen that shows Arabic contradicting its English definition.
5. Every destructive action gets a confirm or an Undo; never `location.reload()` after an edit or delete.
6. Design system targets (V3):
   - 3 breakpoints only (phone < 600, tablet 600–1023, desktop ≥ 1024).
   - A z-index scale in tokens.
   - 4 button styles (+ one icon button).
   - No text under 13px.
   - Every target ≥ 44×44.
   - A visible focus ring ≥ 3:1.
   - Yellow means "the word you're learning" only.
   - One status component.
   - The word page builds only when opened.
7. Identity (V4): "an Arab teacher's notebook":
   - the highlighter is the word being learned;
   - the red pen is the mistake and its fix, the same component everywhere;
   - the 1-3-7-14-30-60 ruler replaces "Box n/6";
   - the session's end names the words that moved.
8. Owner credit (V4.6):
   - "Made by Nagdista" linking to https://nagdista.com/?utm_source=vocabstudy&utm_medium=app&utm_campaign=credit, in exactly four places: the first-run footer, Settings → App & data, the about.html footer, and the print/PDF footer.
   - Add `<meta name="author" content="Nagdista">` and a README credit line.
   - Quiet styling, `target="_blank" rel="noopener"`.
   - Never in a study activity, never a popup, never on the home screen after the first run.
9. Don't regress what works and is loved: the teacher-style feedback ("Almost — one slip", the spelling diff), the Egyptian Arabic glosses in the traps, the Arabic keyboard warning, the first-run lesson and its ruler, the About page, and the v9 features (spelling check, meaning checks, Arabic → English lookup, tense traps, Meet → Check, the Google pause and retry).

## Done means
- Every V0–V6 box is ticked in PLAN.md, with notes.
- The v10 acceptance criteria at the end of section 19 hold.
- A fresh dual-agent `impeccable critique` scores ≥ 34/40 with no P0/P1.
- Report back with a per-phase summary:
  - what changed;
  - what you measured;
  - what you decided differently from the plan and why;
  - anything left for the owner to decide.
