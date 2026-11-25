# v16 — a visible community, a calm bar, and Arabic behind the card

This is the working plan for the v16 pass. It is written before the code so
the work can be checked against it at the end, line by line.

## What the learner asked for

1. A visible way to join the VocabStudy WhatsApp community, for every
   learner: `https://chat.whatsapp.com/EHuPYovOMIvCGPRdAZ28kT`.
2. Remove the “Know someone learning English? / Share the app” box from
   Today. The home screen should not carry a permanent share box.
3. Fix the mobile bars. The top bar is crowded and clipped; the bottom bar
   is five equal buttons with no hierarchy. Arrange both professionally.
4. Stop showing the Arabic translation outside the word card. In the word
   list, Arabic should appear only after the card is opened. The same rule
   applies to the “Just added” rows on Add.
5. When Practise / Manage opens, dim the header and footer too. Only the
   popover stays bright.
6. Keep the paper/desk visual language. This is a refinement, not a new
   identity.

## What the deep review found

### 1. The phone top bar is over budget

At 390px the measured pieces are:

| Piece | Width |
| --- | --- |
| Brand (mark + wordmark + “For all Arabs · 100% free”) | 222px |
| Gap | 8px |
| Three icon buttons (Share, Wallet, Settings) | 140px |
| Page gutters | 40px |
| **Total** | **410px** |

The bar is 20px wider than the screen, so it loses its right gutter and the
Settings button sits on the edge. At 320px the tagline is hidden, so the bar
fits exactly — the bug appears in the common 360–430px phone range.

The three icons are also three different kinds of thing (share, destination,
settings) with equal weight. The wallet icon duplicates a destination that
already belongs in the navigation. Nothing here says which action matters.

### 2. The bottom bar is five equal cells

At 320px each of the five links is 61.6px wide and 54.8px tall. Add — the
app's primary action — looks exactly like Progress and Recall. The active
state is a soft pill behind the icon and a colour change; there is no second
level of hierarchy and no separation between “go somewhere” and “do
something”.

### 3. The community has no door

There is no community URL, link, button, setting or About mention in the
app. Feedback goes to WhatsApp or email one-to-one, which is a different
thing from a community.

### 4. Today carries a second share flow

`views/library.js` renders `VS.today.shareCard()` on Today. The share sheet
is already reachable from the app bar (desktop) and will be in the phone
menu. The card is a permanent billboard on the home screen and costs about
90px above the add box.

### 5. Arabic leaks outside the card

- `VS.ui.wordRow` renders a `.word-row-ar` column on every list row. At 320
  it takes 38vw and clips both the Arabic and the English.
- The Add screen's “Just added” rows render `.recent-ar` in a second column.
- The word card itself, the wallet, AI editing fields and share content keep
  their Arabic: those are places where the learner is working with Arabic on
  purpose.

### 6. The scrim is trapped by the page entrance

`.page.view-enter` runs `animation: view-in var(--slow) var(--ease) both`.
The `both` fill mode keeps the animation's final `transform` applied, so the
computed value stays `matrix(1, 0, 0, 1, 0, 0)` instead of `none`. A
non-`none` transform creates a stacking context. The fixed scrim
(`.lib-more[open]::before`, z-index 21) therefore lives inside the page's
stacking context, below the app bar and tab bar (z-index 20).

Verified in the running app: with Manage open, `elementFromPoint` at the
top bar returns `.icon-btn.wallet-btn` and at the bottom bar returns
`.tab-link`. The scrim is painted behind both.

The root fix is the animation fill mode, not another z-index.

## Design direction

**Chrome recedes; the page leads.** The bar keeps the brand, one visible
community door, and one “More” control. Everything that is not a destination
or the community lives behind More. The bottom bar has four peer
destinations and one distinct action.

**One community door, several handles.** A labelled WhatsApp pill in the
mobile bar (icon-only below 360px), a highlighted first row in More, a
setting under “Help shape VocabStudy”, a CTA on the Arabic About page, and a
quiet line in the share sheet. One URL constant, no new network call.

**Arabic is the reward, not the label.** Lists stay English-only: word,
sense, example, status. Opening the card reveals the Arabic. Arabic-first
surfaces (wallet, share message, About, AI editing) keep their Arabic.

**The desk stays.** Paper surfaces, ink blue, one highlighter, the word face
for English, IBM Plex Sans Arabic for Arabic. No new palette, no glass, no
gradient, no illustration.

## Tasks

### Task 1 — One community URL and one link helper

- [x] Add `VS.COMMUNITY_URL` beside `VS.feedback` in `assets/js/app.js`.
- [x] Use inline links (the helper was not needed) that always emit
      `target="_blank" rel="noopener"` and the WhatsApp icon.
- [x] Use the same URL in every app surface; no second copy of the string in
      app JavaScript.
- [x] The static About page repeats the URL in its own HTML (it has no app
      JavaScript); check it against the constant.

