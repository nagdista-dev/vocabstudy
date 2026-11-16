#!/usr/bin/env python3
"""Check the word data and the generated site.

    python3 tools/check.py              # data + pages
    python3 tools/check.py --data-only  # just the word files (build.py runs this)

ERRORS stop the build: a broken file, a missing field, a bad level.
ERRORS also include the same word twice: the library holds each word once
(give two meanings different senses: "axe (tool)", "axe (cut jobs)").
WARNINGS are worth a look but don't stop anything:
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
const missing = ctx.VS.allWords().filter((w) => !ctx.VS.findInExample(w, true)).map((w) => w.word);
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
        errors.append(f"{DATA.relative_to(ROOT)}/ has no word files")
    for f in files:
        name = f"{DATA.relative_to(ROOT)}/{f.name}"
        text = f.read_text(encoding="utf-8")
        if "VS.addWords([" not in text:
            errors.append(f'{name}: must call VS.addWords([...], {{ source: "starter" }})')
        if not text.rstrip().endswith(("]);", "});")):
            errors.append(f"{name}: must end with ]); or }});")
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
            seen[key].append(f"{name}:{n}")
    missing = examples_without_word()
    if missing is None:
        warnings.append("node not found — skipped the 'example contains the word' check")
    for word in missing or []:
        warnings.append(f"{DATA.relative_to(ROOT)}/ ({word}): example doesn't contain the word")
    for (word, sense), where in seen.items():
        if len(where) > 1:
            errors.append(f"'{word}{' (' + sense + ')' if sense else ''}' is in the library twice: {', '.join(where)}"
                          " — give each meaning its own sense")
    return total


def check_pages(errors: list[str]) -> None:
    sources = sorted(DATA.glob("*.js"))
    if not (ROOT / "index.html").exists():
        errors.append("index.html is missing — run python3 tools/build.py")
    sw = ROOT / "sw.js"
    if not sw.exists():
        errors.append("sw.js is missing — run python3 tools/build.py")
    else:
        # One missing file in the precache list breaks offline install of the app.
        listed = re.search(r"const PRECACHE = (\[.*?\]);", sw.read_text(encoding="utf-8"), re.S)
        for f in json.loads(listed.group(1)) if listed else []:
            if not (ROOT / f.split("?")[0]).exists():
                errors.append(f"sw.js precaches a missing file: {f}")
    manifest = ROOT / "manifest.webmanifest"
    for icon in json.loads(manifest.read_text(encoding="utf-8")).get("icons", []) if manifest.exists() else []:
        if not (ROOT / icon["src"]).exists():
            errors.append(f"manifest.webmanifest: missing icon {icon['src']}")
    bundle = ROOT / "data" / "words.js"
    if bundle.exists() and sources and bundle.stat().st_mtime < max(d.stat().st_mtime for d in sources):
        errors.append("data/words.js is older than data/sample/ — run python3 tools/build.py")
    for page in [ROOT / "index.html"]:
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


# Classes used only as hooks for JavaScript or as plain wrappers — no style needed.
UNSTYLED_OK = {"forecast", "target", "print-preview", "spell-meta", "import-mine", "c-word", "p-backs", "p-empty"}


def check_styles(errors: list[str]) -> None:
    """Every class the markup uses must have a CSS rule — catches styles lost in edits."""
    css = " ".join(p.read_text(encoding="utf-8") for p in (ROOT / "assets" / "css").rglob("*.css"))
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    defined = set(re.findall(r"\.(-?[A-Za-z_][\w-]*)", css))
    sources = list((ROOT / "assets" / "js").rglob("*.js")) + [ROOT / "tools" / "templates" / "page.html"]
    for src in sources:
        text = src.read_text(encoding="utf-8")
        for m in re.finditer(r'class="([^"]*)"', text):
            static = re.sub(r"\$\{[^}]*\}", " ", m.group(1)).split()
            for cls in static:
                if not re.fullmatch(r"[A-Za-z][\w-]*[A-Za-z0-9]", cls) or cls.endswith("-"):
                    continue
                if cls not in defined and cls not in UNSTYLED_OK:
                    errors.append(f"{src.relative_to(ROOT)}: class “{cls}” has no CSS rule")


def main(argv: list[str]) -> int:
    errors: list[str] = []
    warnings: list[str] = []
    total = check_data(errors, warnings)
    if "--data-only" not in argv:
        check_pages(errors)
        check_styles(errors)
    if "--quiet" not in argv:
        for w in warnings:
            print(f"  warning  {w}")
    for e in errors:
        print(f"  ERROR    {e}")
    status = "FAILED" if errors else "OK"
    print(f"check {status}: {total} Starter words, "
          f"{len(errors)} error(s), {len(warnings)} warning(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
