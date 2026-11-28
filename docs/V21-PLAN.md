# V21 — the guided AI add: one step at a time

> Status: shipped. V20 made the app rectangular and quiet. V21 makes the
> “Add words with AI” flow behave like a desk checklist: one open step, a clear
> Next, and two moments that move on by themselves. No new AI feature, no new
> route, no store change.

## Deep review

### What the learner sees today

The With AI tab renders all four steps at once, as a long form:

1. a step header + the words/topic/Arabic input,
2. a step header + three provider buttons,
3. a step header + a paste box,
4. a step header + the review rows and the Add bar.

On a 390px phone the screen is ~1,450px tall before a single word is typed.
The learner sees the paste box and the empty review before they have asked
anything. Nothing says where they are, what is done, or what comes next. The
provider buttons sit disabled until step 1 is valid, but the reason is only in
a `title` tooltip — invisible on touch.

### Measured defects (code evidence)

| Where | Today | Problem |
| --- | --- | --- |
| `aiTab()` | four `.ai-step` blocks always rendered | no active-step state; the page is a form, not a flow |
| `.ai-add` | one long grid, content indented 38px | 4 headers + 3 panels compete; ~1,450px at 390px |
| `VS.aiAsk` | buttons `disabled` until `aiReady()` | no visible reason on touch; the Next action is implicit |
| `add-ai-copy` / `ai-open` | copy/open, then nothing | the learner must find step 3 themselves |
| `readAnswer` | parses on every `input` | the review is updated in place, but the eye is still in step 3 |
| `aiReview()` | Add button fixed to the viewport | good; keep it, but it must only exist in step 4 |
| step headers | `<b>` text, no heading, no `aria-current` | screen readers get no step structure or progress |
| `import-tab` | resets `answer/rows` | good; the step must reset to 1 with it |

### What must not change

- The prompt itself (`VS.aiPrompt*`), `VS.aiAsk`, `VS.aiOpen`, `VS.copyWithFeedback`.
- `readAnswer()` parsing, wallet matching, status chips, row fields, tags.
- `ai-add` saving, wallet removal, the Study toast, the pop.
- The level chip (`VS.levelPick()`), profile sheet, all copy where possible.
- One accent, highlighter, 6/8/12 shape scale, 13px floor, 44px targets,
  Light / Night / Glass, 1.25× text, RTL, reduced motion.
- The other six ways in (Yourself tabs) and the recent-words side card.

## Direction: “the four-step desk”

A quiet vertical checklist. The number is an index in the margin, the current
step is the only open panel, completed steps fold to a one-line receipt with
`Edit`, and future steps are titles only. It reads like the numbered steps the
app already uses, not like a chat product.

```
Written for Intermediate · مصري · Change

│  ✓  Your words            resilient, deadline +2        Edit
│  2  Ask the AI
│     Open a chat with the prompt already typed — one complete card per meaning.
│     [ChatGPT] [Claude] [Copy prompt]
│     Already have the answer?  Paste it →
│  3  Paste its answer
│  4  Check, then add
```

When step 4 is open, the existing review appears unchanged, with the fixed
Add bar. Completed steps keep a hairline top rule only where it divides a
receipt from the next step; no boxes inside boxes.

### The step rail

- A 1px `--line` rail in the 26px margin, drawn from each step’s node to the
  next, so a tall open panel never pulls the line past the last step. It is
  hidden at ≤599px, where the numbered rows carry progress on their own.
- **Done:** 26px `--r-sm` square, `--brand-soft` fill, `--brand` check icon.
- **Current:** 26px `--r-sm` square, `--brand` fill, `--on-brand` number;
  title `--ink`, description visible.
- **Next:** 26px `--r-sm` square, `--surface-2` fill, `--ink-3` number;
  title `--ink-2`; no description. Not focusable.
- A done step folds to a one-line receipt and a separate `Edit` button with an
  accessible name (`Edit step 2: Ask the AI`); the whole receipt is not a
  button, so text selection and the Edit target do not fight.
- Current panel content keeps the 38px indent on ≥600px and loses it at
  ≤599px, exactly like today.

### Step anatomy

| Step | Title | Current panel | Done receipt |
| --- | --- | --- | --- |
| 1 | Your words / Your topic / Arabic words | the existing input + `Next: ask the AI →` | the typed words, topic + count, or Arabic, truncated to one line |
| 2 | Ask the AI | `VS.aiAsk` + “Already have the answer? Paste it →” | `ChatGPT` / `Claude` / `Prompt copied` |
| 3 | Paste its answer | the existing textarea + status + `Check the words →` | `12 words pasted` |
| 4 | Check, then add | the existing review + tags + Add bar | — (Add ends the flow) |

Step 2’s “Paste it →” is the explicit escape hatch for a learner who already
has an answer, or whose browser blocked the copy. It is a text button, not a
third provider.

## State and auto-advance

