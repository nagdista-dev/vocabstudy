#!/usr/bin/env python3
"""Build the reading pages, the sitemap and the AI-readable full text.

    python3 tools/build_guides.py

Source of truth:
    tools/templates/guide.html      the shell (head, header, footer are built here)
    content/<lang>/<slug>.html      the article body, plain HTML
    PAGES (below)                   title, description, pairing, schema kind

Generated (do not edit by hand):
    ar/index.html, ar/<slug>/index.html
    en/index.html, en/<slug>/index.html
    sitemap.xml
    llms-full.txt

The app itself is still built by tools/build.py; that script calls build() so
GitHub Actions regenerates these pages on every deploy.
"""

from __future__ import annotations

import html
import json
import re
from datetime import date
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / "tools" / "templates" / "guide.html"
SITE = "https://vocabstudy.nagdista.com"
UPDATED = "2026-11-28"
OG_IMAGE = SITE + "/assets/icons/og.png"
AUTHOR_URL = "https://nagdista.com/"
GITHUB_URL = "https://github.com/nagdista-dev/vocabstudy"

PAGES = [
    {
        "lang": "ar",
        "slug": "",
        "body": "content/ar/index.html",
        "title": "VocabStudy — تطبيق حفظ كلمات الإنجليزية للعرب | مجاني",
        "desc": "تطبيق عربي مجاني لحفظ كلمات الإنجليزية: أضف الكلمة التي قابلتها، اكتب جملة عنها، وراجعها في أيام متباعدة حتى تثبت. بدون حساب، ويعمل بدون إنترنت.",
        "kicker": "دليل VocabStudy · عربي أولًا",
        "h1": "تطبيق لحفظ كلمات الإنجليزية، مبني للعرب من الأساس.",
        "dek": "VocabStudy تطبيق مجاني ومفتوح المصدر. تضيف الكلمة التي قابلتها في مسلسل أو مقال أو إيميل، وتكتب جملة عنها، وتراجعها في أيام متباعدة. لا حساب، ولا إعلانات، ويعمل بدون إنترنت.",
        "reading": "6 دقائق",
        "pair": "en/index.html",
        "kind": "hub",
        "crumb": "الدليل العربي",
        "nav": "hub",
    },
    {
        "lang": "ar",
        "slug": "best-vocabulary-apps",
        "body": "content/ar/best-vocabulary-apps.html",
        "title": "أفضل تطبيقات حفظ كلمات الإنجليزية للعرب (مقارنة 2026)",
        "desc": "مقارنة صريحة بين VocabStudy وAnki وMemrise وQuizlet وDuolingo وLanGeek: المعنى بالعربي، السياق، المراجعة المتباعدة، العمل بدون إنترنت، والسعر.",
        "kicker": "مقارنة · 6 تطبيقات · 5 معايير",
        "h1": "أفضل تطبيقات حفظ الكلمات الإنجليزية للعرب: مقارنة 2026",
        "dek": "ستة تطبيقات مشهورة، وخمسة معايير تهم المتعلم العربي تحديدًا. لا نرشّح تطبيقًا واحدًا للجميع، لأن الهدف يختلف: كلماتك أنت، أم كورس جاهز، أم نظام مراجعة قوي؟",
        "reading": "9 دقائق",
        "pair": "en/best-vocabulary-apps/index.html",
        "kind": "comparison",
        "crumb": "أفضل التطبيقات",
        "nav": "compare",
        "itemlist": [
            ("VocabStudy", SITE + "/ar/"),
            ("Anki", "https://apps.ankiweb.net/"),
            ("Memrise", "https://www.memrise.com/"),
            ("Quizlet", "https://quizlet.com/"),
            ("Duolingo", "https://www.duolingo.com/"),
            ("LanGeek", "https://langeek.co/"),
        ],
    },
    {
        "lang": "ar",
        "slug": "how-to-memorize-english-words",
        "body": "content/ar/how-to-memorize-english-words.html",
        "title": "كيف تحفظ كلمات الإنجليزية وتثبت في ذاكرتك (دليل عملي 2026)",
        "desc": "طريقة عملية لحفظ كلمات الإنجليزية: استدعاء نشط، تكرار متباعد، جملة شخصية، ونطق. مع خطة أسبوعية 20 دقيقة وأخطاء شائعة يجب تجنبها.",
        "kicker": "دليل الحفظ · 7 تقنيات · خطة أسبوعية",
        "h1": "كيف تحفظ كلمات الإنجليزية وتثبت في ذاكرتك",
        "dek": "الحفظ ليس تكرار الكتابة. الكلمة تثبت عندما تستخرجها من ذاكرتك، وتراها في سياق، وتراجعها على فترات متباعدة. هذا الدليل يحوّل ذلك إلى خطة يومية قصيرة.",
        "reading": "10 دقائق",
        "pair": "en/how-to-memorize-english-words/index.html",
        "kind": "guide",
        "crumb": "طريقة الحفظ",
        "nav": "guide",
    },
    {
        "lang": "ar",
        "slug": "vocabstudy-vs-anki",
        "body": "content/ar/vocabstudy-vs-anki.html",
        "title": "VocabStudy ولا Anki؟ مقارنة صريحة للمتعلم العربي",
        "desc": "أيهما أفضل لك: VocabStudy أم Anki؟ مقارنة في السعر، المحتوى العربي، المراجعة المتباعدة، العمل بدون إنترنت، والتخصيص، مع توصية واضحة لكل نوع متعلم.",
        "kicker": "مقارنة · قرار في 5 دقائق",
        "h1": "VocabStudy ولا Anki؟ أيهما يناسبك؟",
        "dek": "كلاهما مجاني على أغلب المنصات، وكلاهما يعتمد على التكرار المتباعد. الفرق في وقت الإعداد، وفي مقدار الدعم العربي، وفي حرية التخصيص. هذه مقارنة صريحة، نذكر فيها حدود تطبيقنا.",
        "reading": "7 دقائق",
        "pair": "en/vocabstudy-vs-anki/index.html",
        "kind": "comparison",
        "crumb": "VocabStudy مقابل Anki",
        "nav": "compare",
    },
    {
        "lang": "en",
        "slug": "",
        "body": "content/en/index.html",
        "title": "VocabStudy — English Vocabulary App for Arabic Speakers",
        "desc": "Free English vocabulary app for Arabic speakers: add the words you meet, learn Arabic-speaker traps, and recall them on spaced days. No account, offline.",
        "kicker": "VocabStudy guide · Arabic-first",
        "h1": "The English words you meet, made to stay.",
        "dek": "VocabStudy is a free, open-source app for Arabic speakers. Add the word you met in a series, an article or an email, write a sentence with it, and recall it on spaced days. No account, no ads, and it works offline.",
        "reading": "6 min read",
        "pair": "ar/index.html",
        "kind": "hub",
        "crumb": "English guide",
        "nav": "hub",
    },
    {
        "lang": "en",
        "slug": "best-vocabulary-apps",
        "body": "content/en/best-vocabulary-apps.html",
        "title": "Best Vocabulary Apps for Arabic Speakers (2026 Comparison)",
        "desc": "An honest comparison of VocabStudy, Anki, Memrise, Quizlet, Duolingo and LanGeek for Arabic speakers: Arabic support, context, review, offline use and price.",
        "kicker": "Comparison · 6 apps · 5 criteria",
        "h1": "Best vocabulary apps for Arabic speakers: a 2026 comparison",
        "dek": "Six well-known apps, judged on five things that matter to an Arabic speaker. There is no single winner: the right choice depends on whether you want your own words, a ready-made course, or a powerful review system.",
        "reading": "9 min read",
        "pair": "ar/best-vocabulary-apps/index.html",
        "kind": "comparison",
        "crumb": "Best apps",
        "nav": "compare",
        "itemlist": [
            ("VocabStudy", SITE + "/en/"),
            ("Anki", "https://apps.ankiweb.net/"),
            ("Memrise", "https://www.memrise.com/"),
            ("Quizlet", "https://quizlet.com/"),
            ("Duolingo", "https://www.duolingo.com/"),
            ("LanGeek", "https://langeek.co/"),
        ],
    },
    {
        "lang": "en",
        "slug": "how-to-memorize-english-words",
        "body": "content/en/how-to-memorize-english-words.html",
        "title": "How to Memorize English Words So They Stay (Practical Guide)",
        "desc": "A practical method for Arabic speakers: active recall, spaced repetition, personal sentences and pronunciation, with a weekly plan and common mistakes.",
        "kicker": "Study guide · 7 techniques · weekly plan",
        "h1": "How to memorize English words so they stay",
        "dek": "Memorizing is not copying a word ten times. A word sticks when you pull it out of memory, meet it in context, and review it on expanding intervals. This guide turns that into a short daily routine.",
        "reading": "10 min read",
        "pair": "ar/how-to-memorize-english-words/index.html",
        "kind": "guide",
        "crumb": "How to memorize",
        "nav": "guide",
    },
    {
        "lang": "en",
        "slug": "vocabstudy-vs-anki",
        "body": "content/en/vocabstudy-vs-anki.html",
        "title": "VocabStudy vs Anki: Which Fits Arabic Speakers?",
        "desc": "VocabStudy or Anki? A fair comparison of price, Arabic support, spaced repetition, offline use and customization, with a clear recommendation for each learner.",
        "kicker": "Comparison · a decision in 5 minutes",
        "h1": "VocabStudy or Anki? Which one fits you?",
        "dek": "Both are free on most platforms, and both use spaced repetition. The difference is setup time, Arabic support, and how much control you want. Here is the honest comparison, including our own limits.",
        "reading": "7 min read",
        "pair": "ar/vocabstudy-vs-anki/index.html",
        "kind": "comparison",
        "crumb": "VocabStudy vs Anki",
        "nav": "compare",
    },
]


