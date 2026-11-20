#!/usr/bin/env node
// Regenerates Resources/web/js/words.js from the SCOWL word lists.
// Usage: npm install wordlist-english && node tools/build_words.js
const fs = require('fs');
const path = require('path');
const wl = require('wordlist-english');

const tier = k => (wl['english/american/' + k] || []).concat(wl['english/' + k] || []).filter(w => /^[a-z]+$/.test(w));
const T10 = tier(10), T20 = tier(20), T35 = tier(35), T40 = tier(40), T50 = tier(50), T55 = tier(55), T60 = tier(60);
const common = new Set([...T10, ...T20]);
const known = new Set([...T10, ...T20, ...T35, ...T40, ...T50]);

// Words we never want as an answer.
const BLOCK = new Set(`abuse abused abort arse ass asses bastard bitch bloody boob boobs booze breast breasts bugger butt
cancer chink cock coke corpse crap crack cum damn dead death devil dick die died dies drug drugs drunk dummy dying
erect fag fags fart fat fatal fatso gay gays god gun guns hell hooker homo idiot jerk kill killed killer kills knife
lesbian lust moron murder naked nazi nazis nigger nude orgy pee penis piss poop porn prick pussy queer rape raped rapist
rectum retard sex sexes sexy shit slave slaves slut sperm stab strip suck sucks suicide terror tit tits toilet torture
turd urine vagina victim virgin vomit war wars weed whore wound wounds anus anal bomb bombs semen negro sexual sexism racist
racism hate hated hates hatred pimp whores bitches damned crappy pissed screw screwed tumor ulcer feces crotch groin puke
gore gory slay slain kinky fetish horny dildo condom incest molest stripper heroin cocaine opium meth junkie syphilis
herpes rabies plague leper casket coffin grave hearse morgue tomb funeral widow widower hanged noose bleed blood
abortion genocide massacre slaughter terrorist hostage execute executed assault assaults bullet bullets rifle pistol
weapon weapons`.split(/\s+/));

// Drop simple inflections when the stem is also a common word (keeps the answers feeling like "real" words).
const inflected = w =>
  (w.endsWith('s') && !w.endsWith('ss') && (known.has(w.slice(0, -1)) || (w.endsWith('es') && known.has(w.slice(0, -2))) || (w.endsWith('ies') && known.has(w.slice(0, -3) + 'y')))) ||
  (w.endsWith('ed') && (known.has(w.slice(0, -2)) || known.has(w.slice(0, -1)) || known.has(w.slice(0, -3)) || known.has(w.slice(0, -3) + 'y'))) ||
  (w.endsWith('ing') && (known.has(w.slice(0, -3)) || known.has(w.slice(0, -3) + 'e') || known.has(w.slice(0, -4)))) ||
  (w.endsWith('er') && w.length > 5 && (known.has(w.slice(0, -2)) || known.has(w.slice(0, -1)))) ||
  (w.endsWith('ly') && w.length > 5 && known.has(w.slice(0, -2)));

