# v17 — the bar finds its centre

This is the working plan for the bottom-navigation refinement after v16. It is
written before the code so the work can be checked against it line by line.
This is a scoped v16.1 polish pass, not a new identity.

## What the learner asked for

1. The bottom-bar order is wrong. It must read as a professional navigation,
   not five things placed left to right.
2. The bar must look professional.
3. Add animation — the learner has asked for it more than once.
4. Keep the paper/desk language, the v16 community door, the Arabic rule and
   the scrim behaviour.

## Deep review

### What is wrong now

- **The primary action is in the last slot.** Today, Words, Recall, Wallet,
  Add reads as four destinations and then an afterthought. Add is the app's
  one creation action; at the far end it competes with Wallet for the thumb
  and looks like a fifth destination that happens to be blue.
- **The grid is two systems in one row.** Four equal `1fr` cells plus a
  `minmax(62px, auto)` Add cell. The Add cell is a different width from every
  other cell, so the five labels do not sit on an even rhythm.
- **There is no second level of hierarchy.** The active tab is a soft pill
  behind the icon and a colour change; Add is a filled tile. Both are
  legible, but the eye reads five equal stops first and the action second.
- **The active state is static.** A tab switch is the highest-frequency
  action in the app; it currently has a colour transition and a press scale,
  but no arrival at all. The bar feels like a set of links, not an instrument.
- **The bar is slightly undersized for a raised action.** The current 66px
  bar and 74px page offset are tuned for a tile inside the bar. Any centre
  action that rises above the edge needs its own offset so it never covers
  the last row of a page, a toast or the break card.
- **Docs and tests encode the old order.** `DESIGN.md` says "four peer
  destinations … then a 62px Add slot", and the V16 plan describes Add at
  the end. The next reader would rebuild the old bar.

### What is already right and must survive

- Five stops is the right count for this app: Today, Words, Add, Recall,
  Wallet. Progress stays in More on phones and tablets.
- The highlighter yellow is reserved for memory: Recall's due count and the
  Wallet count. The new bar must not use it for the active tab.
- The active tab keeps one accent: brand ink, brand-soft pill. No new colour.
- The tab bar is hidden during activities and shown on browse screens.
- Glass, Night, forced colours, 320px, 1.25× text, keyboard focus and reduced
  motion all have existing rules that the new shape must respect.

## The decision

### Order

**Today · Words · Add · Recall · Wallet**

- Today is the home/base; it stays first.
- Words is the library; it stays second, next to Today.
- **Add is centred.** It is the one action, not a destination. The centre is
  the easiest place for a thumb to reach and the clearest way to say "this
  is different from the four places around it".
- Recall follows Add: the daily study loop (meet → add → recall) sits on the
  centre-right, closest to the action.
- Wallet is the collection at the end: the least frequent destination gets
  the far edge, where a deliberate reach is acceptable.
- The relative order of the four destinations is unchanged (Today, Words,
  Recall, Wallet). Only Add moves, from last to centre. This preserves the
  learner's existing map.

### Shape

- Five equal `1fr` columns. The bar's rhythm is even again.
- Add is a **54px ink circle** that rises 13px above the bar edge. A 4px
  surface ring separates it from the bar and from the page behind it. It is
  the only raised control in the chrome; nothing else floats.
- The plus is the whole label. The learner asked for the word under it to go:
  it read as a caption on a button that already says what it does. The link
  keeps `aria-label="Add words"`, so the name survives for screen readers.
- The active tab keeps the brand-soft pill behind the icon and the brand
  label. The active Add gets the same 4px surface ring plus a 3px brand-soft
  halo, so its state is visible without a second colour.
- Desktop keeps its existing labelled order: Today, Words, Recall, Progress,
  Wallet, Add. Only the phone/tablet bar is reordered. This is the one place
  where the two bars intentionally differ.

### Motion

Motion answers the switch; it does not perform. The guidance for
high-frequency navigation is restrained feedback, under 150ms, with no
sliding indicator between tabs.

