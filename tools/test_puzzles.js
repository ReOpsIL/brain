#!/usr/bin/env node
// Generates every level of every game under Node and checks that each puzzle is valid and solvable.
// Usage: node tools/test_puzzles.js [gameId ...]
const fs = require('fs');
const path = require('path');
const js = path.join(__dirname, '..', 'Resources', 'web', 'js');
require(path.join(js, 'engine.js'));
require(path.join(js, 'words.js'));
for (const f of fs.readdirSync(path.join(js, 'games')).sort()) if (f.endsWith('.js')) require(path.join(js, 'games', f));
const BS = globalThis.BS;

const SLOW_MS = 200;
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
const range = n => [...Array(n).keys()];

// ---- Independent Sudoku solution counter (does not share code with the generator).
function countSudoku(p, limit) {
  const N = p.n, g = p.given.slice();
  const ok = (i, v) => {
    const r = Math.floor(i / N), c = i % N, br = r - r % p.bh, bc = c - c % p.bw;
    for (let k = 0; k < N; k++) if (g[r * N + k] === v || g[k * N + c] === v) return false;
    for (let y = br; y < br + p.bh; y++) for (let x = bc; x < bc + p.bw; x++) if (g[y * N + x] === v) return false;
    return true;
  };
  let count = 0;
  const rec = () => {
    let best = -1, opts = null;
    for (let i = 0; i < N * N; i++) if (!g[i]) {
      const o = [];
      for (let v = 1; v <= N; v++) if (ok(i, v)) o.push(v);
      if (!opts || o.length < opts.length) { best = i; opts = o; if (o.length < 2) break; }
    }
    if (best < 0) { count++; return; }
    for (const v of opts) { g[best] = v; rec(); g[best] = 0; if (count >= limit) return; }
  };
  rec();
  return count;
}

