# Search Console, Bing and IndexNow — setup runbook

**Status:** deployed on 2026-11-28; Search Console and Bing verification pending.
**Canonical domain:** https://vocabstudy.nagdista.com/
**Sitemap:** https://vocabstudy.nagdista.com/sitemap.xml
**IndexNow key:** `76c5101da7d1c6ad4a579e18a35016d9`
**Key file:** https://vocabstudy.nagdista.com/76c5101da7d1c6ad4a579e18a35016d9.txt

Everything below is free. None of it adds a script to the app, so the
"no account, no tracking" promise stays intact.

---

## 0. Before you start

The site must be live on the canonical domain, with HTTPS, and these URLs must
return `200`:

- https://vocabstudy.nagdista.com/
- https://vocabstudy.nagdista.com/about.html
- https://vocabstudy.nagdista.com/ar/
- https://vocabstudy.nagdista.com/ar/best-vocabulary-apps/
- https://vocabstudy.nagdista.com/ar/how-to-memorize-english-words/
- https://vocabstudy.nagdista.com/ar/vocabstudy-vs-anki/
- https://vocabstudy.nagdista.com/en/
- https://vocabstudy.nagdista.com/en/best-vocabulary-apps/
- https://vocabstudy.nagdista.com/en/how-to-memorize-english-words/
- https://vocabstudy.nagdista.com/en/vocabstudy-vs-anki/

Quick check from a terminal:

```bash
for path in / /about.html /ar/ /ar/best-vocabulary-apps/ /ar/how-to-memorize-english-words/ /ar/vocabstudy-vs-anki/ /en/ /en/best-vocabulary-apps/ /en/how-to-memorize-english-words/ /en/vocabstudy-vs-anki/; do
  printf '%s ' "$path"
  curl -s -o /dev/null -w '%{http_code}\n' "https://vocabstudy.nagdista.com$path"
done
```

Also confirm:

```bash
curl -s https://vocabstudy.nagdista.com/robots.txt
curl -s https://vocabstudy.nagdista.com/sitemap.xml | head
curl -s https://vocabstudy.nagdista.com/76c5101da7d1c6ad4a579e18a35016d9.txt
```

The last one must print exactly:

```text
76c5101da7d1c6ad4a579e18a35016d9
```

---

## 1. Google Search Console

### 1a. Add the property

Go to <https://search.google.com/search-console/> and add a property.

**Recommended: Domain property** for `nagdista.com` if you control its DNS.
It covers `vocabstudy.nagdista.com` and every other subdomain, and it survives
a change of host.

- Choose **Domain**.
- Google gives a TXT record such as
  `google-site-verification=...`.
- Add it at your DNS provider for `nagdista.com`.
- Wait for propagation (usually minutes), then click **Verify**.

**Alternative: URL-prefix property** for
`https://vocabstudy.nagdista.com/` if you prefer not to touch DNS. Use the
HTML file method:

1. Download the verification file, for example `google1234abcd.html`.
2. Put it in the repo root.
3. Add the file name to `SITE_FILES` in `tools/build.py`.
4. Rebuild and deploy.
5. Open `https://vocabstudy.nagdista.com/google1234abcd.html`; it must return
   the token, not the app shell.
6. Click **Verify** in Search Console.

Do not use the "Google Analytics" or "Google Tag Manager" verification
methods. They would add tracking and break the privacy promise.

### 1b. Submit the sitemap

1. In Search Console, open **Sitemaps**.
2. Enter `sitemap.xml`.
3. Submit.
4. Status should become **Success** within a day or two. It can say
   "Discovered URLs: 10".

### 1c. Request indexing for the ten URLs

Use **URL Inspection** for each URL above, then **Request indexing**. Google
limits requests per day, so do them in two batches if needed. Requesting
indexing is a hint, not a guarantee; the sitemap and internal links do the
real work.

### 1d. What to watch

| Report | What it tells you | First check |
|---|---|---|
| **Pages** | which URLs are indexed, excluded, or errors | all 10 should be "Indexed" within 2–4 weeks |
| **Sitemaps** | whether Google read the sitemap | status "Success", 10 discovered |
| **Performance** | queries, impressions, clicks, average position | first Arabic impressions in 2–4 weeks |
| **Core Web Vitals** | real-user speed and stability | mobile "Good" |
| **Enhancements** | structured-data warnings | no errors; FAQ rich results are retired, so silence is expected |

Do not panic if the first report shows zero. A new domain with no backlinks
takes time. Judge content after 8–12 weeks; fix technical errors immediately.

---

## 2. Bing Webmaster Tools

Go to <https://www.bing.com/webmasters/>.

### Fastest path: import from Google

