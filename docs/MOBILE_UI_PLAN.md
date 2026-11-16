# Mobile UI/UX overhaul — analysis, direction and tasks

> Goal: the phone experience should feel like a finished study app — clear
> hierarchy, calm density, one obvious next action — without losing the
> "Study desk" identity or turning into a generic template.

## 1. What the current phone screen gets wrong

Measured at 390 × 844, 360 × 800 and 320 × 700, with 15 realistic words,
6 due, 4 learned today, a 12-day streak and a daily goal.

| # | Observation | Why it hurts |
| --- | --- | --- |
| 1 | The quick-add form is the whole first screen (~250px) and the daily plan starts below it. | A returning learner opens the app to study, not to type. The most important action is below the fold. |
| 2 | The daily plan is a large card with a heading, subtitle, full-width CTA, goal bar and 6 pill-chips that wrap to 3 rows. | Everything competes. The CTA loses to the chips; the card is ~360px tall. |
| 3 | "Your words" is a second giant hero (31px) with three oversized statistics, then search, sort and filters. | The screen reads as two unrelated pages stacked. The word list itself starts ~1500px down. |
| 4 | Status filters wrap into a heavy two-row grey block. | Looks like a settings form, not a quick filter. Wastes ~150px and pushes the list away. |
| 5 | Search, a full-width sort select and a full "Filters" button each take their own row. | Three rows of chrome before the first word. |
| 6 | Filter options open inline as a ~500px card of stacked selects. | The list disappears below a form; on a phone a sheet is the expected pattern. |
| 7 | Word rows are ~97px tall because the Arabic meaning always takes a whole line. | 15 words need two screens; the list feels heavier than the content. |
| 8 | The app bar is 64px of logo + gear only; the wordmark is hidden on phones. | Wasted space and a slightly unfinished, unbranded top edge. No safe-area inset for installed iOS. |
| 9 | At 320px the quick-add input truncates to "Type a word or ph", the title wraps awkwardly and the tab labels press against the edges. | The smallest supported phone looks broken. |
| 10 | The empty library is an input, three list items and a lot of white space; there is no title or first-run framing. | The first impression is a form, not a product that understands the learner. |
| 11 | Tab bar labels are 13px and the due badge sits tight against the icon. | Readable, but not the crisp native rhythm of a finished app. |
| 12 | Type scale is desktop-sized: page titles 31–40px, statistics 20px, body 17px. | On a phone this reads as a zoomed-in desktop page. |

## 2. Direction

**Today first, library second.** For a learner with words, the home screen
answers one question first: "What do I do now?" The word library follows
as a calm, dense list. For an empty library, the same screen becomes a
short first-run page: one sentence, the highlighter input, how it works.

Rules kept from the product:

- Study desk: cool paper, white cards, ink-blue actions, highlighter yellow.
- One accent hue (blue) plus yellow for memory and green/red only for truth.
- Bricolage for screen titles, Atkinson for everything read or typed,
  IBM Plex Sans Arabic for Arabic, Charis for IPA.
- The highlighter is the signature: it marks the due count in the hero and
  still draws under the typed word.
- No new colours, no gradients as decoration, no glass, no emoji chrome,
  no mixed radii. 8 / 12 / 18 / pill only.

**Hierarchy for a returning learner (top to bottom):**

1. App bar (56px + safe area): mark + wordmark, settings.
2. Today card: small "Today" label, streak, one marked headline
   ("**6 words** to recall."), one sentence, one primary button,
   a compact goal line, and a single scrollable row of practice chips.
3. Quick add: one line, placeholder, Add. No paragraph of instructions.
4. Library: title + one quiet stats line; search + filter icon;
   status chips with counts; result count + Practise/More; rows.
5. Tab bar: 56px + safe area, 11–12px labels, due badge with a paper ring.

**Hierarchy for an empty library:** first-run hero → large quick-add →
three numbered steps → privacy line. No library controls until there is
a word.

## 3. Tasks

- [x] T1 — Write this plan; keep `docs/DESIGN.md` in sync.
- [x] T2 — App shell: 56px phone bar with wordmark and safe-area top;
      tab bar rhythm and due badge; no crumbs over activity titles.
- [x] T3 — Home: today-first order; compact quick-add; condensed library
      header and stats.
- [x] T4 — Today card: marked headline, streak, one CTA, compact goal,
      one scrollable practice row; no duplicated next-step chip.
- [x] T5 — Library controls: search + icon filter button, counted status
      chips, compact result bar with Practise/More.
- [x] T6 — Filter panel becomes a bottom sheet (desktop: centred sheet)
      with live result count; no full-page re-render while it is open.
- [x] T7 — Word rows: 2-line phone layout, status in the meta line,
      level in the meta line, tighter padding; expanded row polish.
- [x] T8 — Empty library: first-run hero and steps.
- [x] T9 — Responsive hardening at 320/360/390, 1.25× text, long words,
      Arabic meanings, search, menus, keyboard focus, sheet.
- [x] T10 — Sweep the other phone screens (Add, Progress, Recall, cards):
      title sizes, page padding, action bar spacing; no sideways scroll.
- [x] T11 — Use it as a learner, fix what still annoys; build; commit; push.

## 4. Verification evidence

- 16 Nov 2026 (docs/PLAN.md → T23.1): every screen re-measured at 320 px
  (home, recall with hint and answer, cards, quiz, spell, match, progress,
  add, backup, print): `scrollWidth === clientWidth` everywhere.

- Screenshots before: `/tmp/opencode/ui/shots/*.png`.
- After: `/tmp/opencode/ui/after/*.png` at 390, 360 and 320.
- States: populated home, scrolled library, empty, search, filter sheet,
  practise menu, more menu, open row, add, progress, recall, cards.
- Checks: `document.documentElement.scrollWidth === clientWidth` at every
  width; every interactive target ≥ 44px; text scale 1.25; no clipped
  headings or placeholders; filter sheet keeps its open state while
  filters change; `python3 tools/build.py` passes.
