// Sliding Tiles: slide the numbered tiles back into order.
(function (root) {
  const BS = root.BS;
  const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];      // the gap moves up, right, down, left
  const solved = t => t.every((v, i) => v === (i + 1) % t.length);

  // Moves the gap one step in direction d. Returns false if that would leave the board.
  function step(t, n, d) {
    const b = t.indexOf(0), r = Math.floor(b / n) + DR[d], c = b % n + DC[d];
    if (r < 0 || c < 0 || r >= n || c >= n) return false;
    t[b] = t[r * n + c]; t[r * n + c] = 0;
    return true;
  }

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level), n = band < 2 ? 3 : 4;
    const steps = BS.lerp([8, 20, 20, 40, 70][band], [20, 40, 40, 70, 120][band], f);
    const tiles = [...Array(n * n).keys()].map(i => (i + 1) % (n * n));
    // A random walk from the solved board, so it can always be solved. `path` is the way back.
    const path = [];
    while (path.length < steps || solved(tiles)) {
      const last = path.length ? path[path.length - 1] : -1;
      const d = rng.int(0, 3);
      if (d === (last + 2) % 4 && last >= 0) continue;
      if (step(tiles, n, d)) path.push(d);
    }
    return { n, tiles, path };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, n = p.n, t = p.tiles.slice(), path = p.path.slice();
    const px = n === 3 ? 136 : 102, gap = 6;
    let moves = 0, done = false;
    const els = {};
    const board = h('div.sl-board', { style: `width:${n * px + (n + 1) * gap}px;height:${n * px + (n + 1) * gap}px`, role: 'group', 'aria-label': 'Sliding tiles' });
    for (let v = 1; v < n * n; v++) {
      els[v] = h('button.sl-tile.tile', { type: 'button', style: `width:${px}px;height:${px}px;font-size:${n === 3 ? 56 : 44}px`, onclick: () => clickTile(v) }, v);
      board.append(els[v]);
    }
    rootEl.append(board);

    function draw() {
      t.forEach((v, i) => {
        if (!v) return;
        const r = Math.floor(i / n), c = i % n;
        els[v].style.transform = `translate(${gap + c * (px + gap)}px,${gap + r * (px + gap)}px)`;
        els[v].classList.toggle('home', v === i + 1);
        els[v].setAttribute('aria-label', 'Tile ' + v + ', row ' + (r + 1) + ', column ' + (c + 1));
      });
    }
    // One gap move. Undoing the latest move shortens the way back; anything else lengthens it.
    function move(d) {
      if (!step(t, n, d)) return false;
      if (path.length && path[path.length - 1] === (d + 2) % 4) path.pop(); else path.push(d);
      moves++;
      return true;
    }
    function after() {
      ctx.sfx('clack');
      draw();
      if (solved(t)) { done = true; ctx.status('In order, in ' + moves + ' moves.'); ctx.win(); }
      else ctx.status(moves + (moves === 1 ? ' move' : ' moves'));
    }
    function clickTile(v) {
      if (done) return;
      const i = t.indexOf(v), b = t.indexOf(0), r = Math.floor(i / n), c = i % n, br = Math.floor(b / n), bc = b % n;
      if (r !== br && c !== bc) { ctx.status('Only tiles in line with the gap can slide.'); return; }
      const d = r === br ? (c > bc ? 1 : 3) : (r > br ? 2 : 0);
      for (let k = Math.abs(r - br) + Math.abs(c - bc); k > 0; k--) move(d);
      after();
    }

    draw();
    ctx.status('Tap a tile next to the gap to slide it. Put the numbers in order.');
    return {
      hint() {
        if (done || !path.length) return;
        move((path[path.length - 1] + 2) % 4);
        ctx.hintUsed();
        after();
      },
      key(e) {
        // The arrow says which way a tile moves, so the gap goes the opposite way.
        const d = { ArrowUp: 2, ArrowRight: 3, ArrowDown: 0, ArrowLeft: 1 }[e.key];
        if (d == null || done || e.metaKey || e.ctrlKey) return false;
        if (move(d)) after();
        return true;
      }
    };
  }

  BS.game({
    id: 'slide', name: 'Sliding Tiles', cat: 'Visual', color: '#7A55C7',
    icon: '<g fill="currentColor"><rect x="3" y="3" width="8" height="8" rx="1.8"/><rect x="13" y="3" width="8" height="8" rx="1.8"/><rect x="3" y="13" width="8" height="8" rx="1.8"/></g><rect x="13.8" y="13.8" width="6.4" height="6.4" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="2 1.6"/>',
    tagline: 'Slide the tiles until the numbers are in order.',
    how: [
      'One space on the board is empty. Tap a tile beside the gap to slide it in.',
      'Tapping a tile further along the same row or column slides several at once.',
      'Put the numbers in order, reading left to right and top to bottom, with the gap last.',
      'Hint makes one move in the right direction for you.'
    ],
    gen, mount, solved, step
  });
})(typeof window !== 'undefined' ? window : globalThis);