const seenScramble = new Set(), seenGuess = new Set();
const ANSWERS = new Set(BS.words.answers5.match(/.{5}/g)), VALID = new Set(BS.words.valid5.match(/.{5}/g));
const CHECK = {
  sudoku(p, level) {
    const N = p.n;
    assert(N === (level <= 100 ? 6 : 9), 'wrong size for the band');
    assert(p.given.length === N * N && p.solution.length === N * N, 'bad grid length');
    for (const unit of range(N)) {
      const row = new Set(range(N).map(k => p.solution[unit * N + k])), col = new Set(range(N).map(k => p.solution[k * N + unit]));
      assert(row.size === N && col.size === N, 'solution repeats a digit in a row or column');
    }
    for (let br = 0; br < N; br += p.bh) for (let bc = 0; bc < N; bc += p.bw) {
      const box = new Set();
      for (let y = br; y < br + p.bh; y++) for (let x = bc; x < bc + p.bw; x++) box.add(p.solution[y * N + x]);
      assert(box.size === N, 'solution repeats a digit in a box');
    }
    assert(p.given.every((v, i) => !v || v === p.solution[i]), 'a clue disagrees with the solution');
    assert(p.given.some(v => !v), 'nothing to solve');
    assert(countSudoku(p, 2) === 1, 'does not have exactly one solution');
  },
  pipes(p) {
    const n = p.w * p.h, t = p.tiles;
    assert(t.length === n && p.rot.length === n && p.src >= 0 && p.src < n, 'bad shape');
    let ends = 0;
    for (let i = 0; i < n; i++) {
      assert(t[i] > 0 && t[i] < 16, 'tile without pipes');
      for (let d = 0; d < 4; d++) if (t[i] >> d & 1) {
        ends++;
        const x = i % p.w + [0, 1, 0, -1][d], y = Math.floor(i / p.w) + [-1, 0, 1, 0][d];
        assert(x >= 0 && y >= 0 && x < p.w && y < p.h, 'pipe leaves the board');
        assert(t[y * p.w + x] >> ((d + 2) % 4) & 1, 'connection is not mutual');
      }
    }
    assert(ends === 2 * (n - 1), 'solution is not a tree (wrong number of connections)');
    const g = BS.games.pipes;
    assert(g.flow(p.w, p.h, t, p.src).solved, 'solution is not one connected network');
    assert(!g.flow(p.w, p.h, t.map((m, i) => g.turn(m, p.rot[i])), p.src).solved, 'starts already solved');
  },
  wordsearch(p) {
    assert(p.grid.length === p.size * p.size && /^[A-Z]+$/.test(p.grid), 'bad grid');
    assert(p.words.length >= 4 && new Set(p.words).size === p.words.length, 'too few or repeated words');
    assert(p.at.length === p.words.length, 'placements do not match the words');
    p.words.forEach((w, i) => {
      const [r, c, dr, dc] = p.at[i];
      for (let k = 0; k < w.length; k++) {
        const y = r + dr * k, x = c + dc * k;
        assert(y >= 0 && x >= 0 && y < p.size && x < p.size && p.grid[y * p.size + x] === w[k], w + ' is not in the grid');
      }
    });
  },
  scramble(p, level, salted) {
    assert(p.words.length === 3, 'needs three words');
    for (const w of p.words) {
      assert(w.letters.split('').sort().join('') === w.answer.split('').sort().join(''), 'letters are not an anagram of ' + w.answer);
      assert(w.letters !== w.answer && !w.alts.includes(w.letters), w.answer + ' is shown unscrambled');
      for (const a of w.alts) assert(a.split('').sort().join('') === w.answer.split('').sort().join(''), 'bad alternative ' + a);
      if (!salted) { assert(!seenScramble.has(w.answer), w.answer + ' repeats in another level'); seenScramble.add(w.answer); }
    }
  },
  wordguess(p, level, salted) {
    assert(/^[a-z]{5}$/.test(p.answer) && ANSWERS.has(p.answer), 'answer is not in the answer list');
    if (!salted) { assert(!seenGuess.has(p.answer), p.answer + ' repeats in another level'); seenGuess.add(p.answer); }
  },
  pairs(p) {
    assert(p.cards.length === p.cols * p.rows && p.cards.length % 2 === 0, 'bad card count');
    const n = {};
    p.cards.forEach(c => { n[c] = (n[c] || 0) + 1; });
    assert(Object.values(n).every(v => v === 2), 'a picture does not appear exactly twice');
    assert(p.allow === p.cards.length / 2, 'allow should equal the number of pairs');
  },
  recall(p) {
    assert(p.rounds.length === 3, 'needs three rounds');
    for (const r of p.rounds) {
      assert(r.length >= 3 && r.length <= 13 && new Set(r).size === r.length, 'bad pattern size');
      assert(r.every(i => Number.isInteger(i) && i >= 0 && i < p.n * p.n), 'pattern cell off the grid');
      assert(r.length <= p.n * p.n / 2, 'pattern covers more than half the grid');
    }
  },
  sequence(p) {
    assert(p.qs.length === 5, 'needs five questions');
    for (const q of p.qs) {
      assert(q.seq.length >= 4 && [...q.seq, q.answer].every(x => Number.isSafeInteger(x) && x >= 0), 'bad numbers: ' + q.seq + ' -> ' + q.answer);
      assert(q.options.length === 4 && new Set(q.options).size === 4, 'options are not four different numbers: ' + q.options);
      assert(q.options.filter(x => x === q.answer).length === 1, 'answer is not among the options exactly once');
      assert(q.options.every(x => Number.isSafeInteger(x) && x >= 0), 'bad option');
      assert(typeof q.rule === 'string' && q.rule.length > 8 && !/undefined|NaN/.test(q.rule), 'bad rule text');
      assert(new Set(q.seq).size > 1, 'sequence never changes');
    }
  },
  sums(p) {
    assert(p.rounds.length === 5, 'needs five rounds');
    for (const r of p.rounds) {
      assert(r.nums.length >= 6 && r.nums.length <= 12 && new Set(r.nums).size === r.nums.length, 'bad bubbles');
      assert(r.pick >= 2 && r.pick <= 5, 'bad pick count');
      const sols = BS.games.sums.solutions(r);
      assert(sols.length >= 1, 'no ' + r.pick + ' numbers add up to ' + r.target);
      assert(sols.every(s => s.length === r.pick && s.reduce((a, i) => a + r.nums[i], 0) === r.target), 'solver returned a wrong answer');
    }
  },
  odd(p) {
    assert(p.rounds.length === 5, 'needs five rounds');
    for (const r of p.rounds) {
      assert(r.n >= 3 && r.n <= 6 && r.odd >= 0 && r.odd < r.n * r.n, 'odd cell off the grid');
      assert(r.shape >= 0 && r.shape < BS.games.odd.shapes, 'unknown shape');
      assert(['rot', 'mirror', 'size', 'tone', 'detail'].includes(r.kind), 'unknown difference');
      if (r.kind === 'rot') assert(r.amt % 360 !== 0 && !r.turns, 'rotation would not be visible');
      if (r.kind === 'size') assert(r.amt > 0.5 && r.amt < 1, 'bad size');
      if (r.kind === 'tone') assert(r.amt > 14, 'bad tone');
      if (r.turns) assert(r.turns.length === r.n * r.n, 'bad turns');
    }
  },
  slide(p, level) {
    const g = BS.games.slide, n = p.n, t = p.tiles.slice();
    assert(n === (level <= 200 ? 3 : 4), 'wrong size for the band');
    assert(t.slice().sort((a, b) => a - b).every((v, i) => v === i), 'not a permutation');
    assert(!g.solved(t), 'starts already solved');
    for (let i = p.path.length - 1; i >= 0; i--) assert(g.step(t, n, (p.path[i] + 2) % 4), 'the way back makes an illegal move');
    assert(g.solved(t), 'the way back does not solve it');
  }
};

