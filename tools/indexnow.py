#!/usr/bin/env python3
"""Tell IndexNow (Bing, Yandex, Seznam, Naver) that the pages changed.

    python3 tools/indexnow.py            # dry run: show what would be sent
    python3 tools/indexnow.py --submit   # actually send the request

IndexNow is a plain HTTP POST; no account and no SDK. Google does not use it,
so Search Console is still the Google path.

The key is read from the single `<32 hex>.txt` file in the repo root, which is
also deployed with the site so the search engines can verify ownership.
"""

from __future__ import annotations

import json
import re
import sys
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://vocabstudy.nagdista.com"
HOST = "vocabstudy.nagdista.com"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
ENDPOINTS = [
    "https://api.indexnow.org/indexnow",
    "https://www.bing.com/indexnow",
]


def find_key() -> str:
    keys = [
        path.stem
        for path in ROOT.glob("*.txt")
        if re.fullmatch(r"[0-9a-f]{32}", path.stem)
    ]
    if not keys:
        raise SystemExit("no IndexNow key file found (expected <32 hex>.txt in the repo root)")
    if len(keys) > 1:
        raise SystemExit(f"more than one IndexNow key file found: {sorted(keys)}")
    key = keys[0]
    content = (ROOT / f"{key}.txt").read_text(encoding="utf-8").strip()
    if content != key:
        raise SystemExit(f"{key}.txt must contain exactly the key, found {content!r}")
    return key


def sitemap_urls() -> list[str]:
    path = ROOT / "sitemap.xml"
    if not path.exists():
        raise SystemExit("sitemap.xml is missing; run tools/build.py first")
    tree = ET.parse(path)
    urls = [
        loc.text.strip()
        for loc in tree.getroot().findall(f"{{{SITEMAP_NS}}}url/{{{SITEMAP_NS}}}loc")
        if loc.text and loc.text.strip()
    ]
    if not urls:
        raise SystemExit("sitemap.xml has no URLs")
    for url in urls:
        if not url.startswith(SITE + "/"):
            raise SystemExit(f"sitemap URL is outside the canonical domain: {url}")
    return urls


def payload(key: str, urls: list[str]) -> dict:
    return {
        "host": HOST,
        "key": key,
        "keyLocation": f"{SITE}/{key}.txt",
        "urlList": urls,
    }


def submit(url: str, body: dict) -> bool:
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"  {url} -> HTTP {response.status}")
            return 200 <= response.status < 300
    except urllib.error.HTTPError as exc:
        print(f"  {url} -> HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:300]}")
    except urllib.error.URLError as exc:
        print(f"  {url} -> network error: {exc.reason}")
    return False


def main() -> int:
    key = find_key()
    urls = sitemap_urls()
    body = payload(key, urls)

    print(f"IndexNow key: {key}")
    print(f"Host: {HOST}")
    print(f"URLs: {len(urls)}")
    for url in urls:
        print(f"  {url}")

    if "--submit" not in sys.argv:
        print("\nDry run. Nothing was sent. Re-run with --submit to notify IndexNow.")
        return 0

    print("\nSubmitting:")
    results = [submit(endpoint, body) for endpoint in ENDPOINTS]
    if not any(results):
        print("All IndexNow endpoints failed.")
        return 1
    print("IndexNow accepted the submission on at least one endpoint.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
