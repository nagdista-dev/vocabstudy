# Your word sets (private)

Put your own sets here: one file per study day, named `YYYY-MM-DD.js`.

```bash
python3 tools/new_day.py              # creates today's file
python3 tools/build.py                # builds your pages from this folder
```

**This folder is never uploaded.** `.gitignore` excludes every `.js` file
here, so your words stay on your computer. When this folder has no sets,
the build uses the Starter set in `data/sample/` instead — that is what
the public website shows.

You can also add words without any tools: open the app → **Add words** →
paste a table. Those words are saved in your browser.