`st.ai.step` is a number 1–4, default 1. It lives in the existing `st.ai`
object, so a re-render (profile sheet, theme) keeps the place. Switching AI
sub-tab (`Words` / `Topic` / `Arabic`) resets it to 1 with `answer`/`rows`, as
today.

| From | Trigger | To | Focus after |
| --- | --- | --- | --- |
| 1 | `Next` when `aiReady()` | 2 | step 2 title (`tabindex="-1"`) |
| 1 | `Next` when not ready | 1 | the missing control; toast says what is missing |
| 2 | ChatGPT / Claude opened | 3 | the paste textarea |
| 2 | Copy prompt (success or copy sheet) | 3 | the paste textarea |
| 2 | “Paste it” | 3 | the paste textarea |
| 3 | `paste` event that parses ≥1 word | 4 | the tags field; the review bar scrolls to the top |
| 3 | `Check the words` when rows exist | 4 | the tags field; the review bar scrolls to the top |
| 3 | typing (not paste) | 3 | stays; status + Next enable |
| any done step | `Edit` | that step | its title, or the input it asks for |
| 4 | `Add N` | `#/words` | the library, with the new rows marked |

**Why paste only.** Auto-advancing on every `input` would move focus while the
learner is still typing. A paste is one deliberate act; after it, step 4 is
exactly where they need to be. Typing keeps the explicit Next, so nothing is
submitted without a clear action (Modern Web Guidance: forms/accessibility).

**Downstream data is never deleted by going back.** Editing step 1 and pressing
Next leaves an existing answer and review in place; they are simply hidden
until step 3/4 is current again. Re-pasting replaces them.

## Accessibility

- Each step is an `<li>` in an `<ol>`; the title is an `<h2>` with a stable id;
  the panel is `role="group"` + `aria-labelledby`.
- `aria-current="step"` on the current `<li>`; removed from the others.
- Inactive panels get `hidden`, so their controls leave the tab order and the
  accessibility tree. Values survive because the DOM is not re-rendered.
- On every step change: move focus to the new `<h2 tabindex="-1">` (or the
  paste textarea after copy / “Paste it”, or the tags field on step 4), and
  write “Step N of 4 — Title” into a visually hidden `aria-live="polite"`
  region.
- The current step's `Next` is a real `<button type="button">`; the flow is not
  a `<form>` and never submits on Enter except the existing one-word form.
- Done receipts are plain text; the `Edit` beside them is a real button with an
  accessible name (“Edit step 2: Ask the AI”), so its visible label is not
  repeated by a wrapper.
- `prefers-reduced-motion`: no rail/node transitions; the panel appears.
- Contrast: node numbers and receipts use `--ink-2`/`--ink-3` at ≥4.5:1; the
  current node uses `--on-brand`.

## Responsive, theme, text size

- 320 / 390 / 430: rail + title + one panel; no horizontal scroll; the
  provider row keeps its existing two-cards-plus-Copy layout; Next is full
  width in the panel.
- 768 / 1280: the panel is capped by the existing import card; Next sits at
  the start, not stretched across the page.
- Light / Night / Glass: nodes use tokens only (`--brand`, `--brand-soft`,
  `--surface`, `--surface-2`, `--line`, `--on-brand`); no hard-coded colour.
- 1.25× text: titles wrap, receipts truncate with ellipsis, nodes stay 26px
  and do not clip the number; `aria-current` never depends on colour alone
  (the number is filled and the panel is open).
- RTL: rail and indents use logical properties (`inset-inline-start`,
  `margin-inline-start`); the Arabic input keeps `dir="rtl"`.

## Tasks (small, in order)

1. **State + markup.** Add `step: 1` to `st.ai`; build `aiFlow()` with the
   `<ol>`, four `<li>`s, stable ids, current/done/next classes, receipts, and
   hidden panels; keep `aiStepOne()`, `VS.aiAsk`, the textarea, `aiReview()`.
2. **Stepper chrome.** CSS for the rail, nodes, titles, receipts, panel indent,
   current/done/next states; remove the old `.ai-step` reliance in this view
   (keep the shared `.ai-step` for the autofill panel).
3. **Navigation.** `ai-next`, `ai-step` (edit), `ai-back` if needed; `showStep`
   toggles `hidden`, classes, `aria-current`, updates the live region, moves
   focus; validate step 1 with specific toasts and focus.
4. **Auto-advance.** Copy/open → step 3; paste event → parse → step 4 only
   when rows exist; “Paste it” → step 3 + textarea focus; keep Next fallbacks.
5. **Step 4 + add.** Review only in step 4; fixed Add bar unchanged; after
   `ai-add` reset `step` to 1 with the existing field reset.
6. **Mount + reset.** Wire the new controls in `mount`; reset step on AI
   sub-tab switch; keep the existing input/review listeners (they are inside
   hidden panels but still bound).
7. **Docs + verification.** `DESIGN.md` AI section, `docs/ARCHITECTURE.md`
   add-screen note, this plan’s Result; build/check/mcp tests; browser matrix;
   commit, push, Pages deploy, Arabic report.

