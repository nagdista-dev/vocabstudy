# Architecture

## The big picture

```text
data/days/*.js ──build.py──▶ data/words.js ─┐
tools/templates/page.html ──build.py──▶ index.html, days/*.html
                                            │  (every page loads the same app)
                                            ▼
   core/vs.js ─▶ words ─▶ core/* ─▶ views/* ─▶ app.js (boot)
```

Every page is the **same app**. `index.html` starts on the home screen;
`days/2026-11-02.html` has `data-day="2026-11-02"` on `<body>` and starts on
that day. Both load all the words, because recall and wrong answers in a quiz
draw from every day.

## Why these choices

| Choice | Why |
| --- | --- |
| Plain HTML/CSS/JS, no framework, no bundler | Opens with a double-click (`file://`), nothing to install, every line is readable. |
| Classic `<script>` files + one global `VS` | ES modules are blocked on `file://`. One namespace means every shared thing has exactly one name. |
| Hash routes (`#/day/…/quiz`) | Work on `file://`, keep the back button working, need no server. |
| One `words.js` bundle | One download however many days you add. Source files stay one-per-day. |
| Markup from template strings via `VS.html` | Escapes every value automatically, so word data can never break the page. |
| One click handler (`data-action`) | No `onclick` in HTML; every screen lists its actions in one object. |
| Progress in `localStorage`, packed arrays | No account needed; small enough for tens of thousands of words. |

## Load order (`tools/build.py → SCRIPTS`)

| File | Defines |
| --- | --- |
| `core/vs.js` | `VS`, `VS.addDay`, `VS.html`, `VS.shuffle`, dates, toast |
| `data/words.js` | calls `VS.addDay(...)` once per day |
| `core/word-forms.js` | `VS.IRREGULAR`, `VS.STAND_INS` (brought ← bring, my ← your) |
| `core/icons.js` | `VS.icon(name)`, `VS.brandMark` |
| `core/store.js` | `VS.store` — progress, spaced repetition, settings, backup |
| `core/speech.js` | `VS.speech.say()` — browser voices |
| `core/practice.js` | `VS.scope`, `VS.sessionWords`, `VS.distractors`, `VS.findInExample` |
| `core/study-time.js` | active study time + break reminder |
| `views/shared.js` | `VS.ui.*` — word row, activity header, results, celebrate |
| `views/*.js` | one screen each: home, day, cards, recall, quiz, spell, match |
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

## Tools

| Command | Does |
| --- | --- |
| `python3 tools/new_day.py [ISO]` | create a day file with an example row |
| `python3 tools/build.py` | check data → write `data/words.js`, `index.html`, `days/*.html` |
| `python3 tools/check.py` | data errors/warnings + missing files + duplicated helpers |

## Conventions

- **Edit sources, not outputs:** `data/days/*.js`, `assets/`, `tools/templates/page.html`.
- **One helper, one home.** Escaping, shuffling, storage and dates live in `core/`.
  `check.py` fails if a view re-implements them.
- **New screen:** add `assets/js/views/name.js`, add it to `SCRIPTS` in
  `tools/build.py`, add its route in `app.js → parse()`, add CSS to
  `assets/css/views/`.
- **Colours, sizes, fonts** only through tokens (`assets/css/tokens.css`).
- **Comments say why**, not what. Names say what.
