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
| `--note` / `-soft` / `-line` / `-ink` | `#3b5b8c` / `#eef2f8` / `#c8d3e6` / `#22344f` | the app asking or warning: spelling checks, flags, status lines, milestones |
| `--good` / `--bad` | `#0f744f` / `#b3302f` | right / wrong (≥ 5:1 on their soft fills) |
| `--lvl-a/b/c` | teal / blue / violet | CEFR level badges |
| `--photo-frame` / `-line` / `--photo-ink` / `--photo-ink-2` | `#ffffff` / `#e1e5ec` / `#141b2d` / `#465066` | a photograph's paper frame and caption; fixed in both themes, like a real print |

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

**Shape (v20):** one rectangular family, three sizes — **6px** (`--r-sm`) for
tags, counts, badges and chips; **8px** (`--r-md`) for controls: buttons,
fields, segmented controls, speaker squares, tab highlights, the toast;
**12px** (`--r-lg`) for surfaces: cards, sheets, dialogs, the wallet pocket.
`--r-pill` is only for true circles — the microphone, accent swatches and
rings. Nothing that carries text is a pill; the Add action is a 16px rounded
square. The desk is paper and index cards, not bubbles.

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
  block, today's plan and its practice chips, the primary actions
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
| "Top 3,000" | how common the word is — a quiet label, no meter | word list, word details, card front |
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
practice chips as white cards. Under Glass the card itself is clear glass
instead of a tint. Under it, a slim capture bar:
type a word and a highlighter band draws under exactly what you typed (its
width is measured in `views/library.js`) — you are marking the word to keep.

`.mark` draws the same highlighter band behind a word. It appears on every new word
(cards, recall, quiz feedback) and draws itself in (`motion.css → mark-draw`).

## First run (empty library)

The empty library is the first lesson, not an empty state: three acts read
top to bottom — one action, the artifact it produces, then the schedule that
keeps it.

- **A desk before the lesson.** A photograph of a real page being written
  (hands, coffee, a notebook) runs as a wide band above both columns, then
  the lesson begins. It is a print on a paper frame with a caption in the
  teacher's voice, not decoration; the form is still the first thing after
  the headline. On a phone the band is 132–190px tall, so the field stays in
  the first viewport at 320px.
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
- **Trust.** The footer is a colophon: the V mark and wordmark, the
  local-first promise, "Made by Nagdista", and the Arabic About page. The
  example speaker is omitted when speech is unavailable.

## The desk, photographed (`assets/css/photos.css`)

Three photographs carry the identity into the places text alone was doing
all the work. They are prints on the same desk, not stock decoration:

| Print | Where | Its job |
| --- | --- | --- |
| `desk-writing.webp` | first run, 3:1 band | show the physical act the app is for: a word written by hand |
| `wallet-page.webp` | empty wallet | an empty page waiting for the first kept word |
| `library-aisle.webp` | about.html, full width | where the words come from |

- **The frame is paper.** 8px white mat, one hairline, the app's 12px
  corner, a short shadow. It stays white in Night, because a print is a
  physical object on the desk; its caption uses the fixed `--photo-ink*`
  tokens so it never turns pale on white.
- **One caption voice.** A bold phrase, then one quiet sentence. The
  highlighter may mark one word in the phrase, never the whole caption.
- **Bundled, not hotlinked.** Webp files live in `assets/img`, are listed in
  the service worker and in `tools/build.py`, and have intrinsic
  width/height on the `<img>` so the frame never shifts. The local-first
  promise holds offline.
- **Credit is quiet.** The photographers are named once in the about.html
  footer and in the README, never on the working screens.

## The About page (`about.html`)

The only Arabic-first surface, and a static one (`assets/css/about.css`, no app
JS). It keeps the same desk without imitating an app screen:

- Sticky paper header with the brand centred on its own row and the section
  nav centred under it — no CTA competing with the logo. Then a two-column
  hero: the claim on one side, a CSS-drawn mini home screen on the other. The
  preview is decorative (`aria-hidden`, no focusables), so it can never drift
  from the real UI the way a screenshot would.
