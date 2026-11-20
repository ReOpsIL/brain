// Pairs: flip two cards at a time and find all the matching pairs.
(function (root) {
  const BS = root.BS;
  const PLAIN = [
    '🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🍒 🍑 🍍 🥝 🥥 🥕 🌽 🥨',
    '🐶 🐱 🐭 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🐔 🐧',
    '🌷 🌹 🌻 🌵 🌴 🌲 🍄 🍁 🌈 ⭐ 🌙 ☀️ ⛄ 🔥 💧 🌊',
    '🚗 🚌 🚂 ✈️ 🚀 ⛵ 🚲 🚁 🚜 🎈 ⚓ 🏠 ⛺ 🗽 🎡 🚦',
    '⌚ 📷 🎁 🔑 🔔 📚 🎩 👓 ☂️ 🎲 🎹 🎺 🎻 🥁 ⚽ 🏆'
  ].map(s => s.split(' '));
  // Sets whose pictures look alike, for the harder levels.
  const ALIKE = [
    '🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛 🕜 🕝 🕞 🕟',
    '😀 😃 😄 😁 😆 😊 🙂 😉 😌 😍 😘 😋 😛 😜 🤗 😎',
    '😺 😸 😹 😻 😼 😽 🙀 😿 😾 🌑 🌒 🌓 🌔 🌕 🌖 🌗',
    '🐦 🦜 🦆 🦉 🦅 🦢 🕊️ 🐧 🐤 🐥 🐣 🦩 🦚 🦃 🐓 🐔'
  ].map(s => s.split(' '));
  const DIMS = [[4, 3], [4, 4], [4, 5], [4, 6], [5, 6]];

  function gen(level, rng) {
    const band = BS.band(level), f = BS.frac(level);
    const [cols, rows] = DIMS[Math.min(4, band + (f >= 0.5 ? 1 : 0))];
    const pairs = cols * rows / 2;
    const set = rng.pick(rng.chance([0, 0, 0.3, 0.6, 1][band]) ? ALIKE : PLAIN);
    const faces = rng.shuffle(set).slice(0, pairs);
    return { cols, rows, cards: rng.shuffle(faces.concat(faces)), preview: band === 0 ? 2600 : 0, allow: pairs };
  }

  function mount(rootEl, p, ctx) {
    const h = BS.h, n = p.cards.length, pairs = n / 2;
    const up = new Array(n).fill(false), matched = new Array(n).fill(false);
    let first = -1, second = -1, found = 0, peek = false, timer = 0, peekT = 0, done = false;
    const cw = Math.min(104, Math.floor((444 - (p.cols - 1) * 8) / p.cols));
    const ch = Math.min(Math.round(cw * 1.2), Math.floor((512 - (p.rows - 1) * 8) / p.rows));
    const cards = p.cards.map((face, i) => h('button.pr-card', { type: 'button', onclick: () => tap(i) },
      h('span.pr-in', null, h('span.pr-back'), h('span.pr-face', { style: `font-size:${Math.round(Math.min(cw, ch) * 0.56)}px` }, face))));
    rootEl.append(h('div.pr-board', { style: `grid-template-columns:repeat(${p.cols},${cw}px);grid-auto-rows:${ch}px` }, cards));

    function draw() {
      cards.forEach((c, i) => {
        const shown = up[i] || matched[i] || peek;
        c.classList.toggle('up', shown);
        c.classList.toggle('done', matched[i]);
        c.setAttribute('aria-label', 'Card ' + (i + 1) + (shown ? ', ' + p.cards[i] + (matched[i] ? ', matched' : '') : ', face down'));
      });
    }
    function flipBack() {
      clearTimeout(timer);
      if (second < 0) return;
      up[first] = up[second] = false;
      first = second = -1;
    }
    function tap(i) {
      if (done || peek || up[i] || matched[i]) return;
      if (second >= 0) flipBack();
      up[i] = true;
      ctx.sfx('flip');
      if (first < 0) first = i;
      else if (p.cards[first] === p.cards[i]) {
        matched[first] = matched[i] = true; first = -1; found++;
        ctx.sfx('good');
        if (found === pairs) { done = true; ctx.status('All pairs found.'); ctx.win(); }
        else ctx.status(found + ' of ' + pairs + ' pairs found.');
      } else {
        second = i;
        ctx.mistake();
        ctx.status('Not a pair. Remember where they are.');
        timer = setTimeout(() => { flipBack(); draw(); }, 1300);
      }
      draw();
    }
    function showAll(ms, after) {
      peek = true; draw();
      clearTimeout(peekT);
      peekT = setTimeout(() => { peek = false; draw(); if (after) ctx.status(after); }, ms);
    }

    draw();
    if (p.preview) { ctx.status('Take a good look…'); showAll(p.preview, 'Now find the pairs. Tap two cards.'); }
    else ctx.status('Tap two cards to turn them over.');
    return {
      hint() {
        if (done || peek) return;
        flipBack();
        ctx.hintUsed(); ctx.sfx('flip');
        ctx.status('Here is a quick peek at every card.');
        showAll(1800, found + ' of ' + pairs + ' pairs found.');
      },
      destroy() { clearTimeout(timer); clearTimeout(peekT); }
    };
  }

  BS.game({
    id: 'pairs', name: 'Pairs', cat: 'Memory', color: '#F0A92B',
    icon: '<rect x="3" y="5.5" width="10" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.2" transform="rotate(-8 8 12.5)"/><rect x="11" y="4.5" width="10" height="14" rx="2" fill="currentColor" transform="rotate(8 16 11.5)"/>',
    tagline: 'Turn over the cards and match the pairs.',
    how: [
      'Every picture is hiding on exactly two cards.',
      'Tap two cards to turn them over. If they match, they stay face up.',
      'If they don\'t match they turn back, so remember where each picture is.',
      'Hint gives you a quick peek at all the cards.'
    ],
    gen, mount
  });
})(typeof window !== 'undefined' ? window : globalThis);