# ── Small helpers ──────────────────────────────────────────────────────────

def output_path(page: dict) -> str:
    slug = page["slug"]
    return f'{page["lang"]}/{slug + "/" if slug else ""}index.html'


def url_for_output(out: str) -> str:
    return SITE + "/" + out[: -len("index.html")]


def canonical(page: dict) -> str:
    return url_for_output(output_path(page))


def other_lang(page: dict) -> str:
    return "en" if page["lang"] == "ar" else "ar"


def version(rel: str) -> str:
    return format(int((ROOT / rel).stat().st_mtime), "x")


def esc(value: str) -> str:
    return html.escape(value, quote=True)


def lastmod(*rels: str) -> str:
    stamps = [(ROOT / rel).stat().st_mtime for rel in rels if (ROOT / rel).exists()]
    if not stamps:
        return UPDATED
    return date.fromtimestamp(max(stamps)).isoformat()


# ── The head ───────────────────────────────────────────────────────────────

def nav_html(page: dict) -> str:
    ar = page["lang"] == "ar"
    if page["nav"] == "hub":
        links = [("/ar/#how", "كيف يعمل")] if ar else [("/en/#how", "How it works")]
        links.append(("/ar/best-vocabulary-apps/", "المقارنة") if ar else ("/en/best-vocabulary-apps/", "Compare"))
    elif page["nav"] == "guide":
        links = [("/ar/", "الدليل")] if ar else [("/en/", "Guide")]
        links.append(("/ar/best-vocabulary-apps/", "المقارنة") if ar else ("/en/best-vocabulary-apps/", "Compare"))
    else:
        links = [("/ar/", "الدليل")] if ar else [("/en/", "Guide")]
        links.append(("/ar/how-to-memorize-english-words/", "طريقة الحفظ") if ar else ("/en/how-to-memorize-english-words/", "How to memorize"))
    pair_url = url_for_output(page["pair"])
    pair_lang = other_lang(page)
    label = "English" if ar else "العربية"
    attrs = f' hreflang="{pair_lang}" lang="{pair_lang}"' + (' dir="rtl"' if pair_lang == "ar" else "")
    out = [f'<a href="{href}">{text}</a>' for href, text in links]
    out.append(f'<a class="lang-switch" href="{pair_url}"{attrs}>{label}</a>')
    return "\n      ".join(out)


