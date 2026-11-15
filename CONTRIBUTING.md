# Contributing to VocabStudy

Thanks for helping! VocabStudy is plain HTML, CSS and JavaScript — no
framework, no npm. If you can edit a text file and run Python 3, you can
contribute.

## Run it

```bash
python3 tools/build.py        # check the data, generate the pages
open index.html               # or double-click it — no server needed
```

## Before you open a pull request

```bash
python3 tools/check.py        # must say: check OK
python3 tools/screenshots.py  # optional: phone / tablet / desktop screenshots
```

Then test the screens you changed at phone width (375px) and desktop width.

## Ground rules

- **Edit sources, never generated files.** `index.html`, `days/*.html` and
  `data/words.js` are written by `tools/build.py`.
- **One helper, one home.** Shared logic lives in `assets/js/core/`.
  `check.py` fails if a view re-implements escaping, shuffling or storage.
- **Design tokens only.** Colours, sizes and fonts come from
  `assets/css/tokens.css`.
- **Comments explain why.** Names explain what.
- **The learner comes first.** Every change should make studying clearer,
  calmer or more effective — see `docs/DESIGN.md`.

## Ideas that fit well

- New question types for the quiz (see `views/quiz.js → promptMarkup`)
- New print layouts (see `views/print.js`)
- Word sets for other language pairs (only `arabic` would change — a
  `meaning` field is a good first refactor)
- Translations of the interface

Read `docs/ARCHITECTURE.md` for how the app boots and routes, and
`docs/LEARN.md` (Arabic) for a guided tour of the code.
