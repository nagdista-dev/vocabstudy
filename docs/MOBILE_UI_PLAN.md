# Mobile UI/UX overhaul — audit, direction, tasks

> Goal: VocabStudy should feel like a finished global learning app on a phone
> (Duolingo / HelloTalk level of craft), while using a wide desktop screen well.
> Keep the "Study desk" identity: paper, the chosen action accent (ink blue by
> default, five alternates in Settings), highlighter yellow, Atkinson /
> Bricolage / IBM Plex Sans Arabic.

Measured with a realistic library (24 words, 9 due, 4 learned today, 12-day
streak, 150-answer goal) at 320 × 700, 360 × 800, 390 × 844 and 1280 × 900.
Screenshots live in `/tmp/opencode/ui/shots/`.

## 1. What the current screens get wrong

### Home / library (same screen)

| # | What it is now | Why it hurts |
| --- | --- | --- |
| H1 | White "Today" card is ~364px tall: kicker, streak, headline, sentence, full-width CTA, goal row, practice chips, Quick 5 row. | The first scroll is pure chrome. The kicker "TODAY" adds nothing. The hero competes with the library instead of leading it. |
| H2 | A separate large quick-add block, then a 164px yellow backup banner, then "Your words". | The word list starts below the fold at 390px. The backup reminder is louder than the daily lesson. |
| H3 | The library repeats a second hero: "Your words" 28px, a stats line, then search, filters, five chips, result bar. | Reads as two stacked pages. Sorting is hidden in a sheet while sort is one of the most-used controls. |
| H4 | Word rows are separate cards with 8px gaps, ~68px each. | 24 words need 1,600px. A grouped list is calmer and scans faster. |
| H5 | App bar is translucent with backdrop blur; scrolled content shows through as ghost text. | Looks like a rendering bug, especially over headings. |
| H6 | Bottom tab says "Words" with a book icon; the label "Add words" is long; due count is red on a red-free screen. | Red is reserved for wrong answers. Labels should be short and thumb-readable. |
| H7 | Settings icon is a sliders glyph (same as filters). | Wrong semantic; users read it as filters. |
| H8 | At 1280px the page is a single 1080px column with ~300px of unused space and one visible word row at 900px height. | Desktop feels like a stretched phone. |

### Activities

| # | What it is now | Why it hurts |
| --- | --- | --- |
| A1 | On phones the app bar (brand + settings) sits above the activity's own header. | Two headers, 56px wasted, and Settings is irrelevant mid-round. |
| A2 | Titles are "Quiz · Whole library", "Spell · Whole library", "Study · Whole library". | Clumsy and repetitive. The scope belongs in a quiet subtitle. |
| A3 | Quiz / spell / recall put a short card at the top and leave 250–320px of dead space below. | The screen feels unfinished, and the action bar is far from the content. |
| A4 | Quiz options show no A–D marker on phones (the numeric key hint is hidden). | Options read as anonymous rows; no way to refer to "option B". |
| A5 | The progress bar is 8px, light, and sits alone under the title; the count is far right. | Weak feedback about where you are in the round. |

### Other screens

| # | What it is now | Why it hurts |
| --- | --- | --- |
| O1 | Add words: a large intro + tall tab card; the rest of the screen is empty. | The screen has no confirmation of recent words and feels like a form, not a workspace. |
| O2 | Progress: "Your progress" 32px; the week strip labels "Sat / Sun / Today" collide. | The week is the best part of the screen and it is hard to read. |
| O3 | Backup / transfer / print / week inherit desktop type and spacing. | Inconsistent with the new shell. |

## 2. Direction

**One hero, one action, then the library.** The top of home is a compact tinted
paper hero — the chosen accent's soft wash, never a dark block — that answers
"what now?" in one line. Under it: one capture bar, one slim backup row (weekly
only), then a dense, grouped word list. Nothing decorative between the learner
and a word.

### Tokens and shell

- Flat paper page (remove the decorative top gradient). No glass, no blur on
  chrome; opaque app bar and tab bar with a 1px line.
- Spacing: 4px grid; gutters `clamp(16px, 5vw, 32px)` → 16px at 320, ~19.5px
  at 390, 32px at desktop. Page top padding 16px on phones.
- Type: body 17px; `--text-sm` 15px; `--text-xs` 13px; section titles 20–22px;
  mobile page h1 26–28px; desktop page h1 32px; tab labels 12px.
- `--ink-3` darkened to pass 4.5:1 on paper.
- App bar 56px + safe area on phones, 64px desktop; opaque paper.
- Tab bar 56px + safe area, labels Today / Recall / Progress / Add; active icon
  in a brand-soft pill; due badge highlighter yellow with ink text and a paper ring.
- Give the settings button a real gear; keep sliders for filters.
- Activities hide the app bar on ≤1023px and use their own header.

### Home

