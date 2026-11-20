// Word Scramble: three jumbled words per level. Any real word the letters can spell is accepted.
(function (root) {
  const BS = root.BS;

  function gen(level, rng, salt) {
    const band = BS.band(level), pool = BS.words.scramble[band].split(',');
    // Numbered levels walk through the pool so a word never comes back; Today's five picks at random.
    const idx = salt ? rng.shuffle([...pool.keys()]).slice(0, 3) : [0, 1, 2].map(k => ((level - 1) % 100) * 3 + k);
    const words = idx.map(i => {
      const [answer, ...alts] = pool[i % pool.length].split('|');
      const accepted = new Set([answer, ...alts]);
      let letters, tries = 0;
      do { letters = rng.shuffle(answer.split('')).join(''); } while (accepted.has(letters) && ++tries < 60);
      return { answer, alts, letters, given: band >= 3 ? 1 : 0 };
    });
    return { words, allow: 3 };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h;
    let wi = 0, word, L, slots, used, order, locked, busy = false, timer = 0;
    const solved = h('ul.sc-solved', { 'aria-label': 'Solved words' });
    const slotRow = h('div.sc-slots', { role: 'group', 'aria-label': 'Your answer' });
    const rack = h('div.sc-rack', { role: 'group', 'aria-label': 'Letters to use' });
    rootEl.append(solved, slotRow, rack, h('div.sc-tools', null,
      h('button.btn', { type: 'button', onclick: shuffle }, 'Shuffle'),
      h('button.btn', { type: 'button', onclick: clear }, 'Clear')));

    function start() {
      word = p.words[wi]; L = word.answer.length;
      slots = new Array(L).fill(-1); used = new Array(L).fill(false); order = [...Array(L).keys()]; locked = 0;
      for (let k = 0; k < word.given; k++) lockNext();
      ctx.progress(wi + 1, p.words.length, 'Word');
      ctx.status(word.given ? 'The first letter is in place. Unscramble the rest.' : 'Tap the letters in the right order to make a word.');
      draw();
    }
    // Puts the correct letter into the next locked slot.
    function lockNext() {
      const ch = word.answer[locked];
      const t = [...Array(L).keys()].find(i => !used[i] && word.letters[i] === ch);
      slots[locked] = t; used[t] = true; locked++;
    }
    function draw() {
      const px = Math.min(54, Math.floor((444 - (L - 1) * 5) / L));
      const sz = `width:${px}px;height:${px + 6}px;font-size:${Math.round(px * 0.58)}px`;
      slotRow.replaceChildren(...slots.map((t, k) => t < 0
        ? h('span.sc-slot', { style: sz })
        : h('button.sc-tile.tile' + (k < locked ? '.locked' : ''), { type: 'button', style: sz, 'aria-label': word.letters[t].toUpperCase() + ', position ' + (k + 1) + (k < locked ? ', fixed' : ', tap to take back'), onclick: () => takeBack(k) }, word.letters[t].toUpperCase())));
      rack.replaceChildren(...order.map(t => used[t]
        ? h('span.sc-gap', { style: sz })
        : h('button.sc-tile.tile', { type: 'button', style: sz, onclick: () => put(t) }, word.letters[t].toUpperCase())));
    }
    function put(t) {
      if (busy || used[t]) return;
      const k = slots.indexOf(-1);
      if (k < 0) return;
      slots[k] = t; used[t] = true;
      ctx.sfx('clack');
      draw();
      if (!slots.includes(-1)) check();
    }
    function takeBack(k) {
      if (busy || k < locked || slots[k] < 0) return;
      used[slots[k]] = false; slots[k] = -1;
      ctx.sfx('tap');
      draw();
    }
    function clear() {
      if (busy) return;
      for (let k = locked; k < L; k++) if (slots[k] >= 0) { used[slots[k]] = false; slots[k] = -1; }
      ctx.sfx('tap');
      draw();
    }
    function shuffle() {
      if (busy) return;
      for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
      ctx.sfx('clack');
      draw();
    }
    function check() {
      const guess = slots.map(t => word.letters[t]).join('');
      if (guess !== word.answer && !word.alts.includes(guess)) {
        ctx.mistake(); ctx.sfx('bad');
        ctx.status('That is not the word. Take some letters back and try another order.');
        slotRow.classList.remove('shake'); void slotRow.offsetWidth; slotRow.classList.add('shake');
        return;
      }
      busy = true;
      ctx.sfx('good');
      slotRow.classList.add('right');
      solved.append(h('li', null, guess.toUpperCase()));
      ctx.status('Yes, ' + guess.toUpperCase() + '.');
      timer = setTimeout(() => {
        busy = false; slotRow.classList.remove('right');
        if (++wi < p.words.length) start(); else ctx.win();
      }, wi + 1 < p.words.length ? 1100 : 500);
    }

    start();
    return {
      hint() {
        if (busy) return;
        clear();
        lockNext();
        ctx.hintUsed(); ctx.sfx('good');
        ctx.status('Letter ' + locked + ' is in place.');
        draw();
        if (!slots.includes(-1)) check();
      },
      key(e) {
        if (e.metaKey || e.ctrlKey) return false;
        if (e.key === 'Backspace') {
          for (let k = L - 1; k >= locked; k--) if (slots[k] >= 0) { takeBack(k); break; }
          return true;
        }
        if (/^[a-zA-Z]$/.test(e.key)) {
          const ch = e.key.toLowerCase(), t = order.find(i => !used[i] && word.letters[i] === ch);
          if (t != null) put(t);
          return true;
        }
        return false;
      },
      destroy() { clearTimeout(timer); }
    };
  }

  BS.game({
    id: 'scramble', name: 'Word Scramble', cat: 'Words', color: '#C2416B',
    icon: '<rect x="1.5" y="8" width="6.4" height="8" rx="1.6" fill="currentColor" transform="rotate(-10 4.7 12)"/><rect x="8.8" y="6.5" width="6.4" height="8" rx="1.6" fill="currentColor"/><rect x="16.1" y="8.6" width="6.4" height="8" rx="1.6" fill="currentColor" transform="rotate(12 19.3 12.6)"/>',
    tagline: 'Unscramble the letters to spell a word.',
    how: [
      'The letter tiles spell a word, but they are out of order.',
      'Tap the tiles in the right order, or type the letters. Tap a placed letter to take it back.',
      'Shuffle mixes the tiles to give you a fresh look. Clear takes all your letters back.',
      'There are three words in each puzzle. Hint puts the next letter in place.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
