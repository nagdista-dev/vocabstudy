# Design

## Direction: "Study desk"

The learner is an adult (B1–C1 words) who may study for **six hours a day**.
Everything serves long, focused sessions:

- **Light only.** A bright, calm page keeps attention up; no dark mode to maintain.
- **One accent for action** (ink blue), **one for memory** (highlighter yellow).
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
| `--ink` / `--ink-2` / `--ink-3` | `#141b2d` / `#465066` / `#5d6880` | text, secondary, hints |
| `--brand` | `#2b48d6` | actions, links, current step |
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

Scale: 1.25 ratio from 16px (`--text-xs` … `--text-3xl`).
Settings → Text size multiplies everything (`--text-scale`).

## Sound traps and the keyboard note

Advice, not errors: `.traps` is quiet ink on a soft fill (never red/green);
`.kb-warn` ("Your keyboard is in Arabic") uses the highlighter's soft yellow.

## The signature

The home screen opens on one box: "A word you want to remember". As you
type, a highlighter band draws under exactly what you typed (its width is
measured in `views/library.js`) — you are marking the word to keep.

`.mark` draws the same highlighter band behind a word. It appears on every new word
(cards, recall, quiz feedback) and draws itself in (`motion.css → mark-draw`).

## Layout

- Content max 1080px; activities max 720px — one task, centred.
- 4px spacing grid (`--s-1` … `--s-8`).
- Phones (≤ 640px): answer buttons sit in a fixed bar under the thumb;
  options stack; the app bar shows only where you are.
- Touch targets ≥ 44px (`--tap`) on every touch screen — one block in
  `components.css` ("Touch screens") sets it for every component.

## Phones first

Most learning happens on a phone, one-handed, by learners of every age.
Checked at 360px and 414px with every text size (Normal, Large, Larger):

- Nothing scrolls sideways. An input never widens its page (`.field` and
  `.add-line .field` have `min-width: 0`).
- Every control ≥ 44px; today's plan chips and the sound button 46px.
- Small text never below ~13px; the tab bar labels 13px.
- Every form field is 16px or more on touch screens, or iPhone zooms the page.
- Textareas never resize by hand; they grow with the text.
- Choices never hide off-screen: the status filter wraps on phones.

## Motion (`assets/css/motion.css`)

| Moment | Animation |
| --- | --- |
| New word | highlighter draws in |
| Study card answered | card flies right (know) / left (learning); swipe on phones |
| Right / wrong | pop / shake |
| Streak of right answers | combo pill pulses |
| Results | stats arrive in order; perfect round → highlighter confetti |
| Home | progress and forecast bars grow in |

All of it is switched off by the system "reduce motion" setting (`base.css`).

## Files

`tokens.css` → `base.css` → `components.css` → `views/*.css` → `motion.css`.
Screens combine components; they never restyle them.
