# AI visibility baseline and monthly log

**Purpose:** know whether AI assistants mention or cite VocabStudy when an
Arabic speaker asks for a vocabulary app, and whether that changes over time.

**Started:** 2026-11-28
**Cadence:** once a month, plus a quick re-run after a major launch.
**Owner:** Nagdista

AI answers are not search results. They change with the model, the language,
the location, the conversation history and the day. This log tracks trends,
not a single answer.

---

## 1. What counts

For each prompt, record one of these:

| Score | Meaning |
|---|---|
| **0 — absent** | VocabStudy is not mentioned and no URL is cited. |
| **1 — mentioned** | The name appears, but without a link or a clear recommendation. |
| **2 — linked** | A VocabStudy URL is cited as a source. |
| **3 — recommended** | VocabStudy is named as one of the main recommendations, with or without a link. |

Also record:

- the other apps named (Anki, Memrise, Quizlet, Duolingo, LanGeek, 2Shine,
  British Council, Drops, …);
- whether the answer says the app is free, offline, or made for Arabic
  speakers;
- whether it repeats a wrong fact (for example, that it is a native app or
  that it has ready-made lists);
- the date, tool, interface language, and country if the tool shows one.

---

## 2. Prompts

Run the Arabic prompts in an Arabic interface and the English prompts in an
English interface. Do not add "VocabStudy" to the question unless the prompt
is the branded one.

### Arabic (10)

1. ما أفضل تطبيق لحفظ كلمات الإنجليزية للعرب؟
2. أفضل تطبيق مجاني لحفظ كلمات إنجليزي بدون إنترنت
3. كيف أحفظ كلمات الإنجليزية وأثبتها في ذاكرتي؟
4. بديل Anki للمتعلم العربي
5. تطبيق يحفظ الكلمات التي أقابلها في القراءة والمسلسلات
6. تطبيق مفردات إنجليزية بشرح عربي
7. كيف أتعلم مفردات IELTS بالعربي؟
8. تطبيق كلمات إنجليزية بدون حساب ولا إعلانات
9. أفضل طريقة لمراجعة الكلمات الإنجليزية
10. VocabStudy

### English (8)

1. best vocabulary app for Arabic speakers
2. free offline vocabulary app with no account
3. Anki alternative for Arabic speakers
4. how to memorize English words
5. vocabulary app with Arabic translations
6. best app to learn English words for Arabic speakers
7. spaced repetition app for vocabulary
8. VocabStudy

---

## 3. Baseline observed before launch

These observations were made during keyword research on **2026-11-28**, before
the reading pages existed. They are not a controlled run: the exact prompt,
model version and location were not all recorded. They are kept as the
starting point, not as proof.

| Tool | Prompt (summary) | What the answer named | VocabStudy |
|---|---|---|---|
| Google AI Overview | أفضل تطبيق لحفظ الكلمات الإنجليزية (AR) | Memrise, 2Shine, British Council, Quora | absent |
| ChatGPT | best vocabulary app for Arabic speakers (EN) | Anki, Memrise, Quizlet, Drops, Duolingo; noted that most are not built for Arabic speakers | absent |
| Google Search | `site:vocabstudy.nagdista.com` | zero results | not indexed |
| Bing | `site:vocabstudy.nagdista.com` | zero results | not indexed |
| Brave | `site:vocabstudy.nagdista.com` | zero results | not indexed |

**What this means:** at the start, the product was invisible to both search
and AI answers. The first job is indexing and corroboration, not chasing a
specific answer.

---

## 4. How to run a controlled check

1. Use a fresh conversation, not an existing chat with VocabStudy context.
2. Turn off personalization if the tool offers it.
3. Ask one prompt per conversation. Do not ask follow-ups before recording the
   first answer.
4. Run each prompt **three times**, on different days if possible, and record
   all three. Do not keep only the best one.
