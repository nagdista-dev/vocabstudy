# VocabStudy

**A free, open-source app for Arabic speakers learning English vocabulary.**
Tell it a word you want to remember — the app fills in its Arabic meaning,
definition, example and pronunciation, teaches it to you, and brings it back
on spaced days (1, 3, 7, 14, 30, 60 days later) until it stays. It ships with
no words: your library is yours from the first one.

**Open it: https://vocabstudy.nagdista.com/** — then
*Install app* / *Add to Home Screen*. No account, no ads, no server: your
words and progress stay on your device, and it works offline.

## How it works

1. **Add words to your library** — the home screen. Type a word and press
   Enter: that's all. Auto-fill adds the Arabic meaning, the most common
   definition with its own example, similar words, the IPA (in your accent)
   and the type. Met the word in another meaning? **Not the meaning you met?**
   lists every sense, and one tap switches. (The CEFR level is yours to set:
   no free source knows it reliably.)
   Met it in an article, a series or an email? **Share it to VocabStudy**
   (phone), click the **bookmarks-bar button** (computer), or paste the
   paragraph into **From text** and tap the words you don't know — each keeps
   the sentence it came from. Or paste a list from Excel / Google Sheets /
   Notion, or upload `.csv` / `.tsv` files. Each word lives in your library
   once: duplicates are caught.
2. **Follow today's plan**, right above your words:
   **Recall** what's due → **Learn new words** (10 a day by default) →
   practise today's words with **Quiz, Spell and Match** → **Use it**: write
   a sentence of your own — and **Speak** when you turn it on in Settings.
   Only five minutes? **Quick 5** brings the 10 words that matter most.
3. **Your library is the brain.** Search, filter and sort every word, tag them
   your way (IELTS, Work, Travel…), then practise, print or export exactly the
   list you're looking at.

## Made for Arabic speakers

- **The teacher's margin: 108 usage traps.** The mistakes Arab learners make
  with a word, and the fix: *depend ~~of~~ on*, *~~borrow~~ lend me*,
  *~~before~~ three years ago*, *I ~~did~~ made a mistake*, *an ~~advice~~*,
  *actually ≠ حالياً*. Written by hand, shipped with the app, no internet.
- **Use it**: write a sentence about your own life with the word. The app
  marks it like a teacher — on your device: the word is there (any form),
  it's a full sentence, it isn't copied, and none of the 108 traps is hiding
  in it ("depends of — you wrote"). Online, LanguageTool also reads its
  grammar ("She don't", "I didn't went"). Your sentences come back in Recall.
- **Goes with**: the words English puts with yours — *heavy* rain, *final*
  decision, *subtle* differences — because "strong rain" is exactly where
  Arab learners slip. **More examples** brings real sentences from Tatoeba.
- **Where you met it**: the sentence you found the word in, and the source.
  Recall asks with your own sentences first — the strongest cue there is.
- **Stress you can see**: ○●○○ for pro·CRAS·ti·nate, read from the IPA —
  the dots a teacher draws on the board.
- **Is this word worth your time?** Every word shows how common it is —
  *Top 1,000* to *Rare* — from a list of the 30,000 most used English words
  that ships with the app. A word counts with its forms (borrow, borrowed,
  borrowing). Filter and sort by it; new words added the same day are
  learned most common first.
- **Real recordings**: a person saying the word (American or British) from
  the dictionary when you're online; your browser's voice when you're not.
- **Sound traps** on every word that has one: P (not B), V (not F), silent
  letters (know, listen, island), -ed endings, TH, the extra vowel before
  "st" — and the classics (comfortable, Wednesday, vegetable).
- **Speak**: say the word out loud and the app tells you what it heard.
- **Arabic keyboard warning**: typed «ش» instead of "a"? You get a calm
  "switch your keyboard to English", not a wrong answer.
- Arabic meaning on every card, sized for easy reading, right to left.

## Features

**Remember, not just recognise**
- Daily **recall** (active recall + spaced repetition): from the meaning or
  from a sentence with a gap — you bring the English word back yourself.
  Stuck? A **hint** gives the first letter, then more. Type it and the app
  checks it: a one-letter slip is **Almost**, and it shows the letters you
  missed. Mis-tapped a grade? **Undo**.
- Meeting a new word for the first time is not a test: "Still learning" on
  a card you've never seen is not counted as a mistake.
- **Tricky words**: the ones you keep missing get their own practice.
- Recall **forecast** for the next 7 days.
- **Your week**, Saturday to Friday, ready every **Thursday**: words that
  stuck, days studied, new words, answers and time next to last week's,
  and one note on what to do next. **Milestones** at 100, 500 and 1,000
  words mastered.

