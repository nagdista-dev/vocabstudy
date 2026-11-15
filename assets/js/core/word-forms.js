/* core/word-forms.js — the other shapes a word can take in a sentence.
   ------------------------------------------------------------------
   Used to find a word inside its example sentence (the highlight on
   cards, "Fill the gap", recall with a gap). tools/check.py reads this
   same file, so the app and the checker always agree.

   IRREGULAR   base → past, participle        bring → brought
   STAND_INS   a placeholder in an idiom and   your → my, his, their…
               what can stand in for it.       * = any one or two words
                                               (someone → "my cousin")
   Add a line to either list; one entry per line, words separated by spaces.
   ------------------------------------------------------------------ */
(function () {
  "use strict";
  const parse = (block) => block.trim().split("\n").reduce((map, line) => {
    const [base, ...forms] = line.trim().split(/\s+/);
    map[base] = forms;
    return map;
  }, {});

  VS.IRREGULAR = parse(`
arise arose arisen
be was been
bear bore born
beat beat beaten
become became become
begin began begun
bend bent bent
bet bet bet
bind bound bound
bite bit bitten
bleed bled bled
blow blew blown
break broke broken
breed bred bred
bring brought brought
build built built
burn burnt burnt
burst burst burst
buy bought bought
catch caught caught
choose chose chosen
cling clung clung
come came come
cost cost cost
creep crept crept
cut cut cut
deal dealt dealt
dig dug dug
do did done
draw drew drawn
dream dreamt dreamt
drink drank drunk
drive drove driven
eat ate eaten
fall fell fallen
feed fed fed
feel felt felt
fight fought fought
find found found
flee fled fled
fly flew flown
forbid forbade forbidden
forget forgot forgotten
forgive forgave forgiven
freeze froze frozen
get got gotten
give gave given
go went gone
grind ground ground
grow grew grown
hang hung hung
have had had
hear heard heard
hide hid hidden
hit hit hit
hold held held
hurt hurt hurt
keep kept kept
kneel knelt knelt
know knew known
lay laid laid
lead led led
lean leant leant
leap leapt leapt
learn learnt learnt
leave left left
lend lent lent
let let let
lie lay lain
light lit lit
lose lost lost
make made made
mean meant meant
meet met met
pay paid paid
put put put
quit quit quit
read read read
ride rode ridden
ring rang rung
rise rose risen
run ran run
say said said
see saw seen
seek sought sought
sell sold sold
send sent sent
set set set
shake shook shaken
shine shone shone
shoot shot shot
show showed shown
shrink shrank shrunk
shut shut shut
sing sang sung
sink sank sunk
sit sat sat
sleep slept slept
slide slid slid
speak spoke spoken
speed sped sped
spend spent spent
spin spun spun
split split split
spread spread spread
spring sprang sprung
stand stood stood
steal stole stolen
stick stuck stuck
sting stung stung
stink stank stunk
strike struck struck
swear swore sworn
sweep swept swept
swim swam swum
swing swung swung
take took taken
teach taught taught
tear tore torn
tell told told
think thought thought
throw threw thrown
tread trod trodden
understand understood understood
upset upset upset
wake woke woken
wear wore worn
weep wept wept
win won won
wind wound wound
withdraw withdrew withdrawn
write wrote written
`);

  VS.STAND_INS = parse(`
your my his her our their its
yours mine his hers ours theirs
yourself myself himself herself ourselves themselves itself
one's my your his her our their
oneself myself yourself himself herself ourselves themselves
someone *
somebody *
something *
sth *
sb *
`);
})();
