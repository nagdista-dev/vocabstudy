#!/usr/bin/env python3
"""Render the app icons (PNG) from the brand mark, for the installable app.

    python3 tools/build_icons.py

Writes assets/icons/:
    icon-192.png, icon-512.png      the mark on its rounded tile
    maskable-512.png                full-bleed tile with the mark inside the
                                    safe zone (Android crops it into its own shape)
    apple-touch-icon.png (180)      iOS home screen
Run it only when assets/favicon.svg changes. Needs google-chrome or chromium.
"""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "icons"
MARK = (ROOT / "assets" / "favicon.svg").read_text(encoding="utf-8")
BRAND = "#2b48d6"


def page(size: int, maskable: bool) -> str:
    # Maskable: solid brand background, the mark at 62% (inside the 80% safe circle).
    inner = int(size * (0.62 if maskable else 1.0))
    bg = BRAND if maskable else "transparent"
    return f"""<!doctype html><html><body style="margin:0;width:{size}px;height:{size}px;background:{bg};
display:grid;place-items:center;overflow:hidden">
<div style="width:{inner}px;height:{inner}px">{MARK.replace('<svg ', '<svg width="100%" height="100%" ', 1)}</div>
</body></html>"""


def render(chrome: str, html: str, size: int, target: Path) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "icon.html"
        src.write_text(html, encoding="utf-8")
        subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", f"--window-size={size},{size}",
                        f"--screenshot={target}", src.as_uri()], capture_output=True, timeout=60)


def main() -> int:
    chrome = next((shutil.which(c) for c in ("google-chrome", "chromium", "chromium-browser") if shutil.which(c)), None)
    if not chrome:
        raise SystemExit("needs google-chrome or chromium")
    OUT.mkdir(parents=True, exist_ok=True)
    for name, size, maskable in [("icon-192.png", 192, False), ("icon-512.png", 512, False),
                                 ("maskable-512.png", 512, True), ("apple-touch-icon.png", 180, True)]:
        render(chrome, page(size, maskable), size, OUT / name)
        print("wrote", (OUT / name).relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