**Learn**
- Study cards (English-first or Arabic-first), swipe on phones, with similar words.
- Quiz with 5 question types incl. **listening**; every answer shows the full
  word, and a wrong pick shows what *that* word means — the difference is the lesson.
- Spelling from sound with letter-by-letter feedback.
- **Speak** with your browser's speech recognition (off by default; turn it
  on in Settings).
- **Practise your mistakes** straight after a round. **Notes** on any word.

**Your library, your way**
- Filters: status, level, type, memory box, date added, tag, notes,
  tricky words, sound traps. Sorts: A–Z, newest, oldest, weakest, due soonest,
  most mistakes, level. The filters stay in the address, so lists are bookmarkable.
- Practise, print, export, reset or delete any filtered list.
- **Edit or delete** any word you added; editing keeps its progress.
- **Progress** charts: study time, answers, mastered words, memory strength.
- **Download PDF** or print — 7 layouts: word sheet, compact list, fold-over
  self-test, fill-the-gap and matching worksheets, write-a-sentence, and
  double-sided cut-out cards.
- **Backup & export**: one-file backup saved wherever you choose, restore by merge or replace, CSV.

**Made for long study days**
- Calm light design; **Atkinson Hyperlegible** so look-alike letters
  (l I 1, rn m) are never confused.
- Break reminders, real study time, daily goal, streak, text size, accent colour.
- Full keyboard control; bottom navigation on phones.

Keyboard: `n` new word · `/` search · `Space` flip / reveal / speak · `1`–`4` answer · `Enter` next.

## Your data stays yours

Everything lives in your browser (localStorage). The app has no server and
loads nothing from anyone else — fonts, the PDF maker, the QR libraries and the
word-frequency list ship with it. These use free online services (no account,
no key), and each one is optional:

| Feature | What is sent | Where |
| --- | --- | --- |
| Auto-fill (when you add a word) | only the English word | Google Translate (free web endpoint), dictionaryapi.dev, api.datamuse.com (the words it goes with), mymemory.translated.net (fallback) |
| Grammar check (Use it, when you press Check) | only that sentence | api.languagetool.org |
| More examples (when you tap it) | only the English word | api.tatoeba.org |
| Recorded voice (Settings → Sound) | nothing — the recording is downloaded | dictionaryapi.dev |
| Speak (Chrome / Edge) | your voice, by the browser itself | the browser's speech service |

**Move to another device** by QR code: one device shows a moving code, the
other reads it with its camera and merges — no internet, no account, nothing
on a server. **Backup & export** saves everything to one file — choose the
folder and name in the save dialog. Restore it on another device, or merge
phone and laptop. Browsers without a save dialog download the file instead.

## Run it yourself

No install needed: download the repo and open `index.html`. To change the
code, rebuild after editing:

```bash
python3 tools/build.py    # writes index.html and sw.js, then checks everything
python3 tools/check.py    # missing files, unstyled classes, duplicated helpers, usage traps (with Node)
node tools/test_traps.js  # every usage trap catches its own mistake and leaves good English alone
```

```text
index.html, sw.js         generated — don't edit (tools/build.py)
assets/css/               tokens → base → components → screens → motion → glass
assets/js/core/           library, progress (spaced repetition), filters, auto-fill, speech, importer
assets/fonts, assets/vendor  self-hosted fonts, PDF maker and QR libraries (tools/vendor.py)
assets/data/frequency.js  the 30,000 most used English words (tools/frequency.py, wordfreq, CC BY-SA 4.0)
about.html                the Arabic introduction page (the app itself stays English)
assets/js/views/          one file per screen
assets/js/app.js          routing, navigation, settings, keyboard
tools/                    build · check · build_icons · screenshots · templates
docs/                     architecture, design, learning guide
```

| Read | to… |
| --- | --- |
| [about.html](about.html) | introduce the app to a friend — in Arabic |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | understand how the app boots, routes and schedules recall |
| [docs/DESIGN.md](docs/DESIGN.md) | change colours, fonts, spacing, motion or sounds safely |
| [docs/LEARN.md](docs/LEARN.md) | learn web development from this codebase (Arabic) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | send an improvement |

## Updating the app

```bash
# 1. change the code (assets/, tools/templates/)
python3 tools/build.py            # 2. rebuild + check
open index.html                   # 3. try it (or: python3 -m http.server)
git add -A && git commit -m "…"   # 4. save the change
git push                          # 5. publish
```

Pushing to `main` runs `.github/workflows/pages.yml`, which checks, builds
and publishes the site. Installed apps pick up the new version and show
**“A new version is ready — Update now”**. Learners' words and progress are
untouched by updates.

## License

[MIT](LICENSE) — free to use, change and share.
