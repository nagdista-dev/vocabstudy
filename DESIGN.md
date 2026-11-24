# Design

## Direction: "Study desk"

The learner is an adult (B1–C1 words) who may study for **six hours a day**.
Everything serves long, focused sessions:

- **Light by default, Night for the dark room** (V6, Settings → Basics → Theme:
  Light / Night / Auto). The app always opens Light; Night only when the
  learner chooses it (or chooses Auto on a dark device). Night is a navy desk, not black; every colour has a
  night token in `tokens.css`, the ten accents get a light tint and mix their
  soft fill and hover from it, the highlighter becomes a muted yellow band
  behind the whole word with dark text, and green / red stay ≥ 4.5:1.
  Glass is day-only (at night it is a flat accent). Paper and PDFs are always
  light. A `<head>` script applies the theme before the first paint.
- **One action accent at a time** — ink blue by default, plus nine alternates in
  Settings → Look (teal, sky, violet, plum, rose, cocoa, amber, graphite, glass) —
  and **one for memory** (highlighter yellow). The nine flat colours and the
  Liquid Glass material all pass AA on their surfaces. The picker is a 3×3 grid
  at ≥520px, with the tenth (Glass) centred beneath; on a phone it is two
  columns — five full rows.
- **Green / red only for right / wrong.** Never decoration.
- **Motion answers the learner** and finishes in under a second. Nothing loops —
  except the mic while it is listening (Speak), which is a live status.
- **Local first.** Fonts ship with the app (`assets/fonts`, `tools/vendor.py`);
  no font server, no CDN.
- **Breaks are built in** (Settings → Break reminder, default every 50 minutes).

## Tokens (`assets/css/tokens.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f3f5f9` | page background |
| `--surface` | `#ffffff` | cards |
| `--ink` / `--ink-2` / `--ink-3` | `#141b2d` / `#465066` / `#56617a` | text, secondary, hints |
| `--brand` | `#2b48d6` | actions, links, current step |
| accent sets | teal `#0a6f6a`, sky `#0e6688`, violet `#6a3fc4`, plum `#8a2f6b`, rose `#b8325f`, cocoa `#7a4a2b`, amber `#8a5600`, graphite `#3d4452` | optional action colours; each brings its own hover and soft tint |
| `--brand` (glass) | `#26384a` · hover `#17283a` · soft `#eef4f8` | the tenth accent; swaps the action surfaces for the Liquid Glass material (`glass.css`) |
| `--mark` | `#ffe066` | the highlighter: **memory only** — the word being learned and the count that is due |
| `--note` / `-soft` / `-line` / `-ink` | `#3b5b8c` / `#eef2f8` / `#c8d3e6` / `#22344f` | the app asking or warning: "Which meaning?", spelling checks, flags, status lines, milestones |
| `--good` / `--bad` | `#0f744f` / `#b3302f` | right / wrong (≥ 5:1 on their soft fills) |
| `--lvl-a/b/c` | teal / blue / violet | CEFR level badges |

## The system (`assets/css/system.css`, v10 V3)

One rule per concern, written once. Screens use them; they never restate them.

**Breakpoints — three, and only these:**

| Name | Width | Queries |
| --- | --- | --- |
| phone | < 600px | `max-width: 599px` (narrow phones: `max-width: 374px`) |
| tablet | 600–1023px | `min-width: 600px` / `max-width: 1023px` |
| desktop | ≥ 1024px | `min-width: 1024px` |

`about.html` is a marketing page with its own reading widths and is exempt.

**Layers (`--z-*`):** base 1 · sticky 10 · bar 20 · float 30 · sheet 40 ·
toast 50 · dialog 60. No raw z-index numbers anywhere. The toast, update bar
and install card float above the action bar, never over a primary button.

**Type floor:** nothing you read is under 13px (`--text-2xs` = .8125rem).
The one exception is a number inside a badge (`--text-badge` = .75rem).
Reading text is 15–17px; a definition longer than a line is left-aligned.