- Between the teacher and privacy sections, a full-width photograph of a
  library aisle in a paper frame, captioned "كل كلمة ليها مكان." It is the
  page's one atmospheric breath, and the only place the app's photography is
  wide rather than a detail. Photographers are credited in the footer.
- Numbered step cards, a six-tick review ruler, a pair of teacher specimens
  (trap + checked sentence), a hairline feature list, a split privacy card,
  three install cards, native `<details>` FAQ and a tinted final CTA.
- Arabic headings use IBM Plex Sans Arabic; Bricolage has no Arabic glyphs.
  English UI labels are isolated LTR islands, and tap sequences use the Arabic
  word "ثم" instead of a bidi arrow.
- Phones: one column, 16px gutters, header keeps the centred brand and the
  three section links under it. The header never overflows at 320px.
- Tablets get two step cards plus a wide third; desktop splits the hero,
  teacher, privacy and final. The privacy online list becomes two columns at
  ≥1024px.
- Every section anchor clears the taller sticky header
  (`scroll-margin-top: 120px`). No horizontal scroll at 320 or at 1.25× text;
  the ruler stays six ticks.

## Layout

- Content max 1120px; activities max 720px — one task, centred. The study
  card and its answer bar cap at 660px so the activity header, the card and
  the bar share one edge.
- 4px spacing grid (`--s-1` … `--s-8`).
- App bar: 56px on phones, 64px from 600px; opaque paper with a 1px line
  (under Glass: blurred glass). Desktop navigation lives in the bar; ≤1023px
  uses the bottom tab bar (Today, Words, Add, Recall, Wallet) so the thumb
  reaches every destination, with Add raised in the centre and Progress in
  More. The phone bar keeps the
  brand, one community button (icon only under 360px) and one More button;
  Share and Settings moved into More, and the tagline waits for 1200px.
