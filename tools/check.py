#!/usr/bin/env python3
"""Check the generated app before it ships.

    python3 tools/check.py

ERRORS: a file the page or the offline list needs is missing, a class in the
markup has no CSS rule, or a screen re-implements a helper that lives in
core/. The app ships with no words, so there is no word data to check.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def check_pages(errors: list[str]) -> None:
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
    check_pages(errors)
    check_styles(errors)
    for e in errors:
        print(f"  ERROR    {e}")
    print(f"check {'FAILED' if errors else 'OK'}: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
