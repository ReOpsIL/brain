// Pipes ("Light every lamp"): rotate the tiles until every tile is connected to the power source.
(function (root) {
  const BS = root.BS;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];      // bit 0 up, 1 right, 2 down, 3 left
  const SIZES = [[4, 4], [4, 5], [5, 5], [5, 6], [6, 6], [6, 7]];
  const turn = (m, r) => { r = ((r % 4) + 4) % 4; return ((m << r) | (m >> (4 - r))) & 15; };

  // Which tiles the source reaches through connections both sides agree on, and whether any pipe end is left open.
  function flow(w, h, masks, src) {
    const n = w * h, lit = new Array(n).fill(false);
    const link = (i, d) => {
      const x = i % w + DX[d], y = Math.floor(i / w) + DY[d];
      if (x < 0 || y < 0 || x >= w || y >= h) return -1;
      const j = y * w + x;
      return masks[j] >> ((d + 2) % 4) & 1 ? j : -1;
    };
    let open = false;
    for (let i = 0; i < n; i++) for (let d = 0; d < 4; d++) if (masks[i] >> d & 1 && link(i, d) < 0) open = true;
    const queue = [src];
    lit[src] = true;
    while (queue.length) {
      const i = queue.pop();
      for (let d = 0; d < 4; d++) if (masks[i] >> d & 1) {
        const j = link(i, d);
        if (j >= 0 && !lit[j]) { lit[j] = true; queue.push(j); }
      }
    }
    return { lit, open, solved: !open && lit.every(Boolean) };
  }

  function gen(level, rng) {
    const t = (BS.band(level) + BS.frac(level)) / 5;
    const [w, h] = SIZES[Math.min(SIZES.length - 1, Math.floor(t * SIZES.length))];
    const n = w * h, tiles = new Array(n).fill(0), seen = new Array(n).fill(false);
    const src = rng.int(1, h - 2) * w + rng.int(1, w - 2);
    // Growing tree: mostly extend the newest cell (long runs), sometimes a random one (branches).
    const active = [src];
    seen[src] = true;
    while (active.length) {
      const k = rng.chance(0.65) ? active.length - 1 : rng.int(0, active.length - 1);
      const c = active[k], x = c % w, y = Math.floor(c / w);
      const opts = [0, 1, 2, 3].filter(d => {
        const nx = x + DX[d], ny = y + DY[d];
        return nx >= 0 && ny >= 0 && nx < w && ny < h && !seen[ny * w + nx];
      });
      if (!opts.length) { active.splice(k, 1); continue; }
      const d = rng.pick(opts), nb = (y + DY[d]) * w + x + DX[d];
      tiles[c] |= 1 << d; tiles[nb] |= 1 << ((d + 2) % 4);
      seen[nb] = true; active.push(nb);
    }
    const rot = tiles.map(() => rng.chance(0.8) ? rng.int(1, 3) : 0);
    if (flow(w, h, tiles.map((m, i) => turn(m, rot[i])), src).solved) rot[tiles.findIndex(m => turn(m, 1) !== m)] = 1;
    return { w, h, tiles, rot, src };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, w = p.w, H = p.h, n = w * H;
    const ang = p.rot.slice(), pinned = new Array(n).fill(false);
    const size = Math.min(Math.floor(440 / w), Math.floor(496 / H), 96);
    const lamps = p.tiles.map((m, i) => i !== p.src && [1, 2, 4, 8].includes(m));
    let done = false;

    const els = p.tiles.map((m, i) => {
      const arms = [0, 1, 2, 3].filter(d => m >> d & 1).map(d => `<path class="pp-pipe" d="M50 50L${50 + 50 * DX[d]} ${50 + 50 * DY[d]}"/>`).join('');
      const mid = i === p.src ? '<rect class="pp-src" x="27" y="27" width="46" height="46" rx="11"/>'
        : lamps[i] ? '<circle class="pp-lamp" cx="50" cy="50" r="22"/>' : '<circle class="pp-joint" cx="50" cy="50" r="9"/>';
      const top = i === p.src ? '<path class="pp-bolt" d="M55 31L39 53h10l-5 16 17-23H51z"/>'
        : lamps[i] ? '<path class="pp-rays" d="M50 39v-5M50 66v-5M39 50h-5M66 50h-5M42 42l-3-3M61 61l-3-3M42 58l-3 3M61 39l-3 3"/>' : '';
      const b = h('button.pp-tile', {
        type: 'button', style: `width:${size}px;height:${size}px`,
        html: `<svg class="pp-rot" viewBox="0 0 100 100" aria-hidden="true">${arms}${mid}</svg><svg class="pp-top" viewBox="0 0 100 100" aria-hidden="true">${top}</svg>`
      });
      b.addEventListener('click', e => rotate(i, e.shiftKey ? -1 : 1));
      b.addEventListener('contextmenu', e => { e.preventDefault(); rotate(i, -1); });
      return b;
    });
    rootEl.append(h('div.pp-board', { style: `grid-template-columns:repeat(${w},${size}px)` }, els));

    function update(quiet) {
      const f = flow(w, H, p.tiles.map((m, i) => turn(m, ang[i])), p.src);
      let litLamps = 0, total = 0;
      els.forEach((b, i) => {
        b.firstChild.style.transform = `rotate(${ang[i] * 90}deg)`;
        b.classList.toggle('lit', f.lit[i]);
        b.classList.toggle('pinned', pinned[i]);
        if (lamps[i]) { total++; if (f.lit[i]) litLamps++; }
        b.setAttribute('aria-label', (i === p.src ? 'Power source' : lamps[i] ? 'Lamp' : 'Pipe') + ', row ' + (Math.floor(i / w) + 1) + ', column ' + (i % w + 1) +
          (f.lit[i] ? ', connected' : ', not connected') + (pinned[i] ? ', pinned' : ''));
      });
      if (f.solved) { done = true; ctx.status('Every lamp is lit.'); ctx.win(); }
      else if (!quiet) ctx.status(litLamps + ' of ' + total + ' lamps lit' + (litLamps === total ? '. Now close the loose pipe ends.' : '.'));
    }

    function rotate(i, dir) {
      if (done) return;
      if (pinned[i]) { ctx.status('That tile is pinned in the right position.'); return; }
      ang[i] += dir;
      ctx.sfx('clack');
      update();
    }

    update(true);
    ctx.status('Tap a tile to turn it. Connect every lamp to the power source.');
    return {
      hint() {
        if (done) return;
        const sx = p.src % w, sy = Math.floor(p.src / w);
        const wrong = [...Array(n).keys()].filter(i => !pinned[i] && turn(p.tiles[i], ang[i]) !== p.tiles[i])
          .sort((a, b) => Math.abs(a % w - sx) + Math.abs(Math.floor(a / w) - sy) - Math.abs(b % w - sx) - Math.abs(Math.floor(b / w) - sy));
        if (!wrong.length) return;
        const i = wrong[0];
        ang[i] += (4 - ((ang[i] % 4) + 4) % 4) % 4;
        pinned[i] = true;
        ctx.hintUsed(); ctx.sfx('good');
        update();
        if (!done) ctx.status('Pinned one tile in the right position.');
      }
    };
  }

  BS.game({
    id: 'pipes', name: 'Pipes', cat: 'Logic', color: '#2F6FD0',
    icon: '<path d="M3 7h6a3 3 0 0 1 3 3v4a3 3 0 0 0 3 3h6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><circle cx="18.5" cy="7" r="3" fill="currentColor"/>',
    tagline: 'Turn the pipes until every lamp is lit.',
    how: [
      'Tap a tile to turn it a quarter turn. Right-click (or Shift-click) turns it the other way.',
      'Pipes connected to the power source turn blue, and lamps on them light up.',
      'You win when every tile is connected and no pipe end is left open.',
      'Hint turns one tile to the right position and pins it there.'
    ],
    gen, mount, flow, turn
  });
})(typeof window !== 'undefined' ? window : globalThis);
