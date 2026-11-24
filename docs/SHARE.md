# Share with — send words to a friend, learn them together

> Goal: a learner picks any of their words and sends them — as a link, a QR
> code, a message or a file — and the friend opens them, sees exactly what
> was sent, adds the ones they want and starts learning. The friend can send
> them on again. No account, no server: the words travel inside the link.

## Who uses it (thinking as a learner)

| Who | What they want | What the page must do |
| --- | --- | --- |
| A teacher, every week | 20–40 words to a class group, with a title | a list chosen by tag or filter, a title and a short note, a QR on the projector, a link in WhatsApp |
| A friend, after an episode | the 5 words they met, with the sentence | pick by hand, include "where I met it" |
| Anyone, one word | "look at this word" | Share from the word's own page, one tap |
| The friend who receives | see before adding, skip what they know, keep some for later | a preview, "already yours" marked, Add / Save for later, a tag, Learn now |
| A friend with no app yet | it must just work | the link opens the app with the words first; nothing to install |
| A friend in another country | Arabic in their own dialect | "Use their Arabic" on by default, off → auto-fill writes it |

## Rules it keeps

- **Nothing private travels.** Progress, notes, your own sentences and the
  wallet are never in a link unless you tick them (only "where you met it"
  can be ticked). The page says what goes.
- **Nothing passes through a server.** The words are in the link's `#`
  part, which browsers never send to any server.
- **Nothing is added on open.** The friend sees the list first; Add is theirs.
- The app's identity: `page-head`, `.field`, `.word-list`, the app's buttons
  (rounded rectangles), yellow only for memory, red only for wrong.

## The link

`https://vocabstudy.nagdista.com/#/shared?d=<payload>`

- payload = base64url( deflate-raw( JSON ) ), JSON
  `{ v: 1, t: title, f: from, m: note, k: fields, w: [[word, …fields], …] }`
  — rows of values, not objects, so 40 words stay a few KB.
- Fields chosen by the sender (`k`): `a` Arabic, `d` definition, `e` example,
  `p` part of speech, `l` level, `i` IPA, `c` where you met it. "Words only"
  sends just the words — the shortest link; the friend's app fills them in.
- Budget: up to 200 words. Over ~6,000 characters the page says some chat
  apps may cut it and offers "Words only" or a file. A QR is offered while
  the link fits one code (~1,800 characters).
- A cut or damaged link opens a calm page that says so and what to ask for.

## Sending (`#/share`)

1. **Choose the words.** It starts from where you came: the Words page's
   current filter, one word's page, or everything. A source picker (All · New
   · Learning · Mastered · a tag) and a search narrow the list; every row has
   a checkbox; Select all / None; "12 of 40 chosen".
2. **Say what it is** (optional). A title (prefilled from the tag), your name
   (remembered on this device) and a short note.
3. **What goes.** Arabic ✓ · Definition and example ✓ · Part of speech,
   level and IPA ✓ · Where I met it ☐ · or **Words only**.
4. **Send.** Share… (the phone's own share sheet: WhatsApp, Telegram, Mail),
   Copy link, Copy as a message (a readable list + the link), QR code, and
   Download a file (CSV, opens in Add → Upload files).

Desktop: the list on the left, the note, options and send panel on the right
(sticky). Phone: one column, the send panel last, a bottom bar "Share 12
words" that brings you to it.

## Receiving (`#/shared?d=…`)

- Who sent it, the title and the note, the count ("18 words · 3 already yours").
- The list with checkboxes (already-yours rows are marked and unticked):
  each word with its Arabic, definition and example — the same row anatomy as
  the library.
- Options: a tag (the title, so the list stays together) and "Use their Arabic".
- `Add N to my words` (primary) and `Save N for later` (to the wallet).
- After adding: the words are in the library; `Learn them now` opens
  `#/pick/cards?tag=…`, and `Share them on` closes the loop.
- First run: the friend sees the shared list before the level/dialect sheet.

## Entry points

- Words page: `Share` beside `Print & PDF`, and `Share these words` in Manage.
- A word's page: a `Share` button beside Edit and Delete.

## Done when

The codec round-trips Arabic, emoji and 200 words; a link from one browser
opens in another; checks, traps and every JS file pass; the send and receive
pages are checked at 375, 768 and 1280 in Light and Night; it is live.
