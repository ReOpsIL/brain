// Odd One Out: a grid of identical shapes with one that differs. Five rounds.
(function (root) {
  const BS = root.BS;
  // Asymmetric shapes, so a mirror image is never the same as a turned copy. `d` is the detail that can go missing.
  const S = 'fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"';
  const SHAPES = [
    { b: `<path d="M28 12v76" ${S} stroke-width="9"/><path d="M33 15l47 15-47 16z" fill="currentColor"/>`, d: '<circle cx="62" cy="72" r="10" fill="currentColor"/>' },
    { b: '<path d="M28 12h28v46h30v28H28z" fill="currentColor"/>', d: '<circle cx="72" cy="30" r="10" fill="currentColor"/>' },
    { b: `<ellipse cx="36" cy="74" rx="17" ry="12" fill="currentColor" transform="rotate(-20 36 74)"/><path d="M50 72V14" ${S} stroke-width="8"/><path d="M50 16c16 4 28 12 26 30" ${S} stroke-width="8"/>`, d: `<path d="M50 36c12 3 20 9 20 20" ${S} stroke-width="7"/>` },
    { b: '<path d="M26 12h52v17H45v15h24v16H45v28H26z" fill="currentColor"/>', d: '<rect x="62" y="70" width="18" height="18" rx="3" fill="currentColor"/>' },
    { b: `<path d="M24 88V46a22 22 0 0 1 22-22h20" ${S} stroke-width="12"/><path d="M62 6l26 18-26 18z" fill="currentColor"/>`, d: '<circle cx="64" cy="72" r="10" fill="currentColor"/>' },
    { b: `<path d="M50 50a6 6 0 0 1 12 0a12 12 0 0 1-24 0a18 18 0 0 1 36 0a24 24 0 0 1-48 0a30 30 0 0 1 60 0" ${S} stroke-width="7"/>`, d: '<circle cx="86" cy="62" r="9" fill="currentColor"/>' },
    { b: `<circle cx="32" cy="30" r="15" ${S} stroke-width="10"/><path d="M44 42l40 42" ${S} stroke-width="10"/><path d="M64 63l11-10" ${S} stroke-width="9"/>`, d: `<path d="M76 76l10-9" ${S} stroke-width="9"/>` },
    { b: '<path d="M12 64h76l-13 22H25z" fill="currentColor"/><path d="M47 10v48H16z" fill="currentColor"/>', d: '<path d="M55 12l26 12-26 12z" fill="currentColor"/>' }
  ];
  const WHY = { rot: 'That one is turned.', mirror: 'That one is a mirror image.', size: 'That one is smaller.', tone: 'That one is lighter.', detail: 'That one is missing a piece.' };

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level);
    const n = band === 2 && f >= 0.5 ? 5 : [3, 4, 4, 5, 6][band];
    const turned = band >= 3;                       // every shape faces a random way, so only a true difference stands out
    const kinds = turned ? ['mirror', 'mirror', 'mirror', 'detail', 'size', 'tone'] : band === 0 ? ['rot', 'size', 'tone', 'detail'] : ['rot', 'mirror', 'mirror', 'size', 'tone', 'detail'];
    const shapes = rng.shuffle([...SHAPES.keys()]);
    const rounds = [];
    for (let r = 0; r < 5; r++) {
      const kind = rng.pick(kinds);
      const amt = kind === 'rot' ? rng.pick([[90, 180, 270], [90, 45, -45, 135], [30, -30, 45, -45]][band])
        : kind === 'size' ? [0.66, 0.75, 0.82, 0.86, 0.9][band]
        : kind === 'tone' ? [52, 42, 34, 30, 26][band] : 0;
      rounds.push({ n, shape: shapes[r], kind, amt, odd: rng.int(0, n * n - 1), turns: turned ? [...Array(n * n)].map(() => rng.int(0, 3)) : null });
    }
    return { rounds, allow: 2 };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h;
    let ri = 0, round, cells = [], out, busy = false, timer = 0;
    const board = h('div.od-board', { role: 'group', 'aria-label': 'Shapes' });
    rootEl.append(h('p.od-ask', null, 'Which one is different?'), board);

    function start() {
      round = p.rounds[ri]; out = new Set(); busy = false;
      const n = round.n, px = Math.min(110, Math.floor((444 - (n - 1) * 8) / n)), sh = SHAPES[round.shape];
      ctx.progress(ri + 1, p.rounds.length);
      ctx.status('Look closely, then tap the odd one out.');
      cells = [...Array(n * n).keys()].map(i => {
        const odd = i === round.odd, k = round.kind;
        const tf = [];
        if (round.turns) tf.push(`rotate(${round.turns[i] * 90}deg)`);
        if (odd && k === 'rot') tf.push(`rotate(${round.amt}deg)`);
        if (odd && k === 'mirror') tf.push('scaleX(-1)');
        if (odd && k === 'size') tf.push(`scale(${round.amt})`);
        const tone = odd && k === 'tone' ? round.amt : 14;
        return h('button.od-cell.tile', {
          type: 'button', 'aria-label': 'Shape ' + (i + 1), onclick: () => tap(i),
          html: `<svg viewBox="0 0 100 100" aria-hidden="true" style="color:hsl(170 16% ${tone}%);transform:${tf.join(' ') || 'none'}">${sh.b}${odd && k === 'detail' ? '' : sh.d}</svg>`
        });
      });
      board.style.cssText = `grid-template-columns:repeat(${n},${px}px);grid-auto-rows:${px}px`;
      board.replaceChildren(...cells);
    }
    function tap(i) {
      if (busy || out.has(i)) return;
      if (i !== round.odd) {
        out.add(i);
        cells[i].classList.add('out'); cells[i].disabled = true;
        ctx.mistake(); ctx.sfx('bad');
        ctx.status('Not that one. Look again.');
        return;
      }
      busy = true;
      cells[i].classList.add('right');
      cells.forEach((c, j) => { if (j !== i) c.classList.add('rest'); });
      ctx.sfx('good');
      ctx.status('Well spotted. ' + WHY[round.kind]);
      timer = setTimeout(() => { if (++ri < p.rounds.length) start(); else ctx.win(); }, ri + 1 < p.rounds.length ? 1700 : 700);
    }

    start();
    return {
      hint() {
        if (busy) return;
        const live = cells.map((c, i) => i).filter(i => i !== round.odd && !out.has(i));
        if (live.length < 2) { ctx.status('There are only two left to choose from.'); return; }
        for (let i = live.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [live[i], live[j]] = [live[j], live[i]]; }
        live.slice(0, Math.ceil(live.length / 2)).forEach(i => { out.add(i); cells[i].classList.add('out'); cells[i].disabled = true; });
        ctx.hintUsed(); ctx.sfx('tap');
        ctx.status('I faded half of the ordinary ones.');
      },
      destroy() { clearTimeout(timer); }
    };
  }

  BS.game({
    id: 'odd', name: 'Odd One Out', cat: 'Visual', color: '#7A55C7',
    icon: '<g fill="currentColor"><circle cx="6" cy="6" r="3.3"/><circle cx="18" cy="6" r="3.3"/><circle cx="6" cy="18" r="3.3"/></g><rect x="14.7" y="14.7" width="6.6" height="6.6" rx="1.2" fill="none" stroke="currentColor" stroke-width="2"/>',
    tagline: 'One shape is not like the others. Find it.',
    how: [
      'All the shapes are the same, except one.',
      'It may be turned, flipped like a mirror image, a little smaller, a little lighter, or missing a piece.',
      'Tap the one that is different.',
      'There are five rounds. Hint fades half of the ordinary shapes.'
    ],
    gen, mount, shapes: SHAPES.length
  });
})(typeof window !== 'undefined' ? window : globalThis);
