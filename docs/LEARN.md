# اتعلّم من المشروع ده

المشروع مكتوب عشان يتقري. مفيش framework ولا build معقد — HTML و CSS و
JavaScript عادي، وكل ملف صغير وليه وظيفة واحدة. الدليل ده بيمشّيك فيه بالترتيب.

> نصيحة: افتح الملف جنب الدليل، واقرا التعليق اللي في أوله الأول — كل ملف
> بيبدأ بشرح **ليه** اتعمل كده.

---

## المرحلة 1 — الصورة الكبيرة (30 دقيقة)

1. اقرا `README.md` — بيقولك الموقع بيعمل إيه.
2. افتح `tools/templates/page.html` — ده الـ HTML الوحيد اللي اتكتب بإيد.
   لاحظ إن الصفحة فاضية تقريبًا: `<main id="view">` والـ JavaScript هو اللي
   بيملاها.
3. شغّل `python3 tools/build.py` وافتح `index.html` اللي اتولّد (صفحة واحدة فيها التطبيق كله). قارنه بالقالب:
   إيه اللي اتغيّر؟ (الـ `{{…}}` اتبدّلت).

**اتعلمت:** فصل المحتوى عن القالب، وتوليد الصفحات بدل نسخها.

## المرحلة 2 — البيانات (20 دقيقة)

1. افتح `assets/js/core/vs.js` ودوّر على `VS.addWords`. كل كلمة object فيه
   `word`, `definition` … والتطبيق مش جاي معاه ولا كلمة: المكتبة بتاعتك من أول كلمة.
2. في نفس الملف، لاحظ إن الـ `id` هو
   الكلمة نفسها (`borrow`، `axe (tool)`): عشان كده الكلمة مش ممكن تتكرر في
   المكتبة، والتقدّم بيفضل لو عدّلت التعريف.
3. افتح `core/store.js` ودوّر على `saveUserWords` و `fillUserWord`: إزاي
   الكلمة بتتحفظ بالحقول اللي إنت كتبتها بس، والـ auto-fill بيملا الباقي.
4. افتح `core/filters.js`: فلاتر المكتبة كلها functions صافية، والفلتر نفسه
   متخزّن في الـ URL (`#/words?tag=IELTS`).
5. افتح `core/autofill.js`: إزاي التطبيق بيكمّل الكلمة لوحده في الخلفية،
   ومن غير ما يكتب فوق اللي إنت كتبته.
6. جرّب: من التطبيق → **Add words** → اكتب كلمة واضغط Enter، وبعدين افتح
   Library وشوفها.

**اتعلمت:** الـ data model، الـ IDs الثابتة، و async في الخلفية.

## المرحلة 3 — الـ CSS كنظام تصميم (45 دقيقة)

اقرا بالترتيب ده بالظبط — ده نفس ترتيب التحميل:

1. `assets/css/tokens.css` — كل لون ومقاس في مكان واحد (CSS variables).
   **جرّب:** غيّر `--brand` لـ `#0f766e` وشوف الموقع كله اتغيّر.
2. `base.css` — reset + الخطوط + `:focus-visible` + احترام reduced motion.
3. `components.css` — أزرار، كروت، شرايح. كل component بيستخدم tokens بس.
4. `views/*.css` — كل شاشة بتركّب components، مش بتعيد تعريفها.
5. `motion.css` — كل الأنيميشن في ملف واحد. ابدأ بـ `mark-draw`.
6. `glass.css` — الـ accent العاشر: طبقة Liquid Glass، كل قواعدها محصورة في
   `[data-accent="glass"]`، ومعاها fallbacks للشفافية والـ forced colors.

**اتعلمت:** design tokens، الـ cascade، mobile-first بـ `@media`، وإزاي
تحط الأنيميشن في خدمة المستخدم.

## المرحلة 4 — الـ JavaScript الأساسي (ساعة)

1. `core/vs.js` — ركّز على `VS.html` (tagged template literal) وليه بيعمل
   escape لكل قيمة. **ده أهم درس أمان في المشروع** (XSS).
2. `core/store.js` — اقرا التعليق اللي فوق: نظام Leitner للمراجعة المتباعدة.
   بعدين اقرا `grade()` سطر سطر. **جرّب:** غيّر `WAIT_DAYS`.
3. `core/practice.js` — `VS.distractors` (إزاي تختار إجابات غلط عادلة)
   و `VS.findInExample` (regex بيلاقي "brought" لما الكلمة "bring").
4. `core/speech.js` — Web Speech API في 40 سطر.

**اتعلمت:** closures، الـ namespace pattern، localStorage، regex، Web APIs.

## المرحلة 5 — الشاشات والـ routing (ساعة)

1. `app.js` — ابدأ بـ `parse()` (من الـ URL للشاشة) وبعدين `go()` و `render()`.
2. لاحظ **event delegation**: listener واحد لكل الكليكات بيدوّر على
   `data-action`. قارن ده بـ `onclick` في كل زرار.
3. `views/quiz.js` — شاشة كاملة: `start` → `render` → `actions.pick` → `finish`.
4. `views/cards.js` — دوّر على `swipe()`: Pointer Events للموبايل.

**اتعلمت:** SPA routing بالـ hash، state per view، re-render بعد كل تغيير،
keyboard shortcuts، touch gestures.

## المرحلة 6 — الأدوات (30 دقيقة)

1. `tools/check.py` — validation للبيانات قبل ما توصل للمتصفح.
2. `tools/build.py` — توليد الملفات + cache busting بـ `?v=`.

**اتعلمت:** automation، وإنك تمسك الغلط بدري.

---

## تمارين (رتّبها من الأسهل)

1. ضيف إعداد جديد في Settings: "Round size 40".
2. ضيف نوع سؤال جديد في الكويز: "اسمع الكلمة واختارها" (استخدم `VS.speech`).
3. ضيف لعبة جديدة `views/listen.js` واربطها: route + `SCRIPTS` + CSS (بُص على `views/speak.js` كمثال).
4. ضيف فلتر جديد في المكتبة: "اتراجعت آخر مرة إمتى" (`core/filters.js`).
5. اكتب في `check.py` تحذير لو الـ IPA مش بين `/…/`.

لو عملت تمرين وكسر حاجة: `python3 tools/check.py` وافتح Console في المتصفح.
