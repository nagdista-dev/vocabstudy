/* tools/seed_learner.js — a realistic learner for design reviews (QA only, never shipped).
   Paste the body into the browser console on http://127.0.0.1:8791/ (or run it with a
   browser tool's "execute JavaScript"), wait ~40 s, and the page reloads as a learner
   two weeks in: 22 words (8 due today, 3 mastered, 7 new), study history, notes, own
   sentences, tags, a word flagged "Which meaning?" and an unsure sentence.
   Needs the internet (auto-fill fills the words). Kept in git so any copy of the repo can seed a review. */
(async () => {
  localStorage.clear();
  const list = [
    { word: "achieve", tags: ["IELTS"], context: "She worked hard to achieve her goals this year.", source: "BBC article" },
    { word: "postpone", tags: ["work"], context: "The manager decided to postpone the meeting until Monday.", source: "Work email" },
    { word: "actually" }, { word: "beautiful" },
    { word: "take off", context: "The plane will take off at six.", source: "Airport" },
    { word: "receive", tags: ["work"] }, { word: "resilient", tags: ["IELTS"] }, { word: "challenge" }, { word: "decision" },
    { word: "give up" }, { word: "look after" },
    { word: "relieved", context: "Employees were relieved when the news came.", source: "News" },
    { word: "deadline", tags: ["work"] }, { word: "borrow" }, { word: "depend" }, { word: "opportunity", tags: ["IELTS"] },
    { word: "commute", tags: ["work"] }, { word: "persuade" }, { word: "essential" }, { word: "afford" }, { word: "suggest" }, { word: "improve" },
  ];
  VS.store.saveUserWords(list.map((w) => Object.assign({ auto: "todo" }, w)));
  VS.autofill.fill(VS.allWords().map((w) => w.id));
  await new Promise((r) => setTimeout(r, 30000));
  const st = JSON.parse(localStorage.vocabstudy);
  const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const relieved = st.library.find((x) => /^reliev/.test(x.word)).word.toLowerCase();
  st.words = { achieve: [5, day(9), 6, 1], postpone: [6, day(40), 7, 0], actually: [3, day(0), 3, 2], beautiful: [2, day(0), 2, 1],
    "take off": [1, day(0), 1, 3], receive: [3, day(2), 3, 0], resilient: [2, day(1), 2, 2], challenge: [4, day(5), 4, 1],
    decision: [1, day(0), 1, 1], "give up": [2, day(-1), 2, 0], "look after": [1, day(1), 1, 0], [relieved]: [3, day(3), 3, 1],
    deadline: [2, day(0), 2, 0], borrow: [1, day(0), 0, 4], depend: [1, day(0), 1, 3] };
  st.history = {};
  for (let i = 14; i >= 1; i--) if (![3, 6, 10].includes(i)) st.history[day(-i)] = [20 + ((i * 7) % 30), 15 + ((i * 5) % 20), 600 + i * 60, i % 3, i < 5 ? 2 : i < 9 ? 1 : 0];
  st.streak = { last: day(-1), count: 2 };
  st.today = Object.assign(st.today || {}, { date: day(0), answered: 12, right: 9, seconds: 540, newWords: 0, met: 0, learned: [] });
  st.notes = { borrow: "Borrow = آخد. Lend = أدّي.", achieve: "achieve → achievement" };
  const f = (w) => st.library.find((x) => x.word === w);
  f("borrow").mine = ["Can I borrow your charger for a minute?"];
  f("deadline").mine = ["The deadline for my project is next Thursday."];
  f("depend").mine = ["It depends of the weather tomorrow."];
  f("depend").unsure = ["It depends of the weather tomorrow."];
  localStorage.vocabstudy = JSON.stringify(st);
  location.reload();
})();
