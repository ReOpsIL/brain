// Pattern Recall: some squares light up, then you tap them back from memory. Three rounds.
(function (root) {
  const BS = root.BS;

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level);
    const n = [3, 4, 4, 5, 6][band];
    const k = BS.lerp([3, 4, 6, 8, 10][band], [4, 6, 8, 10, 13][band], f);
    const rounds = [0, 1, 2].map(r => {
      const size = Math.min(k + (r === 2 ? 1 : 0), 13, Math.floor(n * n / 2));
      return rng.shuffle([...Array(n * n).keys()]).slice(0, size).sort((a, b) => a - b);
    });
    return { n, rounds, show: 1200 + 260 * k, allow: 2 };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, n = p.n;
    let round = 0, phase = 'ready', target = new Set(), hit = new Set(), miss = new Set(), timer = 0;
    const px = Math.min(96, Math.floor((424 - (n - 1) * 8) / n));
    const cells = [...Array(n * n).keys()].map(i => h('button.rc-cell.tile', { type: 'button', onclick: () => tap(i) }));
    const ready = h('button.btn.primary.rc-ready', { type: 'button', onclick: show }, 'Ready');
    rootEl.append(
      h('div.rc-board', { style: `grid-template-columns:repeat(${n},${px}px);grid-auto-rows:${px}px` }, cells),
      h('div.rc-foot', null, ready));

    function draw() {
      cells.forEach((c, i) => {
        const lit = phase === 'show' && target.has(i);
        c.className = 'rc-cell tile' + (lit ? ' lit' : '') + (hit.has(i) ? ' hit' : '') + (miss.has(i) ? ' miss' : '');
        c.disabled = phase !== 'input' || hit.has(i) || miss.has(i);
        c.setAttribute('aria-label', 'Square ' + (i + 1) + (lit ? ', lit' : hit.has(i) ? ', correct' : miss.has(i) ? ', wrong' : ''));
      });
      ready.style.visibility = phase === 'ready' ? 'visible' : 'hidden';
    }
    function prepare() {
      phase = 'ready'; target = new Set(p.rounds[round]); hit = new Set(); miss = new Set();
      ready.textContent = round ? 'Ready for round ' + (round + 1) : 'Ready';
      ctx.progress(round + 1, p.rounds.length);
      if (!round) ctx.status(target.size + ' squares will light up. Press Ready when you are.');
      draw();
    }
    function show() {
      if (phase !== 'ready' && phase !== 'input') return;
      const again = phase === 'input';
      phase = 'show';
      ctx.sfx('tap');
      ctx.status('Remember these ' + target.size + ' squares…');
      draw();
      clearTimeout(timer);
      timer = setTimeout(() => {
        phase = 'input';
        ctx.status(again && hit.size ? 'Found ' + hit.size + ' of ' + target.size + '.' : 'Now tap the ' + target.size + ' squares that lit up.');
        draw();
      }, again ? Math.round(p.show * 0.7) : p.show);
    }
    function tap(i) {
      if (phase !== 'input') return;
      if (!target.has(i)) {
        miss.add(i);
        ctx.mistake(); ctx.sfx('bad');
        ctx.status('Not that one. Keep going.');
        return draw();
      }
      hit.add(i);
      ctx.sfx('good');
      if (hit.size < target.size) { ctx.status('Found ' + hit.size + ' of ' + target.size + '.'); return draw(); }
      phase = 'done';
      draw();
      if (round + 1 === p.rounds.length) { ctx.status('That is the whole pattern.'); return ctx.win(); }
      ctx.status('That is the whole pattern. Well remembered.');
      timer = setTimeout(() => { round++; prepare(); ready.focus(); }, 1000);
    }

    prepare();
    return {
      hint() {
        if (phase !== 'input') { if (phase === 'ready') ctx.status('Press Ready to see the pattern first.'); return; }
        ctx.hintUsed();
        show();
      },
      destroy() { clearTimeout(timer); }
    };
  }

  BS.game({
    id: 'recall', name: 'Pattern Recall', cat: 'Memory', color: '#F0A92B',
    icon: '<g fill="currentColor"><rect x="3" y="3" width="5" height="5" rx="1.2"/><rect x="16" y="3" width="5" height="5" rx="1.2"/><rect x="9.5" y="9.5" width="5" height="5" rx="1.2"/><rect x="3" y="16" width="5" height="5" rx="1.2"/></g><g fill="none" stroke="currentColor" stroke-width="1.6"><rect x="9.8" y="3.3" width="4.4" height="4.4" rx="1"/><rect x="3.3" y="9.8" width="4.4" height="4.4" rx="1"/><rect x="16.3" y="9.8" width="4.4" height="4.4" rx="1"/><rect x="9.8" y="16.3" width="4.4" height="4.4" rx="1"/><rect x="16.3" y="16.3" width="4.4" height="4.4" rx="1"/></g>',
    tagline: 'Watch the pattern, then tap it back from memory.',
    how: [
      'Press Ready. Some of the squares light up for a few seconds.',
      'When they go dark again, tap the same squares. The order does not matter.',
      'There are three rounds, and nothing starts until you press Ready.',
      'Hint shows you the pattern again.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
