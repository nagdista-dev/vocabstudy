#!/usr/bin/env python3
"""Screenshot every screen at phone, tablet and desktop width — a responsive check.

    python3 tools/screenshots.py            # all screens × all widths
    python3 tools/screenshots.py quiz day   # only screens whose name contains these

Writes PNGs to tools/.screenshots/ (safe to delete). Open them side by side
and look for text that wraps badly, buttons off screen or cramped layouts.
Needs google-chrome or chromium; starts its own local server.
"""

from __future__ import annotations

import functools
import http.server
import shutil
import socketserver
import subprocess
import sys
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / ".screenshots"
WIDTHS = {"phone": (375, 812), "tablet": (768, 1024), "desktop": (1280, 900)}
sys.path.insert(0, str(Path(__file__).resolve().parent))
from build import data_dir  # noqa: E402  — same word source as the build

DAY = sorted(data_dir().glob("*.js"))[-1].stem
SCREENS = {
    "home": "index.html",
    "day": f"index.html#/day/{DAY}",
    "cards": f"index.html#/day/{DAY}/cards",
    "quiz": f"index.html#/day/{DAY}/quiz",
    "spell": f"index.html#/day/{DAY}/spell",
    "match": f"index.html#/day/{DAY}/match",
    "library": "index.html#/words",
    "stats": "index.html#/stats",
    "add": "index.html#/add",
    "data": "index.html#/data",
    "print": f"index.html#/print/day/{DAY}",
}


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main(argv: list[str]) -> int:
    chrome = next((shutil.which(c) for c in ("google-chrome", "chromium", "chromium-browser") if shutil.which(c)), None)
    if not chrome:
        raise SystemExit("needs google-chrome or chromium")
    OUT.mkdir(exist_ok=True)
    server = socketserver.TCPServer(("127.0.0.1", 0), functools.partial(Quiet, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    port = server.server_address[1]
    wanted = {k: v for k, v in SCREENS.items() if len(argv) < 2 or any(a in k for a in argv[1:])}
    try:
        for name, path in wanted.items():
            for size, (w, h) in WIDTHS.items():
                png = OUT / f"{name}-{size}.png"
                subprocess.run([chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars",
                                f"--window-size={w},{h}", "--virtual-time-budget=4000",
                                f"--screenshot={png}", f"http://127.0.0.1:{port}/{path}"],
                               capture_output=True, timeout=90)
                print(f"{name:8} {size:7} {png.relative_to(ROOT)}")
    finally:
        server.shutdown()
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
