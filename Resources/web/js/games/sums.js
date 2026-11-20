// Sum It Up: pick the numbers that add up to the target. Any combination that works is accepted.
(function (root) {
  const BS = root.BS;

  function gen(level, rng) {
    const band = BS.band(level);
    const count = BS.lerp(6, 12, (level - 1) / (BS.LEVELS - 1)), max = [12, 20, 30, 50, 75][band];
    const rounds = [];
    for (let r = 0; r < 5; r++) {
      const pick = [2, rng.int(2, 3), 3, rng.int(3, 4), rng.int(4, 5)][band];
      const nums = rng.shuffle([...Array(max).keys()].map(i => i + 1)).slice(0, count);
      const target = rng.shuffle(nums).slice(0, pick).reduce((a, b) => a + b, 0);
      rounds.push({ nums, pick, target });
    }
    return { rounds, allow: 2 };
  }

  // Every way to choose `pick` of the numbers (as index lists) that adds up to the target.
  function solutions(round) {
    const out = [], { nums, pick, target } = round;
    const rec = (start, chosen, sum) => {
      if (chosen.length === pick) { if (sum === target) out.push(chosen.slice()); return; }
      for (let i = start; i < nums.length; i++) { chosen.push(i); rec(i + 1, chosen, sum + nums[i]); chosen.pop(); }
    };
    rec(0, [], 0);
    return out;
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h;
    let ri = 0, round, sel = [], busy = false, timer = 0, bubbles = [];
    const ask = h('p.sm-ask'), field = h('div.sm-field', { role: 'group', 'aria-label': 'Numbers to choose from' }), total = h('p.sm-total', { 'aria-live': 'polite' });
    rootEl.append(ask, field, total);

    function start() {
      round = p.rounds[ri]; sel = []; busy = false;
      ctx.progress(ri + 1, p.rounds.length);
      ask.innerHTML = 'Pick <b>' + round.pick + '</b> numbers that add up to <b>' + round.target + '</b>';
      bubbles = round.nums.map((x, i) => h('button.sm-num', { type: 'button', onclick: () => toggle(i) }, x));
      field.className = 'sm-field' + (round.nums.length > 9 ? ' small' : '');
      field.replaceChildren(...bubbles);
      ctx.status('Tap a number to pick it. Tap it again to put it back.');
      draw();
    }
    function draw() {
      bubbles.forEach((b, i) => {
        b.classList.toggle('on', sel.includes(i));
        b.setAttribute('aria-pressed', String(sel.includes(i)));
      });
      const sum = sel.reduce((a, i) => a + round.nums[i], 0);
      total.textContent = sel.length ? sel.map(i => round.nums[i]).join(' + ') + ' = ' + sum : 'Nothing picked yet';
    }
    function toggle(i) {
      if (busy) return;
      const k = sel.indexOf(i);
      if (k >= 0) { sel.splice(k, 1); ctx.sfx('tap'); return draw(); }
      sel.push(i);
      ctx.sfx('clack');
      draw();
      if (sel.length < round.pick) return;
      const sum = sel.reduce((a, j) => a + round.nums[j], 0);
      if (sum !== round.target) {
        ctx.mistake(); ctx.sfx('bad');
        ctx.status('That makes ' + sum + ', and you need ' + round.target + '. Swap a number and try again.');
        bubbles[i].classList.remove('shake'); void bubbles[i].offsetWidth; bubbles[i].classList.add('shake');
        sel.pop();
        bubbles[i].classList.remove('on');
        bubbles[i].setAttribute('aria-pressed', 'false');
        return;
      }
      busy = true;
      sel.forEach(j => bubbles[j].classList.add('right'));
      ctx.sfx('good');
      ctx.status('Yes, that makes ' + round.target + '.');
      timer = setTimeout(() => { if (++ri < p.rounds.length) start(); else ctx.win(); }, ri + 1 < p.rounds.length ? 1200 : 500);
    }

    start();
    return {
      hint() {
        if (busy) return;
        // Use the answer that keeps the most of what is already picked.
        const best = solutions(round).sort((a, b) => b.filter(i => sel.includes(i)).length - a.filter(i => sel.includes(i)).length)[0];
        const dropped = sel.filter(i => !best.includes(i));
        sel = sel.filter(i => best.includes(i));
        const i = best.find(j => !sel.includes(j));
        draw();
        bubbles.forEach(b => b.classList.remove('pulse'));
        void bubbles[i].offsetWidth;
        bubbles[i].classList.add('pulse');
        ctx.hintUsed(); ctx.sfx('tap');
        ctx.status((dropped.length ? 'I put back ' + dropped.map(j => round.nums[j]).join(' and ') + '. ' : '') + 'Try the glowing number, ' + round.nums[i] + '.');
      },
      destroy() { clearTimeout(timer); }
    };
  }

  BS.game({
    id: 'sums', name: 'Sum It Up', cat: 'Numbers', color: '#2FA37A',
    icon: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M12 7.5v9M7.5 12h9" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
    tagline: 'Pick the numbers that add up to the target.',
    how: [
      'You are told how many numbers to pick and what they must add up to.',
      'Tap the numbers to pick them. The running total is shown underneath.',
      'Often more than one combination works. Any of them counts.',
      'There are five rounds. Hint points to a number that belongs in an answer.'
    ],
    gen, mount, solutions
  });
})(typeof window !== 'undefined' ? window : globalThis);