- Tinted paper hero (`--brand-soft`, radius 18, flat, no gradient; ink text):
  - top row: highlighter streak pill + daily goal (count and a 4px track);
  - 28–32px headline with a solid highlighter chip on the count
    ("**9 words** to recall.");
  - one full-width solid brand CTA (50px, white label, white arrow chip), or
    none when done;
  - one scrollable practice-chip row of white pills (Quiz / Spell / Match /
    Use it + Quick 5), never wrapping; it fades at the edge when it overflows.
- One compact capture bar (46px field, 44px Add).
- Backup reminder becomes a 52px row: icon, "Last backup 9 days ago · 24 words",
  "Back up", dismiss X. No yellow block.
- Library header: "Your words" 22px; stats only on desktop (chips already carry
  counts); search + icon-only filters one row; compact counted status chips;
  one result bar with count, Practise and an overflow menu.
- Grouped word list in one card with 1px dividers, 56–58px rows, no gaps.
- Desktop ≥1024: two columns — main (hero, capture, library) and a 320px rail
  (this week, Quick 5, progress/backup). Main hero becomes horizontal
  (headline left, CTA right).

### Activities

- Dedicated header: X, 20px title (Quiz / Spell / Recall / Match / Study),
  quiet scope subtitle ("Whole library", "Today's words", "Due today"),
  count, 4px progress bar. No app bar on phones.
- `.activity-stage` fills the remaining viewport and centers its content
  vertically, so short cards sit in the middle of the screen (not at the top).
- Quiz options: always-visible A–D marker; numbers remain the keyboard hint on
  wide screens.
- Fixed action bar: opaque paper, 1px top line, 8px gaps, 52px buttons; undo
  stays a quiet icon button; `kbd` hints hidden on phones.
- Summary: 30px title, three compact stats, one primary next action.

### Other screens

- Add: 28px title, one-line intro, compact tab card, 44px tabs, and a
  "Recently added" list under the card so the screen is useful after a save.
- Progress: 28px title, compact week card, 2×2 stats, readable week labels,
  charts with consistent 20px padding.
- Data / transfer / print / week: same page padding and heading scale; no
  horizontal scroll at 320.
- Empty library: first-run hero with one job — add the first word — then the
  three-step explainer; no library controls until there is a word.

## 3. Tasks

- [x] T1 — Rewrite this plan from the new audit.
- [x] T2 — Tokens + base: gutters, type scale, ink-3 contrast, flat paper,
      page padding, reduced motion respected.
- [x] T3 — App shell: opaque 56px bar, gear icon, tab labels/badge/active state,
      activity mode hides the app bar, desktop nav badge no longer overlaps label.
- [x] T4 — Home hero: compact index card tinted with `--brand-soft` (an early
      dark-ink version was rejected in review), streak + goal, marked headline,
      one solid brand CTA, white practice chips, Quick 5; remove TODAY kicker
      and duplicate Quick 5.
- [x] T5 — Capture bar + slim backup row.
- [x] T6 — Library: compact header, search/filter row, chips, result bar,
      grouped dense word list, expanded row polish.
- [x] T7 — Desktop home: two-column grid + right rail (week, Quick 5, progress,
      backup) with sticky positioning.
- [x] T8 — Activities: hide app bar on phones, new header with scope subtitle,
      centered stage, A–D options, opaque action bar, summary polish.
- [x] T9 — Add screen: compact tab card, 44px tabs, recently added list;
      two columns from 1024px (form left, Latest words 380px right).
- [x] T10 — Progress: heading scale, week strip label fix, tiles, charts.
- [x] T11 — Data / transfer / print / week / settings: consistent type, padding,
      touch targets; phone print bar above the tab bar.
- [x] T12 — Empty library and empty activity states.
- [x] T13 — Responsive pass at 320/360/390/768/1280, 1.25× text, long words,
      Arabic, open rows, menus, sheets; no horizontal scroll; ≥44px targets.
- [x] T14 — Build, check, traps, final screenshots; update DESIGN.md.

## 4. Verification protocol

For every task and every screen:

1. Screenshot at 320 × 700, 360 × 800, 390 × 844, 768 × 1024, 1280 × 900.
2. Check `document.documentElement.scrollWidth === clientWidth`; no clipped
   headings, inputs, chips or buttons.
3. Measure interactive targets (≥ 44 × 44 CSS px) and compare adjacent gaps.
4. Repeat with Settings → Text size = Larger (1.25×).
5. Use the screen as a learner: can the next action be found without reading
   everything? Is the thumb on the control? Does every state (empty, done,
   wrong, filter open, row open) still look intentional?
6. Fix, re-shoot, and only then check the task off.

## 5. Evidence

All checks ran against a seeded 24-word library (9 due, 4 learned today,
12-day streak, 150-answer goal) and a long-word edge state
(*counterrevolutionaries*, long Arabic gloss, long tags). Screenshots:
`/tmp/opencode/ui/shots/` (not committed).

**Built and validated**

