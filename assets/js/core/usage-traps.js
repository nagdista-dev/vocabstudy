/* core/usage-traps.js — the mistakes Arab learners make with a word, and the fix.
   ------------------------------------------------------------------
   A dictionary tells you what "depend" means. A teacher tells you what
   you're going to get wrong: "It depends OF the weather" — because in
   Arabic it's «يعتمد على», and the learner translates the preposition.
   These traps are the teacher's voice. They are written by hand, from
   years of marking Arab learners' English, and they ship with the app:
   no network, no API.

   Each trap:
     keys    the words it belongs to ("depend", "look forward"); inflected
             forms match too (depends, depended, depending).
     kind    prep | mix | meaning | count | with | grammar | tense (soft: a
             sentence may be kept anyway, but not as a Recall cue)
     wrong   what Arab learners typically say or write
     right   what a native speaker says
     why     one short line: the rule, and where the mistake comes from.
             Arabic goes in «» (shown as an isolated chip) and never starts a
             sentence after a full stop: "For «حالياً», say currently", not
             "… . «حالياً» is currently" — mid-line, that reads out of order.
     bad     (optional) a pattern that finds the mistake inside a sentence,
             so "Use it" (views/write.js) can catch it in the learner's own
             writing — like a teacher's red pen, but kind.

     VS.usageTraps(word)          → the traps for a library word
     VS.findUsageMistakes(text)   → traps whose mistake appears in a text
   ------------------------------------------------------------------ */
