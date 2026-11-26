# V20 — the rectangular desk: a quieter shape system and a professional wallet

> Status: shipped (v20). V19 made the wallet a filing cabinet; V20 makes it look like
> one. The app's identity becomes rectangular — cards, chips, fields, buttons
> and tags share one calm shape scale — and the wallet slip, folder sheet and
> Clear action are rebuilt as a proper paper filing card instead of a stack of
> rounded boxes. No behaviour changes.

## Deep review

### What the learner sees today

The wallet works, but it reads as a prototype in four places:

1. **The slip is a pile of rounded boxes.** A 18px card holds a 12px filled
   sentence block, a pill folder tag, two pill-ish buttons and a hairline above
   them. At 390px the eye sees five competing rounded rectangles and two
   horizontal rules (the sentence fill's top edge and the footer divider). It
   feels assembled, not filed.
2. **The app's shape language contradicts its identity.** The product is a
   study desk: paper, ink, index cards, printed sheets. Yet the interface is
   full of pills — folder chips, counts, tags, the community link, the active
   tab background, the Add circle, the library's Practise/More buttons. Pills
   read as "friendly SaaS", not "a desk you sit at for six hours".
3. **Folder rows are ruled like a spreadsheet.** General, Shared and every
   custom folder sit on a `border-bottom`; the create form adds another rule.
   The sheet looks like a settings table, not a filing drawer.
4. **The Clear action is a red text link** floating at the end of the page,
   visually disconnected from the wallet it clears. It is the most dangerous
   action on the screen and gets the least design.

### Measured defects (code evidence)

| Where | Today | Problem |
| --- | --- | --- |
| `tokens.css` | `--r-sm: 8`, `--r-md: 12`, `--r-lg: 18`, `--r-pill: 999` | Card corners too soft for the identity; a pill token invites drift |
| `.chip` | `border-radius: var(--r-pill)` | Folder/filter chips are pills |
| `.tag`, `.pill`, `.chip-n` | pill | Tags and counts read as bubbles |
| `.bar-community` | pill | The one header door is a capsule |
| `.tab-ico` active | 48×28 pill | The tab highlight is a capsule |
| `.tab-add .tab-ico` | 54px circle | The Add action is the largest circle on the phone |
| `.speak-btn` | 50% | Every word's sound is a circle |
| `.lib-practise`, `.lib-more-btn` | hard-coded `999px` | The library's primary pair are the widest pills in the app |
| `.wallet-folder-row` | `border-bottom` on every row | Rules under General, Shared and every folder |
| `.wallet-actions` | `border-top` + filled sentence | Two stacked lines inside every slip |
| `.wallet-ar` | Arabic with no label | An Arabic reader sees a bare line; nothing says "translation" |
| `.wallet-end .danger-link` | red text link | Clear has no button weight or boundary |
| `.wallet-pocket-edge` | two 18px rounded edges | The pocket is cute; the filing-card metaphor should be quieter |
| `.progress`, `.badge`, `.seg` | pill track, 6px badge, 12px segment | Inconsistent shape steps |

### What must not change

- Every flow from V19: folders, migration, move/Undo, scoped search, bulk AI,
  share target, clear/Undo, keyboard and Escape, the install sheet.
- One accent, one highlighter, green/red only for feedback.
- 13px readable floor, 44px targets, AA contrast, Light/Night/Glass.
- The paper/ink palette, the fonts, the highlighter.

## Direction: "the filing card"

The wallet is a drawer of index cards; the rest of the app is the same desk.
Shape carries that identity:

| Token | Old | New | Used for |
| --- | --- | --- | --- |
| `--r-sm` | 8px | **6px** | chips, tags, counts, small badges, keys |
| `--r-md` | 12px | **8px** | buttons, fields, segments, icon buttons |
| `--r-lg` | 18px | **12px** | cards, sheets, slips, dialogs |
| `--r-pill` | 999px | **keep, but restricted** | true circles only: mic, swatches, progress dots/rings, avatars |

Rules:

- **No pill-shaped text.** A chip, tag, badge or count is a 6px rectangle.
- **No circle as a button** except the microphone (a physical object) and the
  accent swatches (colour samples). The speaker becomes a rounded square; the
  Add action becomes a 16px rounded square.
- **One radius per role.** A card never contains a control with a larger
  radius than itself; controls sit a step below their surface.
- **Lines only where they mean something.** Rules divide content that changes
  meaning; lists use spacing and hover fills instead.
- **The number is an index, not a badge.** Plain tabular figures in the card's
  margin, no filled chip.
- **The sentence is a margin quote**, not a filled box: a 2px accent rule and
  a serif italic line, like a note in a book's margin.

## The wallet slip (rebuild)

```
01   Serendipity                                  [speaker]
     ┌ Translation
     │ صدفة سعيدة
     │ “A fortunate discovery made by accident.”
     Folder ▸ Film        Saved 26 Nov
     [ Make with AI ]  [ Add now ]            [trash]
```

- **Head.** Plain `01` in `--ink-3`, 13px, tabular; the word at 18–20px/700;
  a 40px square speaker at the end. No chip behind the number.
- **Translation.** A 11px uppercase tracked label with the `translate` icon,
  then the Arabic on its own line at `--text-md × --arabic-scale`. The label
  is present whenever Arabic exists (also when it arrives late from the
  lookup). An Arabic slip keeps its "English comes next" line instead.
- **Sentence.** A margin quote: `border-inline-start: 2px solid var(--line)`,
  padding-inline-start 12px, `--font-ipa` italic at 15px/1.6, clamped to 3
  lines. No background, no radius.
- **Meta.** The folder tag becomes a quiet inline button (folder icon + name,
  32px tall, transparent, 6px hover fill) followed by "Saved …". The tag is
  the move door; it never competes with the two actions.
- **Actions.** No top rule. `Make with AI` tonal + `Add now` outline on the
  start side, trash icon on the end. 40px tall, 44px on touch.
- **Card.** `--surface`, 1px `--line`, `--r-lg`, `--shadow-1`; hover lifts to
  `--shadow-2` only on a fine pointer. Padding 16/20.

## The folder sheet and the pocket

- Remove every `border-bottom` in `.wallet-folder-row` and the create form's
  rule. Rows get 44–48px height, 8px radius, a `--surface-2` hover fill, and
  12px between groups. The built-in "Default" badge becomes a quiet 6px tag.
- The pocket keeps its two peeking edges — it is the one place where stacked
  paper is the point — but the edges take `--r-md` and the pocket body
  `--r-lg`.
- `Clear` becomes a real button in a footer row: hint on the start, a
  `btn-danger-quiet` with a trash icon on the end. It has a border tinted from
  `--bad`, an 8px radius, a 40px height (44px on touch), and a `--bad-soft`
  hover. It is clearly a button, clearly dangerous, never an alarm. The row
  has no rule; the space above it is the separation.

## Whole-app polish (small, consistent fixes)

| Screen | Work |
| --- | --- |
| **Today / library** | Convert Practise + More from 999px to 8px; chips/tags to 6px; word rows keep their quiet rules (they are a list, not a card stack); first-run card takes 12px; status badges 6px |
| **Add** | Import tabs and method cards take 8/12px; drop zone 12px; pasted-table rows stay flat; no pill tags |
| **Stats** | Chart cards 12px; bars keep 4px tops; streak/level badges 6px |
| **Settings** | Rows use spacing, not extra rules where a group already has one; segmented control 8px; swatches stay circles; theme cards 12px |
| **Share / Shared** | Link box, word picks and actions take 8/12px; the received-list rows lose pill chips |
| **Data / transfer / activities** | Backup cards 12px, QR tiles 6px, option keys 6px; mic stays a circle; no other circles |
| **Word card** | Speaker square, meaning chips 6px, the card 12px; keep the highlighter |
| **About** | Print-like cards 12px, mini-chips 6px, platform tags 6px; keep the editorial layout |
| **Chrome** | Community door 8px; counts 6px; active tab 8px; Add 16px rounded square; install sheet 12px; toast 8px |

## Tasks (in order)

1. **Tokens + global shape pass.** Set 6/8/12; replace every pill text shape,
   count, tag, badge and the hard-coded 999px buttons. Convert the speaker,
   Add action and tab highlight. Keep mic/swatches/rings circular.
2. **Wallet slip.** Restructure the head, add the Translation label (and make
   `paintArabic` insert it), rebuild the sentence as a margin quote, move the
   folder tag into the meta line, remove the footer rule, restyle the actions.
3. **Wallet page chrome.** Folder chips to 6px; pocket edges/body; folder
   sheet row rules removed; move sheet rows; Clear footer button.
4. **Library + home.** Practise/More buttons, chips, tags, first-run card,
   weekly report, Today plan.
5. **Add + stats + settings + share + data + activities + word card + about.**
   Shape and spacing only; no flow changes.
6. **Verification.** Build/check/test; browser matrix 320/390/430/768/1280 in
   Light, Night and Glass at 1.25× text; keyboard through the wallet, folder
   sheet, move sheet and Clear; contrast spot checks.
7. **Docs + ship.** Update `DESIGN.md` (shape system, slip, Clear, folder
   sheet), `docs/ARCHITECTURE.md` if markup changes; commit, push, verify the
   Pages deploy; Arabic report.

## Verification matrix

| Check | 320 | 390 | 430 | 768 | 1280 |
| --- | --- | --- | --- | --- | --- |
| No horizontal scroll | ✓ | ✓ | ✓ | ✓ | ✓ |
| Wallet slip: no clipped word/Arabic, actions fit | ✓ | ✓ | ✓ | ✓ | ✓ |
| Folder chips scroll/fade, no rule under rows | ✓ | ✓ | ✓ | ✓ | ✓ |
| Clear footer button fits, confirm + Undo | ✓ | ✓ | ✓ | ✓ | ✓ |
| Add / stats / settings / share / data / word card | ✓ | ✓ | ✓ | ✓ | ✓ |
| Light / Night / Glass | ✓ | ✓ | ✓ | — | — |
| 1.25× text (no clipping) | ✓ | ✓ | ✓ | — | — |
| Keyboard: chips → pocket → slip → sheet → Clear | ✓ | ✓ | ✓ | ✓ | ✓ |
| Contrast: label, meta, hint, danger button | ✓ | ✓ | ✓ | ✓ | ✓ |

## Out of scope

- New features, new copy, new routes, store changes.
- Replacing the paper photographs or the fonts.
- Changing the spaced-repetition model.

## Result

**Shipped.** V20 is on `main`: one rectangular shape
scale (6 / 8 / 12), the wallet slip rebuilt as a filed index card, the folder
sheet unruled, and Clear turned into a real danger-quiet button. No behaviour,
copy or store changes.

### What changed

- **Tokens.** `--r-sm: 6px` (tags, counts, badges, chips), `--r-md: 8px`
  (buttons, fields, segmented controls, speaker squares, tab highlights,
  toast), `--r-lg: 12px` (cards, sheets, dialogs, pocket). `--r-pill` survives
  only for true circles: the mic, accent swatches and rings. Add is a 16px
  rounded square.
- **Wallet slip.** Plain tabular index number, headword + square speaker,
  **TRANSLATION** label above the Arabic, the kept sentence as a serif margin
  quote, folder tag moved into the meta line as a quiet text button, no footer
  rule, Make with AI / Add now / quiet remove on spacing. `paintArabic()`
  inserts the whole labelled translation block when Arabic arrives late.
- **Folder sheet.** No rules between General, Shared or custom folders and no
  rule above the create form; 8px rows with a hover fill, `minmax(0, 1fr)` and
  `min-width: 0` so a 40-character folder name never widens the dialog.
- **Clear.** `btn-danger-quiet` with a trash icon in the `.wallet-end` footer,
  40px (44px on touch), `--bad-soft` hover; the confirm names the whole wallet
  or the folder and Undo restores through `walletRestore`.
- **Whole app.** Pills removed from chips, tags, counts, badges, the community
  door, the active tab, library Practise/More, speaker buttons, step numbers,
  meaning numbers, the transfer picker, community mark and mini chrome.
  First-run card lost its head rule and gained the Translation label. Word
  rows keep their quiet rules because they are a list, not a stack of cards.
- **Small fixes found in review.** `VS.senseFrom` no longer leaves a trailing
  "to" in a definition; wallet remove/move/toast use `VS.cap(e.word)` so they
  match the slip headword.

### Verification

- `python3 tools/build.py` — OK; `python3 tools/check.py` — 0 errors;
  `node mcp/test.js` — `mcp OK` (protocol, security and the six read/write
  tools).
- Browser matrix at 320 / 390 / 430 / 768 / 1280: no horizontal scroll on
  Today, Words, Add, Stats, Share, Data, Wallet or Recall. Wallet slip and
  actions fit at every width; 1280 uses the 340px pocket + slip column.
- Light, Night and Glass at 390: slip, Arabic label, quote, meta, Clear and
  folder sheet keep their contrast and surfaces. 1.25× text at 320: wallet,
  folder sheet, first-run card and Clear row do not clip.
- Keyboard: Escape closes the folder sheet and the Clear/Remove confirms;
  Remove asks, removes (11 → 10) and Undo restores (10 → 11). The folder tag
  opens the move sheet with the capitalised title.
- Folder sheet at 320 with 1.25× text and a 40-character folder name:
  `scrollWidth === 320`, no overflow.
- Contrast spot checks: `--ink-3` label/meta on `--surface`, `--bad` on
  `--bad-soft`, and the hint all stay above 4.5:1 in Light and Night.

### Known limits

- The brand/favicon tile stays as it is; regenerating the PNG icons is a
  separate job.
- `index.html` and `sw.js` are generated at build time (gitignored); the
  deploy step must run `tools/build.py` before publishing.
