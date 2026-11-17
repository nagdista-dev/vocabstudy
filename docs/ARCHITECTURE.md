# Architecture

## The big picture

```text
tools/templates/page.html ──build.py──▶ index.html   (the whole app)
tools/templates/sw.js ──build.py──▶ sw.js           (offline cache list)
tools/vendor.py (by hand) ──▶ assets/fonts/, assets/vendor/   (fonts, PDF maker)

In the browser:  core/vs.js ─▶ core/* ─▶ views/* ─▶ app.js
                 core/store.js loads the learner's words from localStorage
```

There is one page and **one word library**, and it is the home screen. The app
ships with no words: every word is the learner's, lives once in `VS.words`, and
is identified by the word itself (`borrow`, `axe (tool)`). Words are typed,
pasted or uploaded in the app and saved on the device — never in the build.

**Local first.** The app has no server, no account and no CDN: fonts and the
PDF maker ship with it. Every network call is optional and goes to a free
service with no account: Use it sends the learner's sentence to LanguageTool
(Settings → Grammar check), "More examples" sends the word to Tatoeba, and
auto-fill sends a new English word to free dictionaries — Google Translate's free endpoint for
meanings, examples, Arabic, similar words and its spelling correction (only for a word that
isn't one of the 30,000 most used), dictionaryapi.dev for the IPA,
MyMemory as a fallback (Settings → Auto-fill) — and in
Chrome/Edge the browser's own speech recognition powers Speak.

## Why these choices

| Choice | Why |
| --- | --- |
| Plain HTML/CSS/JS, no framework, no bundler | Opens with a double-click (`file://`), nothing to install, every line is readable. |
| Classic `<script>` files + one global `VS` | ES modules are blocked on `file://`. One namespace means every shared thing has exactly one name. |
| One library, id = the word | A word can't be added twice; progress belongs to the word, not to when it was added. |
| Hash routes, filters in the address (`#/words?tag=IELTS`) | Work on `file://`, keep the back button, make any list bookmarkable. |
| Learner's words + progress in localStorage, packed arrays | No account and no server: free and private. Tens of thousands of words fit. |
| Markup from template strings via `VS.html` | Escapes every value automatically, so word data can never break the page. |
| One click handler (`data-action`) | No `onclick` in HTML; every screen lists its actions in one object. |

## Load order (`tools/build.py → SCRIPTS`)

| File | Defines |
| --- | --- |
| `core/vs.js` | `VS`, `VS.addWords`, `VS.wordKey`, `VS.allTags`, `VS.html`, `VS.shuffle`, dates, toast |
| `core/word-forms.js` | `VS.IRREGULAR`, `VS.STAND_INS` (brought ← bring, my ← your) |
| `core/icons.js` | `VS.icon(name)`, `VS.brandMark` |
| `core/store.js` | `VS.store` — library, progress, spaced repetition, settings, backup |
| `core/speech.js` | `VS.speech.say()` — browser voices |
| `core/listen.js` | `VS.listen.hear()` — speech recognition for Speak |
| `core/sfx.js` | `VS.sfx.play()` — synthesised sound effects (Web Audio) |
| `core/practice.js` | `VS.scope`, `VS.finishStep`, `VS.sessionWords`, `VS.distractors`, `VS.findInExample` |
| `core/filters.js` | `VS.filters` — the library's filters and sorts, shared by every screen |
| `core/sound-traps.js` | `VS.soundTraps(word)` — P/B, V/F, silent letters, -ed, th…; `VS.stress(ipa)` — syllables and the stressed one |
| `core/usage-traps.js` | `VS.usageTraps(word)`, `VS.findUsageMistakes(text)` — 108 hand-written Arab-learner mistakes, each with a pattern (tested by `tools/test_traps.js`) |
| `core/frequency.js` | `VS.frequency` — loads `assets/data/frequency.js` after start-up; `rank(word)` (best rank of the word's forms), `band(word)` → Top 1,000 … Rare |
| `core/week.js` | `VS.week` — the Saturday–Friday week, its numbers and when the report is due; `VS.milestones` |
| `core/study-time.js` | active study time + break reminder |
| `core/importer.js` | `VS.importer` — parse pasted tables and word files |
| `core/autofill.js` | `VS.autofill` — fills a new word's details in the background (incl. `goes`: collocations from Datamuse); `senses(word)` for Other meanings. Each meaning gets its own Arabic (matched through Google's back-translations), and a word is flagged `check: { kind: "spelling" \| "meaning" }` when it is a likely typo or its meanings translate differently; `review()` flags typos saved before the check existed |
| `core/spelling.js` | `VS.spelling` — "Did you mean receive?" before a word is added: words outside the 30,000-word list are checked with Google's spelling correction, or offline by edit distance against that list; `confirm(text, el)` asks under the add box |
| `core/grammar.js` | `VS.grammar.check(text)` — LanguageTool for Use it: grammar and spelling, online and optional; skipped quietly when offline |
| `views/shared.js` | `VS.ui.*` — word row, tags, note box, activity header, results, keyboard guard |
| `views/home.js` | `VS.today` — today's plan, shown at the top of the library |
| `views/*.js` | one screen each: library (home), cards, recall, quiz, spell, match, speak, write (Use it), stats, week, print, import, data, transfer |
| `app.js` | router, app bar, settings, click + keyboard handling, focus keeping, boot |

## Routes

| Hash | Screen | Words |
| --- | --- | --- |
| `#/` | home = the library: add a word, today's plan, your words | every word |
| `#/recall` | recall | words due today |
| `#/quick` | Quick 5 (the recall screen) | the 10 that matter most: due first (oldest, weakest), then weak learning words |
| `#/new/cards` | learn new words | the rest of today's *New words per day*, oldest added first |
| `#/today/quiz\|spell\|match\|write\|speak` | practise today's words | words first studied today |
| `#/word/<mode>?id=borrow` | an activity over one word (Use it from a word's details) | that word |
| `#/all/<mode>` | activity | the whole library |
| `#/tricky/<mode>` | activity | words missed 3+ times |
| `#/pick/<mode>?filters` | activity | a filtered list from the library |
| `#/words?filters` | the library with filters (same screen as `#/`) | filtered and sorted |
| `#/add[?tab=text]` | add words: type, from text, paste a list, upload | — |
| `index.html?share-text=…` | text shared to the app (Share target, bookmarklet) → `VS.capture` → Add words | — |
| `#/data` | backup, restore, export | — |
| `#/stats` | progress charts, this week, next milestone | history |
| `#/week[?start=YYYY-MM-DD]` | your week, Saturday to Friday | history |
| `#/transfer` | move to another device by QR code | everything |
| `#/print/<scope>[/layout][?filters]` | print / PDF | recall, tricky, all, today, new or pick |

## Today's plan

1. **Recall** what's due. 2. **Learn new words** (cards over `new`), capped at
*New words per day*: words first met today count toward it, so stopping halfway
keeps the rest for today and the plan never overstates what's left.
3. **Practise today's words** with Quiz → Spell → Match (and Speak when it is
turned on in Settings). When an
activity ends it calls `VS.finishStep(scope, mode)`, which marks the step done
for today (`store.markDone("today", mode)`) and returns the next step's link.
The strip also shows *Daily goal* progress: answers today against the goal in
Settings (hidden when the goal is off).

## A view

```js
VS.views.quiz = {
  start(params)  { /* new session when the route is entered */ },
  render(params) { return html`…`; },          // required
  mount(root)    { /* focus, listeners after render */ },
  leave()        { /* stop timers */ },
  actions: { pick(el) { … } },                  // <button data-action="pick">
  keys(event)    { /* shortcuts */ },
  crumbs(params) { return [{ label: "Quiz" }]; },
};
```

`VS.app.render()` re-renders the current view after its state changes. It keeps
keyboard focus on the same control, and the screen's entrance plays only once.

## Spaced repetition (core/store.js)

Each word has a **box** 0–6 and a **due** date.

| Event | Effect |
| --- | --- |
| First meeting on a card (`grade(id, g, { meet: true })`, box 0) | box 1 (I know it / Still learning) — not a right or wrong answer, not in accuracy; counts for the daily goal as `today.met` |
| Right answer on a new or due word | box + 1 (Easy in recall: + 2), due = today + wait |
| Right answer on a word not yet due | counted only — cramming doesn't move it |
| Wrong answer / Forgot / Still learning | box 1, due tomorrow |

`grade()` returns an undo token; `VS.store.undo(token)` puts the word and
today's counts back (Undo in cards and recall — a mis-tap on a phone).
Recall suggests the honest grade from what was typed: exact → Got it, one
slip (`VS.isAlmost`, Levenshtein) → Got it without Easy, anything else → Forgot.

Waits per box: 1, 3, 7, 14, 30, 60 days. Box 4+ = **mastered**.
Writing a sentence that passes in **Use it** is a right answer (`grade(id, "good")`).
Tricky = 3+ wrong answers, more wrong than half the right ones, not mastered.

## What the learner writes

Each word can carry the learner's own language: `context` and `source`
(where they met it — From text and Share fill them), and `mine` (sentences
written in **Use it**, newest first, five kept; `store.addSentence`).
Recall's gap questions prefer these over the dictionary example.
`VS.checkSentence(word, text)` (core/practice.js) marks a sentence on the
device: the word in any form (`VS.findIn`), at least four words, not a copy,
and every usage-trap pattern over the whole sentence.

## Moving between devices (views/transfer.js)

`store.exportJSON()` → deflate (`CompressionStream`) → base64 → frames of
600 characters (900 for big libraries): `VS1:<session>:<z|u>:<part>:<parts>:<data>`.
The sender loops the frames as QR codes (assets/vendor/qrcode.js); the
receiver reads them from the camera (`BarcodeDetector` where it exists,
assets/vendor/jsQR.js otherwise), in any order, then `store.mergeJSON`.

## The learner's words

`VS.store.saveUserWords(words)` adds them to `state.library` (skipping words
already in the library) and returns `{ added, skipped }`. Only the fields the
learner gave are stored; `core/autofill.js` fills the empty ones later with
`store.fillUserWord` — never overwriting (the only exception: a capital the
dictionary proves, "wednesday" → "Wednesday", which keeps the id). Words added offline keep
`auto: "todo"` and are filled when the app is next online.
`editUserWord` refuses a change that would duplicate another word, and moves
progress and notes when the word's id changes. `deleteUserWords` /
`resetWords` work on any list (the library's actions).

## Installable app (PWA)

`manifest.webmanifest` names the app and its icons (`tools/build_icons.py`
renders them from `assets/favicon.svg`). `tools/build.py` writes `sw.js` from
`tools/templates/sw.js` with the exact list of files to keep offline, fonts
and the PDF maker included. Pages load network-first;
versioned styles and scripts load cache-first. The service worker only runs
over http(s); opened as a file the app works without it.

## Tools

| Command | Does |
| --- | --- |
| `python3 tools/build.py` | write `index.html` and `sw.js`, then run the checks |
| `python3 tools/check.py` | missing files, classes without CSS, duplicated helpers |
| `python3 tools/vendor.py` | download the fonts and the PDF maker into the project (run by hand, commit the result) |
| `python3 tools/build_icons.py` | app icons from the brand mark |
| `python3 tools/screenshots.py [names]` | phone / tablet / desktop screenshots of every screen |

## Conventions

- **Edit sources, not outputs:** `assets/`, `tools/templates/`.
- **One helper, one home.** Escaping, shuffling, storage, dates and filters live in `core/`.
  `check.py` fails if a view re-implements them.
- **New screen:** add `assets/js/views/name.js`, add it to `SCRIPTS` in
  `tools/build.py`, add its route in `app.js → parse()`, add CSS to
  `assets/css/views/`.
- **Colours, sizes, fonts** only through tokens (`assets/css/tokens.css`).
- **Comments say why**, not what. Names say what.
