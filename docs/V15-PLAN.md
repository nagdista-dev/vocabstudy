# v15 — the honest AI, the quiet Arabic, and a reason to share

This is the working plan for the v15 pass. It is written before the code so
the work can be checked against it at the end, line by line.

## What the learner asked for

1. Arabic and English must stop running into each other.
2. “Make with ChatGPT / Claude” must not surprise the learner with the
   “Your prompt” sheet.
3. The AI must never write tags. Only the learner sets tags.
4. In the wallet, Arabic typed into the pocket is saved as Arabic. It is not
   translated to English first.
5. In the AI review, the tags control is visible at the top, and “Add words”
   is always reachable without scrolling past the cards.
6. After pasting an AI answer, its cards start closed and open one at a time.
7. On the word card, “In Arabic” sits on the left, next to the Arabic word,
   like the “Meaning · المعنى” chapter head.
8. The word list gets a visible delete action, a short English meaning beside
   the headword, a one-line example under the word (ellipsised), and equal
   row heights.
9. Practise / Manage popovers dim the page behind them.
10. Arabic meaning is quieter than the English it supports.
11. Examples have separators; “Goes with” and “Similar” read as dictionary
    lines, not pills.
12. The sense in parentheses stays muted beside the headword.
13. A few purposeful animations that explain state, not decorate it.
14. A prominent, fast app-share flow for every social channel, with an
    encouraging message in the learner’s Arabic.

## Ground rules

- The visual world does not change: cream paper, ink blue, one highlighter,
  the word face for English, IBM Plex Sans Arabic for Arabic.
- The app stays local-first, free, account-free and offline.
- English is the lesson; Arabic is the hand that helps. Arabic is muted
  wherever it sits beside English.
- No new dependency, no new network call, no tracking in the share flow.
- Every animation is opacity/transform only and stops for reduced motion.
- Generated files (`index.html`, `sw.js`) are built, never edited.

---

## Task 1 — Language, direction, and the AI open

**Problem.** Mixed runs reorder because some Arabic is rendered without
`dir`, some mixed lines are not isolated, and the prompt sheet appears
because the clipboard call loses focus after `window.open`.

- [x] Expand `VS.ui.mixed()` to catch Arabic punctuation and digits, and
      wrap every run in an isolating `<bdi>`.
- [x] Give every Arabic display `lang="ar" dir="rtl"` (recall, spell, speak,
      write, match, quiz, print, cards, wallet, word card).
- [x] Give mixed English/Arabic reading blocks `dir="auto"` (context,
      example, memory hook, notes, learner sentences).
- [x] Make `.ar-chip` explicitly `unicode-bidi: isolate`.
- [x] Rewrite `VS.aiOpen`: start the clipboard write while the click still
      has focus, open the chat synchronously, and show the manual sheet only
      when the prompt is not already in the URL and copying failed.
- [x] Update the open buttons’ copy so it says what actually happens.

**Done when:** ChatGPT/Claude open with the prompt in the chat and no sheet;
Arabic runs read right-to-left inside English lines; no Arabic block leans
the wrong way at 320px or in Night.

## Task 2 — The AI writes no tags, and always writes a short meaning

**Problem.** The prompt asks for tags, so the AI invents them; the learner
wants that decision. The sense line is optional, so many cards have no short
meaning beside the headword.

- [x] Remove the `tags:` line from the prompt and from the parser’s keys.
- [x] Remove the per-row tags field from the AI review; keep one
      “Tags for this batch” field, set only by the learner.
- [x] Make the `sense:` line mandatory in the prompt: 2–4 English words,
      never just the part of speech.
- [x] If an answer still omits the sense, derive a short label from the
      definition (first clause, at most five words) so the card is never
      bare.
- [x] Update the review copy: no “tags included”, no “add a tag per word”.
- [x] `ai-add` takes tags only from the learner’s batch field.

**Done when:** a pasted AI answer produces zero tags unless the learner
typed them; every AI card has a muted short meaning beside the headword.

## Task 3 — The wallet keeps Arabic as Arabic

**Problem.** Typing Arabic in “Keep a word” opens the “which one do you
mean?” picker and forces an English choice before the word is saved.

- [x] `walletCapture`: if the input is Arabic, store it directly with its
      Arabic text. No picker, no lookup.
- [x] A slip whose word is Arabic shows the Arabic as its headword, in the
      Arabic face, with a quiet line saying the English comes next.
- [x] “Make with AI” on an Arabic slip opens Add → From Arabic with the
      Arabic already in the box.
- [x] “Add now” on an Arabic slip opens the same route (the library still
      needs an English headword).
- [x] Keep the undo, the duplicate check, and the search working.

**Done when:** typing “مثلاً” in the pocket saves a slip immediately; the
slip reads as Arabic; Make with AI carries it to the From Arabic prompt.

## Task 4 — The AI review: tags on top, closed cards, Add always there

**Problem.** Tags and Add sit after a long list of open cards, so the learner
scrolls past everything to reach either.

- [x] Put a toolbar above the cards: “Tags for this batch” + the count.
- [x] Put “Add N words” in a sticky bar at the bottom of the review, above
      the phone tab bar; the top toolbar carries a compact Add on wide
      screens, and a phone keeps one Add (the fixed bar).
- [x] Turn each card into a `<details>` that starts closed. The summary
      keeps the number, word, sense, status and tick.
- [x] A tick inside the summary must not open or close the card.
- [x] Keep live status refresh and the Add count working while typing.
- [x] Add a short cascade when a pasted answer arrives, and a quiet open
      animation for a card’s fields.