**Done when:** the app has one URL literal, the About page's literal is
identical, and every rendered link opens the exact group in a new tab.

### Task 2 — The mobile top bar

- [x] Template: replace the stand-alone Share / Wallet / Settings buttons
      with a community pill (`#communityBtn`) and a More button
      (`#moreBtn`). Keep Share and Settings in the markup for desktop; hide
      them below 1024px. Remove the wallet button from the bar.
- [x] Brand: hide `.brand-tag` below 1200px, so the tagline only appears
      where there is room. Keep the accessible name on `#brandLink`.
- [x] Community pill: WhatsApp icon + “Community” from 360px; icon only
      below 360px. 44px target, brand-soft hover, no green fill.
- [x] More button: three dots, `aria-haspopup="dialog"`, 44px.
- [x] Desktop (≥1024px): flex row, brand left, nav + community + share +
      settings right; a hairline before Settings. Remove the fragile
      `display: contents` grid placement.
- [x] Phone spacing: 8px between the pill and More; the bar never loses its
      right gutter at 320–430px.

**Done when:** at 320, 360, 390 and 430 the bar's right edge is inside the
viewport, all three controls are ≥44px, and no text is clipped.

### Task 3 — The More sheet

- [x] Create a native `<dialog class="sheet more-sheet">` lazily from
      `app.js`, with a pinned head (“More”) and a body.
- [x] First row: “Join the community” with a WhatsApp mark, a short
      subtitle (“Updates, ideas and app talk”), and an external arrow. It is
      the only tinted row.
- [x] Rows: Progress, Share VocabStudy, Settings, About VocabStudy. Wallet
      is a bottom tab, so it is not repeated here.
- [x] Opening Settings or Share closes More first. Links close More on
      click. Backdrop click, Close and Escape all close it.
- [x] The sheet is a bottom sheet ≤599px and a centred sheet above that.
- [x] Settings: add a “Community” row under “Help shape VocabStudy”, beside
      the existing WhatsApp/email feedback row.
- [x] About page: add one Arabic CTA before the final “start with one word”
      block, with the same URL and a WhatsApp mark.
- [x] Share sheet: add one quiet “Join the community” line under the
      channels, so a reader who wants updates has a door.

**Done when:** two taps from any phone screen reach the community, the
share sheet and settings; the wallet has its own tab; focus returns to More
on close; the sheet is usable at 320px with 1.25× text; the community is also
visible in Settings, About and the share sheet.

### Task 4 — The bottom navigation

- [x] Keep four peer destinations: Today, Words, Recall, Wallet. Progress
      moved into More so the wallet keeps a one-tap destination.
- [x] Render Add as a distinct action in the fifth slot: a filled brand
      tile, 40×34px, with the plus in `--on-brand`; its label stays visible
      and bold.
- [x] Add `data-id` hooks and a `.tab-add` class in `navMarkup`.
- [x] Grid: four `1fr` columns plus a fixed 62–64px Add column; 58px
      minimum row height; 4px padding; safe-area inset.
- [x] Update the browse bottom padding, toast and break-card offsets to the
      new bar height.
- [x] Active state: soft tile + brand label for destinations; the Add tile
      stays filled and gains a ring when current.

**Done when:** at 320px the five slots fit with no clipping, Add is visibly
the primary action, and every label is readable in Light and Night.

### Task 5 — Remove Today's share card

- [x] Delete `VS.today.shareCard()` from `views/home.js` and its call in
      `views/library.js`.
- [x] Delete `.today-share*` rules from `views/share.css`.
- [x] Keep `share-app` as a global action and keep the share sheet reachable
      from the desktop bar, the More sheet and the share screen.
- [x] Update the share docs that still describe the Today card.

**Done when:** Today has no share box, `grep` finds no `today-share` or
`shareCard`, and sharing still works from the bars and the share screen.

### Task 6 — Arabic only behind the card

- [x] `VS.ui.wordRow`: remove the `.word-row-ar` span. Keep an English
      “Filling in…” state in the meta line while auto-fill is pending.
- [x] `views/library.css`: change `.word-row-open` to a single column
      (`"word" "ex" "meta"`), remove `.word-row-ar` rules and the phone
      override. Keep three equal lines and the 44px delete target.
- [x] `views/import.js`: remove `.recent-ar` from the “Just added” rows.
- [x] `views/import.css`: make `.recent-row` a single column with the meta
      line under the word; remove `.recent-ar`.
- [x] Do not touch Arabic in the word card, wallet, AI fields, share
      message, About page or first-run Arabic choice.

**Done when:** no Arabic appears in the Words list, Today's newest list or
Add's recent list; the word card still shows it; rows still have equal
heights and no horizontal scroll at 320px.

### Task 7 — Make the popover dim the chrome

