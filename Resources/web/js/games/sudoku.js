// Sudoku: 6×6 in the first band, 9×9 after that. Every puzzle has exactly one solution.
(function (root) {
  const BS = root.BS;

  // Returns solve(g, limit, rng): counts the solutions of g up to `limit` (g is modified).
  // With an rng the search order is random and g is left holding the first solution found.
  function makeSolver(N, bw, bh) {
    const full = (1 << N) - 1, per = N / bw;
    const box = i => Math.floor(Math.floor(i / N) / bh) * per + Math.floor((i % N) / bw);
    const bits = m => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
    return function solve(g, limit, rng) {
      const rows = new Array(N).fill(0), cols = new Array(N).fill(0), boxes = new Array(N).fill(0);
      for (let i = 0; i < N * N; i++) if (g[i]) {
        const b = 1 << (g[i] - 1), r = Math.floor(i / N), c = i % N;
        if ((rows[r] | cols[c] | boxes[box(i)]) & b) return 0;
        rows[r] |= b; cols[c] |= b; boxes[box(i)] |= b;
      }
      let count = 0;
      const rec = () => {
        // Most-constrained cell first.
        let best = -1, bm = 0, bn = 99;
        for (let i = 0; i < N * N; i++) if (!g[i]) {
          const m = full & ~(rows[Math.floor(i / N)] | cols[i % N] | boxes[box(i)]), n = bits(m);
          if (n < bn) { best = i; bm = m; bn = n; if (n < 2) break; }
        }
        if (best < 0) return ++count >= limit;
        if (!bn) return false;
        let ds = [];
        for (let d = 0; d < N; d++) if (bm >> d & 1) ds.push(d);
        if (rng) ds = rng.shuffle(ds);
        const r = Math.floor(best / N), c = best % N, bx = box(best);
        for (const d of ds) {
          const b = 1 << d;
          g[best] = d + 1; rows[r] |= b; cols[c] |= b; boxes[bx] |= b;
          if (rec()) return true;
          g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b;
        }
        return false;
      };
      rec();
      return count;
    };
  }

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level);
    const small = band === 0, N = small ? 6 : 9, bw = 3, bh = small ? 2 : 3;
    const clues = small ? BS.lerp(26, 18, f) : BS.lerp(44, 27, (band - 1 + f) / 4);
    const solve = makeSolver(N, bw, bh);
    const solution = new Array(N * N).fill(0);
    solve(solution, 1, rng);
    // Dig cells out one at a time, keeping only removals that leave a single solution.
    const given = solution.slice();
    let left = N * N;
    for (const i of rng.shuffle([...Array(N * N).keys()])) {
      if (left <= clues) break;
      const keep = given[i];
      given[i] = 0;
      if (solve(given.slice(), 2) === 1) left--; else given[i] = keep;
    }
    return { n: N, bw, bh, given, solution, allow: 3 };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, N = p.n, NN = N * N, per = N / p.bw;
    const val = p.given.slice(), notes = new Array(NN).fill(0), locked = p.given.map(Boolean);
    const hinted = new Set();
    let undo = [], sel = val.indexOf(0), noteMode = false, done = false, checked = false;
    const row = i => Math.floor(i / N), col = i => i % N;
    const box = i => Math.floor(row(i) / p.bh) * per + Math.floor(col(i) / p.bw);
    const peer = (a, b) => a !== b && (row(a) === row(b) || col(a) === col(b) || box(a) === box(b));

    const base = i => 'sd-cell' + (col(i) % p.bw === 0 && col(i) ? ' bl' : '') + (row(i) % p.bh === 0 && row(i) ? ' bt' : '');
    const cells = [...Array(NN).keys()].map(i => h('button', { type: 'button', onclick: () => { sel = i; ctx.sfx('tap'); draw(); } }));
    const digits = [...Array(N).keys()].map(d => h('button.sd-digit.tile', { type: 'button', onclick: () => place(d + 1) }, h('b', null, d + 1), h('small')));
    const noteBtn = h('button.btn.sd-tool', { type: 'button', onclick: () => { noteMode = !noteMode; draw(); } }, 'Notes');
    rootEl.append(
      h('div.sd-board.sd-' + N, { role: 'group', 'aria-label': 'Sudoku grid' }, cells),
      h('div.sd-tools', null,
        h('button.btn.sd-tool', { type: 'button', onclick: undoLast }, 'Undo'),
        h('button.btn.sd-tool', { type: 'button', onclick: () => place(0) }, 'Erase'),
        noteBtn),
      h('div.sd-pad.sd-pad' + N, null, digits));

    const snap = () => { undo.push([val.slice(), notes.slice()]); if (undo.length > 200) undo.shift(); };
    const clearPeerNotes = (i, d) => { for (let j = 0; j < NN; j++) if (peer(i, j)) notes[j] &= ~(1 << d); };

    function undoLast() {
      if (done) return;
      const s = undo.pop();
      if (!s) { ctx.status('Nothing to undo.'); return; }
      s[0].forEach((v, i) => { val[i] = v; });
      s[1].forEach((v, i) => { notes[i] = v; });
      checked = false;
      ctx.sfx('tap');
      draw();
    }

    function place(d) {
      if (done || sel < 0) return;
      if (locked[sel]) { ctx.status('That square is already filled in for you.'); return; }
      if (noteMode && d) {
        if (val[sel]) { ctx.status('Erase the digit first if you want to write notes here.'); return; }
        snap(); notes[sel] ^= 1 << d; ctx.sfx('tap');
        return draw();
      }
      if (!d && !val[sel] && !notes[sel]) return;
      snap();
      checked = false;
      if (!d || val[sel] === d) {
        val[sel] = 0;
        if (!d) notes[sel] = 0;
        ctx.sfx('tap');
      } else {
        val[sel] = d; notes[sel] = 0;
        if (d !== p.solution[sel] && ctx.settings.sudokuMistakes) {
          ctx.mistake(); ctx.sfx('bad'); ctx.status('That ' + d + " doesn't fit there. Try another digit.");
        } else {
          clearPeerNotes(sel, d); ctx.sfx('clack'); ctx.status('');
        }
      }
      draw(); finish();
    }

    function finish() {
      if (val.some(v => !v)) return;
      if (val.every((v, i) => v === p.solution[i])) { done = true; draw(); ctx.win(); }
      else { checked = true; draw(); ctx.status('Almost there. The marked squares need another look.'); }
    }

    function draw() {
      const sv = sel >= 0 ? val[sel] : 0, show = ctx.settings.sudokuMistakes || checked;
      const left = new Array(N + 1).fill(N);
      val.forEach(v => { if (v) left[v]--; });
      cells.forEach((c, i) => {
        const bad = show && val[i] && val[i] !== p.solution[i];
        c.className = base(i) + (p.given[i] ? ' given' : '') + (hinted.has(i) ? ' hinted' : '') + (i === sel ? ' sel' : '') +
          (sel >= 0 && peer(sel, i) ? ' peer' : '') + (sv && val[i] === sv && i !== sel ? ' same' : '') + (bad ? ' bad' : '');
        if (val[i]) c.textContent = val[i];
        else if (notes[i]) {
          let s = '';
          for (let d = 1; d <= N; d++) s += '<i>' + (notes[i] >> d & 1 ? d : '') + '</i>';
          c.innerHTML = '<span class="sd-notes">' + s + '</span>';
        } else c.textContent = '';
        c.setAttribute('aria-label', 'Row ' + (row(i) + 1) + ', column ' + (col(i) + 1) + ', ' + (val[i] || 'empty') + (bad ? ', does not fit' : ''));
      });
      digits.forEach((b, d) => {
        const n = Math.max(0, left[d + 1]);
        b.lastChild.textContent = n ? n + ' left' : 'done';
        b.classList.toggle('spent', !n);
        b.setAttribute('aria-label', (d + 1) + ', ' + n + ' left to place');
      });
      noteBtn.setAttribute('aria-pressed', String(noteMode));
      noteBtn.textContent = noteMode ? 'Notes: on' : 'Notes';
    }

    draw();
    ctx.status('Pick a square, then a digit.');
    return {
      hint() {
        if (done) return;
        const t = sel >= 0 && !locked[sel] && val[sel] !== p.solution[sel] ? sel : val.findIndex((v, i) => v !== p.solution[i]);
        if (t < 0) return;
        undo = [];
        val[t] = p.solution[t]; notes[t] = 0; locked[t] = true; hinted.add(t); sel = t; checked = false;
        clearPeerNotes(t, val[t]);
        ctx.hintUsed(); ctx.sfx('good'); ctx.status('Filled in a ' + val[t] + ' for you.');
        draw(); finish();
      },
      key(e) {
        const k = e.key;
        if ((e.metaKey || e.ctrlKey) && k === 'z') { undoLast(); return true; }
        if (e.metaKey || e.ctrlKey) return false;
        if (k.length === 1 && k >= '1' && k <= String(N)) { place(+k); return true; }
        if (k === 'Backspace' || k === 'Delete' || k === '0') { place(0); return true; }
        if (k === 'n' || k === 'N') { noteMode = !noteMode; draw(); return true; }
        if (k === 'u' || k === 'U') { undoLast(); return true; }
        const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k];
        if (mv) {
          if (sel < 0) sel = 0;
          else sel = Math.max(0, Math.min(N - 1, row(sel) + mv[0])) * N + Math.max(0, Math.min(N - 1, col(sel) + mv[1]));
          draw();
          return true;
        }
        return false;
      }
    };
  }

  BS.game({
    id: 'sudoku', name: 'Sudoku', cat: 'Logic', color: '#2F6FD0',
    icon: '<path d="M3.5 3.5h17v17h-17zM9.2 3.5v17M14.8 3.5v17M3.5 9.2h17M3.5 14.8h17" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
    tagline: 'Fill every row, column and box with each digit once.',
    how: [
      'Every row, every column and every outlined box must contain each digit exactly once.',
      'Tap a square, then tap a digit below (or type it).',
      'Not sure yet? Turn on Notes to pencil small digits into a square.',
      'Undo takes back your last move. Hint fills in one square for you.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