**Done when:** a 10-word answer shows ten closed rows, tags at the top, and
an Add button visible without scrolling; each row opens on its own.

## Task 5 — The word card: Arabic on the left, examples and relations

**Problem.** “In Arabic” is a right-hand column; examples run together;
“Goes with” and “Similar” are pills that compete with the word.

- [x] Move “In Arabic” under the headword/meta as a left-aligned line:
      label, a hairline dot, then the Arabic word beside it.
- [x] Mute the Arabic: `--ink-2`, Arabic face, never bolder than the English.
- [x] Keep the sense in parentheses muted and inline with the headword.
- [x] Put a hairline between “More examples” and between learner sentences.
- [x] Restyle “Goes with”, “Similar” and “Opposite” as dictionary rows:
      a quiet fixed label, then the words separated by middots, one row each
      with a hairline.
- [x] Add `dir="auto"` to the example and context quotes.

**Done when:** the card reads English first; Arabic sits beside its label on
the left; examples are clearly separate; relations read as one dictionary
line each.

## Task 6 — The word list rows

**Problem.** The list hides the delete action, shows no short meaning or
example, and the Arabic competes with the headword.

- [x] Row anatomy: headword + muted `(sense)`; muted Arabic at the far end;
      one-line ellipsised example under the word; meta line under that.
- [x] A visible delete button at the row’s end, with a 44px target, a
      confirm, and Undo (reuse `word-delete`).
- [x] Equal row heights: fixed min-height, one line for each of the three
      text lines, ellipsis at the end.
- [x] Keep the whole row a button that opens the card; the delete button is
      a sibling, never nested inside it.
- [x] Fit at 320px and at 1280px; Arabic is `--ink-3`.

**Done when:** every row is the same height, the example never wraps, the
delete is visible without hovering, and the row still opens the card.

## Task 7 — Popover scrim and motion

**Problem.** Practise / Manage open over the list with no separation, and
the new pieces arrive without explaining themselves.

- [x] Add a fixed scrim behind an open `.lib-more` menu; clicking it closes
      the menu; the menu stays above the scrim.
- [x] Fade the scrim in; keep the existing menu-in motion.
- [x] Add: AI card cascade, card-open reveal, sticky Add slide, deleted row
      fade, share sheet arrival.
- [x] All of it stops under `prefers-reduced-motion`.

**Done when:** opening Practise dims the page; the menu is the only bright
thing; closing restores the page; motion never delays a task.

## Task 8 — Share the app

**Problem.** The app has a word-share flow but no fast, prominent way to
share VocabStudy itself.

- [x] Add brand marks for WhatsApp, Telegram, X, Facebook, LinkedIn.
- [x] Build the message from the learner’s dialect and level: simple Arabic
      that every dialect understands, with the learner’s own dialect in the
      wording where it helps; the link is always
      `https://vocabstudy.nagdista.com/`.
- [x] Add a share button in the app bar (brand-tinted, always visible) and a
      prominent invitation card on Today.
- [x] The share sheet: native share first where the phone supports it, then
      WhatsApp, Telegram, X, Facebook, LinkedIn, Email, SMS, Copy message,
      Copy link. A preview of the message sits above the buttons.
- [x] The message is encouraging and explains the app in one breath: free,
      no account, offline, words come back on the right days.
- [x] Works in light and night, at 320px, with keyboard focus and Esc.
- [x] No tracking, no third-party script: the buttons are plain links.

**Done when:** two taps from any screen open the sheet; one tap opens the
chosen app with the message; the copy is natural Arabic, not translated
English.

## Task 9 — Verify and ship

- [x] `python3 tools/build.py`
- [x] `python3 tools/check.py`
- [x] `node mcp/test.js`
- [x] Browser pass at 320 / 390 / 1280, light and night, reduced motion:
      mixed bidi, AI open, AI review, wallet Arabic, word card, word list,
      menus, share.
- [x] Update `DESIGN.md` for the v15 decisions.
- [x] Commit, push, confirm the Pages workflow.
- [x] Send the Arabic report: what changed, what was checked, what is next.

---

## Order of work

1. Language + AI open (T1)
2. AI tags + short meaning (T2)
3. Wallet Arabic (T3)
4. AI review (T4)
5. Word card (T5)
6. Word list (T6)
7. Scrim + motion (T7)
8. Share (T8)
9. Verify, document, ship (T9)

## Out of scope

- No redesign of the app’s identity, navigation, or study method.
- No server, account, analytics, or remote share service.
- No change to the spaced-recall schedule.
- No new language besides English and Arabic.

---

## Result (25 Nov 2026)

All eight build tasks are in, and the plan was checked against the running app
at 320, 390 and 1280px, in Light and Night, with reduced motion.

- `python3 tools/build.py`, `python3 tools/check.py` and `node mcp/test.js`
  pass; `index.html` and `sw.js` are generated.
- Mixed lines were checked with Arabic punctuation, digits and Latin URLs;
  ChatGPT opens with the prompt in the URL and no “Your prompt” sheet.
- Wallet Arabic saves immediately and routes to Add → From Arabic; AI review
  keeps tags on top and Add fixed; cards start closed.
- Word rows, word card, relation rows, popover scrim, delete fade, share sheet
  and Today invitation were checked in both themes.
- One deliberate deviation: the compact Add in the review toolbar is hidden on
  phones to leave a single Add action (the fixed bar). The sense fallback caps
  at four words, not five, because four was the longest phrase that stayed a
  label rather than a definition.
