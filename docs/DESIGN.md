# Design

## Direction: "Study desk"

The learner is an adult (B1–C1 words) who may study for **six hours a day**.
Everything serves long, focused sessions:

- **Light only.** A bright, calm page keeps attention up; no dark mode to maintain.
- **One action accent at a time** — ink blue by default, plus five alternates in
  Settings → Look (teal, violet, rose, plum, cocoa) — and **one for memory**
  (highlighter yellow). All six pass AA on their soft tints.
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
| accent sets | teal `#0a6f6a`, violet `#6a3fc4`, rose `#b8325f`, plum `#8a2f6b`, cocoa `#7a4a2b` | optional action colours; each brings its own hover and soft tint |
| `--mark` | `#ffe066` | the highlighter: words being learned, due counts, rewards |
| `--good` / `--bad` | `#0f744f` / `#b3302f` | right / wrong (≥ 5:1 on their soft fills) |
| `--lvl-a/b/c` | teal / blue / violet | CEFR level badges |

## Type

| Role | Font | Why |
| --- | --- | --- |
| Words being learned, all body text | Atkinson Hyperlegible Next | Look-alike letters (l I 1, rn m, O 0) can't be confused |
| Screen headings | Bricolage Grotesque | Characterful at large sizes; never the word being learned |
| Arabic | IBM Plex Sans Arabic | Set a step larger than the English, which looks the same size |
| IPA | Charis SIL | A dictionary face with full IPA coverage |

Scale: tuned for phones — 12 / 13 / 15 / 17 / 20 / 24 / 30 / 32–48px.
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

## The signature

Home opens with one tinted paper index card, never a dark block. Its tint is
the chosen action accent (`--brand-soft`), so the hero belongs to the same ink
as every button: the next action in a sentence, the count in a solid
highlighter chip ("**9 words** to recall."), one solid brand CTA with a white
label, and the practice chips as white pills. Under it, a slim capture bar:
type a word and a highlighter band draws under exactly what you typed (its
width is measured in `views/library.js`) — you are marking the word to keep.

`.mark` draws the same highlighter band behind a word. It appears on every new word
(cards, recall, quiz feedback) and draws itself in (`motion.css → mark-draw`).

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
- Phones: one column, 16px gutters, header keeps only brand + CTA. Tablets get
  two step cards plus a wide third; desktop splits the hero, teacher, privacy
  and final. The privacy online list becomes two columns at ≥1024px.
- Every section anchor clears the sticky header (`scroll-margin-top: 84px`).
  No horizontal scroll at 320 or at 1.25× text; the ruler stays six ticks.

## Layout

- Content max 1120px; activities max 720px — one task, centred.
- 4px spacing grid (`--s-1` … `--s-8`).
- App bar: 56px on phones, 64px from 1024px; opaque paper, 1px line. Desktop
  navigation lives in the bar; ≤1023px uses the bottom tab bar (Today, Recall,
  Progress, Add) so the thumb reaches every destination.
- Activities ≤1023px hide the app bar and show their own header: exit, title,
  scope, count, 4px progress. Print stays a browse screen and keeps the tab bar.
- Phones (≤ 640px): answer buttons sit in a fixed opaque bar under the thumb;
  options stack. Print swaps that bar for Download PDF + an icon-only Print,
  fixed above the tab bar.
- Add is two columns from 1024px: form left, a 380px Latest words column right.
- Touch targets ≥ 44px (`--tap`) on every touch screen — one block in
  `components.css` ("Touch screens") sets it for every component.

## Phones first

Most learning happens on a phone, one-handed, by learners of every age.
Checked at 320, 360, 390, 768 and 1280px at Normal and Larger (1.25×) text,
with 22-letter words and long Arabic meanings:

- Nothing scrolls sideways. An input never widens its page (`.field` and
  `.add-line .field` have `min-width: 0`).
- Every control ≥ 44px; the hero CTA 48px, tab links 54px tall.
- Meta lines, tab labels and badge counts use 12px (`--text-2xs`); every other
  line is 13px or larger at Normal.
- Every form field is 16px or more on touch screens, or iPhone zooms the page.
- Textareas never resize by hand; they grow with the text.
- Choices never hide off-screen: the status filter scrolls with an edge fade,
  and its sheet drops to one column when a select needs the width.
- Word rows keep status, type, level and frequency on the collapsed line; tags
  wait in the expanded row. A long word stacks its Arabic underneath on phones
  instead of squeezing both.
- Week strips shorten "Today" to "Now" at ≤360px so seven labels never collide;
  charts use the same 2xs labels.

## Motion (`assets/css/motion.css`)

Motion shows what just happened and is over in under a second. Nothing
animates layout: only opacity and transform move (the highlighter's
`background-size` and the mic's shadow are paint-only). No blur, no filters.

| Moment | Animation |
| --- | --- |
| A new screen | one 320ms lift and fade (`.view-enter`). Re-rendering the same screen drops the class first, so typing, filtering and answering never replay it |
| Home on arrival | streak chip pops, goal track fills, practice chips rise in an 80–200ms cascade |
| Recent words, week dots, stat tiles | a short rise / dot cascade, only on arrival |
| A new quiz question | card and options rise in reading order (`q-fresh`) |
| A new spelling or recall card | card settles in (`spell-fresh`, `recall-fresh`); hints and the reveal animate on their own |
| A new word | highlighter draws in (560ms) |
| Study card answered | card flies right (know) / left (learning); swipe on phones |
| Right / wrong | pop / shake; the option's icon pops |
| Streak of right answers | combo pill pulses |
| Results | stats arrive in order; a perfect round gets highlighter confetti |
| Sheets, menus, opened rows | sheet lifts from the bottom edge, a menu scales from its trigger, a row body fades down |
| Charts and the progress ring | bars rise and the ring draws once from its base |
| Presses | options and tiles sink 1.5% while held, nav icons 6%; the hero arrow leans on hover |
| Speak | the mic pulses only while it is listening — the app's one loop |

`prefers-reduced-motion` sets every animation and transition to 1ms and every
delay to 0 (`base.css`), so nothing is still waiting to start after the screen
is already visible.

## Files

`tokens.css` → `base.css` → `components.css` → `views/*.css` → `motion.css`.
Screens combine components; they never restyle them.