- [x] Change `.view-enter` to `animation: view-in var(--slow) var(--ease);`
      (no `both`), so the finished animation leaves no transform and no
      stacking context.
- [x] Confirm the fixed scrim at `z-index: calc(var(--z-bar) + 1)` now
      covers the app bar and tab bar.
- [x] Keep the menu above the scrim; keep reduced-motion behaviour.
- [x] If a future entrance needs a fill mode, use `backwards`, never `both`.

**Done when:** with Manage or Practise open, the header and footer are
visibly dimmed and `elementFromPoint` at both bars returns the scrim's
origin, not a bar control. Only the popover is bright.

### Task 8 — Document, verify, ship

- [x] Update `DESIGN.md`: bar composition, More sheet, bottom hierarchy,
      community surfaces, no Arabic in lists, scrim root fix.
- [x] `python3 tools/build.py`, `python3 tools/check.py`,
      `node mcp/test.js`.
- [x] Browser pass at 320 / 360 / 390 / 768 / 1024 / 1280 in Light and
      Night, reduced motion, 1.25× text, keyboard focus.
- [ ] Commit and push; confirm the Pages workflow.
- [ ] Send the Arabic report.

## Acceptance criteria

- The community is reachable in one tap from the mobile bar and two taps
  from anywhere else; the exact URL opens in a new tab.
- No permanent share card on Today.
- At 320–430px the top bar has no clipping and no horizontal scroll; the
  mobile bar has exactly two controls beside the brand.
- The bottom bar reads as four destinations plus one distinct Add action;
  all targets are ≥44px.
- No Arabic in word-list rows or Add recent rows; Arabic remains in the
  word card, wallet, share message, About and AI editing.
- Manage/Practise dims the app bar and tab bar; only the popover is bright.
- Light/Night, reduced motion, keyboard focus and 1.25× text all pass.
- Build, check and MCP tests pass; the Pages deployment succeeds.

## Verification matrix

| Surface | 320 | 360 | 390 | 768 | 1024 | 1280 |
| --- | --- | --- | --- | --- | --- | --- |
| Top bar fit | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Community pill / icon | icon | label | label | label | label | label |
| More sheet | ✓ | ✓ | ✓ | ✓ | — | — |
| Bottom nav 4 + Add | ✓ | ✓ | ✓ | ✓ | — | — |
| No Arabic in lists | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Scrim covers chrome | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Today without share card | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## Order of work

1. Community constant + top bar (T1, T2)
2. More sheet (T3)
3. Bottom navigation (T4)
4. Today share card removal (T5)
5. Arabic behind the card (T6)
6. Scrim fix (T7)
7. Docs, build, browser pass, ship (T8)

## Out of scope

- No new visual identity, palette, typeface or illustration.
- No change to the study method, spaced recall, wallet or AI flow.
- No server, account, analytics or tracking.
- No new language: English chrome, Arabic where the learner works in Arabic.
- No redesign of the desktop navigation destinations.

---

## Result

Filled after the browser pass.

- **Community.** The exact URL is in `VS.COMMUNITY_URL`, the About HTML and
  every rendered link; the top-bar pill, More's first row, Settings, the
  share sheet and About all open it in a new tab. The About page checks
  `EHuPYovOMIvCGPRdAZ28kT` character for character.
- **Bars.** At 320/360/390 the top bar fits with its right gutter (community
  is icon-only at 320, labelled from 360); More is the only menu control.
  The bottom bar is four destinations plus Add at 72px; Wallet is the fourth
  tab and Progress is in More. At 768 the tab bar still shows and More is a
  centred 420px sheet. At 1024/1280 the desktop bar is one flex row, the
  tagline appears only at 1280, More is hidden and nothing overflows.
- **Lists.** 12 word rows and 6 “Just added” rows contained no Arabic; the
  opened word card still showed its Arabic, memory hook and mixed lines.
  Today has no share card and no “Know someone learning English?” text.
- **Scrim.** With Practise open at 360 and 1024, `.page` computed
  `transform: none`; `elementFromPoint` at the top and bottom returned
  `.lib-more` (the scrim's origin), and the menu sat at z-index 22 over the
  z-index-21 scrim. The app bar and tab bar were visibly dimmed.
- **More sheet.** At 360 it is 360×439px, all five rows inside 800px; at 320
  with 1.25× text it is 320×561px, top 179, bottom 740, every row visible
  with wrapped subtitles. Focus opens on the dialog, Tab runs Close →
  community → Progress → Share → Settings → About, and Escape returns focus
  to More. Night mode and the no-outline focus treatment were checked.
- **Mixed direction.** An Arabic-first hook rendered `rtl` with English runs
  in `<bdi dir="ltr">`; an English-first trap line stayed `ltr` with the
  Arabic chip isolated. Both read in the right order on screen.
- **Build.** `tools/build.py`, `tools/check.py` and `node mcp/test.js` pass;
  the site was checked locally at every width in the matrix.
