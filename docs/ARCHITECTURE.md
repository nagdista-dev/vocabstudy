# Architecture

## The big picture

```text
tools/templates/page.html ──build.py──▶ index.html   (the whole app)
tools/templates/sw.js ──build.py──▶ sw.js           (offline cache list)
tools/vendor.py (by hand) ──▶ assets/fonts/, assets/vendor/   (fonts, PDF maker)

In the browser:  core/vs.js ─▶ core/* ─▶ views/* ─▶ app.js
                 core/store.js loads the learner's words from localStorage
```

There is one page and **one word library**, and it is the home screen. The app
ships with no words: every word is the learner's and lives in `VS.words`. An
entry is identified by its English word **and its Arabic meaning**, so `bank`
(ضفة النهر) and `bank` (بنك) are two words — `bank` and `bank~بنك` — while the
same word with the same meaning is a duplicate. A new word with no Arabic yet
is kept once; a second meaning waits for its Arabic. Words are typed, pasted,
uploaded or brought in with an AI chat and saved on the device — never in the
build.

**Local first.** The app has no server, no account and no CDN: fonts and the
PDF maker ship with it. Every network call is optional and goes to a free
service with no account: Use it sends the learner's sentence to LanguageTool only after asking once
(Settings → Grammar check), "More examples" sends the word to Tatoeba, and
auto-fill sends a new English word to free dictionaries — Google Translate's free endpoint for
meanings, examples, Arabic, similar words and its spelling correction (only for a word that
isn't one of the 30,000 most used), dictionaryapi.dev for the IPA,
MyMemory as a fallback (Settings → Auto-fill) — and in
Chrome/Edge the browser's own speech recognition powers Speak.

## Why these choices

| Choice | Why |
| --- | --- |
| Plain HTML/CSS/JS, no framework, no bundler | Opens with a double-click (`file://`), nothing to install, every line is readable. |
| Classic `<script>` files + one global `VS` | ES modules are blocked on `file://`. One namespace means every shared thing has exactly one name. |
| One library, one word per meaning | The same English word can be kept twice only with a different Arabic meaning; progress belongs to that meaning, not to when it was added. |
| Hash routes, filters in the address (`#/words?tag=IELTS`) | Work on `file://`, keep the back button, make any list bookmarkable. |
| Learner's words + progress in localStorage, packed arrays | No account and no server: free and private. Tens of thousands of words fit. |
| Markup from template strings via `VS.html` | Escapes every value automatically, so word data can never break the page. |
| One click handler (`data-action`) | No `onclick` in HTML; every screen lists its actions in one object. |

## Load order (`tools/build.py → SCRIPTS`)

| File | Defines |
| --- | --- |
| `core/vs.js` | `VS`, `VS.addWords`, `VS.wordKey`, `VS.arKey`, `VS.wordId`, `VS.findWord`, `VS.findSameWord`, `VS.parseTags`, `VS.allTags`, `VS.html`, `VS.shuffle`, dates, toast |
| `core/word-forms.js` | `VS.IRREGULAR`, `VS.STAND_INS` (brought ← bring, my ← your) |
| `core/icons.js` | `VS.icon(name)`, `VS.brandMark` |
| `core/store.js` | `VS.store` — library, progress, spaced repetition, settings, wallet, backup |
| `core/speech.js` | `VS.speech.say()` — browser voices |
| `core/listen.js` | `VS.listen.hear()` — speech recognition for Speak |
| `core/sfx.js` | `VS.sfx.play()` — synthesised sound effects (Web Audio) |
| `core/practice.js` | `VS.scope`, `VS.finishStep`, `VS.sessionWords`, `VS.distractors`, `VS.findInExample`, `VS.wordForms` / `VS.isWordForm` (strict forms for judging a typed answer: "took off" for "take off", never "user" for "use") |
| `core/filters.js` | `VS.filters` — the library's filters and sorts, shared by every screen |
| `core/sound-traps.js` | `VS.soundTraps(word)` — P/B, V/F, silent letters, -ed, th…; `VS.stress(ipa)` — syllables and the stressed one |
| `core/usage-traps.js` | `VS.usageTraps(word)`, `VS.findUsageMistakes(text)` — 111 hand-written Arab-learner mistakes, each with a pattern (tested by `tools/test_traps.js`); the `tense` ones (yesterday + a present verb, "didn't went") are soft |
| `core/frequency.js` | `VS.frequency` — loads `assets/data/frequency.js` after start-up; `rank(word)` (best rank of the word's forms), `band(word)` → Top 1,000 … Rare |
| `core/week.js` | `VS.week` — the Saturday–Friday week, its numbers and when the report is due; `VS.milestones` |
| `core/study-time.js` | active study time + break reminder |
| `core/importer.js` | `VS.importer` — parse pasted tables and word files |
| `core/autofill.js` | `VS.google` — every call to Google's free translate endpoint (auto-fill, spelling, Arabic → English, From text) goes through `VS.google.json()`: a 429/403/5xx pauses Google for 10, then 30 minutes, callers fall back, and `status()` tells Settings. `VS.autofill` — fills a new word's details in the background (incl. `goes`: collocations from Datamuse); `senses(word)` for Other meanings. Each meaning gets its own Arabic (matched through Google's back-translations), and a word is flagged `check: { kind: "spelling" \| "meaning" }` when it is a likely typo or its meanings translate differently; `review()` flags typos saved before the check existed. A word filled while Google was down is `partial` (with `tries`): it is filled again from scratch when Google is back (if not studied yet), at most three times |
| `core/spelling.js` | `VS.spelling` — "Did you mean receive?" before a word is added: words outside the 30,000-word list are checked with Google's spelling correction, or offline by edit distance against that list; `confirm(text, el)` asks under the add box; `chooseEnglish(ar, el)` turns Arabic typed in an add box into English choices (Google, ar→en), each with its Arabic back-translation |
| `core/grammar.js` | `VS.grammar.check(text)` — LanguageTool for Use it: grammar and spelling, online and optional; skipped quietly when offline |
| `views/shared.js` | `VS.ui.*` — word row, tags, note box, activity header, results, keyboard guard |
| `views/home.js` | `VS.today` — today's plan, shown at the top of the library |
| `views/*.js` | one screen each: library (home), cards, recall, quiz, spell, match, speak, write (Use it), stats, week, print, import, data, transfer, wallet |
| `app.js` | router, app bar, settings, click + keyboard handling, focus keeping, boot |

## Routes

| Hash | Screen | Words |
| --- | --- | --- |
| `#/` | home = the library: add a word, today's plan, your words | every word |
| `#/recall` | recall | words due today |
| `#/quick` | Quick 5 (the recall screen) | the 10 that matter most: due first (oldest, weakest), then weak learning words |
| `#/new/cards` | learn new words | the rest of today's *New words per day*, oldest added first |
| `#/today/quiz\|spell\|match\|write\|speak` | practise today's words | words first studied today |
| `#/word/<mode>?id=borrow` | an activity over one word (Use it from a word's details) | that word |
| `#/all/<mode>` | activity | the whole library |
| `#/tricky/<mode>` | activity | words missed 3+ times |
| `#/pick/<mode>?filters` | activity | a filtered list from the library |
| `#/words?filters` | the library with filters (same screen as `#/`) | filtered and sorted |
| `#/wallet` | words kept from examples, waiting to be learned | wallet entries |
| `#/add[?tab=text]` | add words: type, from text, paste a list, upload | — |
| `index.html?share-text=…` | a word or short phrase shared to the app → Wallet; longer text → `VS.capture` → Add words | — |
| `#/data` | backup, restore, export | — |
| `#/stats` | progress charts, this week, next milestone | history |
| `#/week[?start=YYYY-MM-DD]` | your week, Saturday to Friday | history |
| `#/transfer` | move to another device by QR code | everything |
| `#/print/<scope>[/layout][?filters]` | print / PDF | recall, tricky, all, today, new or pick |

## Today's plan

1. **Recall** what's due. 2. **Learn new words** (cards over `new`), capped at
*New words per day*: words first met today count toward it, so stopping halfway
keeps the rest for today and the plan never overstates what's left.
3. **Practise today's words** with Quiz → Spell → Match (and Speak when it is
turned on in Settings). When an
activity ends it calls `VS.finishStep(scope, mode)`, which marks the step done
for today (`store.markDone("today", mode)`) and returns the next step's link.
The strip also shows *Daily goal* progress: answers today against the goal in
Settings (hidden when the goal is off).

## A view

```js
VS.views.quiz = {
  start(params)  { /* new session when the route is entered */ },
  render(params) { return html`…`; },          // required
  mount(root)    { /* focus, listeners after render */ },
  leave()        { /* stop timers */ },
  actions: { pick(el) { … } },                  // <button data-action="pick">
  keys(event)    { /* shortcuts */ },
  crumbs(params) { return [{ label: "Quiz" }]; },
};
```

`VS.app.render()` re-renders the current view after its state changes. It keeps
keyboard focus on the same control, and the screen's entrance plays only once.

## Spaced repetition (core/store.js)

Each word has a **box** 0–6 and a **due** date.

| Event | Effect |
| --- | --- |
| First meeting on a card (`grade(id, g, { meet: true })`, box 0) | box 1 (I know it / Still learning) — not a right or wrong answer, not in accuracy; counts for the daily goal as `today.met` |
| Right answer on a new or due word | box + 1 (Easy in recall: + 2), due = today + wait |
| Right answer on a word not yet due | counted only — cramming doesn't move it |
| Wrong answer / Forgot / Still learning | box 1, due tomorrow |

`grade()` returns an undo token; `VS.store.undo(token)` puts the word and
today's counts back (Undo in cards and recall — a mis-tap on a phone).
Recall suggests the honest grade from what was typed: exact → Got it, one
slip (`VS.isAlmost`, Levenshtein) → Got it without Easy, anything else → Forgot.

Waits per box: 1, 3, 7, 14, 30, 60 days. Box 4+ = **mastered**.
Writing a sentence that passes in **Use it** is a right answer (`grade(id, "good")`).
Tricky = 3+ wrong answers, more wrong than half the right ones, not mastered.

## What the learner writes

Each word can carry the learner's own language: `context` and `source`
(where they met it — From text and Share fill them), and `mine` (sentences
written in **Use it**, newest first, five kept; `store.addSentence`).
Recall's gap questions prefer these over the dictionary example.
`VS.checkSentence(word, text)` (core/practice.js) marks a sentence on the
device: the word in any form (`VS.findIn`), at least four words, not a copy,
and every usage-trap pattern over the whole sentence. When only soft (tense)
traps fire, the learner may "Keep it anyway": the sentence is saved and also
listed in the word's `unsure`, and Recall never uses an `unsure` sentence as
a cue — a mistake shown back as a reminder gets learned.

**Learn new words** (views/cards.js) teaches before it tests: *Meet* shows
each word open on one card with a single "Next" (nothing graded), then
*Check* runs the flip cards that feed the schedule. The counter counts words;
a word shown again says "Once more".

The card is one component with three bands (`views/cards.js` +
`views/activities.css`): a meta band (level, type, frequency), a reading body,
and a foot with the next micro-action. Front, back and Meet share the bands;
Meet is left-aligned and never flips. The card caps at 660px so it shares an
edge with the activity header and the answer bar. Sound is one pill (speaker
+ IPA, bare speaker when there is no IPA). Pronunciation and usage notes are
not rendered on any card face — the word page and Speak own them.

## The wallet (`core/store.js`, `views/wallet.js`)

`state.wallet` is a list of `{ id, word, sentence, source, kind?, arabic?,
folder, added }`, newest last, capped at 300. `state.walletFolders` is
`[{ id, name }]`, built-ins first (`general`, `shared`). `walletAdd(word,
sentence, source, kind, arabic, folder)` refuses a word already in the library
and reports a duplicate; the folder defaults to `shared` for a shared word and
`general` otherwise; the Arabic may come from the learner (typed Arabic, or the
gloss on a word card) or from the quiet lookup after an English word is typed.
`walletRemove` returns the entry for Undo; `walletClear(folderId)` returns
everything removed from the whole wallet or one folder. `walletSetFolder` moves
one entry and returns `{ from }` for Undo. `walletFolderCreate`,
`walletFolderRename` and `walletFolderDelete` return `{ ok, folder }` or
`{ ok: false, error }`; deleting moves the folder's words to General.
`normalizeWallet` migrates old saves (shared → Shared, everything else →
General), adds missing built-ins, falls back from unknown ids, and enforces the
name rules. Adding a wallet word to the library removes it from the wallet
(`views/import.js`). The wallet is content, so **Reset progress** keeps it and
its folders and **Start over** returns them to General + Shared; `exportJSON`
includes both and `mergeJSON` joins folders by id then case-insensitive name,
remaps incoming entries and unions words by id, skipping words now in the
library.

The wallet is reached from the bottom tab bar on phones and tablets (fifth
tab, with a count badge) and from the `NAV` link on desktop. Progress is not a
tab: it lives in More on phones and tablets. `VS.walletCapture`
is the one capture path shared by the wallet's pocket and Today's compact box:
it resolves typed Arabic through `VS.spelling.chooseEnglish`, keeps the typed
Arabic as the entry's meaning, refuses words already in the library or the
wallet (with a toast that names the folder), plays the pop, offers Undo, and
looks up the Arabic of a typed English word afterwards (`VS.arabicWord`,
Auto-fill on and online only). The wallet searches past six entries and offers
two doors per word through `VS.walletDraft`: `{ ai: true, items, tag }` opens
Add → With AI with the words typed and their sentences and Arabic in
`st.ai.ctx`, so `VS.aiPrompt` / `VS.aiPromptMany` carry them ("use THAT
meaning") and each added row keeps its `context`, `source` and (when missing)
its wallet `arabic`; a folder batch also sets the visible batch tag and offers
a **Study** toast after adding. `{ word, context, source, arabic }` opens the
Add form. There is no sixth tab.

The page keeps the selected folder in the address (`#/wallet?folder=film`).
`views/wallet.js` validates it on `start()` and again in `render()`; an unknown
id falls back to All and the address is cleaned. Chips are links; the header,
pocket destination, search, no-results line, bulk AI, empty state and Clear
all read from `snapshot()`, which returns the whole wallet, the selected
folder's list and per-folder counts from one read. The folder sheet and move
sheet are body-level native dialogs so a re-render behind them does not close
them; the folder sheet stays open while `VS.confirm` deletes a folder.

**The slip (v20).** `slip(e, i)` renders one `<article class="wallet-slip">`:
a plain tabular index number (`wallet-slip-n`, no chip), a head with
`VS.ui.headword` and a square speaker, `.wallet-translation` — a small
uppercase **Translation** label above the Arabic — then the kept sentence as a
serif margin quote (`wallet-sentence`) with the word marked, and one meta line
where the folder is a quiet text button (`wallet-folder-tag`, opens the move
sheet) followed by source and day. There is no footer hairline:
`.wallet-actions` sits on spacing alone, with Make with AI, Add now and a quiet
remove. Arabic can arrive after the slip is painted (auto-fill);
`paintArabic()` replaces the text and, when the slip had none, inserts the
whole `.wallet-translation` block, so the label never appears without its
Arabic. The move sheet title and the remove confirm use `VS.cap(e.word)`,
matching the headword on the slip.

**Clear (v20).** `Clear wallet` / `Clear folder` is a `btn-danger-quiet` with
a trash icon in `.wallet-end` below the list — not a text link inside the page
head. The quiet line beside it says the wallet is saved on this device and in
the backup; the button opens `VS.confirm` (whose title names the whole wallet
or the folder) and the toast offers Undo through `walletRestore`. The folder
sheet's rows are unruled: spacing, a 6px hover fill and an 8px radius carry the
grouping, and the create form has no rule above it either.

Today's compact add box (`data-capture="wallet"`) routes its submit to
`VS.walletCapture` and names the current General folder; a pasted English
sentence of five or more words still opens Add → From text, checked after
Arabic. The first-run box (`data-capture="library"`) keeps creating the first
library word, because its example card is the screen's promise. The wallet
count in the note and the bar comes from the same `state.wallet`; the tab badge
stays global while the chips show each folder's count.

## Sharing words with a friend (core/share.js, views/share.js)

`VS.share.encode({ title, from, note, keys, words })` packs a list as rows of
values (`k` names the fields: a d e p l i c), deflate-raw + base64url, marked
`z.` (or `u.` where CompressionStream is missing); `VS.share.link(payload)`
puts it after `#/shared?d=`, so no server ever receives it. `decode` throws
`broken` (a cut link), `old-browser` or `version`. `#/share` builds the
payload a moment after each change and paints the send panel in place;
`#/shared` adds through `VS.saveWords` (views/import.js: Auto-fill, wallet
clean-up) or keeps them in the wallet (`walletAdd(…, "shared", arabic)`).
Limits: 200 words a link, a QR while the link is ≤ 1,800 characters.

## Moving between devices (views/transfer.js)

`store.exportJSON()` → deflate (`CompressionStream`) → base64 → frames of
600 characters (900 for big libraries): `VS1:<session>:<z|u>:<part>:<parts>:<data>`.
The sender loops the frames as QR codes (assets/vendor/qrcode.js); the
receiver reads them from the camera (`BarcodeDetector` where it exists,
assets/vendor/jsQR.js otherwise), in any order, then `store.mergeJSON`.

## The learner's words

`VS.store.saveUserWords(words)` adds them to `state.library` and returns
`{ added, skipped, needsArabic }`. The rule is **one English word per Arabic
meaning**: `VS.arKey` removes diacritics and tatweel, unifies alef/ya/ta-marbuta,
drops punctuation, collapses spaces and a leading `ال`, so "البنك." and "بنك"
match. The first meaning keeps the base id (`bank`); every further meaning gets
a hidden, stable `variant` (`bank~بنك`, id `bank~ضفه`) that is never shown in
the interface. Same word + same Arabic meaning is `skipped`; same word with no
Arabic on the new row is `needsArabic`; same word + a different Arabic meaning
is added as a variant.

Only the fields the learner gave are stored; `core/autofill.js` fills the empty
ones later with `store.fillUserWord` — never overwriting (the only exception: a
capital the dictionary proves, "wednesday" → "Wednesday", which keeps the id).
Words added offline keep `auto: "todo"` and are filled when the app is next
online. `editUserWord` returns `{ id, variant }` after a change, or an error
(`duplicate`, `needsArabic`); it moves progress, notes and tags when the id
changes. `deleteUserWords` / `resetWords` work on any list (the library's
actions).

`VS.parseTags` splits on `, ; ، #`, trims, removes repeats and caps at 12.
Tags are stored on the word, shown in its open row, and edited in the same
form as its other fields. A word can carry as many tags as the learner wants.

## Adding words with AI (`views/import.js`, `views/shared.js`)

The "With AI" tab has one shared ask row: **ChatGPT**, **Claude** and **Copy
prompt** (`VS.aiAsk`, the same component in the "Fill it in with AI" panel).
ChatGPT and Claude open with the prompt already typed; Copy is for Gemini or
any other chat. The prompt asks for one block per word — or two blocks for one
English word with two common meanings, each with its own Arabic — carrying
`arabic`, `definition`, `example`, `type`, `level`, `ipa`, and `tags`.
`VS.parseAiWords` reads it whether the AI answers with labelled lines, a table
or JSON, and keeps at most three tags per word. The learner can then edit each row — including its
tags — untick one, or add "Tags for all", which merges into every added word.
The review marks each row **Ready**, **Another meaning**, **In your library**
or **Needs Arabic** using the same Arabic-aware duplicate rule as the store; a
blocked row cannot be added. Nothing is saved until **Add N words**.

A closed row is one line: `views/shared.js` adds the full text as a `title`,
and `views/library.css` clips the headword and the Arabic with an ellipsis.
Opening the `<details>` switches both to normal wrapping, so the full meaning
is readable on a phone; `views/import.js` applies the same single-line rule to
"Just added" rows. There is no `is-long` branch — one rule at every width.

## Installable app (PWA)

`manifest.webmanifest` names the app and its icons (`tools/build_icons.py`
renders them from `assets/favicon.svg`). `tools/build.py` writes `sw.js` from
`tools/templates/sw.js` with the exact list of files to keep offline, fonts
and the PDF maker included. Pages load network-first;
versioned styles and scripts load cache-first. The service worker only runs
over http(s); opened as a file the app works without it.

## Tools

| Command | Does |
| --- | --- |
| `python3 tools/build.py` | write `index.html` and `sw.js`, then run the checks |
| `python3 tools/check.py` | missing files, classes without CSS, duplicated helpers |
| `python3 tools/vendor.py` | download the fonts and the PDF maker into the project (run by hand, commit the result) |
| `python3 tools/build_icons.py` | app icons from the brand mark |
| `python3 tools/screenshots.py [names]` | phone / tablet / desktop screenshots of every screen |

## Conventions

- **Edit sources, not outputs:** `assets/`, `tools/templates/`.
- **One helper, one home.** Escaping, shuffling, storage, dates and filters live in `core/`.
  `check.py` fails if a view re-implements them.
- **New screen:** add `assets/js/views/name.js`, add it to `SCRIPTS` in
  `tools/build.py`, add its route in `app.js → parse()`, add CSS to
  `assets/css/views/`.
- **Colours, sizes, fonts** only through tokens (`assets/css/tokens.css`).
- **Comments say why**, not what. Names say what.