**Touch:** every control is ≥ 44×44 (`--tap`) on every screen, phone or
desktop. Small inline links (#tags, rail links, crumbs) keep their look and
get an invisible `::after` hit ring.

**Focus:** `outline: 2px solid var(--brand)` with offset — ≥ 3:1 on paper
and surface. Never a soft shadow alone.

**Buttons — four kinds and one icon button:**

| Kind | Class | Use |
| --- | --- | --- |
| Primary | `.btn.btn-primary` | the one main action on a screen |
| Secondary | `.btn.btn-tonal` (or plain `.btn`) | every other real action |
| Quiet | `.btn-quiet`, `.link-btn`, `.word-manage-btn` | small actions inside content |
| Danger | `.btn-danger` (cannot undo) / `.btn-danger-quiet` (a door to it) | loss |
| Icon | `.icon-btn` | one size, `--tap` square, always with `aria-label` |

`.btn-good` / `.btn-bad` are answer buttons (Know / Again), not a fifth kind.
**Choice cards** (`.choice`, `.sense-opt`, `.ar-pick-opt`) are rows you pick
one of — one border, brand on hover, brand-soft when chosen.

**Status:** one treatment at every width — a dot beside the word and
"New / Learning / Mastered" leading its meta line. No status pill.

**Yellow means memory.** The highlighter marks the word being learned, the
due count, and what belongs to the learner's own memory: "Where you met it",
their note's bulb, the ruler's reached days, a "Learning" status, words
they keep from a text, and the sentence kept in the wallet. Everything the
*app* says — questions, warnings (the
Arabic-keyboard line), hints, flags, the week's note, "saved but not checked"
— uses `--note`. Counts that are not due (Learn, streak) are neutral; a
right-answer streak (combo) is green.

## Words we use (glossary)

| Say | Means | Never |
| --- | --- | --- |
| Learn | the flash cards: Meet, then Check | Cards, Flashcards |
| Recall | remember the English from the Arabic | Review, Test |
| Quiz / Spell / Match / Speak / Use it | the other activities | — |
| Due | a word whose day on the ruler has come | Overdue, Late |
| New / Learning / Mastered | a word's status | Box 3, Level 2 |
| Your words | the library | Deck, Collection |
| Wallet | words kept from examples, waiting to be learned | Saved, Inbox, Queue |
| Where you met it | the learner's own sentence | Context, Source |
| Checked by hand | a meaning from `overrides.js` | Verified, Official |
| Backup file | the exported `.json` | Export, Dump |

## Liquid Glass (`assets/css/glass.css`)

The tenth choice in Settings → Look is a material, not another hue. It is
scoped under `:root[data-accent="glass"]`, so the other nine accents are
untouched.

- **What turns to glass:** the app bar, the phone tab bar and its current-tab
  pill, today's plan and its practice chips, the primary actions
  (`.btn-primary`, `.today-cta`, `.mic`), tonal buttons, speaker buttons and the
  swatch itself.
- **What never does:** cards, text surfaces, the word being learned, the
  highlighter, and green / red. Meaning never becomes transparent.
- **How it is made:** a cool blue-grey tint, a top specular highlight, a white
  rim with a cool inner hairline, and a short soft shadow. Blur is used only
  where content can pass underneath — the two bars and the primary actions.
- **Contrast:** labels on clear glass are `--lg-ink` `#12263a`, never white.
  The deepest primary tint is `#a9cde9` (hover `#9ec6e2`); ink on it is 9.2:1,
  or 8.5:1 on hover. White appears only on the dark state fills: the listening
  mic and the "speaking" button use the dark `--brand` fill at 12:1.
- **Focus** stays the global 3px `--brand` ring; a field also gets a dark border
  and a cool ring, so pale glass can never swallow focus.
- **Fallbacks:** without `backdrop-filter` the bars become opaque paper and
  surface. `prefers-reduced-transparency: reduce` drops blur and uses opaque
  tints. `forced-colors: active` replaces the material with Canvas / CanvasText.

## Type

| Role | Font | Why |
| --- | --- | --- |
| Words being learned, all body text | Atkinson Hyperlegible Next | Look-alike letters (l I 1, rn m, O 0) can't be confused |
| Screen headings | Bricolage Grotesque | Characterful at large sizes; never the word being learned |
| Arabic | IBM Plex Sans Arabic | Set a step larger than the English, which looks the same size |
| IPA | Charis SIL | A dictionary face with full IPA coverage |

Scale: tuned for phones — 13 / 15 / 17 / 20 / 24 / 30 / 32–48px (12px only for numbers in badges).
Settings → Text size multiplies everything (`--text-scale`: Normal, Large 1.12,
Larger 1.25).

## Sound traps and the keyboard note

Advice, not errors: `.traps` is quiet ink on a soft fill (never red/green);
`.kb-warn` ("Your keyboard is in Arabic") uses the highlighter's soft yellow.

## The teacher's marks

The app speaks like a teacher who has marked thousands of Arab learners'
notebooks — never like a machine. Its marks are always the same, so a
learner learns to read them:

| Mark | Means | Where |
| --- | --- | --- |
| Struck-through line, red ✗, then ink line, green ✓ | "Arab learners say this → say this" (a usage trap) | word details, card back, recall, quiz, Use it |
| Soft yellow block with a bulb | *your* memory: where you met the word, a note from the teacher | word details, card back, your week |
| ○●○○ | word stress — the big dot is the stressed syllable | next to every IPA with two or more syllables |
| ▂▃▅▆█ five rising bars + "Top 3,000" | how common the word is — more bars, more useful | word list, word details, card front |
| Highlighter on a word in a paragraph | "I'm keeping this one" | From text |
| Arabic on a small soft chip inside English | a quoted Arabic word, isolated so it reads right in both directions | trap explanations |

Red and green still mean only wrong and right: a trap's mistake is wrong,
its fix is right.

**The red pen (V4.1)** is one rule for every mistake on every screen: the
learner's words stay in their own ink (`--ink-2`) and the teacher strikes
them through in `--bad` at 2px (`.pen-wrong`). The fix beside it is ink with
a green tick. Recall, Spell, Use it, the traps and a kept sentence all use it.

**A mistake is a margin note, not a red page:** the feedback card stays
neutral with one red edge and a red title; only the chosen wrong option is
red. In Spell the right spelling is never red — the letters the learner had
stay in ink and the ones to learn wear the highlighter.

**The ruler (V4.2, `VS.ui.ruler`)** is where a word stands on the six spaced
days 1·3·7·14·30·60 — the same days the first run promises. Reached days wear
`--mark-soft`, the current one `--mark`. Word page, end of Recall (compact,
no numbers) and Progress ("Your words on the ruler").

**The teacher's line (V4.3)** ends Recall: the word that came back after the
longest real gap (from the day it was last seen, late days included), said only for a due word remembered now after 3+ days.

**The maker's credit (V4.6, `VS.credit`)** — "Made by Nagdista" — lives in
exactly four places: the first-run footer, Settings → App & data, the
about.html footer and the printed page / every PDF page. It is ink, never
brand, opens in a new tab, and its link carries only utm source tags. Never
in an activity, never a popup.

## The signature

Home opens with one index card, never a dark block. Its tint follows the
chosen action accent (`--brand-soft`), so the hero belongs to the same ink as
every button: the next action in a sentence, the count in a solid highlighter
chip ("**9 words** to recall."), one primary CTA — solid brand with a white
label, or under Glass a blue-tinted glass surface with an ink label — and the
practice chips as white pills. Under Glass the card itself is clear glass
instead of a tint. Under it, a slim capture bar:
type a word and a highlighter band draws under exactly what you typed (its
width is measured in `views/library.js`) — you are marking the word to keep.

`.mark` draws the same highlighter band behind a word. It appears on every new word
(cards, recall, quiz feedback) and draws itself in (`motion.css → mark-draw`).

## First run (empty library)

The empty library is the first lesson, not an empty state: three acts read
top to bottom — one action, the artifact it produces, then the schedule that
keeps it.

- **1 · A word you met today.** The h1 states the promise; the form is the
  page's only action. A numbered label, one line saying where words come
  from, the field and Add, then the keyboard / paste / upload hint. At
  ≤374px the field and Add stack, so both get the full width at 320px and
  1.25× text.
- **2 · Learn it once.** A real example card for *resilient* — IPA, type,
  Arabic, definition, example and a working speaker — in the same reading
  order as the word page. It sits beside the form from 820px and below it on
  smaller screens. The heading says "This is the card you'll get", so the
  card is proof, not decoration.
- **3 · Recall it on spaced days.** The six returns (1, 3, 7, 14, 30, 60)
  are a ruler, not a sentence: one tick per day, the first in highlighter
  yellow. The label "Days after you learn it" makes the scale explicit.
- **Edges.** One centred 620px column at tablet portrait; two columns from
  820px (1.08fr invitation / .92fr card), with the ruler and footer running
  underneath both. The card, ruler and footer share the same right edge.
  Checked at 320/360/390/520/768/1280 and 1.25×; no horizontal scroll and no
  clipped placeholder. The compact post-add form keeps its icon-only button
  at ≤374px.
- **Handoff.** The page opens at the heading, not the field. After the first
  word is added, focus moves to the new screen so a phone keyboard closes
  instead of covering today's plan.
- **Trust.** The footer keeps the local-first promise and links to the Arabic
  About page; the example speaker is omitted when speech is unavailable.

## The About page (`about.html`)

The only Arabic-first surface, and a static one (`assets/css/about.css`, no app
JS). It keeps the same desk without imitating an app screen:

- Sticky paper header (brand + section nav + open-app CTA), then a two-column
  hero: the claim on one side, a CSS-drawn mini home screen on the other. The
  preview is decorative (`aria-hidden`, no focusables), so it can never drift
  from the real UI the way a screenshot would.
- Numbered step cards, a six-tick review ruler, a pair of teacher specimens
  (trap + checked sentence), a hairline feature list, a split privacy card,
  three install cards, native `<details>` FAQ and a tinted final CTA.
- Arabic headings use IBM Plex Sans Arabic; Bricolage has no Arabic glyphs.
  English UI labels are isolated LTR islands, and tap sequences use the Arabic
  word "ثم" instead of a bidi arrow.
- Phones: one column, 16px gutters, header keeps only brand + CTA. Below
  900px the section nav is hidden, so the CTA gets `margin-inline-start:
  auto` and takes the far end (the left, in RTL), away from the logo; from
  900px the nav holds the centre and the CTA already sits at the end. The
  header never overflows at 320px.
- Tablets get two step cards plus a wide third; desktop splits the hero,
  teacher, privacy and final. The privacy online list becomes two columns at
  ≥1024px.
- Every section anchor clears the sticky header (`scroll-margin-top: 84px`).
  No horizontal scroll at 320 or at 1.25× text; the ruler stays six ticks.

## Layout

- Content max 1120px; activities max 720px — one task, centred. The study
  card and its answer bar cap at 660px so the activity header, the card and
  the bar share one edge.
- 4px spacing grid (`--s-1` … `--s-8`).
- App bar: 56px on phones, 64px from 1024px; opaque paper with a 1px line
  (under Glass: blurred glass). Desktop
  navigation lives in the bar; ≤1023px uses the bottom tab bar (Today, Words,
  Recall, Progress, Add) so the thumb reaches every destination.
- **Today and Words are two pages** (v10 final): Today (#/) is the plan, the
  add box and the newest five words with "All N words →"; Words (#/words) is
  the whole library — title, search, status chips, filters, the list. Every
  review found the plan and the library crowded together on one phone screen.
- Activities ≤1023px hide the app bar and show their own header: exit, title,
  scope, count, 4px progress. Print stays a browse screen and keeps the tab bar.
- Phones (≤ 599px): answer buttons sit in a fixed opaque bar under the thumb;
  options stack. Print swaps that bar for Download PDF + an icon-only Print,
  fixed above the tab bar.
- Add is two columns from 1024px: form left, a 380px Latest words column right.
- Touch targets ≥ 44px (`--tap`) on every touch screen — one block in
  `components.css` ("Touch screens") sets it for every component.

## The study card (Learn)

The screen a learner looks at for hours is composed like a page in a
notebook, not a pile of centred pieces. Every face — front, back and Meet —
shares three bands:

| Band | What it holds |
| --- | --- |
| Top | CEFR level, word type and frequency — quiet, centred on a recall card, left on Meet |
| Reading body | One idea at a time: the word or the Arabic is the largest thing; definition ≤ 52ch; example in a soft block |
| Foot | The one small action after reading: "Say it in English, then tap to check", "Tap to see the meaning", "Say it once in a sentence", or the wallet hint |

- **Shape.** 660px max, the same edge as the activity header and the answer
  bar; 18px radius, one border, one shadow, no nested card. At 375px it is one
  column and the fixed answer bar never covers the foot.
- **Front, Arabic → English.** Arabic at display size, definition below it,
  then the foot asking for the English out loud before the flip.
- **Front, English → meaning.** The marked word, its sense, and pronunciation
  as one pill: speaker + IPA. With no IPA the speaker stands bare — an empty
  pill would read as missing data. Foot: "Tap to see the meaning".
- **Back.** The answer (the English word when the front was Arabic; the Arabic
  meaning when the front was English), the memory sentence in its yellow
  band, the example, then "Goes with" / "Similar" as chips. Foot: "Say it once
  in a sentence".
- **Meet.** The same bands, read left-aligned like a dictionary entry: word,
  sound, meaning, example, related words, wallet hint. Nothing is hidden and
  nothing is graded; it does not flip.
- **No notes on the card.** Pronunciation tips and usage traps were louder
  than the word; they stay on the word page (Sounds / Mistakes) and in Speak.
- **Type.** Body measure under 52ch; definition 20px; Arabic set larger than
  the English; foot copy 15px, never under 13px. Motion is unchanged: the flip,
  the highlighter drawing under the revealed word, the card leaving in the
  answer's direction.

## Phones first

Most learning happens on a phone, one-handed, by learners of every age.
Checked at 320, 360, 390, 768 and 1280px at Normal and Larger (1.25×) text,
with 22-letter words and long Arabic meanings:

- Nothing scrolls sideways. An input never widens its page (`.field` and
  `.add-line .field` have `min-width: 0`).
- Every control ≥ 44px; the hero CTA 48px, tab links 54px tall.
- Meta lines and tab labels use 13px (`--text-2xs`); only badge numbers are
  12px (`--text-badge`).
- Every form field is 16px or more on touch screens, or iPhone zooms the page.
- Textareas never resize by hand; they grow with the text.
- Choices never hide off-screen: the status filter scrolls with an edge fade,
  and its sheet drops to one column when a select needs the width.
- Word rows keep status (dot + word), type, level and frequency on the collapsed line; tags
  wait in the expanded margin. A closed row is one scannable line: a long
  headword or Arabic meaning clips with an ellipsis, so every row keeps the
  same height. Opening the row is the learner asking to read it — the full
  word and meaning then wrap on phones, with the meta line underneath. The
  same rule holds for "Just added" rows on Add; `is-long` stacking is gone.
- Week strips shorten "Today" to "Now" at ≤360px so seven labels never collide;
  charts use the same 2xs labels.

## The word page (an open library row)

The summary is the entry's title; opening it turns the row into a page in a
learner's notebook, not a stack of labelled cards.

- **Summary.** Headword, Arabic beside it on wide screens, status/type/level/
  frequency on a quiet second line. Badges and the chevron sit at the end.
- **Reading column.** One sound strip (speaker, IPA, stress, a `Sound tips`
  disclosure), the meaning as the largest text, a quiet `Other meanings` link,
  the example as an italic pull quote with a highlighter rule, and one tools
  row: `Hear the sentence` left, `More examples` right. The primary
  `Write a sentence` action follows.
- **More examples.** The list opens under the quote, inside the same hairline:
  each sentence is one block of text, never broken into flex fragments, with a
  quiet speaker at its end; the Tatoeba credit closes the block, indented with
  the sentences.
- **Focus while open (v12).** Opening a word keeps it under the finger while
  the open one folds, then settles it at one place under the top bar (8px from
  the top on phones). The card lifts (hairline + one soft shadow); every other
  row and section stays visible at 45% (85% under the pointer) — opacity only.
  Closing fades the body (150ms) before it folds; Esc closes it.
- **Nothing is removed without a yes.** Delete a word, Reset to new, remove a
  sentence, remove from the wallet, Clear wallet: each asks in the app's sheet
  (Cancel holds the focus), and Undo follows.
- **Opens in place.** The open word stays inside the list's frame: no second
  border or shadow around it (a card in a card); a firmer rule closes it.
- **Manage in view.** The sound capsule (speaker · IPA · stress) on the left;
  `Edit` (pen + label, icon-only under a 340px card) and `Delete` (trash icon,
  red only on hover/focus) on the right — no ⋯ menu. Delete is one tap and
  the toast's Undo restores the word with its progress, note and sentences.
  `Reset to new` is a quiet icon at the end of the memory line, with Undo.
- **Playing.** Every speaker fills with the accent while it plays (the capsule
  speaker and the More examples speakers kept their own face and lost the
  icon); the example's speaker takes the soft accent.
- **Other meanings.** One panel like a learner's dictionary page: rows divided
  by hairlines, each numbered; the part of speech a quiet chip on the left and
  the Arabic on the right edge (physical `margin-left: auto` — the Arabic is
  `dir=rtl`), the definition, the example in italic, then `Use this meaning`.
  The meaning in use wears the accent's soft fill, a filled number and "In use".
  Under 420px the numbers step aside. The Meet card uses the same list.
- **One card at a time.** Opening a word closes the one already open, so the
  library is always one reading column rather than a long stack of half-read
  cards. `toggle` does not bubble; the listener runs in the capture phase.
- **Memory.** Personal blocks wear the highlighter tint (where you met the
  word); the learner's own sentences follow, then teacher corrections when the
  word has a usage trap, then `Goes with` / `Similar`.
- **The margin.** On a wide card (container query, 620px) the learner's note,
  tags, next recall, memory box and three plain text actions sit beside the
  reading column behind a hairline. On a phone they follow it.
- **No labels for their own sake.** No all-caps section labels and no nested
  white cards: type size, spacing and the highlighter carry the order. Actions
  are underlined text or plain text with hairline separators, not rows of
  ghost buttons.
- **Empty states keep the same order.** `No definition yet. Add a definition`,
  `Find a meaning`, `No example yet. Add an example`, then `More examples`.

## The wallet (`#/wallet`)

Words saved for later — typed here, or kept while reading — not a second
library. Nothing in it is studied or scheduled until the learner chooses.

- **What is kept.** `{ id, word, sentence, source, kind?, arabic?, added }` —
  the word, the sentence it was met in (optional when typed), where it came
  from (`kind: "meaning"` when tapped in a definition), the Arabic the word
  card showed (or the lookup after it was typed, Auto-fill on only), and the
  day. The id is the word, so it cannot be kept twice. At most 300.
- **Two ways in.** The save bar under the title — one field and `Save` in one
  frame that takes the accent only while typing; "Add where you met it" opens
  an optional sentence under it; Undo in the toast. Or, reading, tap a word in
  an example or a meaning → the word card → `Keep in wallet`.
- **The page (v13), built from the app's own parts.** `page-head` (h1 + hint,
  `Make all with AI` as the page's primary `.btn`); Today's add box
  (`quick-add` · `add-line` · `.field` + tonal `Save`); the Words search
  `.field` past six words; the library's `.word-list` frame. A row is set like
  a word row: the word 17px/600 left, its Arabic ink-2 at the right edge; the
  sentence in italic with the word highlighted; one meta line; then two
  actions as the app's buttons — tonal `Make with AI`, quiet `Auto-add`, an
  icon to remove (red on hover) — in a column on the right from 720px, one
  line along the bottom on phones; the speaker sits beside the word. Buttons keep the app's rounded rectangles; no pills.
  `Clear wallet` is a `danger-link`; empty is `.empty`.
- **Always reachable.** Desktop: `Wallet` is a labelled link in the top nav
  (app.js `NAV`, `barOnly`). Phones and tablets keep five tabs; the wallet is
  the top bar's icon beside Settings. Its count is the same yellow badge as
  Recall's. No strip on Today.
- **Counts in the bars.** Recall (due) and Wallet share one badge: the
  highlighter yellow with dark bold figures, a 2px paper ring where it sits on
  an icon.
- **No scrollbars.** The app draws none (`base.css`); scrolling is unchanged.
- **One focus ring per field.** `.field:focus-within` draws a single 2px accent
  ring over its own border (system.css); inputs inside it draw none.
- **Clean addresses.** The app lives at its folder (`/#/wallet`), never
  `index.html`: links point to `./`, the manifest uses `./#/…`, and arriving on
  `/index.html` rewrites the address in place (app.js `VS.cleanPath`).
- **Two doors.** `Make with AI` (tonal) opens Add → With AI with the word typed
  and its sentence carried into the prompt ("use THAT meaning"); the learner
  asks ChatGPT or Claude, pastes, checks, then adds. `Auto-add` (quiet) adds
  the word now, its sentence as "where you met it", and Auto-fill completes
  it in the background — edit it any time; Undo in the toast. With Auto-fill
  off it opens the filled-in Add form instead (nothing leaves the device).
  When the word joins the library — even as its base form — it leaves the wallet.
- **On Today.** *Saved for later*: one link with an accent tile carrying the
  count, the four newest words as chips (fading where the row runs out), and
  Open (the arrow alone on phones). Only while the wallet has words.
- **Loss is reversible.** Remove and Keep show Undo; Clear wallet asks in the
  app's own sheet and offers Undo. Reset progress keeps the wallet; Start over
  deletes it. Backup includes it; merge unions by id.

## Still being built, and feedback

- **The note** (`app.js devNote`): a `--note` band under the app bar on every
  browse screen — "VocabStudy is still being built" + WhatsApp + Email + hide.
  Hiding is remembered (`devNoteHidden` holds the note's id, so a new note can
  return after a big change). It steps aside in activities and never prints.
- **Feedback for good** (`VS.feedback`): Settings → *Help shape VocabStudy*
  keeps the same two buttons forever — WhatsApp (+20 114 304 4699, a greeting
  typed) and Gmail (nagdista@gmail.com, a subject typed). Nothing is sent
  until the learner sends it.

## The study card's body (v13)

The headword and its sound stay centred on a check card; everything under
them is ONE column (32rem, one left edge) under a hairline: where you met it
(or the example), then "Goes with" and "Similar" as label | chips rows with a
fixed 5.75rem label column (stacked under 420px). On Meet, the head is a
bilingual-dictionary row — the English word and sound left, the Arabic on the
right edge — with the definition under both (stacked under 480px).

## Share with (`#/share`, `#/shared`)

Send words to a friend; the friend opens them and learns them too
(docs/SHARE.md). The words travel inside the link's `#` part — no server,
no account; progress, notes and your own sentences are never sent.

- **Send** — four numbered steps (`.act-n`): Choose the words (starts from
  where you came: the Words filter, one word's page, or All/New/Learning/
  Mastered + a tag; a search; ticks; "12 of 40 chosen"), Say what it is
  (title, your name — kept as the `shareFrom` setting — a note), What goes
  (Arabic · definition and example · part of speech/level/IPA · where I met
  it, or Words only), Send (the phone's share sheet, Copy link, Copy message,
  QR code while the link fits one, Download a file). The link line says how
  long the link is and warns in `--note` past ~6,000 characters.
- **Receive** — the title as the heading, "From X · N words · K already
  yours", the friend's note in a `--note` panel, the words as full rows (word,
  Arabic, definition, example, where they met it, speaker; already-yours rows
  unticked and faded), a tag (the title), "Use their Arabic", then `Add N to
  my words` or `Save for later` (wallet, "Shared by X"). Done: `Learn them
  now` (`#/pick/cards?tag=…`), See them in Words, Share them on. A cut link
  opens a calm page that says what to ask for. First run waits: the shared
  words come before the level/dialect sheet.
- **Layout** — desktop: the words left, the steps right (380px); below 1024px
  one column and a bottom bar (on `<body>`, so the page's entrance transform
  can't pin it) that brings you to Send while it is out of sight. Phones:
  one action per line; the Arabic sits under the word.
- **Ways in** — Share beside Print & PDF on Words, "Share these words" in
  Manage, a share tool beside Edit and Delete on a word's page.

## A tapped word (the word card)

Any word in an example or an English meaning (word page, study cards, More
examples) is a quiet button. A tap opens **the word card** — a focus moment,
not a menu:

- **Focus.** The page dims (`--shadow-rgb` at .32, no blur); the tapped word
  is lifted above the dim in its own type with a 2px brand ring; the card
  sits beside it with a pointer, on the sheet layer (only toasts are above).
  Focus moves into the card and stays there (Tab cycles); Escape, a tap
  outside or a new screen closes it and returns focus to the word. The card
  follows its word every frame, so a card sliding in or a scroll never
  leaves the pointer behind.
- **Content.** The word and its speaker; then the Arabic, which loads by
  itself the moment the card opens (Google, then MyMemory; only that one word
  is sent, and only while Auto-fill is on). It sits in the app's `--note`
  panel: the app speaking, not the learner's memory. The main meaning is
  large IBM Plex Sans Arabic; under a hairline, one row per part of speech —
  the English label in a fixed left column, each Arabic term its own chip.
- **One choice.** `Keep in wallet` (tonal, full width). Nothing is kept on the
  tap itself. Already kept or already a library word → a plain state line.
- **States.** Waiting: two still bars (no loop). Offline, translation off,
  or no answer → one sentence, with Try again where it helps.

## Confirming a loss

The browser's `confirm()` is never used: it blocks the page, wears the
browser's voice and cannot be styled. `VS.confirm({ title, body,
confirmLabel })` returns a promise and renders the app's own sheet:
`role="alertdialog"`, the loss stated in one sentence, Cancel first with the
focus, and the action named in red (`btn-danger`). Escape or the backdrop
answers no. On phones it rises from the thumb edge like every other sheet; on
wide screens it is a small centred page.

## Starting over (`#/reset`)

This app has one copy of the learner's words: this browser. "Start over" is
therefore the only door out, and it is built as a receipt, not a red button in
a menu.

- **Two losses, two names.** *Reset progress* keeps words and settings and
  clears the schedule, streak and scores. *Start over* deletes the words,
  notes, answers, history, streak and settings, then returns to the first-run
  lesson. The Settings copy says which is which; the quiet red entry appears
  in both Settings and Backup & export.
- **A backup gate that is real.** The delete button unlocks only after a full
  backup has actually been saved from this screen (`VS.backup.save()` in
  `core/backup.js`, shared with Backup & export so the file and its name never
  drift). An older backup does not count: the learner may have added words
  since. Cancelling the save dialog leaves the gate locked and says "No backup
  saved. Nothing was deleted."
- **A typed word.** `RESET`, case-insensitive and trimmed, plus the saved
  backup. The button stays disabled until both are true, and a live hint names
  the missing step. Enter inside the field does nothing: the typed word
  unlocks, the button is the deliberate act. The reason is tied to the button
  with `aria-describedby`.
- **The receipt.** Four rows (words, notes, answers, settings) and one line
  saying the app and its restore path stay. On phones the rows are compact;
  the two exit actions go full width at ≤480px, with the safe exit outlined
  above the red one. From 481px they sit on one line, danger at the far end.
- **Landing.** Deletion clears the undo token and in-memory capture, applies
  the default accent and text size, replaces the history entry with `#/`, and
  lands on the first-run screen with the focus on `MAIN.view`; the toast says
  where the backup went, using the save method that actually succeeded.
- **Checked** at 320/360/390/520/768/1280 and 1.25×: no horizontal scroll, no
  clipped filename, and the gate behaves with mouse, touch and keyboard.

## The install invitation

A phone-only card above the tab bar, never a modal and never on the first-run
screen:

- **When.** At most once per visit, 3.5s after the library settles, and only
  when the learner has a word of their own. It stays away while Settings or a
  confirmation sheet is open, an update bar is waiting, a toast is showing or
  a word row is expanded; opening any of those hides it.
- **What.** Chromium gets the real `beforeinstallprompt` and an `Install app`
  button. iOS (including iPadOS reporting a Mac) gets the Share → Add to Home
  Screen steps with the share glyph; other browsers get the menu instruction.
  Both fall back to a single `Got it` button.
- **How it behaves.** It never takes focus. `Not now` (or the ×) snoozes it
  for 30 days in `installNudgeDismissed`; accepting the system prompt sets
  `installedNow`, and `appinstalled` removes the card. `standalone` hides it
  for good. Settings keeps a permanent install entry, so dismissing is never
  the end of the road.
- **Fit.** ≤700px, or a coarse pointer up to 1023px where the tab bar still
  exists. It is hidden on desktop and on fine-pointer windows wider than
  700px. At 320 the card is 296px wide; at 390 it is 366px; at 1.25× the text
  wraps without clipping and the bottom gap to the tab bar stays 11px.

## Motion (`assets/css/motion.css`)

Motion shows what just happened and is over in under a second. Four
durations and one easing, from `tokens.css`: `--fast` 140ms (hover, press),
`--base` 240ms (opening, leaving, answering), `--slow` 320ms (a screen
arriving), `--draw` 560ms (the highlighter and meters), all on `--ease`.
**Text you are about to read never fades in piece by piece** — the screen
lifts in once, and only marks that carry meaning draw. Nothing
animates layout: only opacity and transform move (the highlighter's
`background-size` and the mic's shadow are paint-only). No blur, no filters.

| Moment | Animation |
| --- | --- |
| A new screen | one 320ms lift and fade (`.view-enter`). Re-rendering the same screen drops the class first, so typing, filtering and answering never replay it |
| Home on arrival | streak chip pops, goal track fills; the chips are already still |
| First run | the headline and example word draw their highlighters; the six recall ticks arrive 50ms apart |
| A new quiz question | question and options fade in together (`q-fresh`) |
| A new spelling or recall card | card settles in (`spell-fresh`, `recall-fresh`); hints and the reveal animate on their own |
| A new word | highlighter draws in (560ms) |
| Study card answered | card flies right (know) / left (learning); swipe on phones |
| Right / wrong | pop / shake; the option's icon pops |
| Streak of right answers | combo pill pulses |
| Results | arrive with their screen; a perfect round gets highlighter confetti |
| Sheets, menus, opened rows | sheet lifts from the bottom edge, a menu scales from its trigger, a row body fades down |
| Charts and the progress ring | bars rise and the ring draws once from its base |
| Presses | options and tiles sink 1.5% while held, nav icons 6%; the hero arrow leans on hover |
| Speak | the mic pulses only while it is listening — the app's one loop |

`prefers-reduced-motion` sets every animation and transition to 1ms and every
delay to 0 (`base.css`), so nothing is still waiting to start after the screen
is already visible.

## Files

`tokens.css` → `base.css` → `components.css` → `views/*.css` → `motion.css`
→ `system.css` → `glass.css`. Screens combine components; they never restyle them.
`glass.css` is the one material layer: every rule is scoped to
`[data-accent="glass"]`, so no other accent matches it.
