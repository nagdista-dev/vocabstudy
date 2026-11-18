#!/usr/bin/env python3
"""Render the app icons (PNG) from the brand mark, for the installable app.

    python3 tools/build_icons.py

Writes assets/icons/:
    icon-192.png, icon-512.png      the mark on its rounded tile
    maskable-512.png                full-bleed tile with the mark inside the
                                    safe zone (Android crops it into its own shape)
    apple-touch-icon.png (180)      iOS home screen
    og.png (1200×630)               the picture a shared link shows (about.html,
                                    index.html): the mark, the name, the promise
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


def og_page() -> str:
    """The share card: paper, the mark, the name and the promise — the Arabic
    line with the highlighter on what matters, as on about.html."""
    fonts = (ROOT / "assets" / "fonts").as_uri()
    mark = MARK.replace('<svg ', '<svg width="100%" height="100%" ', 1)
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face {{ font-family: Plex; font-weight: 600; src: url({fonts}/ibm-plex-sans-arabic-600-normal-arabic.woff2); }}
@font-face {{ font-family: Brico; font-weight: 800; src: url({fonts}/bricolage-grotesque-600-800-normal-latin.woff2); }}
@font-face {{ font-family: Atk; font-weight: 500; src: url({fonts}/atkinson-hyperlegible-next-500-normal-latin.woff2); }}
body {{ margin: 0; width: 1200px; height: 630px; background: #f3f5f9; color: #141b2d; overflow: hidden;
  display: grid; align-content: center; gap: 34px; padding: 0 96px; box-sizing: border-box;
  background-image: repeating-linear-gradient(to bottom, transparent 0 55px, #dfe4ee 55px 56px); }}
.brand {{ display: flex; align-items: center; gap: 20px; direction: ltr; justify-content: flex-end; }}
.brand i {{ width: 84px; height: 84px; display: block; }}
.brand b {{ font: 800 64px/1 Brico; letter-spacing: -.01em; }}
h1 {{ margin: 0; font: 600 68px/1.45 Plex; text-align: right; white-space: nowrap; }}
mark {{ background: linear-gradient(transparent 52%, #ffe066 52%, #ffe066 92%, transparent 92%); color: inherit; padding: 0 .08em; }}
p {{ margin: 0; font: 500 34px/1.4 Atk; color: #465066; direction: ltr; text-align: right; }}
</style></head><body>
<div class="brand"><b>VocabStudy</b><i>{mark}</i></div>
<h1>الكلمة اللي بتقابلها، <mark>متضيعش منك.</mark></h1>
<p>Free · no account · works offline · made for Arab learners</p>
</body></html>"""


def render(chrome: str, html: str, size: int, target: Path, height: int | None = None) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "icon.html"   # file:// so the og card can load the local fonts
        src.write_text(html, encoding="utf-8")
        subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                        "--default-background-color=00000000", f"--window-size={size},{height or size}",
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
    render(chrome, og_page(), 1200, OUT / "og.png", 630)
    print("wrote", (OUT / "og.png").relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