// Deterministic shuffle so rebuilding gives the same puzzles.
function rng(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shuffle(arr, seed) { const r = rng(seed), a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const uniq = a => [...new Set(a)];
const good = w => !BLOCK.has(w) && !inflected(w) && new Set(w).size > 2;

// ---- Word Guess: 5-letter answers (most common first) and the list of accepted guesses.
const a10 = shuffle(uniq(T10.filter(w => w.length === 5 && good(w))).sort(), 11);
const a20 = shuffle(uniq(T20.filter(w => w.length === 5 && good(w) && !T10.includes(w))).sort(), 12);
const answers5 = uniq([...a10, ...a20]).slice(0, 600);
const valid5 = uniq([...T10, ...T20, ...T35, ...T40, ...T50, ...T55, ...T60].filter(w => w.length === 5)).sort();

// ---- Word Scramble: five difficulty pools of 300 words with any other real words the same letters can spell.
const key = w => w.split('').sort().join('');
const byKey = new Map();
for (const w of known) { const k = key(w); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(w); }
const lens = [[4, 5], [5, 6], [6, 7], [7, 8], [8, 9]];
const used = new Set();
const scramble = lens.map(([lo, hi], b) => {
  const pool = shuffle(uniq([...T10, ...T20].filter(w => w.length >= lo && w.length <= hi && good(w) && !used.has(w))).sort(), 100 + b);
  // Prefer the most common tier, and keep the two lengths balanced.
  const pick = [];
  for (const len of [lo, hi]) {
    const c = pool.filter(w => w.length === len);
    c.sort((x, y) => (T10.includes(y) ? 1 : 0) - (T10.includes(x) ? 1 : 0));
    pick.push(...c.slice(0, 150));
  }
  pick.forEach(w => used.add(w));
  return shuffle(pick, 200 + b).map(w => {
    const alts = byKey.get(key(w)).filter(x => x !== w && !BLOCK.has(x));
    return alts.length ? w + '|' + alts.join('|') : w;
  });
});

// ---- Word Search themes.
const themes = {
  'In the garden': 'ROSE TULIP DAISY LILAC FERN IVY HEDGE LAWN SPADE RAKE SEEDS BLOOM PETAL SOIL TROWEL ORCHID POPPY VIOLET',
  'In the kitchen': 'SPOON FORK KNIFE PLATE BOWL OVEN KETTLE WHISK LADLE GRATER APRON TOASTER SKILLET TEAPOT MUG PANTRY SIEVE',
  'Birds': 'ROBIN SPARROW EAGLE OWL HERON FINCH SWAN CRANE WREN DOVE HAWK PELICAN PUFFIN STORK LARK MAGPIE FALCON',
  'Fruit bowl': 'APPLE PEAR PLUM PEACH CHERRY GRAPE LEMON LIME MANGO MELON BANANA ORANGE APRICOT FIG KIWI BERRY PAPAYA',
  'Music': 'PIANO VIOLIN CELLO FLUTE HARP DRUM TRUMPET GUITAR BANJO OBOE CHOIR TEMPO MELODY CHORD WALTZ OPERA SONATA',
  'Weather': 'RAIN SNOW SLEET HAIL FROST BREEZE STORM CLOUD SUNNY MIST FOG THUNDER RAINBOW DRIZZLE GUST HUMID SHOWER',
  'Travel': 'TRAIN PLANE FERRY HOTEL TICKET MAP PASSPORT LUGGAGE CRUISE BEACH MUSEUM TOUR GUIDE VOYAGE HARBOR STATION AIRPORT',
  'Animals': 'LION TIGER ZEBRA GIRAFFE PANDA OTTER MOOSE CAMEL KOALA BADGER RABBIT TURTLE DOLPHIN WALRUS FOX DEER BEAVER',
  'Colors': 'RED BLUE GREEN YELLOW PURPLE ORANGE VIOLET INDIGO SCARLET CRIMSON AMBER IVORY TEAL MAROON OLIVE CORAL SILVER',
  'Baking day': 'FLOUR SUGAR BUTTER YEAST DOUGH CRUST SCONE MUFFIN COOKIE TART PASTRY ICING VANILLA CINNAMON BATTER LOAF BISCUIT',
  'By the sea': 'WAVE TIDE SHELL CORAL CRAB WHALE SHARK SEAL ANCHOR SAIL REEF KELP PEARL LAGOON SQUID LOBSTER OYSTER',
  'The body': 'HEART LUNG BRAIN ELBOW KNEE ANKLE WRIST SPINE THUMB SHOULDER FINGER MUSCLE RIB SKIN JAW PALM HIP',
  'Around the house': 'SOFA LAMP TABLE CHAIR SHELF RUG CURTAIN PILLOW BLANKET MIRROR CLOCK DRAWER CABINET CARPET WINDOW STAIRS ATTIC',
  'Trees': 'OAK MAPLE BIRCH PINE CEDAR WILLOW ELM ASPEN BEECH SPRUCE WALNUT CHERRY PALM CYPRESS HAZEL POPLAR LARCH',
  'Sports': 'TENNIS GOLF BOWLING ROWING SKIING HOCKEY SOCCER CRICKET CYCLING SAILING FENCING ARCHERY BOXING RUGBY CROQUET YOGA DARTS',
  'Night sky': 'MOON STAR PLANET COMET ORBIT GALAXY ROCKET SATURN MARS VENUS NEBULA ECLIPSE METEOR SOLAR COSMOS JUPITER EARTH',
  'Wardrobe': 'SHIRT SCARF GLOVES JACKET SWEATER BOOTS SOCKS HAT COAT DRESS SKIRT BELT TIE VEST SANDALS CARDIGAN PAJAMAS',
  'Vegetable patch': 'CARROT ONION POTATO TOMATO PEPPER CELERY LETTUCE SPINACH RADISH TURNIP GARLIC LEEK BEET PEAS CABBAGE PARSNIP SQUASH',
  'Game night': 'CHESS BRIDGE POKER DOMINO PUZZLE DICE CARDS RUMMY BINGO CHECKERS DARTS RIDDLE TRIVIA QUIZ MAHJONG CANASTA SOLITAIRE',
  'Toolbox': 'HAMMER WRENCH PLIERS DRILL SAW CHISEL LEVEL LADDER NAIL SCREW BOLT CLAMP SANDER RULER SHOVEL AXE FILE',
  'Something to drink': 'TEA COFFEE COCOA JUICE WATER MILK CIDER LEMONADE SODA SHAKE SMOOTHIE LATTE MOCHA TONIC PUNCH NECTAR ESPRESSO',
  'Family': 'MOTHER FATHER SISTER BROTHER AUNT UNCLE COUSIN NIECE NEPHEW GRANDMA GRANDPA DAUGHTER SON TWIN SPOUSE PARENT FAMILY',
  'Countryside': 'FARM BARN MEADOW FIELD ORCHARD STREAM VALLEY HILL FENCE TRACTOR HARVEST PASTURE COTTAGE WINDMILL POND STABLE LANE',
  'Books': 'NOVEL POEM STORY CHAPTER AUTHOR LIBRARY PAGE COVER PLOT HERO FABLE MEMOIR MYSTERY SHELF ESSAY PROSE SEQUEL',
  'Breakfast': 'TOAST EGGS BACON CEREAL PANCAKE WAFFLE HONEY JAM OATMEAL YOGURT BAGEL SYRUP MUFFIN GRANOLA OMELET SAUSAGE JUICE',
  'Jewels': 'RUBY PEARL OPAL TOPAZ GARNET JADE AMBER DIAMOND EMERALD SAPPHIRE ONYX QUARTZ CRYSTAL GOLD SILVER AGATE CORAL',
  'Dancing': 'WALTZ TANGO SALSA RUMBA POLKA BALLET SWING FOXTROT SAMBA DISCO JIVE TWIST MAMBO BOLERO QUICKSTEP REEL JIG',
  'In the city': 'STREET BRIDGE PARK MARKET CAFE TOWER SQUARE SUBWAY TAXI THEATER BAKERY PLAZA AVENUE FOUNTAIN STATUE LIBRARY HARBOR',
  'Time': 'MINUTE HOUR SECOND MORNING EVENING NIGHT WEEK MONTH YEAR DECADE CENTURY SEASON AUTUMN WINTER SPRING SUMMER DAWN',
  'Hobbies': 'KNITTING PAINTING FISHING READING BAKING SEWING HIKING SINGING DANCING POTTERY QUILTING BIRDING CHESS GOLF CAMPING DRAWING WRITING',
};
const themeList = Object.entries(themes).map(([name, s]) => {
  const words = uniq(s.split(' '));
  for (const w of words) if (!/^[A-Z]{3,9}$/.test(w)) throw new Error('bad theme word ' + w);
  return { name, words };
});

const out = `// Generated by tools/build_words.js. Word lists derived from SCOWL (http://wordlist.aspell.net).
(function (root) {
  root.BS = root.BS || {};
  root.BS.words = {
    answers5: ${JSON.stringify(answers5.join(''))},
    valid5: ${JSON.stringify(valid5.join(''))},
    scramble: ${JSON.stringify(scramble.map(p => p.join(',')))},
    themes: ${JSON.stringify(themeList.map(t => t.name + ':' + t.words.join(' ')))}
  };
})(typeof window !== 'undefined' ? window : globalThis);
`;
const dest = process.argv[2] || path.join(__dirname, '..', 'Resources', 'web', 'js', 'words.js');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, out);
console.log('answers5', answers5.length, 'valid5', valid5.length, 'scramble', scramble.map(p => p.length).join('/'), 'themes', themeList.length, 'bytes', out.length);
console.log('sample answers:', answers5.slice(0, 25).join(' '), '...', answers5.slice(-10).join(' '));
scramble.forEach((p, i) => console.log('band', i, p.slice(0, 12).join(' ')));