## Verification matrix

| Check | 320 | 390 | 430 | 768 | 1280 |
| --- | --- | --- | --- | --- | --- |
| No horizontal scroll, rail aligned | ✓ | ✓ | ✓ | ✓ | ✓ |
| Step 1: Next disabled-state copy + focus on error | ✓ | ✓ | ✓ | ✓ | ✓ |
| Step 2: copy/open auto-advance; Paste it works | ✓ | ✓ | ✓ | ✓ | ✓ |
| Step 3: paste auto-advance; typing does not | ✓ | ✓ | ✓ | ✓ | ✓ |
| Step 4: rows, tags, Add, fixed bar | ✓ | ✓ | ✓ | ✓ | ✓ |
| Done receipt + Edit returns, values kept | ✓ | ✓ | ✓ | ✓ | ✓ |
| Keyboard only: Tab/Enter through all 4 steps | ✓ | ✓ | ✓ | ✓ | ✓ |
| Light / Night / Glass | ✓ | ✓ | ✓ | — | — |
| 1.25× text | ✓ | ✓ | ✓ | — | — |
| RTL: nodes and indents mirrored | ✓ | ✓ | — | ✓ | — |

## Out of scope

- New AI providers, new prompt fields, new routes, store or sync changes.
- Redesigning the Yourself tabs or the recent-words side card.
- Changing the review row fields or the Add rules.

## Plan review

Critique before building:

- **“Auto-advance is jarring.”** It is, if it fires on typing. The plan limits
  it to paste and to the two provider actions, both deliberate; every step
  still has a visible Next, and focus lands on a heading, not a random input.
- **“Hidden panels lose data.”** They do not: `hidden` only hides; the DOM and
  `st.ai` keep every value. The existing `readAnswer` keeps updating `#aiReview`
  even when step 4 is hidden.
- **“Two Add buttons.”** The compact Add inside the review bar and the fixed
  bar already coexist; both live in step 4 only, so the fixed bar cannot appear
  over steps 1–3.
- **“The rail is decoration.”** It carries progress: done nodes are checks,
  the current node is filled, future nodes are quiet. It also gives the 26px
  margin a job instead of empty indentation.
- **“Mobile loses the description.”** Future steps show titles only; that is
  the point of a wizard. The current step always explains itself, and the
  completed step keeps a receipt of what was entered.
- **“The copy sheet may cover the advance.”** Advancing behind the sheet is
  harmless: when it closes, the learner is on the paste step with the prompt
  copied. If they dismiss without copying, “Paste it” and `Edit` on step 2 are
  still there.

## Result

Shipped. The With AI tab is a four-step checklist in `assets/js/views/import.js`
and `assets/css/views/import.css`: `st.ai.step` is the only new state,
`showStep` owns the classes, `aria-current`, panels, receipts, live region and
focus, and the old static `.ai-step` blocks are gone from this view (the shared
`.ai-step` is still used by the autofill panel). Copy/open move to step 3 with
the paste box focused; a paste with at least one parsed word moves to step 4
with the tags field focused and the review bar scrolled clear of the fixed bar;
typing never moves. After `ai-add`, the view opens `#/words` immediately.

Four fixes came out of the browser pass:

- The status line says “check it in the next step”, and a paste that adds
  nothing names the real reason — “Nothing new here” for duplicates instead of
  asking for Arabic.
- The Add bar uses “Add N”, so “N words ready” stays on one line at 320px and
  1.25× text.
- A long headword keeps its own line, the status chip wraps below it, the
  chevron stays top-right, and the IPA is one unit instead of splitting
  mid-symbol.
- Under a forced RTL document the skip link’s `left: -9999px` added 9,999px of
  scroll width; it now uses the clipped `.sr-only` pattern, so the layout
  mirrors without a horizontal scroll.

Verified in the browser:

- 320 / 390 / 430 / 768 / 1280: no horizontal scroll; steps 1–4, the rail
  (≥600px), receipts, `Edit`, review rows and the fixed Add bar.
- Light, Night and Glass; 1.25× text at 320 / 390 / 430.
- Keyboard only: Tab/Enter through step 1, the validation toast, step 2
  providers, Copy prompt, paste, step 4 fields, `Edit` back to step 1; focus
  rings are visible.
- RTL at 320 / 390 / 768: nodes, indents and rail mirror; no horizontal
  scroll.
- Arabic mode end-to-end (`borrow`, `opportunity`) and Topic mode (`commute`,
  `landlord`); both added and landed on `#/words`.
- Reduced motion: transitions collapse to 0.001s.
- `python3 tools/check.py`, `python3 tools/build.py`, `node mcp/test.js`.

The matrix below is the shipped state. RTL was checked by setting `dir="rtl"`
at 320, 390 and 768: nodes, indents and the rail mirror, and the page has no
horizontal scroll. The skip link now uses the clipped `.sr-only` pattern instead
of `left: -9999px`, which used to add 9,999px of scroll width under RTL.
