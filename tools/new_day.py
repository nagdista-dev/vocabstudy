#!/usr/bin/env python3
"""Start a new word set.

    python3 tools/new_day.py              # today's date
    python3 tools/new_day.py 2026-11-16   # a given date

Creates data/days/YYYY-MM-DD.js with one example row to copy.
Fill in your words, then run:  python3 tools/build.py
"""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEMPLATE = '''/* Word set for {label}.
   Content only. Each word: word, sense (optional, tells two meanings apart),
   type, level (CEFR A1–C2), ipa, definition, example, arabic (Egyptian).
   After editing, run: python3 tools/build.py */
VS.addDay("{iso}", [
  {{ word: "Example", type: "Noun", level: "B1", ipa: "/ɪɡˈzɑːmpəl/", definition: "Something that shows what others of its kind are like.", example: "This sentence is an example.", arabic: "مثال" }},
]);
'''


def main(argv: list[str]) -> int:
    try:
        day = date.fromisoformat(argv[1]) if len(argv) > 1 else date.today()
    except ValueError:
        print("Use a date like 2026-11-16")
        return 1
    path = ROOT / "data" / "days" / f"{day.isoformat()}.js"
    if path.exists():
        print(f"{path.relative_to(ROOT)} already exists — open it and add words.")
        return 1
    path.write_text(TEMPLATE.format(iso=day.isoformat(), label=f"{day.day} {day.strftime('%b %Y')}"), encoding="utf-8")
    print(f"created {path.relative_to(ROOT)}\nadd your words, then run: python3 tools/build.py")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
