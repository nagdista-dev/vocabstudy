# Architecture

## The big picture

```text
data/sample/*.js ──build.py──▶ data/words.js   (the Starter set)
tools/templates/page.html ──build.py──▶ index.html   (the whole app)
tools/templates/sw.js ──build.py──▶ sw.js           (offline cache list)

In the browser:  core/vs.js ─▶ Starter words ─▶ core/* ─▶ views/* ─▶ app.js
                 core/store.js adds the learner's own words from localStorage
```

There is one page. Every set — the Starter set and the learner's own —
opens inside it (`#/day/ISO`). The learner's words are never part of the
build: they are typed, pasted or uploaded in the app and saved on the device.

## Why these choices

| Choice | Why |
| --- | --- |
| Plain HTML/CSS/JS, no framework, no bundler | Opens with a double-click (`file://`), nothing to install, every line is readable. |
| Classic `<script>` files + one global `VS` | ES modules are blocked on `file://`. One namespace means every shared thing has exactly one name. |
| Hash routes (`#/day/…/quiz`) | Work on `file://`, keep the back button working, need no server. |
| Learner's words in localStorage | No account and no server: the app stays free and private. ~20k words fit. |
| Markup from template strings via `VS.html` | Escapes every value automatically, so word data can never break the page. |
| One click handler (`data-action`) | No `onclick` in HTML; every screen lists its actions in one object. |
| Progress in `localStorage`, packed arrays | No account needed; small enough for tens of thousands of words. |

## Load order (`tools/build.py → SCRIPTS`)

| File | Defines |
| --- | --- |
| `core/vs.js` | `VS`, `VS.addDay`, `VS.html`, `VS.shuffle`, dates, toast |
| `data/words.js` | the Starter set: `VS.addDay("2026-01-01", [...], { title: "Starter set" })` |
| `core/word-forms.js` | `VS.IRREGULAR`, `VS.STAND_INS` (brought ← bring, my ← your) |
| `core/icons.js` | `VS.icon(name)`, `VS.brandMark` |
| `core/store.js` | `VS.store` — progress, spaced repetition, settings, backup |
| `core/speech.js` | `VS.speech.say()` — browser voices |
| `core/practice.js` | `VS.scope`, `VS.sessionWords`, `VS.distractors`, `VS.findInExample` |
| `core/sfx.js` | `VS.sfx.play()` — synthesised sound effects (Web Audio) |
| `core/study-time.js` | active study time + break reminder |
| `core/importer.js` | `VS.importer` — parse pasted tables, build data files, dictionary fill |
| `views/shared.js` | `VS.ui.*` — word row, note box, activity header, results, celebrate |
| `views/word-browser.js` | `VS.WordBrowser` — search/filter/sort list used by day and library |
| `views/*.js` | one screen each: home, day, cards, recall, quiz, spell, match, library, stats, print, import |
| `app.js` | router, app bar, settings, click + keyboard handling, boot |

## Routes

| Hash | Screen | Words |
| --- | --- | --- |
| `#/` | home (or the day, on a day page) | — |
| `#/recall` | recall | due words from every day |
| `#/day/ISO` | day | that day |
| `#/day/ISO/cards\|quiz\|spell\|match\|recall` | activity | that day (recall: its due words) |
| `#/all/cards\|quiz\|spell\|match` | activity | every word |
| `#/tricky/cards\|quiz\|spell\|match` | activity | words missed 3+ times |
| `#/words` | library | every word |
| `#/stats` | progress charts | history |
| `#/add` | add words (importer) | — |
| `#/print/day/ISO[/layout]` | print / PDF (also `/print/recall`, `/tricky`, `/all`) | chosen in the screen |

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

`VS.app.render()` re-renders the current view after its state changes.

## Spaced repetition (core/store.js)

Each word has a **box** 0–6 and a **due** date.

| Event | Effect |
| --- | --- |
| Right answer on a new or due word | box + 1 (Easy in recall: + 2), due = today + wait |
| Right answer on a word not yet due | counted only — cramming doesn't move it |
| Wrong answer / Forgot / Still learning | box 1, due tomorrow |

Waits per box: 1, 3, 7, 14, 30, 60 days. Box 4+ = **mastered**.
Tricky = 3+ wrong answers, more wrong than half the right ones, not mastered.

## Installable app (PWA)

`manifest.webmanifest` names the app and its icons (`tools/build_icons.py`
renders them from `assets/favicon.svg`). `tools/build.py` writes `sw.js` from
`tools/templates/sw.js` with the exact list of files to keep offline. Pages
and `data/words.js` load network-first (new days arrive when online);
versioned styles and scripts load cache-first. The service worker only runs
over http(s); opened as a file the app works without it.

## The learner's words

`VS.store.saveUserWords(iso, words)` keeps them in localStorage
(`userDays`); at start-up `core/store.js` merges them in with
`VS.addDay(iso, words, { custom: true })`. `editUserWord` / `deleteUserWord`
change one word — an edit moves the word's progress and note to its new id.
The importer (`core/importer.js`) reads pasted tables, `.tsv`/`.csv` files and
VocabStudy `.js` sets (read as data, never executed).

## Tools

| Command | Does |
| --- | --- |
| `python3 tools/build.py` | check the Starter set → write `index.html`, `data/words.js`, `sw.js` |
| `python3 tools/check.py` | data errors/warnings, missing files, classes without CSS, duplicated helpers |
| `python3 tools/build_icons.py` | app icons from the brand mark |
| `python3 tools/screenshots.py [names]` | phone / tablet / desktop screenshots of every screen |

## Conventions

- **Edit sources, not outputs:** `assets/`, `data/sample/`, `tools/templates/`.
- **One helper, one home.** Escaping, shuffling, storage and dates live in `core/`.
  `check.py` fails if a view re-implements them.
- **New screen:** add `assets/js/views/name.js`, add it to `SCRIPTS` in
  `tools/build.py`, add its route in `app.js → parse()`, add CSS to
  `assets/css/views/`.
- **Colours, sizes, fonts** only through tokens (`assets/css/tokens.css`).
- **Comments say why**, not what. Names say what.
