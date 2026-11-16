# VocabStudy

**A free, open-source app for Arabic speakers learning English vocabulary.**
Type a word — the app fills in its Arabic meaning, definition, example and
pronunciation, teaches it to you, and brings it back on spaced days (1, 3, 7,
14, 30, 60 days later) until it stays.

**Open it: https://nagdista-dev.github.io/vocabstudy/** — then
*Install app* / *Add to Home Screen*. No account, no ads, no server: your
words and progress stay on your device, and it works offline.

![Home: today's plan, word spotlight and daily goal](docs/screenshot-home.png)

## How it works

1. **Add words to your library.** Type a word and press Enter — that's all.
   Auto-fill adds the Arabic meaning, definition, example, IPA, type and level.
   Or paste a list from Excel / Google Sheets / Notion, or upload `.csv` / `.tsv`
   files. Each word lives in your library once: duplicates are caught.
2. **Follow today's plan** on the home screen:
   **Recall** what's due → **Learn new words** (10 a day by default) →
   practise today's words with **Quiz, Spell, Match and Speak**.
3. **Your library is the brain.** Search, filter and sort every word, tag them
   your way (IELTS, Work, Travel…), then practise, print or export exactly the
   list you're looking at.

Not ready to add words yet? Try the built-in **Starter set**: 30 words Arabic
speakers often mix up (borrow / lend, affect / effect, actually ≠ حالياً).

## Made for Arabic speakers

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
- **Tricky words**: the ones you keep missing get their own practice.
- Recall **forecast** for the next 7 days.

**Learn**
- Study cards (English-first or Arabic-first), swipe on phones.
- Quiz with 5 question types incl. **listening**; every answer shows the full word.
- Spelling from sound with letter-by-letter feedback.
- **Speak** with your browser's speech recognition.
- **Practise your mistakes** straight after a round. **Notes** on any word.

**Your library, your way**
- Filters: status, level, type, memory box, date added, tag, source, notes,
  tricky words, sound traps. Sorts: A–Z, newest, oldest, weakest, due soonest,
  most mistakes, level. The filters stay in the address, so lists are bookmarkable.
- Practise, print, export, reset or delete any filtered list.
- **Edit or delete** any word you added; editing keeps its progress.
- **Progress** charts: study time, answers, mastered words, memory strength.
- **Download PDF** or print — 7 layouts: word sheet, compact list, fold-over
  self-test, fill-the-gap and matching worksheets, write-a-sentence, and
  double-sided cut-out cards.
- **Backup & export**: one-file backup, restore by merge or replace, CSV.

**Made for long study days**
- Calm light design; **Atkinson Hyperlegible** so look-alike letters
  (l I 1, rn m) are never confused.
- Break reminders, real study time, daily goal, streak, text size, accent colour.
- Full keyboard control; bottom navigation on phones.

<img src="docs/screenshot-cards-phone.png" alt="A study card on a phone" width="240"> <img src="docs/screenshot-quiz-phone.png" alt="A quiz question on a phone" width="240">

Keyboard: `Space` flip / reveal / speak · `1`–`4` answer · `Enter` next · `/` search.

## Your data stays yours

Everything lives in your browser (localStorage). The app has no server and
loads nothing from anyone else — fonts and the PDF maker ship with it.
Two things can use the internet, and both can be switched off in Settings:

| Feature | What is sent | Where |
| --- | --- | --- |
| Auto-fill (when you add a word) | only the English word | dictionaryapi.dev, mymemory.translated.net |
| Speak (Chrome / Edge) | your voice, by the browser itself | the browser's speech service |

**Backup & export** saves everything to one file; restore it on another
device, or merge phone and laptop.

## Run it yourself

No install needed: download the repo and open `index.html`. To change the
code, rebuild after editing:

```bash
python3 tools/build.py    # checks everything and writes index.html, data/words.js, sw.js
python3 tools/check.py    # data, missing files, unstyled classes, duplicated helpers
```

```text
index.html, data/words.js, sw.js   generated — don't edit (tools/build.py)
data/sample/              the Starter set and a sample import table
assets/css/               tokens → base → components → screens → motion
assets/js/core/           library, progress (spaced repetition), filters, auto-fill, speech, importer
assets/fonts, assets/vendor  self-hosted fonts and PDF maker (tools/vendor.py)
assets/js/views/          one file per screen
assets/js/app.js          routing, navigation, settings, keyboard
tools/                    build · check · build_icons · screenshots · templates
docs/                     architecture, design, learning guide
```

| Read | to… |
| --- | --- |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | understand how the app boots, routes and schedules recall |
| [docs/DESIGN.md](docs/DESIGN.md) | change colours, fonts, spacing, motion or sounds safely |
| [docs/LEARN.md](docs/LEARN.md) | learn web development from this codebase (Arabic) |
| [CONTRIBUTING.md](CONTRIBUTING.md) | send an improvement |

## Updating the app

```bash
# 1. change the code (assets/, data/sample/, tools/templates/)
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
