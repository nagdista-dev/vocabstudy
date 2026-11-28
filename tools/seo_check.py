#!/usr/bin/env python3
"""Check the search and AI surfaces before they ship.

    python3 tools/seo_check.py

Run after `python3 tools/build.py` (or `--site`). It reads the generated
pages, the sitemap and the discovery files, and fails on the mistakes that
cost indexing: a missing canonical, a broken internal link, a duplicate
title, a page that is in the sitemap but not on disk, hreflang that does not
reciprocate, invalid JSON-LD, or accidental bidi control characters.

Exit code 1 means: do not deploy.
"""

from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path
from urllib.parse import urljoin, urlparse

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://vocabstudy.nagdista.com"
SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
XHTML_NS = "http://www.w3.org/1999/xhtml"

PAGES = [
    "index.html",
    "about.html",
    "ar/index.html",
    "ar/best-vocabulary-apps/index.html",
    "ar/how-to-memorize-english-words/index.html",
    "ar/vocabstudy-vs-anki/index.html",
    "en/index.html",
    "en/best-vocabulary-apps/index.html",
    "en/how-to-memorize-english-words/index.html",
    "en/vocabstudy-vs-anki/index.html",
]

PAIRS = [
    ("ar/index.html", "en/index.html"),
    ("ar/best-vocabulary-apps/index.html", "en/best-vocabulary-apps/index.html"),
    ("ar/how-to-memorize-english-words/index.html", "en/how-to-memorize-english-words/index.html"),
    ("ar/vocabstudy-vs-anki/index.html", "en/vocabstudy-vs-anki/index.html"),
]

REQUIRED = [
    "robots.txt", "sitemap.xml", "llms.txt", "llms-full.txt",
    "facts.md", "pricing.md",
]

BIDI = re.compile(r"[\u202a-\u202e\u2066-\u2069\u200e\u200f\u061c]")


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def url_for(rel: str) -> str:
    if rel == "index.html":
        return SITE + "/"
    return SITE + "/" + rel[: -len("index.html")] if rel.endswith("/index.html") else SITE + "/" + rel


def file_for(url: str) -> Path | None:
    if not url.startswith(SITE):
        return None
    path = url[len(SITE):].split("#")[0].split("?")[0]
    if path in ("", "/"):
        return ROOT / "index.html"
    path = path.lstrip("/")
    if path.endswith("/"):
        path += "index.html"
    return ROOT / path


def tag_attr(tag: str, name: str) -> str | None:
    match = re.search(rf'\b{name}\s*=\s*"([^"]*)"', tag, re.I)
    return match.group(1) if match else None


