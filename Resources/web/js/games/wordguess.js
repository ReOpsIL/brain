// Word Guess: find the five-letter word in six tries.
(function (root) {
  const BS = root.BS;
  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  let valid = null;

  function gen(level, rng, salt) {
    const A = BS.words.answers5, n = A.length / 5;
    // Answers are ordered most common first, so the level number is also the difficulty.
    const i = salt ? rng.int(Math.max(0, level - 40), Math.min(n - 1, level + 99)) : (level - 1) % n;
    return { answer: A.substr(i * 5, 5) };
  }

  // 'ok' right letter and spot, 'near' right letter in another spot, 'no' not in the word.
  function score(guess, answer) {
    const res = new Array(5).fill('no'), spare = {};
    for (let i = 0; i < 5; i++) { if (guess[i] === answer[i]) res[i] = 'ok'; else spare[answer[i]] = (spare[answer[i]] || 0) + 1; }
    for (let i = 0; i < 5; i++) if (res[i] !== 'ok' && spare[guess[i]]) { res[i] = 'near'; spare[guess[i]]--; }
    return res;
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, answer = p.answer;
    if (!valid) {
      valid = new Set();
      for (const s of [BS.words.valid5, BS.words.answers5]) for (let i = 0; i < s.length; i += 5) valid.add(s.substr(i, 5));
    }
    const guesses = [], known = new Array(5).fill(''), keyState = {};
    let cur = '', done = false, busy = false, timer = 0;
    const words = { ok: 'right spot', near: 'wrong spot', no: 'not in the word' };

    const rows = [...Array(6)].map(() => h('div.wg-row', null, [...Array(5)].map(() => h('span.wg-cell'))));
    const keys = {};
    const kb = h('div.wg-kb', null, ROWS.map((r, ri) => h('div.wg-krow', null,
      ri === 2 ? h('button.wg-key.wide', { type: 'button', onclick: submit }, 'Enter') : null,
      r.split('').map(ch => keys[ch] = h('button.wg-key', { type: 'button', onclick: () => type(ch) }, ch.toUpperCase())),
      ri === 2 ? h('button.wg-key.wide', { type: 'button', 'aria-label': 'Delete', onclick: back }, 'Del') : null)));
    rootEl.append(
      h('div.wg-grid', { role: 'group', 'aria-label': 'Your guesses' }, rows),
      h('p.wg-legend', { html: '<span class="wg-cell ok mini"></span> right spot <span class="wg-cell near mini"></span> wrong spot <span class="wg-cell no mini"></span> not in the word' }),
      kb);

    function draw() {
      const row = rows[guesses.length];
      if (!row) return;
      [...row.children].forEach((c, i) => {
        c.textContent = (cur[i] || known[i] || '').toUpperCase();
        c.className = 'wg-cell' + (cur[i] ? ' typed' : known[i] ? ' ghost' : '');
      });
      row.setAttribute('aria-label', 'Current guess: ' + (cur.toUpperCase() || 'empty'));
    }
    function type(ch) {
      if (done || busy || cur.length >= 5) return;
      cur += ch; ctx.sfx('tap'); draw();
    }
    function back() {
      if (done || busy || !cur) return;
      cur = cur.slice(0, -1); ctx.sfx('tap'); draw();
    }
    function submit() {
      if (done || busy) return;
      const row = rows[guesses.length];
      const nudge = msg => { ctx.status(msg); row.classList.remove('shake'); void row.offsetWidth; row.classList.add('shake'); };
      if (cur.length < 5) return nudge('Type all five letters first.');
      if (!valid.has(cur)) return nudge(cur.toUpperCase() + " isn't in my word list. Try another word.");
      const guess = cur, res = score(guess, answer);
      guesses.push(guess); cur = '';
      [...row.children].forEach((c, i) => {
        c.textContent = guess[i].toUpperCase();
        c.className = 'wg-cell ' + res[i];
        c.style.animationDelay = i * 90 + 'ms';
        if (res[i] === 'ok') known[i] = guess[i];
        const rank = { no: 1, near: 2, ok: 3 };
        if (!keyState[guess[i]] || rank[res[i]] > rank[keyState[guess[i]]]) keyState[guess[i]] = res[i];
      });
      row.setAttribute('aria-label', 'Guess ' + guesses.length + ': ' + guess.split('').map((ch, i) => ch.toUpperCase() + ' ' + words[res[i]]).join(', '));
      for (const ch in keyState) {
        keys[ch].className = 'wg-key ' + keyState[ch];
        keys[ch].setAttribute('aria-label', ch.toUpperCase() + ', ' + words[keyState[ch]]);
      }
      if (guess === answer) {
        done = true; ctx.sfx('good');
        ctx.status('You got it in ' + guesses.length + (guesses.length === 1 ? ' try.' : ' tries.'));
        return ctx.win({ stars: guesses.length <= 4 ? 3 : guesses.length === 5 ? 2 : 1 });
      }
      if (guesses.length === 6) { done = true; ctx.status('That was the last try.'); return ctx.fail('The word was ' + answer.toUpperCase() + '.'); }
      ctx.sfx('clack');
      ctx.status((6 - guesses.length) + (guesses.length === 5 ? ' try left.' : ' tries left.'));
      busy = true;
      timer = setTimeout(() => { busy = false; draw(); }, 500);
    }

    draw();
    ctx.status('Type a five-letter word and press Enter.');
    return {
      hint() {
        if (done) return;
        const open = [0, 1, 2, 3, 4].filter(i => !known[i]);
        if (!open.length) { ctx.status('You already know every letter.'); return; }
        const i = open[Math.floor(Math.random() * open.length)];
        known[i] = answer[i];
        ctx.hintUsed(); ctx.sfx('good');
        ctx.status('Letter ' + (i + 1) + ' is ' + answer[i].toUpperCase() + '.');
        draw();
      },
      key(e) {
        if (e.metaKey || e.ctrlKey) return false;
        if (e.key === 'Enter') { submit(); return true; }
        if (e.key === 'Backspace') { back(); return true; }
        if (/^[a-zA-Z]$/.test(e.key)) { type(e.key.toLowerCase()); return true; }
        return false;
      },
      destroy() { clearTimeout(timer); }
    };
  }

  BS.game({
    id: 'wordguess', name: 'Word Guess', cat: 'Words', color: '#C2416B',
    icon: '<rect x="2" y="8.5" width="5.6" height="7" rx="1.3" fill="currentColor"/><rect x="9.2" y="8.5" width="5.6" height="7" rx="1.3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="16.4" y="8.5" width="5.6" height="7" rx="1.3" fill="currentColor"/>',
    tagline: 'Work out the secret five-letter word in six tries.',
    how: [
      'Type any five-letter word and press Enter.',
      'A green square means the letter is in the right spot.',
      'A yellow circle means the letter is in the word, but in a different spot.',
      'A dark tile means the letter is not in the word at all.',
      'You have six tries. Hint reveals one letter.'
    ],
    gen, mount, score
  });
})(typeof window !== 'undefined' ? window : globalThis);
