/* assets/data/overrides.js — meanings checked by hand (VS.overrides reads it).
   The words Arab learners add most, where free dictionaries get the Arabic
   wrong ("persuade" = اقتنع, "commute" = خفف العقوبة) or lead with a rare
   sense ("challenge" … a duel). Each entry is the meaning a learner most
   likely met, in plain English, with short Arabic and a short example.
   A word with several everyday meanings lists them all; `keys` are words a
   sentence uses with that meaning, so "The plane will take off" picks
   "leave the ground" (core/autofill.js).

   Add a word: "word": { type, arabic, definition, example }  or
                "word": { senses: [{ type, arabic, definition, example, keys }, …] }
   Definitions and examples are written for this app (no dictionary text).
   tools/check.py checks every entry has word, type, arabic, definition, example. */
window.VS_OVERRIDES = {
  "achieve": { type: "Verb", arabic: "يحقق", definition: "To succeed in doing something you worked hard for.", example: "She achieved her goal of running five kilometres." },
  "actually": { type: "Adverb", arabic: "في الحقيقة - فعلًا", definition: "Used to say what is really true, often when it is surprising.", example: "He looks young, but he's actually forty." },
  "afford": { type: "Verb", arabic: "يقدر يتحمّل (تكلفة) - يقدر يدفع", definition: "To have enough money or time for something.", example: "We can't afford a new car this year." },
  "agenda": { type: "Noun", arabic: "جدول أعمال (اجتماع)", definition: "The list of topics to discuss at a meeting.", example: "The budget is the first item on the agenda." },
  "anxious": { type: "Adjective", arabic: "قلقان - متوتر", definition: "Worried and nervous about something.", example: "I always feel anxious before an exam." },
  "apply": { senses: [
    { type: "Verb", arabic: "يقدّم (على وظيفة/منحة)", definition: "To ask formally for a job, a place or a visa, usually in writing.", example: "I applied for three jobs last week.", keys: "job jobs university visa position scholarship course" },
    { type: "Verb", arabic: "يطبّق", definition: "To use a rule, an idea or a method in a situation.", example: "You can apply this rule to every verb.", keys: "rule rules method idea law theory" } ] },
  "appointment": { type: "Noun", arabic: "ميعاد (عند دكتور/مكتب)", definition: "A fixed time to meet someone, like a doctor.", example: "I have a dentist appointment at four." },
  "appreciate": { type: "Verb", arabic: "يقدّر - يشكر على", definition: "To be thankful for something, or to understand its value.", example: "I really appreciate your help." },
  "argue": { type: "Verb", arabic: "يتخانق (بالكلام) - يجادل", definition: "To speak angrily to someone because you disagree.", example: "My brothers argue about football all the time." },
  "attend": { type: "Verb", arabic: "يحضر", definition: "To go to an event, a class or a meeting.", example: "Over a hundred people attended the wedding." },
  "available": { type: "Adjective", arabic: "متاح - فاضي", definition: "Free to use, buy or talk to.", example: "Is the manager available this afternoon?" },
  "avoid": { type: "Verb", arabic: "يتجنّب", definition: "To stay away from something or not do it.", example: "Try to avoid driving in the rush hour." },
  "aware": { type: "Adjective", arabic: "واعي بـ - عارف", definition: "Knowing that something exists or is happening.", example: "Are you aware of the new rules?" },
  "borrow": { type: "Verb", arabic: "يستلف - يستعير", definition: "To take something from someone and give it back later.", example: "Can I borrow your pen for a minute?" },
  "bother": { type: "Verb", arabic: "يضايق - يزعج", definition: "To annoy or worry someone.", example: "Does the noise bother you?" },
  "break down": { senses: [
    { type: "Phrasal Verb", arabic: "يعطل (عربية/جهاز)", definition: "When a car or a machine stops working.", example: "Our car broke down on the way to Alexandria.", keys: "car machine bus engine computer phone road" },
    { type: "Phrasal Verb", arabic: "ينهار (من العياط)", definition: "To start crying because you are very upset.", example: "She broke down when she heard the news.", keys: "cried crying cry news upset tears" } ] },
  "brief": { type: "Adjective", arabic: "قصير - مختصر", definition: "Lasting a short time, or using few words.", example: "He gave a brief answer and left." },
  "career": { type: "Noun", arabic: "مسيرة مهنية - شغلانة", definition: "The jobs you do during your working life.", example: "She started her career as a teacher." },
  "challenge": { senses: [
    { type: "Noun", arabic: "تحدّي", definition: "Something difficult that tests your skill or strength.", example: "Learning a new language is a real challenge.", keys: "" },
    { type: "Verb", arabic: "يتحدّى", definition: "To say you don't accept something, or to invite someone to compete.", example: "He challenged me to a game of chess.", keys: "challenged decision rule" } ] },
  "colleague": { type: "Noun", arabic: "زميل (في الشغل)", definition: "A person you work with.", example: "My colleagues took me out for lunch." },
  "commute": { type: "Verb", arabic: "يروح ويجي (من البيت للشغل)", definition: "To travel regularly between home and work or school.", example: "I commute to Cairo by train every day." },
  "complain": { type: "Verb", arabic: "يشتكي", definition: "To say that you are unhappy about something.", example: "Customers complained about the long wait." },
  "concern": { type: "Noun", arabic: "قلق - اهتمام", definition: "A feeling of worry about something important.", example: "Safety is our main concern." },
  "confident": { type: "Adjective", arabic: "واثق (من نفسه)", definition: "Sure about yourself or that something will happen.", example: "I feel more confident speaking English now." },
  "convince": { type: "Verb", arabic: "يقنع", definition: "To make someone believe that something is true.", example: "She convinced me that the plan would work." },
  "deadline": { type: "Noun", arabic: "آخر ميعاد (للتسليم)", definition: "The time or date by which you must finish something.", example: "The deadline for the report is Thursday." },
  "deal with": { type: "Phrasal Verb", arabic: "يتعامل مع - يحل", definition: "To take action to solve a problem or handle a situation.", example: "Who is dealing with this complaint?" },
  "decision": { type: "Noun", arabic: "قرار", definition: "A choice you make after thinking.", example: "It was a hard decision, but I made it." },
  "depend": { type: "Verb", arabic: "يعتمد على", definition: "To change according to something else, or to need someone's help.", example: "It depends on the weather." },
  "deserve": { type: "Verb", arabic: "يستاهل - يستحق", definition: "To have earned something because of what you did.", example: "You worked hard. You deserve a break." },
  "disappointed": { type: "Adjective", arabic: "محبط - خاب أمله", definition: "Sad because something was not as good as you hoped.", example: "I was disappointed with my exam result." },
  "embarrassed": { type: "Adjective", arabic: "محرج - مكسوف", definition: "Feeling shy or silly in front of other people.", example: "I was embarrassed when I forgot his name." },
  "encourage": { type: "Verb", arabic: "يشجّع", definition: "To give someone confidence or support to do something.", example: "My teacher encouraged me to read more." },
  "essential": { type: "Adjective", arabic: "أساسي - ضروري", definition: "Completely necessary; you can't do without it.", example: "Water is essential for life." },
  "eventually": { type: "Adverb", arabic: "في الآخر - في النهاية", definition: "After a long time or after many problems.", example: "We eventually found the hotel." },
  "expect": { type: "Verb", arabic: "يتوقّع", definition: "To think that something will happen.", example: "I expect the meeting to finish at five." },
  "experience": { type: "Noun", arabic: "خبرة - تجربة", definition: "Knowledge you get from doing something, or something that happened to you.", example: "Do you have any experience in sales?" },
  "fee": { type: "Noun", arabic: "رسوم - أتعاب", definition: "Money you pay for a service, like a course or a doctor.", example: "The course fee is 500 pounds." },
  "figure out": { type: "Phrasal Verb", arabic: "يفهم - يلاقي حل", definition: "To understand something or find the answer after thinking.", example: "I can't figure out how this machine works." },
  "fine": { senses: [
    { type: "Adjective", arabic: "كويس - تمام", definition: "Good, healthy or acceptable.", example: "I'm fine, thanks. And you?", keys: "i'm im thanks thank ok okay everything feel feeling" },
    { type: "Noun", arabic: "غرامة", definition: "Money you must pay because you broke a rule.", example: "He got a fine for parking there.", keys: "parking police speeding pay paid rule law ticket" },
    { type: "Adjective", arabic: "رفيع - ناعم", definition: "Very thin or made of very small pieces.", example: "She has fine, straight hair.", keys: "hair sand thin line powder" } ] },
  "get along": { type: "Phrasal Verb", arabic: "يتفاهم مع - علاقته كويسة بـ", definition: "To have a friendly relationship with someone.", example: "I get along well with my neighbours." },
  "give up": { senses: [
    { type: "Phrasal Verb", arabic: "يبطّل (عادة)", definition: "To stop doing or having something, often a habit.", example: "My father gave up smoking last year.", keys: "smoking sugar coffee habit eating drinking" },
    { type: "Phrasal Verb", arabic: "يستسلم - ييأس", definition: "To stop trying because something is too difficult.", example: "Don't give up — you're almost there!", keys: "don't never try trying hard difficult" } ] },
  "handle": { senses: [
    { type: "Verb", arabic: "يتعامل مع - يتحكم في", definition: "To deal with a problem, a person or a situation.", example: "She handles difficult customers very well.", keys: "problem customers situation stress pressure deal" },
    { type: "Noun", arabic: "إيد (الباب/الشنطة) - مقبض", definition: "The part of a door, bag or cup that you hold.", example: "The door handle is broken.", keys: "door bag cup broken hold" } ] },
  "hire": { type: "Verb", arabic: "يوظّف - يأجّر", definition: "To give someone a job, or to pay to use something for a short time.", example: "The company hired ten new engineers." },
  "improve": { type: "Verb", arabic: "يحسّن - يتحسّن", definition: "To make something better, or to become better.", example: "My English has improved a lot this year." },
  "interview": { type: "Noun", arabic: "مقابلة (شغل)", definition: "A meeting where someone asks you questions, for example for a job.", example: "I have a job interview tomorrow morning." },
  "involve": { type: "Verb", arabic: "يتضمّن - يشمل", definition: "To include something as a necessary part.", example: "The job involves a lot of travel." },
  "issue": { type: "Noun", arabic: "مشكلة - قضية", definition: "An important problem or subject people talk about.", example: "Pollution is a serious issue in big cities." },
  "lend": { type: "Verb", arabic: "يسلّف - يعير", definition: "To give something to someone for a short time.", example: "Can you lend me 50 pounds until Friday?" },
  "look after": { type: "Phrasal Verb", arabic: "يعتني بـ - ياخد باله من", definition: "To take care of someone or something.", example: "My mother looks after my kids when I'm at work." },
  "look forward to": { type: "Phrasal Verb", arabic: "مستني بفارغ الصبر", definition: "To feel happy about something that is going to happen.", example: "I'm looking forward to seeing you." },
  "manage": { senses: [
    { type: "Verb", arabic: "قدر يعمل - نجح في", definition: "To succeed in doing something difficult.", example: "I managed to finish the report on time.", keys: "finish finally somehow time succeed" },
    { type: "Verb", arabic: "يدير", definition: "To be in charge of a business, a team or people.", example: "She manages a team of twenty people.", keys: "team company business shop people staff project" } ] },
  "notice": { senses: [
    { type: "Verb", arabic: "يلاحظ", definition: "To see or become aware of something.", example: "Did you notice his new haircut?", keys: "didn't did noticed see" },
    { type: "Noun", arabic: "إعلان - إخطار", definition: "A written message that gives information, or a warning that something will happen.", example: "There's a notice on the door.", keys: "door board wall short give gave weeks" } ] },
  "offer": { type: "Verb", arabic: "يعرض", definition: "To ask someone if they want something, or to say you will do something.", example: "He offered me a cup of tea." },
  "opportunity": { type: "Noun", arabic: "فرصة", definition: "A chance to do something good.", example: "This job is a great opportunity for me." },
  "persuade": { type: "Verb", arabic: "يقنع", definition: "To make someone agree to do something by giving reasons.", example: "I persuaded my friend to come with us." },
  "point out": { type: "Phrasal Verb", arabic: "يلفت النظر لـ - يوضّح", definition: "To tell someone a fact or show them something.", example: "She pointed out a mistake in my email." },
  "postpone": { type: "Verb", arabic: "يأجّل", definition: "To move an event to a later time.", example: "They postponed the match because of the rain." },
  "prefer": { type: "Verb", arabic: "يفضّل", definition: "To like one thing more than another.", example: "I prefer tea to coffee." },
  "pretend": { type: "Verb", arabic: "يتظاهر - يعمل نفسه", definition: "To act as if something is true when it is not.", example: "He pretended to be asleep." },
  "put off": { type: "Phrasal Verb", arabic: "يأجّل", definition: "To decide to do something later.", example: "Stop putting off your homework!" },
  "raise": { type: "Verb", arabic: "يرفع - يربّي", definition: "To lift something up or increase it; also to bring up children.", example: "Raise your hand if you have a question." },
  "realize": { type: "Verb", arabic: "يدرك - ياخد باله", definition: "To suddenly understand or know something.", example: "I didn't realize it was so late." },
  "receive": { type: "Verb", arabic: "يستلم - يتلقّى", definition: "To get something that someone gives or sends you.", example: "Did you receive my message?" },
  "recognize": { type: "Verb", arabic: "يتعرّف على - يعرف", definition: "To know someone or something because you have seen them before.", example: "I didn't recognize you with glasses!" },
  "refuse": { type: "Verb", arabic: "يرفض", definition: "To say you will not do or accept something.", example: "She refused to answer the question." },
  "relieved": { type: "Adjective", arabic: "مرتاح (بعد قلق)", definition: "Happy because something bad did not happen or is over.", example: "I was so relieved when I passed the test." },
  "remind": { type: "Verb", arabic: "يفكّر حد بـ - يذكّر", definition: "To help someone remember something.", example: "Remind me to call my mother tonight." },
  "rent": { senses: [
    { type: "Verb", arabic: "يأجّر - يستأجر", definition: "To pay money to live in or use something that belongs to someone else.", example: "We rent a small flat near the university.", keys: "flat apartment car house" },
    { type: "Noun", arabic: "إيجار", definition: "The money you pay every month to live in a place.", example: "The rent is due on the first of the month.", keys: "pay paid month monthly due high" } ] },
  "require": { type: "Verb", arabic: "يتطلّب - يحتاج", definition: "To need something, or to make it necessary.", example: "This job requires good English." },
  "resilient": { type: "Adjective", arabic: "صامد - مرن", definition: "Able to recover quickly from difficulties.", example: "Children are often more resilient than we expect." },
  "run out of": { type: "Phrasal Verb", arabic: "يخلص (عنده) - ينفد", definition: "To have none of something left.", example: "We've run out of milk." },
  "salary": { type: "Noun", arabic: "مرتب", definition: "Money you get every month for your job.", example: "He got a higher salary at his new job." },
  "schedule": { type: "Noun", arabic: "جدول - مواعيد", definition: "A plan of when things will happen.", example: "My schedule is very busy this week." },
  "sensible": { type: "Adjective", arabic: "عاقل - منطقي", definition: "Doing what is reasonable and right.", example: "Saving some money is a sensible idea." },
  "sensitive": { type: "Adjective", arabic: "حسّاس", definition: "Easily upset, or easily affected by something.", example: "She is very sensitive about her weight." },
  "set up": { type: "Phrasal Verb", arabic: "يأسّس - يجهّز", definition: "To start a business or an organization, or to prepare equipment.", example: "They set up their own company in 2020." },
  "struggle": { type: "Verb", arabic: "يعاني - يبذل مجهود كبير", definition: "To try very hard to do something difficult.", example: "I struggled to understand the lecture." },
  "suggest": { type: "Verb", arabic: "يقترح", definition: "To give an idea for someone to think about.", example: "I suggest that we leave early." },
  "support": { type: "Verb", arabic: "يدعم - يساند", definition: "To help or encourage someone.", example: "My family always supports me." },
  "suppose": { senses: [
    { type: "Verb", arabic: "يفترض - يتوقّع", definition: "To think that something is probably true.", example: "I suppose you're right.", keys: "right guess probably" },
    { type: "Phrase", arabic: "المفروض", definition: "(be supposed to) What should happen, because of a rule or a plan.", example: "You're supposed to wear a seat belt.", keys: "supposed you're were was are is" } ] },
  "sympathetic": { type: "Adjective", arabic: "متعاطف", definition: "Showing that you understand someone's problems.", example: "My boss was very sympathetic when I was ill." },
  "take care of": { type: "Phrasal Verb", arabic: "ياخد باله من - يعتني بـ", definition: "To look after someone or something.", example: "Who takes care of your dog when you travel?" },
  "take off": { senses: [
    { type: "Phrasal Verb", arabic: "تقلع (الطيارة)", definition: "When a plane leaves the ground and starts flying.", example: "Our plane took off an hour late.", keys: "plane flight airport airplane aircraft runway" },
    { type: "Phrasal Verb", arabic: "يقلع - يخلع (هدوم/جزمة)", definition: "To remove clothes or shoes.", example: "Please take off your shoes.", keys: "shoes coat jacket clothes hat shirt glasses" },
    { type: "Phrasal Verb", arabic: "ينجح فجأة", definition: "To suddenly become successful or popular.", example: "Her business really took off last year.", keys: "business career sales song idea" } ] },
  "take place": { type: "Phrasal Verb", arabic: "يحصل - يتم", definition: "To happen, usually at a planned time.", example: "The meeting will take place on Monday." },
  "tend": { type: "Verb", arabic: "يميل لـ - عادةً", definition: "To usually do something or be likely to happen.", example: "I tend to wake up early." },
  "turn down": { senses: [
    { type: "Phrasal Verb", arabic: "يرفض (عرض)", definition: "To say no to an offer or a request.", example: "He turned down the job in Dubai.", keys: "offer job invitation request" },
    { type: "Phrasal Verb", arabic: "يوطّي - يقلّل (الصوت/التكييف)", definition: "To make the sound, heat or light lower.", example: "Please turn down the music.", keys: "music volume tv radio heat sound" } ] },
  "used to": { senses: [
    { type: "Phrase", arabic: "كان بيعمل زمان", definition: "Something you did often in the past but don't do now.", example: "I used to play football every day.", keys: "child kid young ago years before anymore" },
    { type: "Phrase", arabic: "متعود على", definition: "(be/get used to) Something is normal for you now, so it isn't strange or hard.", example: "I'm used to waking up early.", keys: "i'm im am is are get got getting being" } ] },
  "worth": { type: "Adjective", arabic: "يستاهل - قيمته", definition: "Having a value; good enough to spend time or money on.", example: "The film is worth watching." },
  "apparently": { type: "Adverb", arabic: "على ما يبدو - بيقولوا إن", definition: "Used to say what you have heard or what seems true.", example: "Apparently, the shop is closed on Fridays." },
  "argument": { type: "Noun", arabic: "خناقة (بالكلام) - حجة", definition: "An angry talk between people who disagree; also a reason you give.", example: "They had an argument about money." },
  "book": { senses: [
    { type: "Verb", arabic: "يحجز", definition: "To arrange a hotel room, a ticket or a table before you go.", example: "I booked a table for two.", keys: "ticket hotel table flight room seat appointment" },
    { type: "Noun", arabic: "كتاب", definition: "Pages with writing that you read.", example: "I'm reading a good book.", keys: "read reading page pages author" } ] },
  "charge": { senses: [
    { type: "Verb", arabic: "يشحن (موبايل/بطارية)", definition: "To put electricity into a phone or a battery.", example: "I need to charge my phone.", keys: "phone battery laptop charger" },
    { type: "Verb", arabic: "ياخد فلوس - يحاسب", definition: "To ask for money for something.", example: "They charged us 50 pounds for delivery.", keys: "pounds money price delivery fee pay" } ] },
  "come up with": { type: "Phrasal Verb", arabic: "يطلع بـ (فكرة) - يفكر في", definition: "To think of an idea or a plan.", example: "She came up with a great idea." },
  "convenient": { type: "Adjective", arabic: "مناسب - مريح (وقت أو مكان)", definition: "Easy for you, or at a good time or place for you.", example: "Is Monday convenient for you?" },
  "end up": { type: "Phrasal Verb", arabic: "ينتهي بيه الأمر إنه - في الآخر", definition: "To be in a place or situation in the end, often without planning it.", example: "We ended up eating at home." },
  "experiment": { type: "Noun", arabic: "تجربة (علمية)", definition: "A test you do to learn something, especially in science.", example: "We did an experiment in the lab." },
  "fabric": { type: "Noun", arabic: "قماش", definition: "Material for making clothes or curtains.", example: "This fabric is soft and light." },
  "find out": { type: "Phrasal Verb", arabic: "يعرف - يكتشف", definition: "To learn a fact or some information.", example: "I found out the truth yesterday." },
  "fit": { type: "Verb", arabic: "مقاسه مظبوط - يدخل في", definition: "To be the right size for someone or for a space.", example: "These shoes don't fit me." },
  "get rid of": { type: "Phrasal Verb", arabic: "يتخلّص من", definition: "To throw away or remove something you don't want.", example: "I got rid of my old clothes." },
  "hardly": { type: "Adverb", arabic: "بالعافية - يا دوب", definition: "Almost not; only a very small amount.", example: "I can hardly hear you." },
  "kind": { senses: [
    { type: "Adjective", arabic: "لطيف - طيب", definition: "Friendly and caring to other people.", example: "It was kind of you to help me.", keys: "nice helpful thank thanks" },
    { type: "Noun", arabic: "نوع", definition: "A type of person or thing.", example: "What kind of music do you like?", keys: "what music food type sort" } ] },
  "lately": { type: "Adverb", arabic: "مؤخرًا - الأيام دي", definition: "Recently; in the last few days or weeks.", example: "I've been very tired lately." },
  "make sure": { type: "Phrase", arabic: "يتأكد", definition: "To check that something is true or will happen.", example: "Make sure you lock the door." },
  "mean": { senses: [
    { type: "Verb", arabic: "يقصد - يعني", definition: "To have a meaning, or to want to say something.", example: "What do you mean?", keys: "what word does do say" },
    { type: "Adjective", arabic: "بخيل - قاسي", definition: "Not kind; or not willing to spend money.", example: "Don't be mean to your sister.", keys: "don't sister brother unkind rude" } ] },
  "miss": { senses: [
    { type: "Verb", arabic: "وحشني - يفتقد", definition: "To feel sad because someone or something is not with you.", example: "I miss my family.", keys: "family mother friends home" },
    { type: "Verb", arabic: "يفوّت (أتوبيس/قطر/فرصة)", definition: "To be too late for something, or not catch it.", example: "I missed the bus this morning.", keys: "bus train flight class chance lesson" } ] },
  "nervous": { type: "Adjective", arabic: "متوتر - قلقان", definition: "Worried and a little afraid about something.", example: "I'm nervous about the interview." },
  "pick up": { senses: [
    { type: "Phrasal Verb", arabic: "يجيب (حد) - يعدّي ياخد", definition: "To go and get someone in a car.", example: "Can you pick me up at six?", keys: "school airport station car" },
    { type: "Phrasal Verb", arabic: "يرفع - يشيل (من على الأرض)", definition: "To lift something up with your hand.", example: "Pick up your toys, please.", keys: "toys floor phone hand" } ] },
  "save": { senses: [
    { type: "Verb", arabic: "يحوّش - يوفّر", definition: "To keep money so you can use it later.", example: "I'm saving money for a car.", keys: "money pounds car buy" },
    { type: "Verb", arabic: "ينقذ", definition: "To keep someone safe from danger.", example: "The doctor saved his life.", keys: "life lives doctor danger" },
    { type: "Verb", arabic: "يحفظ (ملف)", definition: "To keep a file on a computer or phone.", example: "Don't forget to save the file.", keys: "file document computer work" } ] },
  "stand": { type: "Verb", arabic: "مش طايق (can't stand)", definition: "(can't stand) To hate something or someone.", example: "I can't stand waiting in queues." },
  "suit": { senses: [
    { type: "Noun", arabic: "بدلة", definition: "A jacket and trousers made of the same cloth.", example: "He wore a black suit.", keys: "wore wear black tie jacket" },
    { type: "Verb", arabic: "يليق على - يناسب", definition: "To look good on someone, or to be right for them.", example: "That colour suits you.", keys: "colour color looks time" } ] },
  "turn out": { type: "Phrasal Verb", arabic: "يطلع (في الآخر)", definition: "To happen in a way you didn't expect, or to be found to be.", example: "The test turned out to be easy." },
  "worried": { type: "Adjective", arabic: "قلقان", definition: "Unhappy because you think something bad may happen.", example: "My mother gets worried when I'm late." },
};

/* The same entry under another spelling or form: British "realise", or a phrasal verb
   typed in the past ("gave up"). core/autofill.js looks here first. */
window.VS_OVERRIDE_ALIASES = {
  "realise": "realize", "recognise": "recognize",
  "gave up": "give up", "giving up": "give up", "given up": "give up",
  "took off": "take off", "taking off": "take off", "taken off": "take off",
  "broke down": "break down", "broken down": "break down", "turned down": "turn down",
  "looking forward to": "look forward to", "look forward": "look forward to",
  "got along": "get along", "get along with": "get along", "take care": "take care of",
  "found out": "find out", "came up with": "come up with", "ended up": "end up", "turned out": "turn out",
  "got rid of": "get rid of", "picked up": "pick up", "ran out of": "run out of", "set up": "set up",
  "be used to": "used to", "get used to": "used to", "supposed to": "suppose", "be supposed to": "suppose",
};