def head_html(page: dict) -> str:
    url = canonical(page)
    pair_url = url_for_output(page["pair"])
    is_ar = page["lang"] == "ar"
    og_locale = "ar_EG" if is_ar else "en_US"
    alt_locale = "en_US" if is_ar else "ar_EG"
    en_url = url if not is_ar else pair_url
    ar_url = url if is_ar else pair_url
    og_type = "website" if page["kind"] == "hub" else "article"
    css = "\n".join(
        f'<link rel="stylesheet" href="{{{{ROOT}}}}{p}?v={version(p)}">'
        for p in ("assets/css/fonts.css", "assets/css/tokens.css", "assets/css/photos.css",
                  "assets/css/about.css", "assets/css/guide.css")
    )
    schema = json.dumps(schema_graph(page), ensure_ascii=False, indent=2)
    return f"""<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(page["title"])}</title>
<meta name="description" content="{esc(page["desc"])}">
<meta name="author" content="Nagdista">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">
<meta name="theme-color" content="#f3f5f9">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="ar" href="{ar_url}">
<link rel="alternate" hreflang="en" href="{en_url}">
<link rel="alternate" hreflang="x-default" href="{en_url}">
<meta property="og:type" content="{og_type}">
<meta property="og:site_name" content="VocabStudy">
<meta property="og:title" content="{esc(page["title"])}">
<meta property="og:description" content="{esc(page["desc"])}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{OG_IMAGE}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="VocabStudy — English vocabulary for Arabic speakers.">
<meta property="og:locale" content="{og_locale}">
<meta property="og:locale:alternate" content="{alt_locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{esc(page["title"])}">
<meta name="twitter:description" content="{esc(page["desc"])}">
<meta name="twitter:image" content="{OG_IMAGE}">
<link rel="icon" href="{{{{ROOT}}}}assets/favicon.svg" type="image/svg+xml">
{css}
<script type="application/ld+json">
{schema}
</script>"""