const only = process.argv.slice(2);
const DAYS = range(40).map(i => 'd2026-' + String(1 + i % 12).padStart(2, '0') + '-' + String(1 + i % 28).padStart(2, '0'));
let failures = 0;
console.log('game         puzzles   avg ms   max ms   result');
for (const id of BS.order) {
  if (only.length && !only.includes(id)) continue;
  assert(CHECK[id], 'no checks written for ' + id);
  const g = BS.games[id];
  let n = 0, total = 0, max = 0, maxAt = '', errs = [];
  for (const k of ['id', 'name', 'cat', 'color', 'icon', 'tagline']) if (typeof g[k] !== 'string' || !g[k]) errs.push('missing ' + k);
  if (!Array.isArray(g.how) || g.how.length < 2) errs.push('missing how-to steps');
  const run = (level, salt) => {
    const label = salt ? 'level ' + level + ' ' + salt : 'level ' + level;
    try {
      const t0 = process.hrtime.bigint();
      const p = BS.puzzle(id, level, salt);
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      n++; total += ms;
      if (ms > max) { max = ms; maxAt = label; }
      CHECK[id](p, level, !!salt);
      if (level % 50 === 1) assert(JSON.stringify(BS.puzzle(id, level, salt)) === JSON.stringify(p), 'not deterministic');
    } catch (e) {
      errs.push(label + ': ' + e.message);
    }
  };
  for (let level = 1; level <= BS.LEVELS; level++) run(level);
  DAYS.forEach((d, i) => run(1 + (i * 13) % BS.LEVELS, d));          // Today's five puzzles
  if (max > SLOW_MS) errs.push('too slow: ' + max.toFixed(0) + ' ms at ' + maxAt);
  failures += errs.length;
  console.log(id.padEnd(12), String(n).padStart(7), (total / n).toFixed(2).padStart(8), max.toFixed(1).padStart(8), '  ', errs.length ? 'FAIL (' + errs.length + ')' : 'ok');
  errs.slice(0, 8).forEach(e => console.log('    ' + e));
  if (errs.length > 8) console.log('    … and ' + (errs.length - 8) + ' more');
}
if (!only.length && BS.order.length !== 11) { failures++; console.log('expected 11 games, found ' + BS.order.length); }
console.log(failures ? '\n' + failures + ' problem(s) found' : '\nAll puzzles passed');
process.exit(failures ? 1 : 0);