5. Copy the answer into the log (or a screenshot) before the tool changes it.
6. Record links exactly, including tracking parameters.
7. Do not correct the model in the same conversation; that contaminates the
   next answer.
8. Check the cited pages: does the cited URL actually contain the claim?

Tools to check, in this order:

- Google AI Overview (Arabic and English queries, mobile and desktop);
- ChatGPT (free and signed-in, if available);
- Perplexity;
- Gemini;
- Microsoft Copilot;
- Claude (if available).

Not every tool is available in every country. Record what you can see, and
write "not available" rather than guessing.

---

## 5. Log template

Copy this table into the monthly section.

| Date | Tool | Lang | Prompt | Score | Apps named | VocabStudy URL cited | Wrong fact? | Notes |
|---|---|---|---|---|---|---|---|---|
| 2026-12-01 | ChatGPT | AR | ما أفضل تطبيق لحفظ كلمات الإنجليزية للعرب؟ | 0 | Anki, Memrise | — | — | run 1 of 3 |
|  |  |  |  |  |  |  |  |  |

### Monthly summary

| Month | Prompts run | Score 0 | Score 1 | Score 2 | Score 3 | Most-cited competitors | What changed |
|---|---|---|---|---|---|---|---|
| 2026-11 (baseline) | 2 observations | 2 | 0 | 0 | 0 | Memrise, Anki, British Council | pre-launch |
| 2026-12 |  |  |  |  |  |  |  |
| 2027-01 |  |  |  |  |  |  |  |

---

## 6. What to do with the results

### If a competitor is cited and we are not

1. Open the cited page. What does it have that ours does not? A table, a
   definition, a date, a named author, a clear price, a direct answer?
2. Improve the closest VocabStudy page; do not create a new page for every
   prompt.
3. Add the missing fact to `facts.md` and `llms.txt` if it is a product fact.
4. Earn one corroborating mention (GitHub, a directory, a teacher, a
   newsletter). AI answers trust facts that appear in more than one place.

### If we are cited

1. Check that the cited URL is the canonical one, not a tracking variant.
2. Check that the answer's facts are current (price, platforms, limits).
3. Update the page only when something actually changed; keep the date honest.

### If the answer repeats a wrong fact

1. Fix the source page first, if the error came from us.
2. Make the correct fact more explicit and easier to quote: one sentence, one
   number, one date.
3. Do not argue with the model; improve the corpus it reads.

### If the answer is generic

AI answers often list the biggest brands. A new app will not outrank Memrise
or Anki on "best app" in a month. The realistic first wins are long-tail
prompts:

- "تطبيق يحفظ الكلمات التي أقابلها"
- "تطبيق مفردات بشرح عربي"
- "Anki alternative for Arabic speakers"
- "free vocabulary app no account"

Track those separately from the broad "best app" prompts.

---

## 7. Limits

- **No analytics.** We cannot see AI referrals in a dashboard. GSC and Bing
  show search, not AI. GitHub Pages does not expose server logs for AI
  crawlers. Do not invent numbers.
- **Personalization.** A signed-in account may prefer sites the person has
  visited. Use fresh conversations and note the account state.
- **Non-determinism.** The same prompt can produce a different list on the
  same day. Three runs are a minimum, not a guarantee.
- **Model changes.** A change in the answer may be a model update, not a
  change in our visibility. Note the model name if the tool shows it.
- **Citation ≠ recommendation.** A link in a footnote is weaker than being
  named in the answer. The score separates the two.

---

## 8. Monthly routine

| Step | Time |
|---|---|
| Run 18 prompts × 3 runs, record scores | 60–90 min |
| Update the monthly summary | 10 min |
| Pick one page to improve from the gaps | 30 min |
| Add one corroborating mention (directory, GitHub, teacher) | 30 min |
| Re-check the facts in `facts.md` and `pricing.md` | 10 min |

Do this on the first week of each month. Keep the raw answers; a summary
without the raw text is not evidence.