1. Sign in.
2. Choose **Import from Google Search Console**.
3. Authorize and import `vocabstudy.nagdista.com`.
4. Confirm the sitemap is imported; if not, submit
   `https://vocabstudy.nagdista.com/sitemap.xml` manually.

### Alternative: add the site directly

1. Add `https://vocabstudy.nagdista.com/`.
2. Verify with DNS, or with an XML file:
   - Download `BingSiteAuth.xml`.
   - Put it in the repo root.
   - Add it to `SITE_FILES` in `tools/build.py`.
   - Rebuild, deploy, and verify.
3. Submit the sitemap in **Sitemaps**.

### IndexNow

Bing uses IndexNow for near-instant discovery. The key file is already in the
repo and deployed with the site. After every content change and deploy, run:

```bash
python3 tools/indexnow.py            # dry run: shows the 10 URLs
python3 tools/indexnow.py --submit   # sends them to IndexNow
```

The script reads `sitemap.xml`, checks the key file, and posts to
`api.indexnow.org` and `bing.com/indexnow`. Check **IndexNow** in Bing
Webmaster Tools for the submission status.

Do not run `--submit` before the new URLs are live; IndexNow will fetch them
and may see a 404.

---

## 3. First-month schedule

| When | Task | Time |
|---|---|---|
| Deploy day | verify 10 URLs, robots, sitemap, key file | 10 min |
| Deploy day | GSC property + sitemap + request indexing | 20 min |
| Deploy day | Bing import + sitemap | 10 min |
| Deploy day | `indexnow.py --submit` | 2 min |
| Day 2 | check GSC/Bing verification and sitemap status | 5 min |
| Day 7 | check **Pages** report; fix any "Excluded" URL that should be indexed | 15 min |
| Day 14 | check first impressions and queries; note them in the log | 15 min |
| Day 30 | first monthly review: GSC, Bing, AI prompts, content gaps | 45 min |

---

## 4. If a page is not indexed

Check in this order:

1. **Is it in the sitemap?** Open `sitemap.xml` and search for the URL.
2. **Does it return 200?** `curl -I` the exact URL.
3. **Is it canonical to itself?** View source, find `<link rel="canonical">`.
4. **Is it blocked?** Check `robots.txt` and the page's `<meta name="robots">`.
5. **Is it linked internally?** The hub and footer should link to it.
6. **Is the content distinct?** The Arabic and English pages are translations,
   not duplicates: `hreflang` and canonical are correct.
7. **Request indexing again** after fixing anything.
8. **Wait.** A new site can take 2–6 weeks for the first page.

Common false alarms:

- "Discovered – currently not indexed" on a new site is normal.
- "Crawled – currently not indexed" usually means Google saw the page but
  judged it not yet worth indexing. Improve the page and earn a mention; do
  not resubmit daily.
- "Duplicate, Google chose a different canonical" means Google preferred
  another URL. Check that internal links use the canonical URL, not a variant.

---

## 5. Monthly review

### Search Console

- Which queries already get impressions? Write them down.
- Which page gets the most impressions but few clicks? Improve its title and
  description.
- Which Arabic query is closest to the product but still missing? That is the
  next article.
- Are all 10 URLs indexed? If not, use section 4.

### Bing

- Same questions as GSC, plus IndexNow status.
- Bing sometimes indexes faster on a new site; use it as an early signal, not
  as the final judge.

### AI visibility

Run the prompts in `marketing/ai-visibility-baseline.md` once a month. Record
mentions and citations; do not chase a single answer.

### Content

- Update the "last updated" date only when the content actually changes.
- Re-check competitor prices and features every quarter.
- Add one new guide only when GSC shows demand for it.

---

## 6. Guardrails

- **No analytics script.** GSC and Bing give query data without touching the
  learner. If you ever add analytics, it must be opt-in, self-hosted, and
  disclosed; otherwise the privacy promise is false.
- **No paid links, link exchanges, or mass guest posts.**
- **No fake reviews, ratings, user counts, or testimonials.**
- **No keyword stuffing.** The pages are written for people first.
- **Do not change the app UI as part of SEO work.** The English interface is a
  deliberate learning feature.
- **Keep the date honest.** `dateModified` and the visible date must match a
  real content change.

---

## 7. Change log

| Date | Change | By |
|---|---|---|
| 2026-11-28 | Runbook created; technical SEO and 8 pages built; IndexNow key added | Nagdista |
| 2026-11-28 | Deployed commit `0187daa` to GitHub Pages; all 10 URLs verified `200` | Nagdista |
| 2026-11-28 | IndexNow submission accepted: `api.indexnow.org` returned `202`, Bing returned `200` | Nagdista |

Add a row whenever verification, sitemap submission, or a significant content
change happens.
