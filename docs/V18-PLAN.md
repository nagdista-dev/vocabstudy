# V18 — a quieter app that is ready to live with

> Status: implemented and checked. This is the last polish batch before the
> app is treated as finished: no development notices, no update nag that can
> be dismissed, a real install invitation, and the small visual faults that
> showed up once the app was used every day.

## Deep review

The app is stable and the WhatsApp community exists, so the "still being
built" note is now noise: it covers the bottom of every browse screen, asks
for feedback that Settings already asks for, and makes a finished app look
unfinished. Remove it completely.

The install card was tied to a finished round and snoozed for 30 days. That
is backwards for a PWA: the people who most need it are the ones who never
finish a round, and one accidental "not now" removed it for a month. On a
phone, show it whenever the app is open in a browser and not installed; let
"not now" dismiss it for this visit only.

Recorded voice shipped on. A learner who never chose it pays for a network
request on every word, and the first impression is a delay. Default it off,
but remember an explicit On so the choice sticks.

A shared word currently always opens Add for confirmation. For one word or a
short phrase the learner has already made the choice by sharing it: put it in
the Wallet and say so. Long text still needs the "From text" picker.

The rest are visual faults found in daily use:

- the update bar has an ×, so a learner can put off an update forever;
- the About page has a CTA in the header that competes with the logo;
- "Your week is ready" touches the card above and is a thin strip on a wide
  screen;
- the frequency badge carries five tiny bars that read as a broken icon;
- Print starts on "Due" instead of "All";
- Meet the word mixes its example into the related-words block, sets the
  Arabic too large, and on a tall desktop the "Now check yourself" button can
  sit below the fold.

## Decisions

| Area | Decision |
| --- | --- |
| Recorded voice | Off in `DEFAULTS`; a `recordedChosen` flag is set when the learner presses On or Off, so an old save with the old default goes off once and a real choice is kept. Off is the first segment. |
| Share target | Text of ≤4 words with no sentence punctuation → `walletAdd(..., "shared")`, toast, `#/wallet`. Anything longer → the existing Add → From text flow. A word already in the library is reported, not duplicated. |
| Dev note | Delete `devNote()`, its markup, CSS, store references and docs. Settings keeps the permanent feedback buttons with copy that no longer says the app is being built. |
| Install nudge | Phone/tablet only, any browse screen, 3.5s after render, once per visit. No stored snooze. "Not now" hides this visit; the next launch shows it again until `appinstalled` or standalone. |
| Update bar | Text + "Update now" only. No ×, no `update-later` action, no way to dismiss. |
| About header | Brand centred on its own row, section nav centred under it, no CTA. Sticky header stays; anchors clear the taller header. |
| Week card | 12px top gap, trophy tile, copy, and a real "Open your week" button from 600px; on phones the same link ends in an arrow so the card stays one line of intent. |
| Frequency | Label only ("Top 12,000"), no bars. The tooltip keeps the teacher's sentence. |
| Print | `fromRoute` falls back to `all`; explicit scopes still win. |
| Meet | Arabic capped at ~1.65rem before the Arabic scale. Example gets an "Example" label; related words get a "Related words" group with separate "Goes with" / "Similar" rows. The Meet action bar is sticky from 600px and fixed on phones, with the primary label kept whole. |

## Tasks

1. **Store** — recorded default off, migration flag, remove install snooze.
2. **Settings** — Off first, set `recordedChosen` on a press, update the hint
   and the feedback copy.
3. **Share** — short shared text goes straight to the Wallet; long text keeps
   the Add capture.
4. **Dev note** — remove the JS, CSS, calls and documentation.
5. **Install** — persistent per-visit nudge with the brand mark, benefit copy,
   Install and Not now; no store writes; hidden in print.
6. **Update bar** — remove the × and its action; keep one clear button.
7. **About** — centre the brand, show the section nav under it, remove the CTA,
   adjust the anchor offset.
8. **Week card** — spacing, trophy tile, desktop CTA.
9. **Frequency** — remove the bars from markup and CSS.
10. **Print** — default source `all`.
11. **Meet** — labelled Example, grouped related rows, smaller Arabic, sticky
    action bar with a whole primary label.
12. **Docs and checks** — DESIGN, ARCHITECTURE, SHARE, this plan; build, check,
    MCP test, browser matrix at 320/390/430/768/1280 in light and night, 1.25×
    text, keyboard, print preview.

## Verification matrix

| Check | How |
| --- | --- |
| Recorded voice starts Off | Fresh profile; Settings shows Off pressed; speech falls back to the browser voice. |
| An explicit On sticks | Press On, reload; still On. An old save with `recorded: true` and no `recordedChosen` loads Off. |
| Share a word | Share `serendipity`; app lands on Wallet with the word and a toast. |
| Share a sentence | Share a full sentence; app lands on Add → From text with the text. |
| Dev note is gone | No `#devNote`, no "Still being built" in Settings, no `dev-note` CSS. |
| Install nudge | Phone width, not standalone: card appears on Today, Words, Wallet. Not now hides this visit; reload shows it again. Install uses the native prompt. |
| Update bar | No ×; only "Update now"; cannot be dismissed. |
| About header | Logo centred, nav under it, no CTA; anchors clear the header at 320 and 1280. |
| Week card | 12px gap above; trophy tile; "Open your week" at 768/1280; one-line intent at 390. |
| Frequency | Only "Top 12,000" beside level/type; no bars. |
| Print | Opening `#/print/all` with due words still selects All. |
| Meet | Arabic visibly smaller; Example label; Goes with and Similar separate; "Now check yourself" visible at 1280 without scrolling. |
| Floors | 320/390/430/768/1280, light/night/glass, 1.25× text, keyboard focus, no horizontal scroll. |
| Build | `python3 tools/build.py`, `python3 tools/check.py`, `node mcp/test.js`. |

## Result

Shipped as v18.

- **Voice** — `recorded` is off in `DEFAULTS`, `recordedChosen` keeps an
  explicit On/Off, and an old save without the flag goes off once. Settings
  lists Off first and sets the flag on either press. A scripted On survived a
  reload; an old `recorded: true` save loaded Off.
- **Share** — a word or phrase of up to four words with no sentence
  punctuation goes straight to the Wallet with a toast and `#/wallet`;
  duplicates and words already in the library are reported. Longer text still
  opens Add → From text.
- **Install** — the nudge is a per-visit card on phones/tablets with the brand
  mark, benefit copy, Install/Got it and Not now. It appeared on Today, Words
  and Wallet after 3.5s, disappeared for the visit, and returned on reload. No
  store write; the old `installNudgeDismissed` key is deleted on load.
- **Dev note** — removed from JS, markup, CSS, settings copy and docs. The
  update bar has one "Update now" button and no ×.
- **About** — brand centred on its own row, section nav centred under it, no
  header CTA; `#how` lands 120px below the top at 1280.
- **Week card** — 12px above today's plan, trophy tile, copy, and an "Open your
  week" pill from 600px; on phones the same link is a 44px arrow.
- **Frequency** — label only; the five bars are gone from markup and CSS.
- **Print** — `#/print/all` opens with All selected even when words are due.
- **Meet** — labelled Example block, separate Related words group with Goes
  with / Similar rows, Arabic capped at 1.65rem (26.4px at 1280, 21.1px at
  390). The action bar is sticky from 600px and fixed on phones; "Now check
  yourself" is on screen at 1280 and at 320 (also at 1.25× text).
- **Checks** — no horizontal scroll at 320/390/430/768/1280, light and
  night+glass; keyboard focus visible on the Add tab; `tools/build.py`,
  `tools/check.py` and `mcp/test.js` pass.