def alt_links(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for tag in re.findall(r"<link\b[^>]*>", text, re.I):
        if (tag_attr(tag, "rel") or "").lower() != "alternate":
            continue
        lang = tag_attr(tag, "hreflang")
        href = tag_attr(tag, "href")
        if lang and href:
            out[lang] = href
    return out


def canonical_of(text: str) -> str | None:
    for tag in re.findall(r"<link\b[^>]*>", text, re.I):
        if (tag_attr(tag, "rel") or "").lower() == "canonical":
            return tag_attr(tag, "href")
    return None


def internal_links(rel: str, text: str) -> list[tuple[str, str]]:
    """Return (href, resolved local path or empty for external/anchor)."""
    found: list[tuple[str, str]] = []
    base = url_for(rel)
    for tag in re.findall(r"<a\b[^>]*>", text, re.I):
        href = tag_attr(tag, "href")
        if not href:
            continue
        low = href.strip().lower()
        if low.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
            continue
        resolved = urljoin(base, href)
        parsed = urlparse(resolved)
        if parsed.scheme not in ("http", "https"):
            continue
        if parsed.netloc != urlparse(SITE).netloc:
            continue
        found.append((href, parsed.path + (("/" if parsed.path.endswith("/") else ""))))
    return found


def check_structure(errors: list[str]) -> None:
    for rel in REQUIRED:
        if not (ROOT / rel).exists():
            errors.append(f"missing required file: {rel}")
    for rel in PAGES:
        if not (ROOT / rel).exists():
            errors.append(f"missing page (run the build): {rel}")


def check_pages(errors: list[str]) -> None:
    titles: Counter[str] = Counter()
    descriptions: Counter[str] = Counter()
    for rel in PAGES:
        if not (ROOT / rel).exists():
            continue
        text = read(rel)
        name = rel

        if "{{" in text:
            errors.append(f"{name}: an unreplaced {{{{placeholder}}}} is still in the page")
        if BIDI.search(text):
            errors.append(f"{name}: contains a bidi control character")

        html_tag = re.search(r"<html\b([^>]*)>", text, re.I)
        if not html_tag:
            errors.append(f"{name}: no <html> tag")
        else:
            lang = tag_attr(html_tag.group(1), "lang")
            direction = tag_attr(html_tag.group(1), "dir")
            if lang not in ("ar", "en"):
                errors.append(f"{name}: html lang is {lang!r}, expected ar or en")
            if lang == "ar" and direction != "rtl":
                errors.append(f"{name}: Arabic page needs dir=\"rtl\"")
            if lang == "en" and direction not in (None, "ltr"):
                errors.append(f"{name}: English page needs dir=\"ltr\"")

        title = re.search(r"<title>(.*?)</title>", text, re.S | re.I)
        if not title:
            errors.append(f"{name}: no <title>")
        else:
            value = " ".join(title.group(1).split())
            titles[value] += 1
            if len(value) > 80:
                errors.append(f"{name}: title is {len(value)} characters (max 80)")
            if len(value) < 15:
                errors.append(f"{name}: title is too short ({len(value)} characters)")

        desc = re.search(r'<meta\s+name="description"\s+content="([^"]*)"', text, re.I)
        if not desc:
            errors.append(f"{name}: no meta description")
        else:
            value = " ".join(desc.group(1).split())
            descriptions[value] += 1
            if not (60 <= len(value) <= 180):
                errors.append(f"{name}: meta description is {len(value)} characters (expected 60–180)")

        h1s = len(re.findall(r"<h1\b", text, re.I))
        if rel != "index.html" and h1s != 1:
            errors.append(f"{name}: has {h1s} <h1> tags (expected exactly 1)")
        if rel == "index.html" and h1s:
            errors.append(f"{name}: the app shell should not hard-code an <h1>")

        canonical = canonical_of(text)
        if not canonical:
            errors.append(f"{name}: no canonical link")
        elif not canonical.startswith(SITE + "/"):
            errors.append(f"{name}: canonical is not on the canonical domain: {canonical}")
        elif file_for(canonical) != (ROOT / rel).resolve():
            errors.append(f"{name}: canonical points elsewhere: {canonical}")

        for block in re.findall(r'<script\s+type="application/ld\+json">(.*?)</script>', text, re.S | re.I):
            try:
                data = json.loads(block)
            except json.JSONDecodeError as exc:
                errors.append(f"{name}: invalid JSON-LD ({exc})")
                continue
            if "schema.org" not in str(data.get("@context", "")):
                errors.append(f"{name}: JSON-LD has no schema.org @context")
        if not re.search(r'application/ld\+json', text, re.I):
            errors.append(f"{name}: no JSON-LD")

        for img in re.findall(r"<img\b[^>]*>", text, re.I):
            if not re.search(r"\balt\s*=", img, re.I):
                errors.append(f"{name}: an <img> has no alt attribute")

        for href, path in internal_links(rel, text):
            if not path:
                continue
            target = ROOT / path.lstrip("/")
            if path.endswith("/"):
                target = target / "index.html"
            if not target.exists():
                errors.append(f"{name}: broken internal link {href!r} -> {path}")

    for value, count in titles.items():
        if count > 1:
            errors.append(f"duplicate title used {count} times: {value!r}")
    for value, count in descriptions.items():
        if count > 1:
            errors.append(f"duplicate meta description used {count} times: {value!r}")


def check_hreflang(errors: list[str]) -> None:
    for ar_rel, en_rel in PAIRS:
        if not ((ROOT / ar_rel).exists() and (ROOT / en_rel).exists()):
            continue
        ar = alt_links(read(ar_rel))
        en = alt_links(read(en_rel))
        ar_url, en_url = url_for(ar_rel), url_for(en_rel)
        expected_ar = {"ar": ar_url, "en": en_url, "x-default": en_url}
        expected_en = {"ar": ar_url, "en": en_url, "x-default": en_url}
        for rel, got, expected in ((ar_rel, ar, expected_ar), (en_rel, en, expected_en)):
            for lang, href in expected.items():
                if got.get(lang) != href:
                    errors.append(f"{rel}: hreflang {lang} is {got.get(lang)!r}, expected {href!r}")
            for lang in got:
                if lang not in expected:
                    errors.append(f"{rel}: unexpected hreflang {lang!r}")


def check_sitemap(errors: list[str]) -> None:
    path = ROOT / "sitemap.xml"
    if not path.exists():
        return
    try:
        tree = ET.parse(path)
    except ET.ParseError as exc:
        errors.append(f"sitemap.xml: invalid XML ({exc})")
        return
    root = tree.getroot()
    entries = root.findall(f"{{{SITEMAP_NS}}}url")
    if not entries:
        errors.append("sitemap.xml: no <url> entries")
    seen: dict[str, dict[str, str]] = {}
    for entry in entries:
        loc = entry.findtext(f"{{{SITEMAP_NS}}}loc")
        lastmod = entry.findtext(f"{{{SITEMAP_NS}}}lastmod")
        if not loc:
            errors.append("sitemap.xml: a <url> has no <loc>")
            continue
        if loc in seen:
            errors.append(f"sitemap.xml: duplicate loc {loc}")
        target = file_for(loc)
        if target is None or not target.exists():
            errors.append(f"sitemap.xml: loc has no file on disk: {loc}")
        if lastmod and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", lastmod):
            errors.append(f"sitemap.xml: bad lastmod {lastmod!r} for {loc}")
        alternates: dict[str, str] = {}
        for link in entry.findall(f"{{{XHTML_NS}}}link"):
            lang = link.get("hreflang")
            href = link.get("href")
            if lang and href:
                alternates[lang] = href
        seen[loc] = alternates

    expected_urls = {url_for(rel) for rel in PAGES}
    if set(seen) != expected_urls:
        missing = expected_urls - set(seen)
        extra = set(seen) - expected_urls
        if missing:
            errors.append(f"sitemap.xml: missing URLs: {sorted(missing)}")
        if extra:
            errors.append(f"sitemap.xml: unexpected URLs: {sorted(extra)}")

    for url, alternates in seen.items():
        if not alternates:
            continue
        if "x-default" not in alternates:
            errors.append(f"sitemap.xml: {url} has hreflang alternates but no x-default")
        for lang, href in alternates.items():
            if href not in seen:
                errors.append(f"sitemap.xml: {url} points hreflang {lang} at a URL outside the sitemap: {href}")
                continue
            back = seen[href]
            if url not in back.values():
                errors.append(f"sitemap.xml: hreflang does not reciprocate between {url} and {href}")


def check_discovery(errors: list[str]) -> None:
    robots = read("robots.txt") if (ROOT / "robots.txt").exists() else ""
    if f"Sitemap: {SITE}/sitemap.xml" not in robots:
        errors.append("robots.txt: does not point to the canonical sitemap")
    if re.search(r"^Disallow:\s*/\s*$", robots, re.M):
        errors.append("robots.txt: blocks the whole site")

    llms = read("llms.txt") if (ROOT / "llms.txt").exists() else ""
    for url in re.findall(r"https://vocabstudy\.nagdista\.com[^\s)\]>\"']*", llms):
        target = file_for(url)
        if target is None or not target.exists():
            errors.append(f"llms.txt: link has no file on disk: {url}")

    full = read("llms-full.txt") if (ROOT / "llms-full.txt").exists() else ""
    if len(full) < 5000:
        errors.append(f"llms-full.txt: only {len(full)} bytes; expected the full text")
    for rel in PAGES:
        if url_for(rel) not in full:
            errors.append(f"llms-full.txt: missing {url_for(rel)}")


def check_about(errors: list[str]) -> None:
    if not (ROOT / "about.html").exists():
        return
    text = read("about.html")
    if "ar/" not in text:
        errors.append("about.html: does not link to the Arabic hub")
    if not canonical_of(text):
        errors.append("about.html: no canonical")


def main() -> int:
    errors: list[str] = []
    check_structure(errors)
    check_pages(errors)
    check_hreflang(errors)
    check_sitemap(errors)
    check_discovery(errors)
    check_about(errors)
    if errors:
        print(f"SEO check failed with {len(errors)} error(s):")
        for error in errors:
            print(f"  ERROR {error}")
        return 1
    print(f"SEO check passed · {len(PAGES)} pages · sitemap · hreflang · JSON-LD · discovery files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
