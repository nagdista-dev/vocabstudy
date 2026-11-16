# Architecture

## The big picture

```text
data/sample/*.js ──build.py──▶ data/words.js   (the Starter set)
tools/templates/page.html ──build.py──▶ index.html   (the whole app)
tools/templates/sw.js ──build.py──▶ sw.js           (offline cache list)
tools/vendor.py (by hand) ──▶ assets/fonts/, assets/vendor/   (fonts, PDF maker)

In the browser:  core/vs.js ─▶ Starter words ─▶ core/* ─▶ views/* ─▶ app.js
                 core/store.js adds the learner's own words from localStorage
```

There is one page and **one word library**. Every word — the Starter set and
the learner's own — lives once in `VS.words`, identified by the word itself
(`borrow`, `axe (tool)`). The learner's words are never part of the build:
they are typed, pasted or uploaded in the app and saved on the device.

**Local first.** The app has no server, no account and no CDN: fonts and the
PDF maker ship with it. The only network calls are optional: auto-fill sends
a new English word to two free dictionaries (Settings → Auto-fill), and in
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
| `data/words.js` | the Starter set: `VS.addWords([...], { source: "starter" })` |
| `core/word-forms.js` | `VS.IRREGULAR`, `VS.STAND_INS` (brought ← bring, my ← your) |
| `core/icons.js` | `VS.icon(name)`, `VS.brandMark` |
| `core/store.js` | `VS.store` — library, progress, spaced repetition, settings, backup, migration |
| `core/speech.js` | `VS.speech.say()` — browser voices |
| `core/listen.js` | `VS.listen.hear()` — speech recognition for Speak |
| `core/sfx.js` | `VS.sfx.play()` — synthesised sound effects (Web Audio) |
| `core/practice.js` | `VS.scope`, `VS.finishStep`, `VS.sessionWords`, `VS.distractors`, `VS.findInExample` |
| `core/filters.js` | `VS.filters` — the library's filters and sorts, shared by every screen |
| `core/sound-traps.js` | `VS.soundTraps(word)` — P/B, V/F, silent letters, -ed, th… |
| `core/study-time.js` | active study time + break reminder |
| `core/importer.js` | `VS.importer` — parse pasted tables and word files |
| `core/autofill.js` | `VS.autofill` — fills a new word's details in the background |
| `views/shared.js` | `VS.ui.*` — word row, tags, note box, activity header, results, keyboard guard |
| `views/*.js` | one screen each: home, cards, recall, quiz, spell, match, speak, library, stats, print, import, data |
| `app.js` | router, app bar, settings, click + keyboard handling, focus keeping, boot |

## Routes

| Hash | Screen | Words |
| --- | --- | --- |
| `#/` | home: today's plan | — |
| `#/recall` | recall | words due today |
| `#/new/cards` | learn new words | the next *New words per day* from the library, oldest added first |
| `#/today/quiz\|spell\|match\|speak` | practise today's words | words first studied today |
| `#/all/<mode>` | activity | the whole library |
| `#/tricky/<mode>` | activity | words missed 3+ times |
| `#/pick/<mode>?filters` | activity | a filtered list from the library |
| `#/words?filters` | library | filtered and sorted |
| `#/add` | add words | — |
| `#/data` | backup, restore, export | — |
| `#/stats` | progress charts | history |
| `#/print/<scope>[/layout][?filters]` | print / PDF | recall, tricky, all, today, new or pick |

Old `#/day/…` links open home.

## Today's plan

1. **Recall** what's due. 2. **Learn new words** (cards over `new`).
3. **Practise today's words** with Quiz → Spell → Match → Speak. When an
activity ends it calls `VS.finishStep(scope, mode)`, which marks the step done
for today (`store.markDone("today", mode)`) and returns the next step's link.

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
| Right answer on a new or due word | box + 1 (Easy in recall: + 2), due = today + wait |
| Right answer on a word not yet due | counted only — cramming doesn't move it |
| Wrong answer / Forgot / Still learning | box 1, due tomorrow |

Waits per box: 1, 3, 7, 14, 30, 60 days. Box 4+ = **mastered**.
Tricky = 3+ wrong answers, more wrong than half the right ones, not mastered.

## The learner's words

`VS.store.saveUserWords(words)` adds them to `state.library` (skipping words
already in the library) and returns `{ added, skipped }`. Only the fields the
learner gave are stored; `core/autofill.js` fills the empty ones later with
`store.fillUserWord` — never overwriting. Words added offline keep
`auto: "todo"` and are filled when the app is next online.
`editUserWord` refuses a change that would duplicate another word, and moves
progress and notes when the word's id changes. `deleteUserWords` /
`resetWords` work on any list (the library's actions).

**Migration.** Version 2 kept words per day (`userDays`) with ids like
`2026-11-16:borrow`. `migrate()` in `core/store.js` turns every save and
every restored backup into one library: ids lose the date, a word that was in
two days keeps the stronger memory and both notes.

## Installable app (PWA)

`manifest.webmanifest` names the app and its icons (`tools/build_icons.py`
renders them from `assets/favicon.svg`). `tools/build.py` writes `sw.js` from
`tools/templates/sw.js` with the exact list of files to keep offline, fonts
and the PDF maker included. Pages and `data/words.js` load network-first;
versioned styles and scripts load cache-first. The service worker only runs
over http(s); opened as a file the app works without it.

## Tools

| Command | Does |
| --- | --- |
| `python3 tools/build.py` | check the Starter set → write `index.html`, `data/words.js`, `sw.js` |
| `python3 tools/check.py` | data errors (incl. duplicate words), missing files, classes without CSS, duplicated helpers |
| `python3 tools/vendor.py` | download the fonts and the PDF maker into the project (run by hand, commit the result) |
| `python3 tools/build_icons.py` | app icons from the brand mark |
| `python3 tools/screenshots.py [names]` | phone / tablet / desktop screenshots of every screen |

## Conventions

- **Edit sources, not outputs:** `assets/`, `data/sample/`, `tools/templates/`.
- **One helper, one home.** Escaping, shuffling, storage, dates and filters live in `core/`.
  `check.py` fails if a view re-implements them.
- **New screen:** add `assets/js/views/name.js`, add it to `SCRIPTS` in
  `tools/build.py`, add its route in `app.js → parse()`, add CSS to
  `assets/css/views/`.
- **Colours, sizes, fonts** only through tokens (`assets/css/tokens.css`).
- **Comments say why**, not what. Names say what.
