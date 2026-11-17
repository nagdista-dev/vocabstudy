#!/usr/bin/env python3
"""Check the generated app before it ships.

    python3 tools/check.py

ERRORS: a file the page or the offline list needs is missing, a class in the
markup has no CSS rule, a screen re-implements a helper that lives in
core/, or a usage trap's pattern misses its own mistake (tools/test_traps.js,
run when Node is installed). The app ships with no words, so there is no
word data to check.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
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


def check_traps(errors: list[str]) -> None:
    """Every usage trap must catch its own mistake and leave good English alone."""
    node = shutil.which("node")
    if not node:
        return
    run = subprocess.run([node, str(ROOT / "tools" / "test_traps.js")], capture_output=True, text=True)
    if run.returncode:
        errors.extend(line.strip() for line in run.stdout.splitlines() if "FAIL" in line)


def check_old_safari(errors: list[str]) -> None:
    """No regex lookbehind in the app's JS: Safari before 16.4 can't parse it and the whole file stops working."""
    for f in sorted((ROOT / "assets" / "js").rglob("*.js")):
        for n, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if "(?<=" in line or "(?<!" in line:
                errors.append(f"{f.relative_to(ROOT)}:{n}: regex lookbehind breaks older iPhones")


def check_overrides(errors: list[str]) -> None:
    """Every hand-checked meaning (assets/data/overrides.js) is complete: no half entries reach a learner."""
    node = shutil.which("node")
    path = ROOT / "assets" / "data" / "overrides.js"
    if not node or not path.exists():
        return
    script = (
        "const window={};" + path.read_text(encoding="utf-8") +
        ";const bad=[];for(const [w,o] of Object.entries(window.VS_OVERRIDES)){"
        "for(const m of (o.senses||[o])){for(const k of ['type','arabic','definition','example'])"
        "if(!m[k]||!String(m[k]).trim())bad.push(w+': missing '+k);"
        "if(!/[\\u0600-\\u06FF]/.test(m.arabic||''))bad.push(w+': arabic is not Arabic');"
        "if((m.example||'').split(/\\s+/).length>14)bad.push(w+': example over 14 words');"
        "for(const k of String(m.keys||'').split(/\\s+/).filter(Boolean)){if(k.length<2)bad.push(w+': key too short: '+k);"
        "if(/^(i|me|my|you|your|he|him|his|she|her|it|its|we|us|our|they|them|their|the|a|an|to|of|and)$/.test(k))bad.push(w+': key is a pronoun or a little word: '+k);}}}"
        "for(const [a,b] of Object.entries(window.VS_OVERRIDE_ALIASES||{}))if(!window.VS_OVERRIDES[b])bad.push('alias '+a+' points to a missing entry '+b);"
        "console.log(bad.join('\\n'));"
    )
    run = subprocess.run([node, "-e", script], capture_output=True, text=True)
    if run.returncode:
        errors.append("overrides.js does not load: " + run.stderr.strip()[:200])
    errors.extend("overrides.js — " + line for line in run.stdout.splitlines() if line.strip())


def main(argv: list[str]) -> int:
    errors: list[str] = []
    check_pages(errors)
    check_styles(errors)
    check_traps(errors)
    check_overrides(errors)
    check_old_safari(errors)
    for e in errors:
        print(f"  ERROR    {e}")
    print(f"check {'FAILED' if errors else 'OK'}: {len(errors)} error(s)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