- **Today and Words are two pages** (v10 final): Today (#/) is the plan, the
  add box (which saves to the wallet for later) and the newest five words with
  "All N words →"; Words (#/words) is the whole library — title, search, status
  chips, filters, the list. Every review found the plan and the library crowded
  together on one phone screen.
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
  bar; 12px radius, one border, one shadow, no nested card. At 375px it is one
  column and the fixed answer bar never covers the foot.
- **Front, Arabic → English.** Arabic at display size, definition below it,
  then the foot asking for the English out loud before the flip.
- **Front, English → meaning.** The marked word, its sense, and pronunciation
  as one unit: square speaker + IPA. With no IPA the speaker stands bare — an
  empty frame would read as missing data. Foot: "Tap to see the meaning".
- **Back.** The answer (the English word when the front was Arabic; the Arabic
  meaning when the front was English), the memory sentence in its yellow
  band, the example, then "Goes with" / "Similar" as chips. Foot: "Say it once
  in a sentence".
- **Meet.** The same bands, read left-aligned like a dictionary entry: word,
  sound, meaning, a labelled **Example** block, then a separate **Related
  words** group with "Goes with" and "Similar" on their own rows, and the
  wallet hint. The Arabic meaning is capped smaller than the English headword
  (about 1.65rem before the Arabic scale). Nothing is hidden, nothing is
  graded, and the card does not flip. From 600px the one next step stays
  visible in a sticky bar under the card.
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
- Word rows are three fixed lines: the headword with its muted `(sense)` on
  the first, a one-line ellipsised example on the second, status · type ·
  level · frequency on the third. A visible 44px delete sits at the end, a
  sibling of the row button. The headword never gives way to its sense — the
  sense clips first — so rows keep the same height at 320 and at 1280. The
  Arabic is deliberately absent (v16): it is the reward for opening the word
  card, not a label in the list. The same rule holds for "Just added" rows on
  Add.
- Week strips shorten "Today" to "Now" at ≤360px so seven labels never collide;
  charts use the same 2xs labels.

## The word page (a dialog over the list)

A word row opens the whole word in one native `<dialog>`; the row itself stays
in place underneath. The page behind is inert, keeps its scroll, and dims
under a plain scrim. On a computer the dialog is a centred 760px page
(max 88dvh); on a phone it rises from the bottom as a 92dvh sheet with rounded
top corners and safe-area padding. Opening puts focus on the dialog; Esc, the
close button and the backdrop close it; focus returns to the row that asked.

- **A cream head, white chapters.** The status line, hero and the learner's own
  paper blocks share one cream tint. The chapters between them stay white, and
  a single hairline divides chapters — no boxes, no stacked cards.
- **Hero.** The headword in the spelling face (`--font-word`), letter by
  letter, with one highlighter swipe under it; the speaker sits beside it. The
  IPA follows, then type · level · frequency as one quiet line without chips.
  Under it, the `In Arabic · مثلاً` line starts on the left: a quiet label, a
  hairline dot, then the Arabic at `--ink-2` in its own face. The two languages
  are separated by whitespace, not a rule.
- **Tags and actions.** Tags are plain `#hashtags` with a dotted underline;
  `Edit`, `Share` and `Delete` are three equal text actions (icon + word,
  44px) with no fills. Delete turns red only on hover/focus.
- **Bilingual chapter heads.** `Meaning · المعنى`, `In context · في السياق`,
  `Memory · الذاكرة`, `Your sentences · جُملك`, `Good to know · للمعرفة`. The
  English title uses the display face; the Arabic gloss is small and quiet.
- **Meaning and the example.** The definition is the largest reading text.
  `Other meanings` is a quiet brand link. The example is a serif italic pull
  quote without a bar; one quiet row under it holds `Hear it` and
  `More examples`. More examples open in the same chapter with a thin rule at
  the start, each with its own speaker, and end with the Tatoeba credit.
- **Paper for what the learner owns.** `In context`, `Memory` and `My note`
  share the same cream paper. The note is a ruled line, not a grey input inside
  a card, and saves when it loses focus. `Your sentences` lists their own lines
  with a quiet remove; `Write a sentence` is a brand-coloured underlined link.
- **Memory.** A memory hook, when the AI wrote one, is a paper note at the top
  of this chapter: the bulb in the margin, a quiet label, and the sentence in
  the learner's language. Under it, a six-stop ruler (1 · 3 · 7 · 14 · 30 · 60)
  drawn as circles on a connecting line: past stops are soft yellow, the
  reached day is solid, the days ahead are quiet. `Next recall today` and
  `right · wrong` sit above and below it; `Reset to new` is a quiet icon at
  the end, with Undo.
- **Good to know.** Mistakes, sounds and related words. A mistake written for
  this meaning comes first under `Mistake to avoid`; a trap may show only the
  rule when that is all the AI knew. Related words are read, not pressed:
  `Goes with`, `Similar` and `Opposite` are three fixed-label rows with a
  hairline between them, their words separated by middots. The dot follows its
  word, so a wrapped line never starts with one. The block becomes two columns
  at a 620px container; on a phone it stays one.
- **Words inside the text.** Every English word in a definition, example or
  context is dotted-underlined at rest; a tap opens the small word card inside
  the dialog — Arabic senses, speaker, and `Keep in wallet` — without leaving
  the word. Esc closes that card first, then the page.
- **One page at a time.** Opening another word replaces the dialog's contents;
  leaving the route, following a tag or Share closes it before the next screen
  is drawn. Native modal behavior keeps Tab inside; a small handler closes the
  reverse-Tab gap so Shift+Tab from the first control reaches the note.
- **Nothing is removed without a yes.** Delete a word, Reset to new, remove a
  sentence: each asks in the app's confirm sheet, Cancel holds focus, and the
  toast's Undo restores the word with its progress and note.
- **Night and motion.** The cream head becomes `--surface-2` at night; the
  highlighter becomes a solid band with dark ink. The sheet animates only
  transform (`card-rise` / `card-up`), never opacity; reduced motion turns the
  entrance off and forced colors keep every control legible.
- **Empty states keep the same order.** `No definition yet. Add a definition`,
  `Find a meaning`, `No example yet. Add an example`, then `More examples`.

## Add words with AI (`#/add`, the With AI tab)

Four numbered steps: your words → ask the AI → paste its answer → check and
add. The ask row is the same component in both AI places (`VS.aiAsk`): three
provider cards — ChatGPT with the OpenAI knot, Claude with its starburst, and
`Copy prompt` for Gemini or any chat. Each mark sits in its own soft tile
(mint for ChatGPT, terracotta for Claude; both lighten at night); at 480px the
provider cards lose their second line, under 720px they become two cards with
Copy full width.

**One card per meaning.** The prompt asks for complete cards, not a word and a
translation. A lone word with no context may come back with up to four blocks —
`play` = يلعب (games and sport) and `play` = يعزف (music) are two cards — but a
sentence, an Arabic meaning or a sense label locks the answer to exactly one
meaning. Several typed words get one block each (two only for a very common
second meaning); a topic gets one per word; Arabic gets one per item. Every
block carries the same lines: `word`, `sense`, `arabic`, `definition`,
`example`, `type`, `level`, `ipa`, `synonyms`, `antonyms`, `goes with`,
`memory`, and a `wrong` / `right` / `why` mistake. `sense` is required — two to
four English words naming this meaning, never just a part of speech — and the
parser derives one from the definition when an answer still leaves it out, so
the muted label beside a headword is never blank. The AI is never asked for
tags and the parser ignores any it volunteers; tags belong to the learner
alone. A dash (`—`) means "nothing honest to say", never an empty field to fill
with invention.

**Checking the answer.** The answer lands as a numbered card per meaning, with
the sense label beside the headword and type · level · IPA underneath. A sticky
toolbar above the cards carries the learner's `Tags for this batch` and the
ready count; the cards themselves start closed as `<details>`, so ten words are
ten quiet lines instead of a wall of fields. Opening one shows the meaning
first — Arabic, sense, definition, example — then type, level, IPA, and
`More of the card`: similar, opposite, word partners, memory hook, and a boxed
`Mistake to avoid` with Wrong / Right / Why. `Add N words` waits in a bar fixed
above the phone tab bar, so it never scrolls with the cards; on a wide screen
the toolbar carries the same action. Each card has one checkbox outside its
`<details>`, so ticking it never opens the card; its status chip says
**Ready**, **Another meaning**, **Needs Arabic**, **In your library** or
**Repeated**. A word already kept with another Arabic meaning says **Another
meaning** and keeps its fields; a duplicate of the same headword and the same
Arabic says **In your library** and folds them away. The sense label names a
meaning, but the Arabic is what decides whether two cards are the same word.

**Copy is never a dead end.** `Copy prompt` uses the Clipboard API, falls back
to the old selection trick, and if the browser blocks both, opens a sheet with
the prompt already selected plus `Try again`. It never writes the prompt into
the learner's answer box. In Edit, a parsed answer fills the fields, closes the
AI panel and puts focus on the first filled field so Save is in reach.

## The wallet (`#/wallet`)

Words saved for later — typed here, or kept while reading — not a second
library. Nothing in it is studied or scheduled until the learner chooses.

- **What is kept.** `{ id, word, sentence, source, kind?, arabic?, folder,
  added }` — the word, the sentence it was met in (optional when typed), where
  it came from (`kind: "meaning"` when tapped in a definition), the Arabic the
  learner typed or the word card showed (or the lookup after an English word was
  typed, Auto-fill on and online only), its folder, and the day. The id is the
  word, so it cannot be kept twice. At most 300.
- **Folders (v19).** `state.walletFolders` is `[{ id, name }]`, built-ins first:
  `general` → **General** (quick saves), `shared` → **Shared** (a friend's
  words). Both can be renamed, not deleted; a custom folder can be created,
  renamed and deleted (its words move to General). Names are trimmed,
  whitespace-collapsed, 40 characters, unique ignoring case; "All" is reserved
  and the cap is 50. Every entry carries a folder id. Old saves migrate by
  `kind === "shared"`; unknown ids fall back the same way. The chosen folder
  lives in the address (`#/wallet?folder=film`), so a refresh or a link keeps
  it. Chips are the filing tabs: **All**, every folder with its count, then
  **New folder**. Header, pocket, search, bulk AI, empty states and **Clear**
  all follow the selected folder; the tab badge stays the whole wallet.
- **Three ways in.** The pocket's capture line — one field and `Save`, English
  or Arabic. Arabic is saved exactly as typed, with no lookup and no English
  first: the slip is Arabic until the learner chooses it, and `Make with AI` or
  `Add now` carries it to Add → From Arabic, where the English is filled in
  next. English is looked up only when Auto-fill is on. "Add where you met it"
  opens an optional sentence under it; Undo in the toast. Or, reading, tap a
  word in an example or a meaning → the word card → `Keep in wallet`. Or a
  friend shares a list (`#/shared`) and the learner chooses **Save for later**
  (Shared).
- **The page (v20): a pocket of filed cards.** Two columns from 900px — a
  340px sticky pocket and the slips it holds — and one column on tablets and
  phones, pocket first. The pocket is a card with two stacked slip edges
  peeking above it (`wallet-pocket-edge`), so it reads as a place words go, not
  a toolbar. It holds "Keep a word", the saved count, the capture line and, in
  its foot, the bulk AI action as a tonal button — never the page's primary
  action. Slips are loose index cards, not the library's bound `.word-list`:
  a plain tabular index number (`01`) in the margin, the word at 17px/700 with
  a square speaker, the Arabic behind a small **TRANSLATION** label, the
  sentence set as a serif margin quote with the word marked, then one meta line
  (folder tag as a quiet text button · where it came from · saved when).
  There is no footer rule: Make with AI, Add now and a quiet remove sit on
  spacing alone, and the slip is one continuous card. On a phone the
  doors keep their words and drop their icons. The folder tag opens the move
  sheet; moving, removing and clearing offer Undo. Empty is `.empty` with a
  quiet wallet tile. Tokens only, 13px text floor, 44px targets, Light and
  Night.
- **Clear (v20).** A footer row under the slips, not a floating red link: a
  quiet line on the start ("Saved on this device, inside your backup") and, on
  the end, `Clear wallet` / `Clear folder` as a bordered `btn-danger-quiet`
  with a trash icon. It is the page's one danger door, so it looks like a
  button — tinted `--bad`, 8px radius, 44px on touch, a `--bad-soft` hover —
  and never like an alarm. It asks in the app's own confirm sheet, names the
  scope in the title and clears only what is on screen.
- **Always reachable.** Desktop: `Wallet` is a labelled link in the top nav
  (app.js `NAV`). Phones and tablets: Wallet is the fifth bottom tab, at the
  end after Recall, and Progress moved into More; the wallet no longer has a
  top-bar icon. Its count is the same yellow badge as Recall's.
- **Counts in the bars.** Recall (due) and Wallet share one badge: the
  highlighter yellow with dark bold figures, a 2px paper ring where it sits on
  an icon.
- **No scrollbars.** The app draws none (`base.css`); scrolling is unchanged.
- **One focus ring per field.** `.field:focus-within` draws a single 2px accent
  ring over its own border (system.css); inputs inside it draw none.
- **Clean addresses.** The app lives at its folder (`/#/wallet`), never
  `index.html`: links point to `./`, the manifest uses `./#/…`, and arriving on
  `/index.html` rewrites the address in place (app.js `VS.cleanPath`).
- **Two doors.** `Make with AI` (tonal) opens Add → With AI with the word typed,
  its sentence and its Arabic carried into the prompt ("use THAT meaning"); the
  learner asks ChatGPT or Claude, pastes, checks, then adds. `Add now` (quiet)
  adds the word to the library now, its sentence as "where you met it", its
  Arabic kept, and Auto-fill completes the rest in the background — edit it any
  time; Undo in the toast. With Auto-fill off it opens the filled-in Add form
  instead (nothing leaves the device). When the word joins the library — even as
  its base form — it leaves the wallet. **Make all with AI** works on the
  selected folder (up to 30), suggests the folder name as the batch tag, and a
  successful add offers **Study** for that tag.
- **On Today.** The compact box under the plan saves to the wallet's **General**
  folder, not the library: placeholder `Save a word or phrase`, button `Save`,
  and one quiet note under it — `English or Arabic · saves to General`, plus
  `N in your wallet →` while the wallet has words. A pasted English sentence
  (5+ words) still opens Add → From text, and Arabic is checked before that
  route. The first-run box still creates the first library word: its example
  card is the promise that screen is making. The learner decides in the wallet
  when a kept word becomes a library word.
- **Loss is reversible.** Remove, move and Keep show Undo; Clear wallet (or
  Clear folder) asks in the app's own sheet and offers Undo. Reset progress
  keeps the wallet and its folders; Start over deletes the wallet and returns
  to General + Shared. Backup includes the wallet and its folders; merge joins
  folders by id then name, remaps entries and unions by word.

## The wordmark

`VocabStudy` beside the brand mark — nothing else. The bar keeps its room for
the destinations; the name is the whole lockup in the app bar and on the About
page.

## The app bar on desktop (≥1024px)

Two groups: the wordmark on the left; on the right the destinations, a hairline,
then Settings. No breadcrumbs in the bar (the highlighted link and the page
title say where you are; phones never showed them). From 1024 to 1199px the
nav keeps its words and drops its icons, so the wordmark always has room.

## Feedback

There is no floating development note: the app is finished enough to live
without one. Feedback lives in Settings → *Help shape VocabStudy* as the same
two buttons — WhatsApp (+20 114 304 4699, a greeting typed) and Gmail
(nagdista@gmail.com, a subject typed). Nothing is sent until the learner
sends it.

## The study card (v14)

The card is a page from the same notebook as the word card: cream paper, a
dark hairline, an index line at the top and a dashed fold at the foot. The
index line says which side you are on (`Front · العربية`, `Back · English`,
`Meet · أول لقاء`) and then type, level and frequency as one typographic run
— never three chips. Everything under the headword is ONE left-aligned
column under a hairline: where you met it (or the example) as a serif italic
margin quote with a highlighter rule, then "Goes with" and "Similar" as
label | words rows with a fixed 5.75rem label column (stacked under 420px).
The example is a pull quote, not a grey panel; word partners are separated
by middots, not pills. On Meet, the head is a bilingual-dictionary row — the
English word and sound left, the Arabic on the right edge — with the
definition under both (stacked under 480px).

## The end of a round (results)

A page, not a dashboard: one left-aligned editorial column, a quiet
`Round finished` kicker, the title in a highlighter, then the score as a
ruled tally across the page (label above value, hairline between columns)
instead of three floating stat boxes. The teacher's line is a margin note;
"Moving forward" is a ruled list on the page, not a stack of cards. Actions
sit left, primary first. "Words to look at again" uses the same tray as the
word list. On phones the tally keeps three columns and the actions become a
full-width primary over two secondary buttons.

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

## Share VocabStudy itself (v15)

A separate, faster flow from sending words: the whole app, in one message.

- **Where.** A share mark sits in the desktop app bar beside Settings; on
  phones and tablets it is a row in More. Two taps from anywhere open the
  sheet. Today no longer carries an invitation card (v16): the home screen is
  the plan, not a billboard.
- **What it says.** The message is built from the learner's chosen dialect
  (Egyptian, Gulf, Levantine, Maghrebi, Iraqi, Yemeni, and a simple MSA
  fallback) and stays simple enough for any Arabic reader: free, no account,
  works offline, keeps the words you meet and brings them back on the right
  days; then `https://vocabstudy.nagdista.com/`. It is not a translation of an
  English pitch.
- **How it sends.** The phone's native sheet first when the browser supports
  it, then WhatsApp, Telegram, X, Facebook, LinkedIn, Email and SMS as plain
  links, plus Copy message and Copy link. A preview of the exact message sits
  above the channels; the URL is its own LTR run, so its trailing slash never
  jumps to the front of the Arabic line.
- **Nothing to measure.** No tracking pixel, no third-party script and no
  learner data in the link — the URL is only the app.

## The community door (v16)

One URL, several handles, no network call: `VS.COMMUNITY_URL` in `app.js`,
and the identical literal in the static About page (which has no app JS).
It opens `https://chat.whatsapp.com/EHuPYovOMIvCGPRdAZ28kT` in a new tab.

- **Top bar.** A labelled WhatsApp door sits beside the brand on every browse
  screen. Under 360px it keeps the 44px target and drops the word, so the bar
  still fits at 320. It is a door, not a destination: paper, a brand-coloured
  mark, no green fill.
- **More.** The first row of the phone menu, the only tinted one, with
  "Updates, ideas and app talk on WhatsApp" and an external arrow.
- **Elsewhere.** Settings → Help shape VocabStudy, one quiet line under the
  share sheet's channels, and a CTA on the Arabic About page. The community
  never becomes a nav destination and never floats over the page.

## The phone menu and the bottom bar (v16)

The phone chrome is now one community door, one More button, and four
destinations plus one action.

- **Top bar.** Brand, community button, More. Share and Settings left the phone
  bar for More; the wallet icon is gone because Wallet is a tab. The tagline
  is hidden below 1200px. The bar keeps its right gutter at 320–430px.
- **More** is a native `<dialog class="sheet more-sheet">` created lazily by
  `app.js`: a pinned head, the tinted community row, then Progress, Share
  VocabStudy, Settings and About. Choosing a row closes More before opening
  its sheet or screen; the backdrop, the × and Escape also close it, and
  focus returns to More. It is a bottom sheet on phones and a centred 420px
  sheet from 600px.
- **Bottom bar.** Five even `1fr` columns: Today, Words, the raised Add,
  Recall, Wallet. Add is a 54px ink rounded square that rises 13px above the
  edge, with a 4px surface ring. The plus is the whole label — the word under it
  was noise — so the link carries `aria-label="Add words"` and the four
  destinations keep their words. The order keeps the four destinations'
  relative order and puts the one action in the thumb's centre; desktop
  keeps its own labelled order (Today, Words, Recall, Progress, Wallet, Add).
  Progress is not a fifth destination: it lives in More on phones and tablets
  and in the desktop bar. The bar is 69px with safe-area padding;
  `--tab-clear` (94px) gives browse pages, toasts and the break card room for
  the raised Add square.
- **Motion.** A real tab switch settles the new current-tab block once (140ms,
  0.84 → 1); a due or wallet count that changed pops once. There is no
  sliding indicator between tabs. Re-renders that keep the same place do not
  replay either.
- **Focus.** More focuses the dialog itself, not a row, so opening it is
  quiet; the sheet suppresses its own focus outline because the sheet edge
  and scrim already show where focus went.

## Mixed direction and the AI hand-off (v15)

Arabic and English share almost every screen, so direction is explicit instead
of guessed. Every Arabic display carries `lang="ar" dir="rtl"`. Every mixed
line (context, example, memory hook, note, learner sentence, wallet sentence,
AI context) asks `VS.ui.textDir()` for its paragraph direction — taken from
the first letter — and renders through `VS.ui.mixed()`, which wraps each
detected run in an isolating `<bdi>`, including Arabic punctuation and digits.
On an Arabic-first line `mixed()` also wraps the English runs in
`<bdi dir="ltr">`; `dir="auto"` alone misreads such a line because the Arabic
run is itself isolated, so the auto scan never sees the first Arabic letter.
`.ar-chip` is `unicode-bidi: isolate`. The result is that an Arabic phrase
inside an English sentence keeps its order at 320px and in Night.

The AI open is synchronous on purpose: the clipboard write starts while the
tap still has focus, the chat opens in the same turn with the prompt in the
URL, and the "Your prompt" sheet is kept only for the case that actually needs
it — a prompt too long for the URL whose copy also failed. A prompt already in
the chat never hides behind a dialog.

The quiet-Arabic rule holds across the new work: Arabic is `--ink-2` on the
word page and `--ink-3` in list rows, never bolder than the English it
supports; a sense is always lower-case, muted and in parentheses beside its
headword.

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
`role="alertdialog"`, a red trash mark in a soft tile, the loss stated in one
sentence, Cancel first with the focus, and the action named in red
(`btn-danger`). Escape or the backdrop answers no. On phones it rises from
the thumb edge like every other sheet; on wide screens it is a small centred
page.

## The profile chip

Who the AI writes for is a small bookplate, not a settings row: a soft
`--brand` tile with the CEFR level (`B1`), "Written for Intermediate · مصري",
and an underlined Change. The level tile is information, not an action, so
it never uses the highlighter; the dialect keeps its Arabic face and RTL
isolation. On a narrow screen the text ellipses but the level and Change
stay whole, and the whole chip is one ≥44px target.

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

A phone-and-tablet modal sheet above the tab bar. It is the one decision on
screen, so the page behind it dims and waits:

- **When.** Every visit, 3.5s after a browse screen settles, while the app is
  open in a browser. It stays away during an activity, while Settings or a
  confirmation sheet is open, while an update bar or toast is showing, and
  while the learner is typing. Opening any of those hides it for that visit.
- **What.** Chromium gets the real `beforeinstallprompt` and an `Install app`
  button. iOS (including iPadOS reporting a Mac) gets the Share → Add to Home
  Screen steps; other browsers get the menu instruction and a `Got it`
  button. The sheet wears the brand mark, not a generic download glyph.
- **How it behaves.** It is a native `<dialog>` shown with `showModal()`: the
  page behind is inert under a `::backdrop` dim, focus is inside the sheet, a
  tap on the dimmed page or Escape puts it away, and `Not now` does the same
  for this visit only — there is no stored snooze, so the next launch asks
  again. Accepting the system prompt sets `installedNow`; `appinstalled` and
  `standalone` end the invitation for good. Settings keeps a permanent
  install entry.
- **Fit.** ≤700px, or a coarse pointer up to 1023px where the tab bar still
  exists. It is hidden on desktop and on fine-pointer windows wider than
  700px. At 320 the sheet is 296px wide; at 390 it is 366px; at 1.25× the text
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
| Practise / Manage opens | the page and the app bar dim behind one scrim; the menu is the only paper in the light |
| An AI answer arrives | its closed rows cascade 24ms apart; opening one fades its fields down |
| A word is deleted | the row fades out for 170ms before the list closes the gap |
| The share sheet | the same bottom-edge arrival as every other sheet |
| Charts and the progress ring | bars rise and the ring draws once from its base |
| A tab switch | the new current-tab block settles once (140ms, 0.84 → 1); a due or wallet count that changed pops once; no sliding indicator |
| Presses | options and tiles sink 1.5% while held, nav icons 6%, the raised Add 8%; the hero arrow leans on hover |
| Speak | the mic pulses only while it is listening — the app's one loop |

The screen entrance (`.view-enter`) runs `view-in` with no fill mode. `both`
would leave the final transform on `.page`, create a stacking context and trap
the fixed Practise / Manage scrim below the app bar and tab bar. A future
entrance that needs a fill uses `backwards`, never `both`.

`prefers-reduced-motion` sets every animation and transition to 1ms and every
delay to 0 (`base.css`), so nothing is still waiting to start after the screen
is already visible.

## Files

`tokens.css` → `base.css` → `components.css` → `views/*.css` → `motion.css`
→ `system.css` → `glass.css`. Screens combine components; they never restyle them.
`glass.css` is the one material layer: every rule is scoped to
`[data-accent="glass"]`, so no other accent matches it.