# ── Structured data ────────────────────────────────────────────────────────

def schema_graph(page: dict) -> dict:
    url = canonical(page)
    is_ar = page["lang"] == "ar"
    website_id = SITE + "/#website"
    org_id = SITE + "/#organization"
    person_id = SITE + "/#person"
    app_id = SITE + "/#app"
    graph = [
        {
            "@type": "WebSite",
            "@id": website_id,
            "url": SITE + "/",
            "name": "VocabStudy",
            "alternateName": "VocabStudy for Arabic speakers",
            "inLanguage": ["ar", "en"],
            "publisher": {"@id": org_id},
        },
        {
            "@type": "Person",
            "@id": person_id,
            "name": "Nagdista",
            "url": AUTHOR_URL,
            "sameAs": ["https://github.com/nagdista-dev"],
        },
        {
            "@type": "Organization",
            "@id": org_id,
            "name": "VocabStudy",
            "alternateName": "VocabStudy for Arabic speakers",
            "url": SITE + "/",
            "founder": {"@id": person_id},
            "sameAs": [GITHUB_URL],
        },
        {
            "@type": "WebPage",
            "@id": url + "#webpage",
            "url": url,
            "name": page["title"],
            "description": page["desc"],
            "inLanguage": page["lang"],
            "isPartOf": {"@id": website_id},
            "datePublished": UPDATED,
            "dateModified": UPDATED,
            "author": {"@id": person_id},
            "publisher": {"@id": org_id},
            "primaryImageOfPage": {"@type": "ImageObject", "url": OG_IMAGE},
        },
    ]
    if page["kind"] == "hub":
        graph.append({
            "@type": "SoftwareApplication",
            "@id": app_id,
            "name": "VocabStudy",
            "alternateName": "VocabStudy for Arabic speakers",
            "applicationCategory": "EducationalApplication",
            "applicationSubCategory": "English vocabulary learning",
            "operatingSystem": "Any (web browser)",
            "url": SITE + "/",
            "description": "A free, open-source English vocabulary app for Arabic speakers: add your own words, learn Arabic-speaker usage traps, and recall them on spaced days. No account, works offline.",
            "inLanguage": "en",
            "availableLanguage": ["ar", "en"],
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "license": "https://opensource.org/licenses/MIT",
            "sameAs": [GITHUB_URL],
        })
    else:
        graph.append({
            "@type": "Article",
            "@id": url + "#article",
            "headline": page["h1"],
            "description": page["desc"],
            "inLanguage": page["lang"],
            "datePublished": UPDATED,
            "dateModified": UPDATED,
            "author": {"@id": person_id},
            "publisher": {"@id": org_id},
            "mainEntityOfPage": {"@id": url + "#webpage"},
            "image": OG_IMAGE,
            "isPartOf": {"@id": website_id},
            "about": {"@type": "Thing", "name": "Learning English vocabulary" if not is_ar else "حفظ مفردات اللغة الإنجليزية"},
        })

    crumbs = [{"@type": "ListItem", "position": 1, "name": "VocabStudy", "item": SITE + "/"}]
    if page["kind"] == "hub":
        crumbs.append({"@type": "ListItem", "position": 2, "name": page["crumb"], "item": url})
    else:
        hub_url = SITE + ("/ar/" if is_ar else "/en/")
        hub_name = "الدليل العربي" if is_ar else "English guide"
        crumbs.append({"@type": "ListItem", "position": 2, "name": hub_name, "item": hub_url})
        crumbs.append({"@type": "ListItem", "position": 3, "name": page["crumb"], "item": url})
    graph.append({
        "@type": "BreadcrumbList",
        "@id": url + "#breadcrumb",
        "itemListElement": crumbs,
    })

    faq = extract_faq(page)
    if faq:
        graph.append({
            "@type": "FAQPage",
            "@id": url + "#faq",
            "mainEntity": [
                {
                    "@type": "Question",
                    "name": question,
                    "acceptedAnswer": {"@type": "Answer", "text": answer},
                }
                for question, answer in faq
            ],
        })

    if page.get("itemlist"):
        graph.append({
            "@type": "ItemList",
            "@id": url + "#apps",
            "name": "Vocabulary apps compared" if not is_ar else "تطبيقات المفردات التي تمت مقارنتها",
            "itemListElement": [
                {"@type": "ListItem", "position": i, "name": name, "url": link}
                for i, (name, link) in enumerate(page["itemlist"], start=1)
            ],
        })

    return {"@context": "https://schema.org", "@graph": graph}


