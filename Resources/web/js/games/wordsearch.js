// Word Search: themed words hidden in a letter grid. Drag across a word, or tap its first and last letter.
(function (root) {
  const BS = root.BS;
  const FILL = 'EEEEAAAIIIOOOTTNNSSRRLLDDUUCMHGPBFYWKV';
  const ALL = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];
  // Words we don't want the random filler letters to spell by accident.
  const BAD = 'ASS SEX FUCK SHIT DAMN HELL CUNT COCK DICK PISS TIT FAG NAZI RAPE SLUT ARSE CRAP KKK CUM POO PEE ANUS DIE DEAD KILL HATE'.split(' ');
  const INKS = ['#C2416B', '#2F6FD0', '#F0A92B', '#2FA37A', '#7A55C7', '#D9772B'];

  function gen(level, rng, salt) {
    const band = BS.band(level), size = 8 + band;
    const count = BS.lerp(5, 12, (level - 1) / (BS.LEVELS - 1));
    const dirs = band === 0 ? ALL.slice(0, 2) : band === 1 ? ALL.slice(0, 4) : ALL;
    const themes = BS.words.themes;
    const [theme, list] = themes[salt ? rng.int(0, themes.length - 1) : (level - 1) % themes.length].split(':');
    const pool = rng.shuffle(list.split(' ').filter(w => w.length <= size));
    const order = pool.slice(0, count).sort((a, b) => b.length - a.length).concat(pool.slice(count));

    const grid = new Array(size * size).fill(''), words = [], at = [];
    for (const word of order) {
      if (words.length >= count) break;
      for (let tries = 0; tries < 200; tries++) {
        const [dr, dc] = rng.pick(dirs), L = word.length;
        const r = rng.int(dr < 0 ? L - 1 : 0, dr > 0 ? size - L : size - 1);
        const c = rng.int(dc < 0 ? L - 1 : 0, dc > 0 ? size - L : size - 1);
        let ok = true;
        for (let k = 0; k < L && ok; k++) { const g = grid[(r + dr * k) * size + c + dc * k]; ok = !g || g === word[k]; }
        if (!ok) continue;
        for (let k = 0; k < L; k++) grid[(r + dr * k) * size + c + dc * k] = word[k];
        words.push(word); at.push([r, c, dr, dc]);
        break;
      }
    }

    const filler = grid.map(g => !g);
    for (let i = 0; i < grid.length; i++) if (filler[i]) grid[i] = rng.pick(FILL);
    // Re-roll filler letters that happen to spell something unwelcome, in any direction.
    const lines = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) for (const [dr, dc] of ALL.slice(0, 4)) {
      const pr = r - dr, pc = c - dc;
      if (pr >= 0 && pr < size && pc >= 0 && pc < size) continue;      // not the start of a line
      const line = [];
      for (let y = r, x = c; y >= 0 && y < size && x >= 0 && x < size; y += dr, x += dc) line.push(y * size + x);
      if (line.length > 2) lines.push(line);
    }
    for (let pass = 0, changed = true; changed && pass < 40; pass++) {
      changed = false;
      for (const line of lines) {
        const s = line.map(i => grid[i]).join('');
        for (const b of BAD) for (const w of [b, b.split('').reverse().join('')]) {
          for (let k = s.indexOf(w); k >= 0; k = s.indexOf(w, k + 1)) {
            const cell = line.slice(k, k + w.length).find(i => filler[i]);
            if (cell != null) { grid[cell] = rng.pick(FILL); changed = true; }
          }
        }
      }
    }
    return { size, theme, words, at, grid: grid.join('') };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, S = p.size, cellPx = Math.floor(432 / S);
    const found = p.words.map(() => false);
    let anchor = -1, cur = -1, dragging = false, kb = -1, done = false, pulseT = 0;

    const cells = p.grid.split('').map(ch => h('span.ws-cell', null, ch));
    const marks = h('div.ws-marks', { html: `<svg viewBox="0 0 ${S * 10} ${S * 10}" aria-hidden="true"><g class="ws-done"></g><line class="ws-live" stroke-width="7.2" stroke-linecap="round" visibility="hidden"/></svg>` });
    const gDone = marks.querySelector('.ws-done'), live = marks.querySelector('.ws-live');
    const grid = h('div.ws-grid', {
      style: `grid-template-columns:repeat(${S},${cellPx}px);grid-auto-rows:${cellPx}px;font-size:${Math.max(19, Math.round(cellPx * 0.5))}px`,
      role: 'group', 'aria-label': 'Letter grid. Use the arrow keys and Enter to mark the first and last letter of a word.'
    }, marks, cells);
    const chips = p.words.map(w => h('li.ws-word', null, w));
    rootEl.append(
      h('p.ws-theme', null, p.theme),
      grid,
      h('ul.ws-words' + (p.words.length > 8 ? '.small' : ''), { 'aria-label': 'Words to find' }, chips));

    const rc = i => [Math.floor(i / S), i % S];
    const setLine = (el, a, b) => {
      const [ar, ac] = rc(a), [br, bc] = rc(b);
      el.setAttribute('x1', ac * 10 + 5); el.setAttribute('y1', ar * 10 + 5);
      el.setAttribute('x2', bc * 10 + 5); el.setAttribute('y2', br * 10 + 5);
    };
    const cellAt = e => {
      const r = grid.getBoundingClientRect();
      const c = Math.max(0, Math.min(S - 1, Math.floor((e.clientX - r.left) / r.width * S)));
      const y = Math.max(0, Math.min(S - 1, Math.floor((e.clientY - r.top) / r.height * S)));
      return y * S + c;
    };
    // Nearest cell to b that lies on a straight or diagonal line from a.
    const snap = (a, b) => {
      const [ar, ac] = rc(a), [br, bc] = rc(b), dr = br - ar, dc = bc - ac;
      if (!dr && !dc) return a;
      const ang = Math.round(Math.atan2(dr, dc) / (Math.PI / 4));
      const sr = Math.round(Math.sin(ang * Math.PI / 4)), sc = Math.round(Math.cos(ang * Math.PI / 4));
      let len = Math.max(Math.abs(dr), Math.abs(dc));
      while (len > 0 && (ar + sr * len < 0 || ar + sr * len >= S || ac + sc * len < 0 || ac + sc * len >= S)) len--;
      return (ar + sr * len) * S + ac + sc * len;
    };
    const showLive = () => {
      if (anchor < 0) { live.setAttribute('visibility', 'hidden'); return; }
      setLine(live, anchor, cur < 0 ? anchor : cur);
      live.setAttribute('visibility', 'visible');
    };
    const drawCursor = () => cells.forEach((c, i) => c.classList.toggle('cur', i === kb));

    function tryWord(a, b) {
      const [ar, ac] = rc(a), [br, bc] = rc(b);
      const len = Math.max(Math.abs(br - ar), Math.abs(bc - ac)), sr = Math.sign(br - ar), sc = Math.sign(bc - ac);
      let s = '';
      for (let k = 0; k <= len; k++) s += p.grid[(ar + sr * k) * S + ac + sc * k];
      const rev = s.split('').reverse().join('');
      const wi = p.words.findIndex((w, i) => !found[i] && (w === s || w === rev));
      anchor = cur = -1; showLive();
      if (wi < 0) { ctx.sfx('tap'); ctx.status('No word there. Try again.'); return; }
      found[wi] = true;
      const ink = INKS[wi % INKS.length];
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('stroke', ink); line.setAttribute('stroke-width', '7.2'); line.setAttribute('stroke-linecap', 'round');
      setLine(line, a, b);
      gDone.append(line);
      chips[wi].classList.add('found');
      chips[wi].style.setProperty('--ink', ink);
      const left = found.filter(f => !f).length;
      ctx.sfx('good');
      if (!left) { done = true; ctx.status('You found them all.'); ctx.win(); }
      else ctx.status('Found ' + p.words[wi] + '. ' + left + ' to go.');
    }

    // First tap sets the first letter; a drag or a second tap finishes the word.
    function begin(i) {
      if (anchor >= 0 && !dragging && i !== anchor) return tryWord(anchor, snap(anchor, i));
      anchor = i; cur = i; showLive();
    }
    grid.addEventListener('pointerdown', e => {
      if (done || e.button) return;
      e.preventDefault();
      const i = cellAt(e), had = anchor >= 0 && i !== anchor;
      begin(i);
      if (!had) { dragging = true; try { grid.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ } }
    });
    grid.addEventListener('pointermove', e => {
      if (!dragging) return;
      cur = snap(anchor, cellAt(e)); showLive();
    });
    const up = () => {
      if (!dragging) return;
      dragging = false;
      if (cur !== anchor && cur >= 0) tryWord(anchor, cur);
      else ctx.status('Now tap the last letter of the word.');
    };
    grid.addEventListener('pointerup', up);
    grid.addEventListener('pointercancel', () => { dragging = false; anchor = cur = -1; showLive(); });

    ctx.status('Drag across a word, or tap its first and last letter.');
    return {
      hint() {
        if (done) return;
        const wi = found.indexOf(false), [r, c] = p.at[wi], el = cells[r * S + c];
        cells.forEach(x => x.classList.remove('pulse'));
        void el.offsetWidth;
        el.classList.add('pulse');
        clearTimeout(pulseT);
        pulseT = setTimeout(() => el.classList.remove('pulse'), 4200);
        ctx.hintUsed(); ctx.sfx('tap');
        ctx.status(p.words[wi] + ' starts at the glowing letter.');
      },
      key(e) {
        if (done || e.metaKey || e.ctrlKey) return false;
        const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
        if (mv) {
          const [r, c] = kb < 0 ? [0, 0] : rc(kb);
          kb = kb < 0 ? 0 : Math.max(0, Math.min(S - 1, r + mv[0])) * S + Math.max(0, Math.min(S - 1, c + mv[1]));
          if (anchor >= 0) { cur = snap(anchor, kb); showLive(); }
          drawCursor();
          return true;
        }
        if ((e.key === 'Enter' || e.key === ' ') && kb >= 0) {
          if (anchor >= 0 && kb !== anchor) tryWord(anchor, snap(anchor, kb));
          else { anchor = cur = kb; showLive(); ctx.status('Now move to the last letter and press Enter.'); }
          return true;
        }
        return false;
      },
      destroy() { clearTimeout(pulseT); }
    };
  }

  BS.game({
    id: 'wordsearch', name: 'Word Search', cat: 'Words', color: '#C2416B',
    icon: '<circle cx="10" cy="10" r="6.2" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M15 15l6 6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
    tagline: 'Find the hidden words in the grid of letters.',
    how: [
      'The words listed under the grid are hidden among the letters.',
      'Drag from the first letter of a word to its last. Or tap the first letter, then the last.',
      'Early puzzles only run across and down. Later ones add diagonals, and then backwards words.',
      'Hint makes the first letter of a word glow.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