- `python3 tools/build.py` → `index.html`, `sw.js`.
- `python3 tools/check.py` → `check OK: 0 error(s)` (twice, after the last edit).
- `node tools/test_traps.js` → `traps OK: 108 traps, 101 with patterns`.

**Screens reviewed at 320 × 700, 360 × 800, 390 × 844, 768 × 900 and
1280 × 900** — home, library/search results, recall, quiz, study cards,
spell, match, progress, week, add, backup, transfer, print — plus 1024px
boundary captures for home, library, add, progress, data and print.

**States reviewed**: quiz answered + summary, recall revealed + graded,
spell wrong, cards flipped, match picked, write draft, filter sheet, settings
sheet, row expanded, library overflow menu, no-results search, first-run empty
home/library/add, print top/bottom, and printing at 320/390 with text at 1.25×.

**Fixes that came out of the review**

- Week strip and recall chart: "Today" shortened to "Now" at ≤360px; smaller
  labels and tighter gaps. Seven labels no longer touch at 320 with Larger text.
- Spell: the letter-by-letter answer and long Arabic had no break opportunity.
  A 22-letter word pushed the card and the page to 470px wide; both now wrap,
  and the page stays at 390/320.
- Recall, write and card-back long text (headword, Arabic, definition, example)
  now wrap instead of widening the card; the flip face has `min-width: 0`.
- Filter sheet at 320 with Larger text: the two selects clipped "Any memory".
  The grid now uses `auto-fit` with a rem minimum, so it drops to one column
  when the labels need it.
- Library phone rows: the meta line ended in "#…" and truncated the tag. Tags
  moved to the expanded row; frequency keeps its own no-wrap span and moves to
  a second line intact at 1.25×.
- Search on ≤1023px now scrolls the search row under the app bar on focus, so
  results are visible while typing; `scroll-margin-top` keeps it below the bar.
- Print on phones: fixed action bar verified at 320/360/390, 1× and 1.25×,
  sitting above the tab bar with the document's last line clearing it; desktop
  keeps the sticky footer inside the options card.
- Quiz answered on phones hides unmarked distractors and no longer auto-scrolls.
- Add recent rows stack the Arabic under long headwords at ≤640px, left-aligned.

**Known trade-off**: the practice-chip row is a deliberate one-line scroller.
At 390 the four main activities (Quiz / Spell / Match / Use it) fit whole and
only Quick 5 begins past the edge; at 320 "Use it" is partly visible. The edge
fade plus the peeking chip is the affordance, and Quick 5 is one swipe away (or
in the desktop rail).

## 6. Second pass — hero colour, six accents, About page

The first build followed the audit's dark-ink hero. In review it read as a
separate product sitting on the desk and dominated everything under it, so the
hero was rebuilt as a tinted paper index card: `--brand-soft` wash, ink text,
a solid brand CTA with a white label, white practice pills, and the highlighter
kept only for the streak and the marked count. The tint follows the chosen
accent, so the hero and the buttons always speak the same colour and nothing on
the page turns black.

**Accents.** Settings → Look now offers six: the original Ink blue, Teal,
Violet, Rose, plus **Plum** `#8a2f6b` (soft `#f7e4f1`) and **Cocoa** `#7a4a2b`
(soft `#f6ebe2`). Teal was darkened to `#0a6f6a` so it passes AA on its own
tint. Every accent was checked on its soft wash: blue 5.85, teal 5.09, violet
5.47, rose 4.72, plum 6.42, cocoa 6.30; white on each solid fill is ≥5.6. The
picker is a wrapping grid (two columns on phones, three from 520px) instead of
a scrolling line, so all six swatches stay visible at 320.

**About page.** `about.html` was still the old long text page, so it was rebuilt
against the same desk: sticky paper header with section nav and open-app CTA; a
two-column hero with a CSS-drawn mini home screen; numbered steps; a six-tick
review ruler; teacher "trap vs checked sentence" specimens; hairline feature
list; split privacy card; three install cards; native FAQ; tinted final CTA.
All prior content is kept, with deep links into `index.html#/data`. Arabic stays
the voice; English UI labels are isolated LTR islands and tap sequences read
"Share ثم VocabStudy" to avoid bidi arrows.

Responsive decisions: steps are 2 columns + a wide third from 760px and 3
columns from 1000px; teacher specimens pair up between 700–899px; install is 3
columns from 900px; the privacy online list becomes 2 columns at ≥1024px; the
mini app grows to 360px from 700px. The header drops its nav below 900px,
anchors clear it with `scroll-margin-top: 84px`, and the footer splits the
GitHub link onto its own line with the licence as a `nowrap` island.

**Second-pass evidence.** About was audited at 320/360/390/768/1280 and at
1.25× text on 320/390/768/1024/1280; `scrollWidth === clientWidth` in every
case, with no clipped cards, chips or footer lines. Teal home was re-shot at
390 and 1280, and the six-swatch settings grid at 320 and 390. `about.html` is
static, so `tools/check.py` does not scan it; the page was checked directly in
the browser instead.