class FAQParser(HTMLParser):
    """Read <details><summary>Q</summary>A</details> from a body fragment."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.depth = 0
        self.in_summary = False
        self.in_answer = False
        self.question: list[str] = []
        self.answer: list[str] = []
        self.items: list[tuple[str, str]] = []

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag == "details":
            self.depth += 1
            self.question, self.answer = [], []
            self.in_summary = self.in_answer = False
        elif tag == "summary" and self.depth:
            self.in_summary, self.in_answer = True, False
        elif self.depth and not self.in_summary:
            self.in_answer = True

    def handle_endtag(self, tag: str) -> None:
        if tag == "summary":
            self.in_summary = False
        elif tag == "details" and self.depth:
            self.depth -= 1
            question = " ".join("".join(self.question).split())
            answer = " ".join("".join(self.answer).split())
            if question and answer:
                self.items.append((question, answer))
            self.in_answer = False

    def handle_data(self, data: str) -> None:
        if self.in_summary:
            self.question.append(data)
        elif self.in_answer:
            self.answer.append(data)


def extract_faq(page: dict) -> list[tuple[str, str]]:
    parser = FAQParser()
    parser.feed((ROOT / page["body"]).read_text(encoding="utf-8"))
    return parser.items


# ── Body, footer and the build ─────────────────────────────────────────────

def footer_html(page: dict) -> str:
    ar = page["lang"] == "ar"
    if ar:
        return f"""<p>VocabStudy — تطبيق مجاني ومفتوح المصدر للعرب الذين يتعلمون الإنجليزية. <a href="/">افتح التطبيق</a>.</p>
<p class="foot-links"><a href="/ar/">الدليل</a> <a href="/ar/best-vocabulary-apps/">أفضل التطبيقات</a> <a href="/ar/how-to-memorize-english-words/">طريقة الحفظ</a> <a href="/ar/vocabstudy-vs-anki/">مقارنة Anki</a> <a href="/about.html">عن التطبيق</a> <a href="/en/" hreflang="en" lang="en">English</a></p>
<p>عمله <a href="https://nagdista.com/?utm_source=vocabstudy&amp;utm_medium=guide&amp;utm_campaign=credit" lang="en" dir="ltr">Nagdista</a> · مفتوح المصدر برخصة MIT · <a href="{GITHUB_URL}" lang="en" dir="ltr">GitHub</a></p>
<p>آخر تحديث: 28 نوفمبر 2026 · أرقام شيوع الكلمات من <a href="https://github.com/rspeer/wordfreq" lang="en">wordfreq</a> (CC BY-SA 4.0).</p>"""
    return f"""<p>VocabStudy is a free, open-source app for Arabic speakers learning English. <a href="/">Open the app</a>.</p>
