// Brain Spark engine: seeded randomness, the puzzle registry and small helpers.
// No DOM access at load time, so the generators can be tested under Node (tools/test_puzzles.js).
(function (root) {
  const BS = root.BS = root.BS || {};
  BS.games = {};
  BS.order = [];
  BS.LEVELS = 500;
  BS.BANDS = ['Gentle', 'Easy', 'Medium', 'Tricky', 'Expert'];
  BS.game = g => { BS.games[g.id] = g; BS.order.push(g.id); };

  BS.hash = s => {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
    h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^ h >>> 16) >>> 0;
  };

  // mulberry32 with a few conveniences hung off the function.
  BS.rng = seed => {
    let a = seed >>> 0;
    const f = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    f.int = (lo, hi) => lo + Math.floor(f() * (hi - lo + 1));
    f.pick = arr => arr[Math.floor(f() * arr.length)];
    f.shuffle = arr => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(f() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    f.chance = p => f() < p;
    return f;
  };

  // Levels 1-500 fall into five bands of 100; frac is the position inside the band (0..1).
  BS.band = L => Math.max(0, Math.min(4, Math.floor((L - 1) / 100)));
  BS.frac = L => ((L - 1) % 100) / 99;
  BS.lerp = (a, b, t) => Math.round(a + (b - a) * t);

  // A numbered level is always the same puzzle; `salt` (used by Today's five) gives a different one at the same difficulty.
  BS.puzzle = (id, level, salt) => BS.games[id].gen(level, BS.rng(BS.hash(id + ':' + (salt || level))), salt);

  // Tiny hyperscript: h('button.tile.big', {onclick: fn, 'aria-label': 'x'}, 'text', child)
  BS.h = (sel, props, ...kids) => {
    const [tag, ...cls] = sel.split('.');
    const e = document.createElement(tag || 'div');
    if (cls.length) e.className = cls.join(' ');
    if (props) for (const k in props) {
      const v = props[k];
      if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'style') e.style.cssText = v;
      else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
    return e;
  };
  BS.svg = (inner, vb, cls) => `<svg viewBox="${vb || '0 0 100 100'}" class="${cls || ''}" aria-hidden="true">${inner}</svg>`;
  BS.wait = ms => new Promise(r => setTimeout(r, ms));
})(typeof window !== 'undefined' ? window : globalThis);
