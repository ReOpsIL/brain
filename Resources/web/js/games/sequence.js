// What Comes Next: number sequences with four possible answers. The rule is explained after each one.
(function (root) {
  const BS = root.BS;
  const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
  const BY_BAND = [
    ['add', 'add', 'sub'],
    ['add', 'sub', 'mul', 'alt', 'alt'],
    ['alt', 'grow', 'grow', 'square', 'inter'],
    ['grow', 'inter', 'fib', 'tri', 'prime', 'square'],
    ['fib', 'prime', 'cube', 'quad', 'dbl', 'muladd', 'inter']
  ];
  // The last number of `s` becomes the answer.
  const cut = (s, rule) => ({ seq: s.slice(0, -1), answer: s[s.length - 1], rule });
  const build = (first, n, next) => { const s = [first]; for (let i = 0; i < n; i++) s.push(next(s[i], i, s)); return s; };

  const MAKE = {
    add(r, f) { const k = r.int(2, 4 + Math.round(f * 8)); return cut(build(r.int(1, 20), 5, x => x + k), `Add ${k} each time.`); },
    sub(r, f) { const k = r.int(2, 4 + Math.round(f * 6)); return cut(build(k * 6 + r.int(1, 15), 5, x => x - k), `Subtract ${k} each time.`); },
    mul(r) { const m = r.pick([2, 2, 3]); return cut(build(r.int(1, m === 2 ? 6 : 3), 5, x => x * m), `Multiply by ${m} each time.`); },
    alt(r) {
      const p = r.int(1, 6); let q = r.int(2, 9); if (q === p) q++;
      return cut(build(r.int(1, 15), 6, (x, i) => x + (i % 2 ? q : p)), `The steps take turns: add ${p}, then add ${q}, then add ${p} again.`);
    },
    grow(r) {
      const d = r.int(1, 4), inc = r.int(1, 3);
      return cut(build(r.int(1, 12), 5, (x, i) => x + d + inc * i), `The step grows by ${inc} each time: +${d}, +${d + inc}, +${d + 2 * inc}, and so on.`);
    },
    square(r) {
      const n = r.int(1, 6), c = r.pick([0, 0, 1, 2]);
      return cut([0, 1, 2, 3, 4, 5].map(i => (n + i) * (n + i) + c),
        c ? `Square numbers plus ${c}: ${n}×${n}+${c}, ${n + 1}×${n + 1}+${c}, and so on.` : `Square numbers: ${n}×${n}, ${n + 1}×${n + 1}, ${n + 2}×${n + 2}, and so on.`);
    },
    inter(r) {
      const a = r.int(1, 10), p = r.int(2, 5), b = r.int(30, 60), q = r.int(2, 6);
      return cut([a, b, a + p, b - q, a + 2 * p, b - 2 * q, a + 3 * p],
        `Two patterns take turns. One adds ${p} (${a}, ${a + p}, ${a + 2 * p}…), the other subtracts ${q} (${b}, ${b - q}, ${b - 2 * q}…).`);
    },
    fib(r) { const a = r.int(1, 5); return cut(build(a, 6, (x, i, s) => i ? x + s[i - 1] : x + r.int(1, 6)), 'Each number is the sum of the two before it.'); },
    tri(r) {
      const n = r.int(1, 4);
      return cut([0, 1, 2, 3, 4, 5].map(i => (n + i) * (n + i + 1) / 2), `The step grows by 1 each time: +${n + 1}, +${n + 2}, +${n + 3}, and so on.`);
    },
    prime(r) { const i = r.int(0, 14); return cut(PRIMES.slice(i, i + 6), 'Prime numbers in order: numbers that can only be divided by 1 and themselves.'); },
    cube(r) { const n = r.int(1, 4); return cut([0, 1, 2, 3, 4].map(i => (n + i) ** 3), `Cube numbers: ${n}×${n}×${n}, ${n + 1}×${n + 1}×${n + 1}, and so on.`); },
    quad(r) {
      const d = r.int(2, 9), inc = r.int(3, 7);
      return cut(build(r.int(1, 20), 5, (x, i) => x + d + inc * i), `Look at the steps: +${d}, +${d + inc}, +${d + 2 * inc}. The step itself grows by ${inc} each time.`);
    },
    dbl(r) { const d = r.int(1, 3); return cut(build(r.int(1, 9), 5, (x, i) => x + d * 2 ** i), `The step doubles each time: +${d}, +${d * 2}, +${d * 4}, and so on.`); },
    muladd(r) {
      const c = r.pick([1, -1, 2, 3]);
      return cut(build(r.int(c < 0 ? 2 : 1, 4), 5, x => x * 2 + c), `Double the number, then ${c > 0 ? 'add' : 'subtract'} ${Math.abs(c)}.`);
    }
  };

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level);
    const qs = [];
    for (let i = 0; i < 5; i++) {
      const q = MAKE[rng.pick(BY_BAND[band])](rng, f);
      const s = q.seq, a = q.answer, last = s[s.length - 1], step = last - s[s.length - 2];
      // Tempting wrong answers: carrying on with the last step, and near misses.
      const near = rng.shuffle([a + 1, a - 1, a + 2, a - 2, a + 10, a - 10, a + step, a - step, last + 1, a + 3, a + 5]);
      const wrong = [...new Set([last + step, ...near])].filter(x => x !== a && x >= 0).slice(0, 3);
      q.options = rng.shuffle([a, ...wrong]);
      qs.push(q);
    }
    return { qs, allow: 2 };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h;
    let qi = 0, q, answered = false, removed, optBtns = [];
    const seqRow = h('div.sq-row', { role: 'group' });
    const opts = h('div.sq-opts', { role: 'group', 'aria-label': 'Possible answers' });
    const rule = h('p.sq-rule');
    const next = h('button.btn.primary', { type: 'button', onclick: advance }, 'Next question');
    const after = h('div.sq-after', null, rule, next);
    rootEl.append(h('p.sq-ask', null, 'Which number comes next?'), seqRow, opts, after);

    function start() {
      q = p.qs[qi]; answered = false; removed = new Set();
      ctx.progress(qi + 1, p.qs.length, 'Question');
      ctx.status('Find the pattern, then choose the missing number.');
      seqRow.setAttribute('aria-label', 'Sequence: ' + q.seq.join(', ') + ', then a missing number');
      seqRow.replaceChildren(...q.seq.map(x => h('span.sq-num.tile', null, x)), h('span.sq-num.sq-gap', null, '?'));
      optBtns = q.options.map((x, i) => h('button.sq-opt.tile', { type: 'button', onclick: () => choose(i) }, x));
      opts.replaceChildren(...optBtns);
      after.style.visibility = 'hidden';
    }
    function choose(i) {
      if (answered || removed.has(i)) return;
      answered = true;
      const right = q.options[i] === q.answer;
      optBtns.forEach((b, j) => {
        b.disabled = true;
        if (q.options[j] === q.answer) b.classList.add('right');
        else if (j === i) b.classList.add('wrong');
      });
      const gap = seqRow.lastChild;
      gap.textContent = q.answer; gap.className = 'sq-num tile sq-filled';
      if (right) { ctx.sfx('good'); ctx.status('Correct.'); }
      else { ctx.mistake(); ctx.sfx('bad'); ctx.status('Not quite. The answer is ' + q.answer + '.'); }
      rule.textContent = q.rule;
      next.textContent = qi + 1 < p.qs.length ? 'Next question' : 'Finish';
      after.style.visibility = 'visible';
      next.focus();
    }
    function advance() {
      if (!answered) return;
      if (++qi < p.qs.length) start(); else { answered = false; after.style.visibility = 'hidden'; ctx.win(); }
    }

    start();
    return {
      hint() {
        if (answered) return;
        const wrong = q.options.map((x, i) => i).filter(i => q.options[i] !== q.answer && !removed.has(i));
        if (wrong.length < 2) { ctx.status('Only two answers are left. One of them is right.'); return; }
        const i = wrong[Math.floor(Math.random() * wrong.length)];
        removed.add(i);
        optBtns[i].disabled = true; optBtns[i].classList.add('out');
        ctx.hintUsed(); ctx.sfx('tap');
        ctx.status('It is not ' + q.options[i] + '.');
      },
      key(e) {
        if (e.metaKey || e.ctrlKey) return false;
        if (!answered && e.key >= '1' && e.key <= '4') { choose(+e.key - 1); return true; }
        return false;
      }
    };
  }

  BS.game({
    id: 'sequence', name: 'What Comes Next', cat: 'Numbers', color: '#2FA37A',
    icon: '<circle cx="4.5" cy="15" r="2.5" fill="currentColor"/><circle cx="12" cy="12" r="3.2" fill="currentColor"/><circle cx="19.5" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="2.4 2"/>',
    tagline: 'Spot the pattern and choose the next number.',
    how: [
      'Each row of numbers follows a rule. Work out what the rule is.',
      'Choose which of the four numbers comes next.',
      'After each answer the rule is explained, so you learn the patterns as you go.',
      'There are five questions. Hint removes one wrong answer.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