(function () {
  "use strict";

  const KIND = {
    prep: "Preposition",
    mix: "Don't mix up",
    meaning: "Meaning trap",
    count: "Not countable",
    with: "Right partner word",
    grammar: "Grammar",
    tense: "Tense",
  };

  const PRON = "(?:me|him|her|us|them)";
  const NUM = "(?:\\d+|one|two|three|four|five|six|seven|eight|nine|ten|a\\s+few|few|many|several)";
  const TIME = "(?:minutes?|hours?|days?|weeks?|months?|years?)";
  const DAY = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)";
  /* Tense: Arabic keeps the verb as it is after «امبارح» (امبارح الطيارة بتطير متأخر),
     English moves it to the past. These patterns look for a past-time word and a
     present verb in the same clause. They are "soft" (kind: tense): a learner may
     keep the sentence, because a pattern can be wrong — but a sentence kept against
     the warning is never used as a Recall cue (views/write.js). */
  const PAST = "(?:yesterday|last\\s+(?:night|week|weekend|month|year|summer|winter|spring|autumn|time|" + "monday|tuesday|wednesday|thursday|friday|saturday|sunday)|" +
    "(?:\\d+|a|an|one|two|three|four|five|six|seven|eight|nine|ten|a\\s+few|few|many|several)\\s+(?:minutes?|hours?|days?|weeks?|months?|years?)\\s+ago|" +
    "when\\s+i\\s+was\\s+(?:a\\s+)?(?:child|kid|boy|girl|young|little|student))";
  const SUBJ = "(?:i|you|we|they|he|she|the\\s+[a-z]+|my\\s+[a-z]+|our\\s+[a-z]+|his\\s+[a-z]+|her\\s+[a-z]+|their\\s+[a-z]+)";
  // Verbs whose present and past differ, and that are rarely nouns ("the bus stop" is not a verb).
  // No state verbs (think, know, like, want): "I think he left yesterday" is right.
  const DO = "(?:go|come|take|make|have(?!\\s+to\\b)|do|see|eat|buy|get|give|find|leave|meet|tell|say|write|drink|drive|fly|forget|" +
    "lose|pay|sell|send|sleep|speak|spend|teach|wake|win|begin|break|bring|build|catch|choose|keep|run|sit|stand|swim|wear|" +
    "become|fall|grow|hear|decide|arrive|finish|stay|travel|visit|watch|study|cook|play|walk|move|return|receive|happen|" +
    // Regular verbs learners use with "yesterday" (critique v10: "Yesterday I borrow…" passed).
    "borrow|lend|ask|try|live|open|clean|wash|miss|learn|talk|listen|enjoy|remember|explain|carry|invite|reply|join|" +
    "cry|laugh|steal|postpone|achieve|improve|suggest|persuade|afford|commute|depend|attend|discuss|marry|call)";
  // A clause, not a whole paragraph: no full stop, and no "and / but / because" (…and I love it — still true now).
  const GAP = "(?:(?!\\b(?:and|but|because|so|now|today|still|than|since|until)\\b)[^.;!?\\n]){0,50}?";
  const PASTFORM = "(?:went|ate|saw|took|made|came|bought|got|gave|found|left|met|told|said|thought|wrote|drank|drove|flew|forgot|" +
    "lost|paid|sold|sent|slept|spoke|spent|taught|understood|woke|won|began|broke|brought|built|caught|chose|felt|kept|knew|ran|" +
    "sat|stood|swam|wore|became|fell|grew|heard|had|did|\\w*[^e\\s]ed)";

  // Verbs a learner puts after "give up to / enjoy to…": only these fire the -ing trap, so
  // "keeps to himself" and "gave up to the police" (to + a noun) are never marked wrong.
  const GERUNDABLE = "(?:smoke|eat|drink|go|work|study|play|travel|read|wait|watch|do|try|run|swim|drive|cook|write|talk|" +
    "speak|sleep|learn|sing|dance|walk|use|buy|see|meet|help|answer|call|clean|wake|get|make|take|come|leave|live|stay|" +
    "spend|visit|listen|look|think|exercise|shop|chat|practise|practice|argue|complain|lie|stop|start|open|close)";

  const ME = "\\b(?:i\\s*'?m|i\\s+am|i\\s+was|i\\s+feel|i\\s+felt|we\\s+are|we\\s+were|we're)\\s+(?:so\\s+|very\\s+|really\\s+|a\\s+bit\\s+)?";

  /* [keys, kind, wrong, right, why, bad?] — keys are "|"-separated. */
  const DATA = [
    /* ── Prepositions: Arabic picks a different one, or none ───── */
    ["depend|dependent", "prep", "It depends of the weather.", "It depends on the weather.",
      "«يعتمد على» = depend on — never of, from or at.", "\\bdepend\\w*\\s+(?:of|from|at)\\b"],
    ["afraid|scared|frightened", "prep", "I'm afraid from dogs.", "I'm afraid of dogs.",
      "«خايف من» is afraid of — never from.", "\\b(?:afraid|scared|frightened)\\s+from\\b"],
    ["listen", "prep", "I listen music on the bus.", "I listen to music on the bus.",
      "You listen to something. (You hear it — no to.)",
      "\\blisten(?:s|ed|ing)?\\s+(?!to\\b|carefully|again|out|up|now|here|for|well|closely)(?:the|a|my|your|his|her|music|songs?|podcasts?|him|me|them|us|it)\\b"],
    ["arrive|arrival", "prep", "We arrived to Cairo at night.", "We arrived in Cairo at night.",
      "Arrive in a city or country, arrive at a place. Never arrive to.", "\\barriv(?:e|es|ed|ing)\\s+to\\b"],
    ["discuss", "prep", "Let's discuss about the plan.", "Let's discuss the plan.",
      "Discuss already means «نتكلم عن»: no about after it.", "\\bdiscuss(?:es|ed|ing)?\\s+about\\b"],
    ["enter", "prep", "He entered to the room.", "He entered the room.",
      "Enter a place directly — no to, no in.", "\\bent(?:er|ers|ered|ering)\\s+(?:to|in)\\s+(?:the|a|my|his|her|our|their)\\b"],
    ["explain|explanation", "prep", "Can you explain me this word?", "Can you explain this word to me?",
      "Explain something to someone. Never explain me.", `\\bexplain(?:s|ed|ing)?\\s+${PRON}\\b`],
    ["married|marry", "prep", "She is married with a doctor.", "She is married to a doctor.",
      "Married to someone. And you marry someone — no with.", "\\bmarri(?:ed|es)\\s+with\\s+(?:a|an|the|my|his|her|him|me)\\b|\\bmarry(?:ing)?\\s+with\\b"],
    ["good", "prep", "I'm good in English.", "I'm good at English.",
      "Good at a skill or subject: good at English, good at cooking.",
      "\\bgood\\s+in\\s+(?:english|arabic|french|math|maths|science|sports?|football|cooking|drawing|writing|speaking|\\w+ing)\\b"],
    ["interested|interest", "prep", "I'm interested about history.", "I'm interested in history.",
      "Interested in — always in.", "\\binterested\\s+(?:on|about|with|at|for)\\b"],
    ["wait", "prep", "I'm waiting you outside.", "I'm waiting for you outside.",
      "Wait for someone. (Await has no for, but it's formal.)", `\\bwait(?:s|ed|ing)?\\s+(?:you|${PRON})\\b`],
    ["reach", "prep", "We reached to the hotel at six.", "We reached the hotel at six.",
      "Reach a place directly — no to. (Or: we got to the hotel.)", "\\breach(?:es|ed|ing)?\\s+to\\s+(?:the|a|my|our|his|her)\\b"],
    ["call", "prep", "I'll call to him tomorrow.", "I'll call him tomorrow.",
      "Call someone — no to.", `\\bcall(?:s|ed|ing)?\\s+to\\s+(?:you|${PRON})\\b`],
    ["contact", "prep", "Please contact with us.", "Please contact us.",
      "As a verb, contact takes no with. (Be in contact with — that one is fine.)", "\\bcontact(?:s|ed|ing)?\\s+with\\s+(?:us|me|him|her|them|the|our)\\b"],
    ["emphasize|emphasise|emphasis", "prep", "He emphasized on the deadline.", "He emphasized the deadline.",
      "Emphasize something directly. (Put emphasis on — that's where on goes.)", "\\bemphasi[sz](?:e|es|ed|ing)\\s+on\\b"],
    ["mention", "prep", "She mentioned about the problem.", "She mentioned the problem.",
      "Mention something directly — no about.", "\\bmention(?:s|ed|ing)?\\s+about\\b"],
    ["attend", "prep", "I attended to the meeting.", "I attended the meeting.",
      "Attend an event directly. (Attend to = take care of.)", "\\battend(?:s|ed|ing)?\\s+to\\s+(?:the|a|my|our)\\s+(?:meeting|class|lecture|wedding|party|course|conference|event)\\b"],
    ["answer", "prep", "Answer on the question.", "Answer the question.",
      "Answer a question, a call, an email — directly.", "\\banswer(?:s|ed|ing)?\\s+(?:on|to)\\s+(?:the|my|his|her|this|that|your)\\s+(?:question|email|call|phone)\\b"],
    ["join", "prep", "Join with us for dinner.", "Join us for dinner.",
      "Join someone directly — no with.", "\\bjoin(?:s|ed|ing)?\\s+with\\s+(?:us|me|them|him|her)\\b"],
    ["resemble", "prep", "He resembles to his father.", "He resembles his father.",
      "Resemble someone directly. (Or: he looks like his father.)", "\\bresembl(?:e|es|ed|ing)\\s+to\\b"],
    ["lack", "prep", "He lacks of experience.", "He lacks experience.",
      "The verb lack takes no of. The noun does: a lack of experience.", "\\black(?:s|ed|ing)\\s+of\\b"],
    ["consist", "prep", "The team consists from five people.", "The team consists of five people.",
      "Consist of — always of.", "\\bconsist(?:s|ed|ing)?\\s+(?:from|on)\\b"],
    ["similar|similarity", "prep", "Your phone is similar with mine.", "Your phone is similar to mine.",
      "Similar to. (Different from.)", "\\bsimilar\\s+(?:with|of)\\b"],
    ["different|difference", "prep", "My job is different of yours.", "My job is different from yours.",
      "Different from (or different to in Britain). Never different of.", "\\bdifferent\\s+of\\b"],
    ["responsible|responsibility", "prep", "Who is responsible of this?", "Who is responsible for this?",
      "Responsible for — «مسؤول عن» is for, not of.", "\\bresponsible\\s+(?:of|about|on)\\b"],
    ["proud", "prep", "I'm proud with my son.", "I'm proud of my son.",
      "Proud of — always of.", "\\bproud\\s+(?:with|on|from|in)\\b"],
    ["famous", "prep", "Egypt is famous with its history.", "Egypt is famous for its history.",
      "Famous for what makes it known.", "\\bfamous\\s+(?:with|by)\\b"],
    ["angry", "prep", "She is angry from me.", "She is angry with me.",
      "Angry with a person, angry about a thing. Never from.", "\\bangry\\s+(?:from|on)\\b"],
    ["worry|worried", "prep", "Don't worry from the exam.", "Don't worry about the exam.",
      "Worry about, worried about.", "\\bworr(?:y|ies|ied|ying)\\s+(?:from|on)\\b"],
    ["insist", "prep", "He insisted to pay.", "He insisted on paying.",
      "Insist on + -ing.", "\\binsist(?:s|ed|ing)?\\s+(?:to|in)\\b"],
    ["succeed|success", "prep", "She succeeded to pass the test.", "She succeeded in passing the test.",
      "Succeed in + -ing.", "\\bsucceed(?:s|ed|ing)?\\s+to\\b"],
    ["graduate|graduation", "prep", "I graduated in Cairo University.", "I graduated from Cairo University.",
      "Graduate from a school or university.", "\\bgraduat(?:e|es|ed|ing)\\s+(?:in|of)\\s+(?:the\\s+)?\\w+\\s+(?:university|college|school|faculty)\\b"],
    ["home", "prep", "I went to home early.", "I went home early.",
      "Go home, come home, get home — no to. (But: go to my house.)", "\\b(?:go|goes|went|going|gone|come|comes|came|coming|get|gets|got|getting|arrive\\w*|return\\w*)\\s+to\\s+home\\b"],
    ["abroad", "prep", "I want to travel to abroad.", "I want to travel abroad.",
      "Abroad already means «لبرّه»: no to.", "\\bto\\s+abroad\\b"],
    ["monday|tuesday|wednesday|thursday|friday|saturday|sunday", "prep", "See you in Wednesday.", "See you on Wednesday.",
      "On for days, in for months and years, at for times.", `\\bin\\s+${DAY}\\b`],
    ["look forward", "grammar", "I look forward to meet you.", "I look forward to meeting you.",
      "Here to is a preposition, so the verb takes -ing.", "\\blook(?:s|ed|ing)?\\s+forward\\s+to\\s+(?:meet|see|hear|work|visit|talk|speak|start|join)\\b"],
    ["used to|get used to|be used to", "grammar", "I'm used to wake up early.", "I'm used to waking up early.",
      "Be / get used to + -ing (a habit now). Used to + verb is the past: I used to smoke.",
      "(?:\\b(?:am|is|are|was|were|be|been|get|gets|got|getting)|'m|'re|'s)\\s+used\\s+to\\s+(?:wake|work|live|drive|eat|study|speak|go|do|sleep|get|walk|read|have)\\b"],

    /* ── Don't mix up: one Arabic word, two English ones ─────────── */
    ["borrow|lend", "mix", "Can you borrow me your car?", "Can you lend me your car?",
      "Borrow = you take it «تستلف». Lend = you give it «تسلّف».", `\\bborrow(?:s|ed|ing)?\\s+${PRON}\\b`],
    ["say|tell", "mix", "He said me the news.", "He told me the news.",
      "Tell someone something. Say something (to someone).", `\\b(?:say|says|said|saying)\\s+${PRON}\\b`],
    ["joke|lie|truth|tell", "mix", "He said a joke.", "He told a joke.",
      "Tell a joke, a lie, a story, the truth.", "\\b(?:say|says|said|saying)\\s+(?:a\\s+|the\\s+)?(?:joke|lie|story|truth)\\b"],
    ["mistake|make", "with", "I did a big mistake.", "I made a big mistake.",
      "Make a mistake, a decision, an effort, money, a plan. Do homework, a job, your best.",
      "\\b(?:do|does|did|doing|done)\\s+(?:a\\s+)?(?:big\\s+|huge\\s+|lot\\s+of\\s+|many\\s+|some\\s+|silly\\s+|small\\s+)?mistakes?\\b"],
    ["decision|decide", "with", "I did a decision.", "I made a decision.",
      "Arabic says «اتخذ قرار» (take), but English makes it: make a decision.", "\\b(?:do|does|did|doing|done)\\s+(?:a|the|this|that|my|your|our|a\\s+big)\\s+decision\\b"],
    ["homework|do", "with", "I make my homework after dinner.", "I do my homework after dinner.",
      "Do homework, do the dishes, do your best.", "\\b(?:make|makes|made|making)\\s+(?:my|your|his|her|our|their|the)\\s+homework\\b"],
    ["party", "with", "We'll do a party on Friday.", "We'll have a party on Friday.",
      "Have, throw or give a party — never do or make one.", "\\b(?:do|does|did|doing|make|makes|made|making)\\s+a\\s+(?:big\\s+|small\\s+|birthday\\s+)?party\\b"],
    ["effort", "with", "I did a big effort.", "I made a big effort.",
      "Make an effort.", "\\b(?:do|does|did|doing)\\s+(?:an?\\s+)?(?:big\\s+|great\\s+|huge\\s+|real\\s+)?efforts?\\b"],
    ["progress", "with", "I did a lot of progress.", "I made a lot of progress.",
      "Make progress. And progress has no plural: no progresses.", "\\b(?:do|did|does|doing)\\s+(?:a\\s+lot\\s+of\\s+|good\\s+|great\\s+|some\\s+|much\\s+)?progress\\b|\\bprogresses\\b"],
    ["noise", "with", "Don't do noise, the baby is asleep.", "Don't make noise, the baby is asleep.",
      "Make noise.", "\\b(?:do|did|does|doing)\\s+(?:a\\s+lot\\s+of\\s+|much\\s+|any\\s+)?noise\\b"],
    ["favour|favor", "with", "Can you make me a favour?", "Can you do me a favour?",
      "Do someone a favour.", "\\bmake\\s+(?:me|him|her|us)\\s+a\\s+favou?r\\b"],
    ["remind|remember", "mix", "Remember me to call her.", "Remind me to call her.",
      "Remind = make someone remember «فكّرني». Remember = you remember «افتكر».", `\\bremember(?:s|ed)?\\s+${PRON}\\s+to\\b`],
    ["learn|teach", "mix", "He learned me English.", "He taught me English.",
      "Teach someone. Learn something yourself.", `\\blearn(?:s|ed|t|ing)?\\s+${PRON}\\b`],
    ["win|earn|beat", "mix", "We won them 3–0. He wins 8,000 a month.", "We beat them 3–0. He earns 8,000 a month.",
      "Win a game or a prize. Beat the other team. Earn money from work.", `\\bw(?:in|ins|on|inning)\\s+${PRON}\\b|\\bw(?:in|ins)\\s+[\\d,]+\\s+(?:a|per)\\s+month\\b`],
    ["watch|see", "mix", "I see TV every night.", "I watch TV every night.",
      "Watch TV, a match, a film. See = notice with your eyes.", "\\b(?:see|sees|saw|seeing)\\s+(?:tv|television|the\\s+match|a\\s+film|films|movies?|a\\s+movie)\\b"],
    ["rob|steal|stole", "mix", "Someone stole the bank.", "Someone robbed the bank (and stole the money).",
      "Rob a person or place. Steal a thing.", "\\bst(?:eal|eals|ole|olen|ealing)\\s+(?:the\\s+)?(?:bank|shop|store|house|me|him|her|us)\\b"],
    ["fun|funny", "mix", "The trip was very funny.", "The trip was a lot of fun.",
      "Funny = it makes you laugh «بيضحّك». Fun = you enjoy it «ممتع».",
      "\\b(?:trip|party|game|day|weekend|holiday|vacation|evening|night)\\s+(?:was|is)\\s+(?:very\\s+|so\\s+|really\\s+)?funny\\b"],
    ["bored|boring", "mix", "I'm boring at home.", "I'm bored at home.",
      "-ed is how you feel (bored). -ing is what causes it (a boring film).", ME + "boring\\b"],
    ["interested|interesting", "mix", "I'm interesting in football.", "I'm interested in football.",
      "-ed is how you feel. -ing describes the thing.", ME + "interesting\\b"],
    ["excited|exciting", "mix", "I'm so exciting about the trip.", "I'm so excited about the trip.",
      "-ed is how you feel. -ing describes the thing.", ME + "exciting\\b"],
    ["embarrassed|embarrassing", "mix", "I was very embarrassing.", "I was very embarrassed.",
      "-ed is how you feel. -ing describes the situation.", ME + "embarrassing\\b"],
    ["tired|tiring", "mix", "I'm tiring after work.", "I'm tired after work.",
      "-ed is how you feel. -ing describes the work.", ME + "tiring\\b"],
    ["confused|confusing", "mix", "I'm confusing about the rules.", "I'm confused about the rules.",
      "-ed is how you feel. -ing describes the rules.", ME + "confusing\\b"],
    ["sensible|sensitive", "mix", "She cries easily, she's very sensible.", "She cries easily, she's very sensitive.",
      "Sensitive = حساس. Sensible = عاقل، منطقي."],
    ["lose|loose", "mix", "I don't want to loose my job.", "I don't want to lose my job.",
      "Lose (one o) = تخسر، تضيّع. Loose (two o's) = واسع، مش مربوط.", "\\bloose\\s+(?:my|your|his|her|our|their|the|weight|time|money|it|him|her)\\b"],
    ["rise|raise", "mix", "Prices raised again this month.", "Prices rose again this month.",
      "Rise: it goes up by itself. Raise: you lift something (raise your hand, raise prices).", "\\bprices?\\s+(?:raised|raises|has\\s+raised|have\\s+raised)\\b"],
    ["job|work", "mix", "I found a work in Dubai.", "I found a job in Dubai.",
      "A job (countable). Work (no a): I have a lot of work.", "\\b(?:found|find|finding|need|needs|get|got|looking\\s+for)\\s+a\\s+work\\b"],
    ["travel|trip|journey", "mix", "How was your travel?", "How was your trip?",
      "A trip / a journey is one time. Travel is the general activity: I love travel.",
      "\\b(?:a|your|my|his|her|the|our)\\s+travel\\b(?!\\s+(?:agent|agency|bag|guide|plans?|insurance|documents?|costs?|time|tips|company))"],
    ["hope|wish", "mix", "I hope I was taller.", "I wish I were taller.",
      "Wish = it isn't true «يا ريت». Hope = it may happen «أتمنى».", "\\bhope\\s+(?:i|you|he|she|we|they)\\s+(?:was|were|had|could)\\b"],
    ["ago|before", "mix", "I came to Dubai before three years.", "I came to Dubai three years ago.",
      "«قبل 3 سنين» = three years ago. Before needs a point in time: before 2020, before lunch.",
      `\\bbefore\\s+${NUM}\\s+${TIME}\\b`],
    ["since|for", "grammar", "I live here since 2020.", "I have lived here since 2020.",
      "Since / for + up to now = present perfect: I have lived, I have worked.",
      "\\b(?:i|we|they|you)\\s+(?:live|work|study|know|am|are)\\b[^.!?]{0,40}\\b(?:since|for\\s+(?:\\d+|two|three|four|five|many|several)\\s+(?:years|months))\\b"],
    ["during", "grammar", "I studied during three hours.", "I studied for three hours.",
      "For + how long. During + when (during the film, during Ramadan).", `\\bduring\\s+${NUM}\\s+${TIME}\\b`],
    ["light|turn on|turn off|switch on|switch off|open|close", "mix", "Can you open the light?", "Can you turn on the light?",
      "«افتح النور» = turn on (switch on) the light. You open doors and windows, not lights.",
      "\\b(?:open|opens|opened|opening|close|closes|closed|closing)\\s+(?:the\\s+)?(?:light|lights|tv|television|air\\s+conditioner|ac|fan|radio|computer|laptop|phone)\\b"],
    ["exam|pass|test", "meaning", "I will pass the exam tomorrow. (= sit it)", "I will take the exam tomorrow — and I hope I pass.",
      "Pass = تنجح. Take (or sit) an exam = تمتحن.", "\\bpass(?:es)?\\s+(?:the|an|my)\\s+(?:exam|test)\\s+(?:tomorrow|next|on|this\\s+(?:morning|evening|afternoon))\\b"],

    /* ── Meaning traps: looks like a word you know ─────────────── */
    ["actually", "meaning", "Actually, I work in a bank. (= now)", "Currently, I work in a bank.",
      "Actually = «في الحقيقة، في الواقع». For «حالياً», say currently or at the moment."],
    ["eventually", "meaning", "We may eventually be late. (= maybe)", "We may be late. / We eventually arrived.",
      "Eventually = في الآخر، بعد وقت طويل. It never means «ممكن»."],
    ["sympathetic|sympathy", "meaning", "He's very sympathetic, everyone likes him.", "He's very nice — everyone likes him.",
      "Sympathetic = «متعاطف» (understands your pain). For «لطيف، دمه خفيف», say nice, friendly or fun."],
    ["agenda|diary|planner", "meaning", "I wrote it in my agenda.", "I wrote it in my diary (or planner).",
      "An agenda is the list of topics for a meeting. For the «أجندة» you write in, say a diary or a planner."],
    ["library|bookshop|bookstore", "meaning", "I bought it from the library.", "I bought it from the bookshop.",
      "A library lends books «تستلف منها». A bookshop sells them «تشتري منها»."],
    ["recipe|receipt|prescription", "meaning", "The doctor gave me a recipe.", "The doctor gave me a prescription.",
      "Prescription = روشتة. Recipe = وصفة أكل. Receipt = إيصال."],
    ["opinion", "meaning", "According to my opinion, it's wrong.", "In my opinion, it's wrong.",
      "In my opinion. According to is for other people or sources: according to the report.", "\\baccording\\s+to\\s+(?:my|our)\\s+opinion\\b"],
    ["old|age", "grammar", "I have 25 years.", "I'm 25 (years old).",
      "In English you are an age — you don't have it.", "\\bi\\s+have\\s+\\d+\\s+years\\b"],
    ["born", "grammar", "I born in Alexandria.", "I was born in Alexandria.",
      "Born needs was: I was born, she was born.", "\\b(?:i|he|she|we|they|you)\\s+born\\b"],
    ["agree", "grammar", "I am agree with you.", "I agree with you.",
      "Agree is a verb, not an adjective — no am.", "\\b(?:am|is|are|was|were)\\s+(?:not\\s+)?agree\\b"],

    /* ── Not countable: no a, no -s ─────────────────────────────── */
    ["advice|advise", "count", "He gave me an advice.", "He gave me some advice (a piece of advice).",
      "Advice has no plural and no an. Advise (with s) is the verb.", "\\ban\\s+advice\\b|\\badvices\\b"],
    ["information", "count", "Thanks for the informations.", "Thanks for the information.",
      "Information has no plural. One fact = a piece of information.", "\\binformations\\b|\\ban\\s+information\\b"],
    ["furniture", "count", "We bought new furnitures.", "We bought new furniture.",
      "Furniture has no plural. One = a piece of furniture.", "\\bfurnitures\\b|\\ba\\s+furniture\\b"],
    ["news", "count", "The news are bad.", "The news is bad.",
      "News looks plural but takes is: the news is.", "\\bnews\\s+(?:are|were)\\b"],
    ["homework|housework", "count", "I have many homeworks.", "I have a lot of homework.",
      "Homework has no plural: a lot of homework.", "\\bhomeworks\\b|\\bhouseworks\\b|\\bmany\\s+homework\\b"],
    ["equipment", "count", "The equipments are new.", "The equipment is new.",
      "Equipment has no plural.", "\\bequipments\\b"],
    ["luggage|baggage", "count", "I have three luggages.", "I have three bags (three pieces of luggage).",
      "Luggage has no plural.", "\\bluggages\\b|\\bbaggages\\b"],
    ["people|person", "count", "People is friendly here.", "People are friendly here.",
      "People is already plural: people are.", "\\bpeople\\s+(?:is|was|has)\\b"],
    ["police", "count", "The police is coming.", "The police are coming.",
      "The police is plural: are, have.", "\\bpolice\\s+(?:is|was|has)\\b"],
    ["weather", "count", "What a nice weather!", "What nice weather!",
      "Weather takes no a.", "\\ba\\s+(?:nice|good|bad|beautiful|hot|cold|great|lovely|terrible)\\s+weather\\b"],

    /* ── Goes with: the words English puts together ───────────── */
    ["rain|heavy", "with", "There was strong rain last night.", "There was heavy rain last night.",
      "Heavy rain, heavy traffic. (Strong wind, strong coffee.)", "\\bstrong\\s+rain\\b"],
    ["traffic", "with", "The traffic was very crowded.", "The traffic was very heavy. (The street was crowded.)",
      "Heavy traffic, a traffic jam. People and places are crowded.", "\\b(?:strong|crowded)\\s+traffic\\b|\\btraffic\\s+(?:is|was)\\s+(?:very\\s+|so\\s+)?crowded\\b"],
    ["coffee|tea|strong", "with", "I like my coffee heavy.", "I like my coffee strong.",
      "Strong coffee, strong tea — that's what «تقيل» means here.", "\\bheavy\\s+(?:coffee|tea)\\b|\\b(?:coffee|tea)\\s+(?:is\\s+)?heavy\\b"],
    ["price|expensive|cheap", "with", "The price is very expensive.", "The price is very high. (It's very expensive.)",
      "A price is high or low. The thing is expensive or cheap.", "\\bprices?\\s+(?:is|are|was|were)\\s+(?:very\\s+|so\\s+|too\\s+)?(?:expensive|cheap)\\b"],
    ["crime|commit", "with", "He made a crime.", "He committed a crime.",
      "Commit a crime.", "\\b(?:make|made|do|did)\\s+a\\s+crime\\b"],
    ["attention", "with", "Take attention to the road.", "Pay attention to the road.",
      "Pay attention.", "\\b(?:take|takes|taking|took)\\s+attention\\b"],
    ["cold|flu", "with", "I took a cold.", "I caught a cold. (I have a cold.)",
      "Catch a cold, have the flu.", "\\b(?:took|take|takes|taking)\\s+(?:a\\s+)?(?:cold|flu)\\b"],
    ["question|ask", "with", "Can I make a question?", "Can I ask a question?",
      "Ask a question.", "\\b(?:make|made|do|did)\\s+a\\s+question\\b"],

    /* ── Tense: the past needs a past verb (soft: see PAST above) ── */
    ["yesterday|ago|last", "tense", "Yesterday the plane take off late.", "Yesterday the plane took off late.",
      "Yesterday, last week, two days ago = the past, so the verb goes to the past too (borrow → borrowed, take → took). Arabic can say «امبارح الطيارة بتطير متأخر» (yesterday the plane flies late); English can't.",
      `\\b${PAST}\\b,?\\s+${GAP}\\b${SUBJ}\\s+${DO}(?:s|es)?\\b|\\b(?:i|you|we|they|he|she)\\s+${DO}(?:s|es)?\\b[^.,;!?\\n]{0,40}?\\b${PAST}\\b`],
    ["yesterday|ago|last", "tense", "Yesterday I am very tired.", "Yesterday I was very tired.",
      "Am / is / are are now. Yesterday, last week, two days ago: was / were.",
      `\\b${PAST}\\b,?\\s+${GAP}\\b(?:i\\s+am|i'm|(?:he|she|it)\\s+is|(?:we|you|they)\\s+are|(?:we|you|they)'re|the\\s+[a-z]+\\s+(?:is|are))\\b`],
    ["did|didn't", "tense", "I didn't went to work.", "I didn't go to work.",
      "Did / didn't already says the past: the verb after it stays as it is — didn't go, didn't eat, did you see.",
      `\\b(?:didn't|didnt|did\\s+not)\\s+${PASTFORM}\\b|\\bdid\\s+(?:you|he|she|they|we|it)\\s+${PASTFORM}\\b`],

    /* ── Grammar that belongs to the word ─────────────────────── */
    ["can|must|should|could|might", "grammar", "I can to swim.", "I can swim.",
      "No to after can, must, should, could, might, will.", "\\b(?:can|could|must|should|will|would|might|may)\\s+to\\s+(?!be\\s+honest)\\w+"],
    ["let", "grammar", "Let me to explain.", "Let me explain.",
      "Let someone do — no to.", `\\blet\\s+${PRON}\\s+to\\b`],
    ["give up|enjoy|avoid|finish|mind|keep|practise|practice|consider|suggest", "grammar", "My father gave up to smoke.", "My father gave up smoking.",
      "After give up, enjoy, avoid, finish, mind and keep, the next verb takes -ing: gave up smoking, enjoy reading. Arabic says «بطّل يدخّن»; English doesn't use to here.",
      "\\b(?:g(?:ive|ives|ave|iven|iving)\\s+up|enjoy(?:s|ed|ing)?|avoid(?:s|ed|ing)?|finish(?:es|ed|ing)?|mind(?:s|ed)?|keep(?:s|ing)?|kept)\\s+to\\s+" + GERUNDABLE + "\\b"],
    ["enjoy", "grammar", "We enjoyed in the party.", "We enjoyed the party. (We enjoyed ourselves.)",
      "Enjoy needs an object: enjoy it, enjoy yourself, enjoy + -ing.", "\\benjoy(?:s|ed|ing)?\\s+(?:in|with)\\b"],
    ["suggest|recommend", "grammar", "He suggested me to go.", "He suggested that I go. (He suggested going.)",
      "Suggest that someone do, or suggest + -ing. Never suggest me to.", `\\b(?:suggest|recommend)(?:s|ed|ing)?\\s+${PRON}\\s+to\\b`],
    ["despite", "grammar", "Despite of the rain, we went out.", "Despite the rain, we went out.",
      "Despite — no of. (In spite of has of.)", "\\bdespite\\s+of\\b"],
    ["although|though", "grammar", "Although it was late, but we stayed.", "Although it was late, we stayed.",
      "Arabic says «رغم … لكن». English uses one of them, not both.", "\\balthough\\b[^.!?]*,\\s*but\\b"],
    ["almost", "grammar", "Almost of the students passed.", "Almost all the students passed.",
      "Almost all, almost every — never almost of.", "\\balmost\\s+of\\b"],
    ["most", "grammar", "The most of people agree.", "Most people agree.",
      "Most people, most of the people — never the most of.", "\\bthe\\s+most\\s+of\\b"],
    ["everyday|every day", "grammar", "I go to the gym everyday.", "I go to the gym every day.",
      "Every day (two words) = each day. Everyday (one word) = normal: everyday life.", "\\beveryday\\s*[.,!?]|\\beveryday\\s+(?:in|at|after|before)\\b"],
  ];

  const TRAPS = DATA.map(([keys, kind, wrong, right, why, bad]) => ({
    keys: keys.split("|"), kind, label: KIND[kind], wrong, right, why, soft: kind === "tense",
    bad: bad ? new RegExp(bad, "i") : null,
  }));

  /** The dictionary forms a typed word may hide: "depended" → depend, "worries" → worry. */
  function bases(id) {
    const out = new Set([id]);
    [[/ies$/, "y"], [/es$/, ""], [/s$/, ""], [/ied$/, "y"], [/ed$/, ""], [/d$/, ""], [/ing$/, ""], [/ing$/, "e"]]
      .forEach(([re, to]) => { if (re.test(id) && id.length > 4) out.add(id.replace(re, to)); });
    return out;
  }

  /**
   * The traps for one library word, most specific first. A phrase
   * ("look forward to") matches its key ("look forward"); a verb with a
   * particle ("listen to") matches its verb.
   */
  const PARTICLE = /^(?:to|on|in|at|for|of|up|out|about|with|from|off|down|away|back|over|into)$/;
  VS.usageTraps = function (w) {
    const id = VS.wordKey(w.word);
    const forms = bases(id);
    const parts = id.split(" ");
    const verbParticle = parts.length === 2 && PARTICLE.test(parts[1]);
    // The AI can write the one mistake this particular meaning invites. It
    // comes first: it was written for this card, not for every word like it.
    const own = VS.cleanMistake(w.mistake);
    const custom = own ? [{
      keys: [id], kind: "custom", label: "Mistake to avoid", soft: false, bad: null,
      wrong: own.wrong, right: own.right, why: own.why,
    }] : [];
    return custom.concat(TRAPS.filter((t) => t.keys.some((k) =>
      forms.has(k) ||
      (k.includes(" ") && (id === k || id.startsWith(k + " ") || bases(parts[0]).has(k.split(" ")[0]) && id.includes(" " + k.split(" ").slice(1).join(" ")))) ||
      (verbParticle && bases(parts[0]).has(k))
    ))).slice(0, 3);
  };

  /**
   * A learner's sentence that must not be shown as a model or a Recall cue:
   * kept against a warning, or one today's traps now catch (a sentence saved
   * before a trap existed is re-read every time, never trusted forever).
   */
  VS.sentenceUnsure = (w, text) => (w.unsure || []).includes(text) || VS.findUsageMistakes(text).length > 0;

  /** Every trap whose mistake appears in a piece of writing (the learner's own sentence). */
  VS.findUsageMistakes = function (text) {
    const t = " " + String(text || "").replace(/[’‘]/g, "'") + " ";
    return TRAPS.filter((trap) => trap.bad && trap.bad.test(t));
  };

  /**
   * The learner's own sentence, corrected — never the trap's canned example.
   * The trap's wrong and right sentences differ by one word swapped, added or
   * removed ("depends of" → "depends on", "discuss about" → "discuss", "listen
   * music" → "listen to music"); the same edit is made inside what the learner
   * wrote. A trap whose fix isn't that simple (tense, word order) returns ""
   * and the app shows the rule alone.
   *   VS.fixSentence(text, trap) → corrected text, or ""
   */
  const toks = (t) => String(t).replace(/\s*\(=.*?\)/, "").toLowerCase().match(/[a-z']+/g) || [];
  function oneEdit(trap) {
    const a = toks(trap.wrong), b = toks(trap.right);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    let ja = a.length - 1, jb = b.length - 1;
    while (ja >= i && jb >= i && a[ja] === b[jb]) { ja--; jb--; }
    const from = a.slice(i, ja + 1), to = b.slice(i, jb + 1);
    if (from.length > 1 || to.length > 1 || (!from.length && !to.length)) return null;
    return { from: from[0] || "", to: to[0] || "", before: a[i - 1] || "" };
  }
  /** smoke → smoking, stop → stopping, lie → lying, read → reading. */
  const DOUBLE = new Set("begin admit prefer refer occur forget regret permit commit control travel cancel".split(" "));
  const ing = (v) => DOUBLE.has(v) ? v + v.slice(-1) + "ing"                     // beginning, travelling (British)
    : /ie$/.test(v) ? v.slice(0, -2) + "ying"
    : /[^aeiou]e$/.test(v) && v !== "be" ? v.slice(0, -1) + "ing"
    : /^[^aeiou]*[aeiou][bdgmnprt]$/.test(v) && v.length <= 4 ? v + v.slice(-1) + "ing" : v + "ing";
  /** One fix inside a sentence (the first place the trap matches), or "" when the trap has no safe fix. */
  function fixOnce(t, trap) {
    const m = trap.bad.exec(t);
    if (!m) return "";
    const found = m[0];
    const keys = trap.keys.join(" ");
    let fixed = "";
    // "give up to smoke" → "give up smoking": the -ing trap is two words, not one.
    // Only when the right sentence has the -ing of the very verb after "to" ("to smoke" → "smoking"),
    // so "attended to the meeting" is never turned into "attended thing meeting".
    const toVerb = /\bto\s+([a-z]+)/i.exec(trap.wrong);
    if (toVerb && new RegExp("\\b" + ing(toVerb[1].toLowerCase()) + "\\b", "i").test(trap.right)) {
      // "look forward to meet" keeps its "to" (→ to meeting); "give up to smoke" loses it (→ smoking).
      const keepTo = new RegExp("\\bto\\s+" + ing(toVerb[1].toLowerCase()) + "\\b", "i").test(trap.right);
      fixed = found.replace(/\bto\s+([a-z]+)/i, (_, v) => (keepTo ? "to " : "") + ing(v.toLowerCase()));
    } else if (/\barrive\b/.test(keys)) {
      // Arrive at a place, arrive in a city or country: a capital after "to" is a name (Cairo), anything else is a place.
      const next = (/^\s*(\S+)/.exec(t.slice(m.index + found.length)) || [])[1] || "";
      fixed = found.replace(/\bto\b/i, /^[A-Z]/.test(next) && next !== "The" ? "in" : "at");
    } else if (/\bmarried\b/.test(keys) && !/\b(?:is|am|are|was|were|be|been|get|got|getting)\s+married\b/i.test(t)) {
      return "";                                    // "She married with her cousin" → "married her cousin": not a one-word swap
    } else {
      const e = oneEdit(trap);
      if (!e) return "";
      if (e.from && e.to) fixed = found.replace(new RegExp("\\b" + e.from + "\\b", "i"), (x) => keepCase(x, e.to));   // swap
      else if (e.from) fixed = found.replace(new RegExp("\\s*\\b" + e.from + "\\b", "i"), "");                      // remove
      else {                                                                                                         // add after the word before
        const w = /^(\s*\S+)/.exec(found);
        fixed = w ? w[1] + " " + e.to + found.slice(w[1].length) : "";
      }
    }
    if (!fixed || fixed === found) return "";
    return t.slice(0, m.index) + fixed + t.slice(m.index + found.length);
  }
  /** "Remember" → "Remind": a fix keeps the capital of the word it replaces. */
  const keepCase = (was, now) => (/^[A-Z]/.test(was) ? now.charAt(0).toUpperCase() + now.slice(1) : now);

  /* Tense, fixed in the learner's own words (critique v10: the teacher struck the
     sentence out but never said it back). Their verb goes to the past —
     "Yesterday I borrow…" → "Yesterday I borrowed…", "I am" → "I was" —
     and nothing else is touched. */
  const IRREGULAR = { go: "went", come: "came", take: "took", make: "made", have: "had", do: "did", see: "saw", eat: "ate",
    buy: "bought", get: "got", give: "gave", find: "found", leave: "left", meet: "met", tell: "told", say: "said", write: "wrote",
    drink: "drank", drive: "drove", fly: "flew", forget: "forgot", lose: "lost", pay: "paid", sell: "sold", send: "sent",
    sleep: "slept", speak: "spoke", spend: "spent", teach: "taught", wake: "woke", win: "won", begin: "began", break: "broke",
    bring: "brought", build: "built", catch: "caught", choose: "chose", keep: "kept", run: "ran", sit: "sat", stand: "stood",
    swim: "swam", wear: "wore", become: "became", fall: "fell", grow: "grew", hear: "heard", lend: "lent", steal: "stole" };
  const pastOf = (v) => IRREGULAR[v] || (v === "travel" ? "travelled"
    : /e$/.test(v) ? v + "d" : /[^aeiou]y$/.test(v) ? v.slice(0, -1) + "ied" : v + "ed");
  const BE_PAST = { "i am": "I was", "i'm": "I was", "he is": "he was", "she is": "she was", "it is": "it was",
    "we are": "we were", "you are": "you were", "they are": "they were", "we're": "we were", "you're": "you were", "they're": "they were" };
  function fixTense(t) {
    if (!new RegExp("\\b" + PAST + "\\b", "i").test(t)) return "";
    const verb = new RegExp("\\b(" + SUBJ + ")\\s+(" + DO + ")(?:s|es)?\\b", "i").exec(t);
    if (verb) {
      const v = verb[2].toLowerCase();
      return t.slice(0, verb.index) + verb[1] + " " + keepCase(verb[2], pastOf(v)) + t.slice(verb.index + verb[0].length);
    }
    const be = /\b(i\s+am|i'm|(?:he|she|it)\s+is|(?:we|you|they)\s+are|(?:we|you|they)'re)\b/i.exec(t);
    if (!be) return "";
    const now = BE_PAST[be[1].toLowerCase().replace(/\s+/g, " ")];
    return now ? t.slice(0, be.index) + keepCase(be[1], now) + t.slice(be.index + be[0].length) : "";
  }

  VS.fixSentence = function (text, trap) {
    if (!trap || !trap.bad) return "";
    if (trap.kind === "tense") {
      if (/didn't|did\b/i.test(trap.wrong)) return "";      // "didn't went": its own fix is not a past form
      const fixed = fixTense(" " + String(text || "").replace(/[’‘]/g, "'") + " ").replace(/\s+/g, " ").trim();
      return fixed && !VS.findUsageMistakes(fixed).some((x) => x.kind === "tense") ? fixed : "";
    }
    let t = " " + String(text || "").replace(/[’‘]/g, "'") + " ";
    // Every place the trap matches ("afraid of the dark and of dogs"), three at most.
    let changed = false;
    for (let i = 0; i < 3; i++) {
      const next = fixOnce(t, trap);
      if (!next) break;
      t = next;
      changed = true;
    }
    if (!changed) return "";
    const fixed = t.replace(/\s+/g, " ").trim();
    // A corrected sentence that is still wrong does more harm than the rule alone: re-check it.
    return VS.findUsageMistakes(fixed).length ? "" : fixed;
  };

  VS.usageTrapsCount = TRAPS.length;
})();