- **Arrival:** when the current tab changes, its icon pill settles in with a
  140ms scale from 0.84 and a 2px lift. It plays once per real tab change,
  not on every bar repaint.
- **Count:** when the due count or wallet count changes, the badge pops once
  from 0.7 at 140ms. This is meaningful (new words are due / kept), not
  decoration.
- **Press:** the existing 6% icon press stays; Add presses a little deeper
  (8%) because it is the largest target.
- **Hover (pointer only):** inactive tabs get the quiet surface-2 pill;
  Add lifts 1px. Touch devices never see a sticky hover.
- **No loops.** Nothing moves on its own. No sliding pill across the bar.
- **Reduced motion:** the global 1ms rule in `base.css` already neutralises
  every new animation; the new rules add no exception.

## Tasks

1. **Order the data.** Add `TAB_ORDER` to `app.js`; keep `NAV` as the desktop
   order. Make `navMarkup` use `TAB_ORDER` for the tab bar only.
2. **Mark the arrival.** Track the last active tab in `renderBar`; add
   `is-arriving` only when the active id changes. Track due/kept counts and
   add `is-fresh` to the count badge only when the value changes.
3. **Rebuild the bar shape.** Five equal columns, raised 54px Add circle,
   surface ring, aligned label, active halo.
4. **Add the motion.** `tab-settle` and `count-pop` keyframes in
   `motion.css`; press/hover rules; reduced-motion check.
5. **Fix the offsets.** Main bottom padding, toast and break card offsets
   must clear the raised circle.
6. **Protect the other states.** Night, Glass, forced colours, 320px, 1.25×
   text, keyboard focus. Glass gets the same ring in its own material.
7. **Update the docs.** `DESIGN.md` (layout, wallet, phone menu, motion
   table) and this plan's result section.
8. **Verify and ship.** Build, check, MCP tests, browser matrix, commit,
   push, confirm Pages.

## Verification

| Check | How |
| --- | --- |
| Order | DOM order is Today, Words, Add, Recall, Wallet; desktop stays Today, Words, Recall, Progress, Wallet, Add |
| 320px | five labels fit, Add circle does not touch the edges, no horizontal scroll |
| 390px / 430px | even rhythm, raised circle clears content, labels aligned |
| 768px | tablet bar still centred, no desktop bar |
| 1024px+ | desktop bar unchanged, Add remains last |
| Light / Night | ring reads as surface, active pill has contrast |
| Glass | ring and active bead use the glass material, no white donut |
| 1.25× text | labels do not clip, circle still fits |
| Keyboard | Tab reaches every link in visual order; focus ring visible on Add |
| Reduced motion | no settle or pop; state is still legible |
| Scrim | Practise/Manage dims the bar; no stacking regression |
| Build | `python3 tools/build.py`, `python3 tools/check.py`, `node mcp/test.js` |

## Result

Shipped 2026-11-26.

- **Order.** Phones and tablets read Today · Words · Add · Recall · Wallet;
  desktop keeps Today · Words · Recall · Progress · Wallet · Add. The four
  destinations keep their relative order; only Add moved, from last to centre.
- **Shape.** Five even `1fr` columns. Add is a 54px ink circle with a 4px
  surface ring, rising 12.8px at normal text and 14.75px at 1.25×. The plus
  is the whole label; the link carries `aria-label="Add words"`.
- **Motion.** A real tab change settles the new current pill once (140ms,
  0.84 → 1); a changed due/wallet count pops once. Re-renders that keep the
  same place do not replay either. The global reduced-motion rule neutralises
  both.
- **Offsets.** Bar 69px, `--tab-clear` 94px. Main padding, toast, break card,
  update bar, share dock, AI add bar, print bar and the old dev note all use
  the same clearance; floating cards sit 8px above it.
- **Verified.** 320/390/430/768/1280, light/night/glass, 1.25× text, keyboard
  focus, counts, scrim, desktop order. `python3 tools/build.py` and
  `python3 tools/check.py` pass.
- **Follow-up.** The learner asked for the "Add" caption to go after the first
  pass. It is now visually hidden; the circle and its accessible name remain.