<p class="foot-links"><a href="/en/">Guide</a> <a href="/en/best-vocabulary-apps/">Best apps</a> <a href="/en/how-to-memorize-english-words/">How to memorize</a> <a href="/en/vocabstudy-vs-anki/">VocabStudy vs Anki</a> <a href="/about.html">About</a> <a href="/ar/" hreflang="ar" lang="ar" dir="rtl">العربية</a></p>
<p>Built by <a href="https://nagdista.com/?utm_source=vocabstudy&amp;utm_medium=guide&amp;utm_campaign=credit">Nagdista</a> · open source under the MIT licence · <a href="{GITHUB_URL}">GitHub</a></p>
<p>Last updated: 28 November 2026 · Word frequency data from <a href="https://github.com/rspeer/wordfreq">wordfreq</a> (CC BY-SA 4.0).</p>"""


def render(page: dict) -> str:
    out = output_path(page)
    root = "../" * out.count("/")
    body = (ROOT / page["body"]).read_text(encoding="utf-8").replace("{{ROOT}}", root)
    shell = TEMPLATE.read_text(encoding="utf-8")
    values = {
        "{{LANG}}": page["lang"],
        "{{DIR}}": "rtl" if page["lang"] == "ar" else "ltr",
        "{{HEAD}}": head_html(page),
        "{{SKIP}}": "انتقل إلى المحتوى" if page["lang"] == "ar" else "Skip to content",
        "{{ROOT}}": root,
        "{{NAV_LABEL}}": "أقسام الصفحة" if page["lang"] == "ar" else "Page sections",
        "{{NAV}}": nav_html(page),
        "{{CONTENT}}": body,
        "{{FOOTER}}": footer_html(page),
    }
    for key, value in values.items():
        shell = shell.replace(key, value)
    if "{{" in shell:
        raise SystemExit(f"guide template has an unknown placeholder in {out}")
    return shell


def build_sitemap() -> None:
    entries: list[tuple[str, str, list[tuple[str, str]] | None]] = [
        (SITE + "/", lastmod("index.html"), None),
        (SITE + "/about.html", lastmod("about.html"), None),
    ]
    for page in PAGES:
        url = canonical(page)
        pair_url = url_for_output(page["pair"])
        is_ar = page["lang"] == "ar"
        alternates = [
            ("ar", url if is_ar else pair_url),
            ("en", pair_url if is_ar else url),
            ("x-default", pair_url if is_ar else url),
        ]
        entries.append((url, lastmod(page["body"], "tools/templates/guide.html"), alternates))
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
    ]
    for url, modified, alternates in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{esc(url)}</loc>")
        lines.append(f"    <lastmod>{modified}</lastmod>")
        for lang, href in alternates or []:
            lines.append(f'    <xhtml:link rel="alternate" hreflang="{lang}" href="{esc(href)}"/>')
        lines.append("  </url>")
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")


class TextExtractor(HTMLParser):
    BLOCK = {"p", "h1", "h2", "h3", "h4", "li", "tr", "div", "section", "article",
             "details", "summary", "br", "blockquote", "figcaption"}
    SKIP = {"script", "style", "svg"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.skip = 0

    def handle_starttag(self, tag: str, attrs) -> None:
        if tag in self.SKIP:
            self.skip += 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.SKIP and self.skip:
            self.skip -= 1
        if tag in self.BLOCK:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self.skip:
            self.parts.append(data)


def plain_text(fragment: str) -> str:
    parser = TextExtractor()
    parser.feed(fragment)
    text = "".join(parser.parts)
    lines = [" ".join(line.split()) for line in text.splitlines()]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(line for line in lines if line)).strip()


def build_llms_full() -> None:
    parts = [
        "# VocabStudy — full text",
        "",
        "> The complete text of the VocabStudy reading pages, for AI search engines and agents.",
        "> Canonical domain: https://vocabstudy.nagdista.com/",
        "> Product: free, open-source English vocabulary app for Arabic speakers. MIT licence.",
        "",
    ]
    for page in PAGES:
        body = (ROOT / page["body"]).read_text(encoding="utf-8")
        parts += [
            f'## {page["h1"]}',
            f'URL: {canonical(page)}',
            f'Language: {page["lang"]}',
            "",
            plain_text(body),
            "",
        ]

    about = ROOT / "about.html"
    if about.exists():
        text = about.read_text(encoding="utf-8")
        match = re.search(r"<main\b[^>]*>(.*?)</main>", text, re.S | re.I)
        if match:
            parts += [
                "## عن VocabStudy، بالعربي",
                f"URL: {SITE}/about.html",
                "Language: ar",
                "",
                plain_text(match.group(1)),
                "",
            ]

    (ROOT / "llms-full.txt").write_text("\n".join(parts), encoding="utf-8")


def build() -> None:
    for page in PAGES:
        out = ROOT / output_path(page)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(render(page), encoding="utf-8")
    build_sitemap()
    build_llms_full()
    print(f"built {len(PAGES)} reading pages · sitemap.xml · llms-full.txt")


if __name__ == "__main__":
    build()
