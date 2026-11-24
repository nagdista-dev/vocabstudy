# UI refresh — cards, relations, profile and the wallet

> Scope: the learner's feedback of 23 Nov 2026. Refinement, not a redesign:
> the "study desk" identity, the highlighter, the action accent, the type
> faces and every spaced-repetition rule stay exactly as they are.

## What changes

| # | Change | Why |
| --- | --- | --- |
| W0 | Wallet in the store: add, remove, clear, undo, backup/merge, reset rules | the new feature must survive a backup and obey the two reset doors |
| W1 | Study cards lose the pronunciation and usage notes (front, back, Meet) | the notes were louder than the word; they stay in the word page and Speak |
| W2 | "Goes with" and "Similar" become calm chips, one phrase each | a dot-separated paragraph read as one long note |
| W3 | Tap any word in an example or the English meaning → the word card: page dims, Arabic loads by itself, one choice: Keep in wallet (DESIGN.md → A tapped word) | a learner meets unknown words while reading; a stray tap must not fill the wallet, and often a quick Arabic gloss is all they need |
| W4 | Wallet page (save a word for later, search, Make with AI / Add myself) + a Saved for later strip on Today | it is where words wait until the learner is ready — never an instant add |
| W5 | "Make it yours" uses the app's own fonts, a 2-column dialect grid on small phones, a clearer selected state | the screen felt like a system form, not VocabStudy |
| W6 | Build, checks, 375 / 768 / 1280 + Night + Larger text, detector, docs | it ships only when it looks right where it is used |

## Rules it must keep

- English interface; Arabic only where it teaches.
- Yellow = the learner's own memory; green / red = right / wrong only.
- One next step per screen; controls ≥ 44px; nothing under 13px.
- No new network call. The wallet lives in `localStorage`, inside the same backup.
- Removing a word from the wallet is a loss: undo it, or confirm a clear.
- Notes stay reachable, one tap away, on the word page (Mistakes / Sounds) and in Speak.

## Study cards v2 — a page from the notebook

The study card is the screen a learner looks at for hours. The first pass
fixed its content; this pass fixes its composition.

**The problem.** Front, back and Meet were a pile of centred pieces floating
in a tall white face. The meta row sat at the top, the hint drifted after the
content, and a card with three lines left half the surface empty. The back
looked unfinished because the one line that made it a page — the next small
action — was missing.

**The direction.** One card anatomy on every face, like a page in a notebook:

| Zone | What it does |
| --- | --- |
| Top band | CEFR level, word type and frequency — quiet, centred, never competing with the word |
| Reading body | One idea at a time, generously spaced, 46–52ch wide; the word or the Arabic is the largest thing |
| Footer band | The one micro-action after reading: "say it, then tap", "say it once in a sentence", "tap a word you don't know" |

- The card keeps the 18px radius, one border and one shadow; no nested card,
  no kicker above a heading, no new colour. Yellow still belongs to memory:
  the highlighter and "Where you met it".
- **Front (Arabic → English):** Arabic at display size, definition below it,
  and a footer that asks for the English out loud before the flip.
- **Front (English → meaning):** the marked word, pronunciation grouped in one
  pill with the speaker, and the same footer rhythm.
- **Back:** the answer word (Arabic-first) or the Arabic meaning (English-first),
  then the memory sentence, then "Goes with" / "Similar" as chips. The footer
  asks the learner to use it once in a sentence.
- **Meet:** the same bands, but left-aligned like a dictionary entry: word and
  sound, meaning, example, related words, wallet hint. It is read, not flipped.
- Body measure stays under 52ch; definition at 20px; Arabic set 1.12× larger;
  footer copy at 15px (never under 13px). At 375px the card is one column and
  the fixed answer bar never covers the footer.
- Motion stays what it was: the card flip, the highlighter drawing under the
  revealed word, the card leaving in the answer's direction. No new cascade.

## Closed rows — one scannable line

A library row is a spine on a shelf, not a paragraph. The closed row keeps one
line for the headword and one line for the Arabic; both clip with an ellipsis,
so every row is the same height whatever its meaning. Opening the row is the
learner asking to read it: the full headword and Arabic wrap on phones, with
the status, type, level and frequency underneath. The same rule applies to
"Just added" rows on Add. The `is-long` class and its stacking rules are gone —
one rule at every width. Full text is also in the `title` attribute on a
desktop hover, and on the word's page after a tap.

## The wallet — a pocket, not a deck

- **What it is.** A word met inside an example, kept with the sentence that
  made the learner tap. It is not a library word: no schedule, no note, no
  place on the ruler until the learner adds it deliberately.
- **How it is kept.** `walletAdd(word, sentence, source)` stores
  `{ id, word, sentence, source, added }`, newest last, at most 300. A word
  already in the library returns `inLibrary`; a second tap returns `existed`.
- **Where it appears.** A quiet Today strip only while the wallet has words,
  and `#/wallet`: newest first, each entry with its sentence, its source and
  one `Add to my words` action. Add prefills the add screen with the word and
  uses the kept sentence as `context`; the word leaves the wallet when it
  becomes a library word. No sixth tab.
- **Loss.** Remove shows an Undo toast; Clear wallet asks in the app's own
  sheet and offers Undo. Reset progress keeps the wallet; Start over deletes
  it with the rest of the content. Backup includes it; merge unions by id and
  drops any word that is already in the library.
- **Look.** The kept sentence wears the highlighter rule (memory), the rest
  stays ink and paper. No new colour, no new network call.

## Checked

- Card front, back and Meet at 375×812, 768×1024 and 1280×900; Night and
  Larger text at 375 and 1280; card and action bar share the same 660px edge.
- Closed library rows at 375 and 768: long Arabic is ellipsized, all rows the
  same height; opening the row shows the full meaning and wraps it.
- "Just added" rows at 375: one line each, long Arabic ellipsized, full text on
  the word's page.
- Profile sheet at 375 (Light/Night, Normal/Larger) and 768: level and dialect
  grids, explicit fonts, selected state, no horizontal scroll.
- No console errors; `impeccable detect --changed` reports only the app's
  intentional margin rules (the red pen and the highlighter quote rule), not
  decorative side tabs.

## Done when

`python3 tools/build.py`, `python3 tools/check.py` and `node tools/test_traps.js`
pass; no console errors; the card, the wallet and the profile sheet are
checked at 375×812, 768×1024 and 1280×900, at Normal and Larger text, in
Light and Night.
