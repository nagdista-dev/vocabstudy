#!/usr/bin/env python3
"""Check the word data and the generated site.

    python3 tools/check.py              # data + pages
    python3 tools/check.py --data-only  # just the word files (build.py runs this)

ERRORS stop the build: a broken file, a missing field, a bad level.
WARNINGS are worth a look but don't stop anything:
  • the same word in two days (fine if intended — it is practised twice)
  • an example sentence that doesn't contain its word ("Fill the gap"
    and the highlighted example then skip it)
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import data_dir  # noqa: E402  — one rule for where the words come from

DATA = data_dir()
FIELDS = ["word", "type", "level", "example", "arabic"]          # required
OPTIONAL = ["ipa", "definition"]                                   # a warning when empty
LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}
TYPES = {"Noun", "Verb", "Adjective", "Adverb", "Phrase", "Phrasal Verb", "Idiom",
         "Interjection", "Conjunction", "Determiner", "Preposition", "Pronoun"}
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ROW = re.compile(r"^\s*\{(.*)\},?\s*$")
PAIR = re.compile(r'(\w+):\s*("(?:[^"\\]|\\.)*")')


# The "is the word in its example?" check runs the app's own matcher
# (VS.findInExample in assets/js/core/practice.js) through Node, so the
# checker can never disagree with what the app highlights. Without Node
# the check is skipped with a note.
NODE_MATCHER = r"""
const fs = require("fs"), vm = require("vm"), path = require("path");
const root = process.argv[1];
const ctx = { window: {}, console };
ctx.window = ctx; vm.createContext(ctx);
for (const f of ["assets/js/core/vs.js", "assets/js/core/word-forms.js", "assets/js/core/practice.js"])
  vm.runInContext(fs.readFileSync(path.join(root, f), "utf8"), ctx);
const dir = process.argv[2];
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort())
  vm.runInContext(fs.readFileSync(path.join(dir, f), "utf8"), ctx);
const missing = ctx.VS.allWords().filter((w) => !ctx.VS.findInExample(w, true)).map((w) => w.day + " | " + w.word);
console.log(JSON.stringify(missing));
"""


def examples_without_word() -> list[str] | None:
    node = shutil.which("node")
    if not node:
        return None
    out = subprocess.run([node, "-e", NODE_MATCHER, str(ROOT), str(DATA)], capture_output=True, text=True)
    if out.returncode:
        raise SystemExit("matcher failed:\n" + out.stderr)
    return json.loads(out.stdout)


def check_data(errors: list[str], warnings: list[str]) -> int:
    seen = defaultdict(list)
    total = 0
    files = sorted(DATA.glob("*.js"))
    if not files:
        errors.append("data/days/ has no word files")
    for f in files:
        name = f"{DATA.relative_to(ROOT)}/{f.name}"
        if not ISO.match(f.stem):
            errors.append(f"{name}: file name must be YYYY-MM-DD.js")
            continue
        text = f.read_text(encoding="utf-8")
        if f'VS.addDay("{f.stem}"' not in text:
            errors.append(f'{name}: must call VS.addDay("{f.stem}", [...])')
        if not text.rstrip().endswith(("]);", "});")):
            errors.append(f"{name}: must end with ]);")
        for n, line in enumerate(text.splitlines(), 1):
            m = ROW.match(line)
            if not m:
                continue
            total += 1
            try:
                w = {k: json.loads(v) for k, v in PAIR.findall(m.group(1))}
            except json.JSONDecodeError:
                errors.append(f"{name}:{n}: a value is not a valid string")
                continue
            where = f"{name}:{n} ({w.get('word', '?')})"
            for field in FIELDS:
                if not str(w.get(field, "")).strip():
                    errors.append(f"{where}: missing {field}")
            for field in OPTIONAL:
                if not str(w.get(field, "")).strip():
                    warnings.append(f"{where}: no {field}")
            if w.get("level") and w["level"] not in LEVELS:
                errors.append(f"{where}: level must be one of {', '.join(sorted(LEVELS))}")
            if w.get("type") and w["type"] not in TYPES:
                warnings.append(f"{where}: unusual type '{w['type']}'")
            if w.get("arabic") and not re.search(r"[؀-ۿ]", w["arabic"]):
                errors.append(f"{where}: arabic has no Arabic letters")
            key = (w.get("word", "").lower(), w.get("sense", "").lower())
            seen[key].append(f.stem)
    missing = examples_without_word()
    if missing is None:
        warnings.append("node not found — skipped the 'example contains the word' check")
    for item in missing or []:
        day, word = item.split(" | ", 1)
        warnings.append(f"{DATA.relative_to(ROOT)}/{day}.js ({word}): example doesn't contain the word")
    for (word, sense), days in seen.items():
        if len(days) > 1:
            same_day = len(set(days)) < len(days)
            target = errors if same_day else warnings
            target.append(f"'{word}{' (' + sense + ')' if sense else ''}' appears in {', '.join(days)}"
                          + (" — twice in one day (give each a different sense)" if same_day else ""))
    return total


def check_pages(errors: list[str]) -> None:
    days = sorted(DATA.glob("*.js"))
    if not (ROOT / "index.html").exists():
        errors.append("index.html is missing — run python3 tools/build.py")
    for d in days:
        if not (ROOT / "days" / f"{d.stem}.html").exists():
            errors.append(f"days/{d.stem}.html is missing — run python3 tools/build.py")
    if not (ROOT / "sw.js").exists():
        errors.append("sw.js is missing — run python3 tools/build.py")
    bundle = ROOT / "data" / "words.js"
    if bundle.exists() and days and bundle.stat().st_mtime < max(d.stat().st_mtime for d in days):
        errors.append("data/words.js is older than a day file — run python3 tools/build.py")
    for page in [ROOT / "index.html", *(ROOT / "days").glob("*.html")]:
        if not page.exists():
            continue
        for ref in re.findall(r'(?:src|href)="((?:\.\./)?(?:assets|data)/[^"?]+)', page.read_text(encoding="utf-8")):
            if not (page.parent / ref).resolve().exists():
                errors.append(f"{page.relative_to(ROOT)}: missing file {ref}")
    # One helper, one home: these must not be redefined outside core/.
    for js in (ROOT / "assets" / "js" / "views").glob("*.js"):
        text = js.read_text(encoding="utf-8")
        for helper in ("function escape", "replace(/[&<>", "Math.random() - .5", "localStorage."):
            if helper in text:
                errors.append(f"{js.relative_to(ROOT)}: uses '{helper}' — use the shared helper in core/ instead")


def main(argv: list[str]) -> int:
    errors: list[str] = []
    warnings: list[str] = []
    total = check_data(errors, warnings)
    if "--data-only" not in argv:
        check_pages(errors)
    if "--quiet" not in argv:
        for w in warnings:
            print(f"  warning  {w}")
    for e in errors:
        print(f"  ERROR    {e}")
    status = "FAILED" if errors else "OK"
    print(f"check {status}: {total} words in {len(list(DATA.glob('*.js')))} day(s), "
          f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
