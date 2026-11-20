// Brain Spark screens: home (Today's five + all puzzles), game lobby, play, settings.
// Runs in the menu bar app's web view (state saved through the native bridge) or in a plain browser (localStorage).
(function () {
  'use strict';
  const BS = window.BS, h = BS.h;
  const app = document.getElementById('app'), frame = document.getElementById('frame');
  const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bs;
  const NATIVE = window.BS_NATIVE || null;
  const post = (type, data) => { if (bridge) bridge.postMessage(Object.assign({ type }, data)); };
  const CATS = ['Words', 'Logic', 'Memory', 'Numbers', 'Visual'];
  const KEY = 'brainspark.state';
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (bridge) document.documentElement.classList.add('native');

  const icon = (inner, cls) => BS.svg(inner, '0 0 24 24', cls || 'ico');
  const STROKE = 'fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"';
  const IC = {
    back: `<path d="M15 5l-7 7 7 7" ${STROKE}/>`,
    close: `<path d="M6 6l12 12M18 6L6 18" ${STROKE}/>`,
    help: `<path d="M8.8 9a3.3 3.3 0 1 1 5 2.8c-1.1.7-1.8 1.4-1.8 2.7" ${STROKE}/><circle cx="12" cy="18.6" r="1.5" fill="currentColor"/>`,
    gear: '<circle cx="12" cy="12" r="6.3" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 2.2v3M12 18.8v3M2.2 12h3M18.8 12h3M5.1 5.1l2.1 2.1M16.8 16.8l2.1 2.1M5.1 18.9l2.1-2.1M16.8 7.2l2.1-2.1" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>',
    star: '<path d="M12 2.4l2.95 6 6.6.95-4.78 4.65 1.13 6.57L12 17.47 6.1 20.57l1.13-6.57L2.45 9.35l6.6-.95z" stroke-linejoin="round"/>',
    spark: '<path d="M12 1.5l2.4 8.1 8.1 2.4-8.1 2.4-2.4 8.1-2.4-8.1L1.5 12l8.1-2.4z"/>'
  };
  const starRow = (n, cls) => [0, 1, 2].map(i => icon(IC.star, 'star' + (i < n ? ' on' : '') + (cls ? ' ' + cls : ''))).join('');

  // ---------- State

  const fresh = () => ({ v: 1, settings: { table: 'green', size: 1, sounds: true, sudokuMistakes: true }, prog: {}, daily: { date: '', done: {}, lv: {} }, streak: { last: '', n: 0 }, seen: {} });
  function normalize(s) {
    const f = fresh();
    if (!s || typeof s !== 'object' || s.v !== 1) return f;
    const st = s.settings || {};
    if (['green', 'blue', 'burgundy'].includes(st.table)) f.settings.table = st.table;
    if ([1, 1.15, 1.3].includes(st.size)) f.settings.size = st.size;
    if (typeof st.sounds === 'boolean') f.settings.sounds = st.sounds;
    if (typeof st.sudokuMistakes === 'boolean') f.settings.sudokuMistakes = st.sudokuMistakes;
    for (const id of BS.order) {
      const p = s.prog && s.prog[id];
      if (typeof p === 'string' && p.length === BS.LEVELS && /^[0-3]+$/.test(p)) f.prog[id] = p;
      if (s.seen && s.seen[id]) f.seen[id] = 1;
    }
    const d = s.daily;
    if (d && typeof d.date === 'string') {
      f.daily.date = d.date;
      for (const id of BS.order) {
        if (d.done && d.done[id] >= 1 && d.done[id] <= 3) f.daily.done[id] = d.done[id] | 0;
        if (d.lv && d.lv[id] >= 1 && d.lv[id] <= BS.LEVELS) f.daily.lv[id] = d.lv[id] | 0;
      }
    }
    if (s.streak && typeof s.streak.last === 'string' && s.streak.n >= 0) f.streak = { last: s.streak.last, n: s.streak.n | 0 };
    return f;
  }
  function load() {
    if (NATIVE) return normalize(NATIVE.state);
    try { return normalize(JSON.parse(localStorage.getItem(KEY))); } catch (e) { return fresh(); }
  }
  let state = load();
  function save() {
    const s = JSON.stringify(state);
    if (bridge) post('save', { state: s });
    else try { localStorage.setItem(KEY, s); } catch (e) { /* private window: play on without saving */ }
  }

  const prog = id => state.prog[id] || '0'.repeat(BS.LEVELS);
  const nextLevel = id => { const i = prog(id).indexOf('0'); return i < 0 ? BS.LEVELS : i + 1; };
  const solvedCount = id => prog(id).replace(/0/g, '').length;
  const starCount = id => prog(id).split('').reduce((a, c) => a + +c, 0);
  function record(id, level, stars) {
    const p = prog(id);
    if (stars > +p[level - 1]) state.prog[id] = p.slice(0, level - 1) + stars + p.slice(level);
  }

  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today = () => ymd(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
  const streakNow = () => state.streak.last === today() || state.streak.last === yesterday() ? state.streak.n : 0;

  // Today's five: one game per category, picked by the date, at the level the player has reached in it.
  function dailyIds() {
    const t = today();
    if (state.daily.date !== t) state.daily = { date: t, done: {}, lv: {} };
    const r = BS.rng(BS.hash('daily:' + t));
    return CATS.map(c => {
      const id = r.pick(BS.order.filter(g => BS.games[g].cat === c));
      if (!state.daily.lv[id]) state.daily.lv[id] = nextLevel(id);
      return id;
    });
  }

  function applySettings() {
    document.body.dataset.table = state.settings.table;
    if (bridge) post('scale', { value: state.settings.size });
    else frame.style.zoom = state.settings.size;
  }

  // ---------- Sound (synthesized, so there are no audio files to ship)

  let audio = null;
  function sfx(name) {
    if (!state.settings.sounds) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
      const t = audio.currentTime;
      const tone = (freq, at, dur, vol, type) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = type || 'sine'; o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t + at);
        g.gain.exponentialRampToValueAtTime(vol, t + at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + at + dur);
        o.connect(g).connect(audio.destination);
        o.start(t + at); o.stop(t + at + dur + 0.02);
      };
      const knock = (freq, dur, vol) => {
        const len = Math.ceil(audio.sampleRate * dur), buf = audio.createBuffer(1, len, audio.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        const src = audio.createBufferSource(), f = audio.createBiquadFilter(), g = audio.createGain();
        src.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4; g.gain.value = vol;
        src.connect(f).connect(g).connect(audio.destination);
        src.start(t);
      };
      if (name === 'tap') knock(1900, 0.03, 0.22);
      else if (name === 'flip') knock(2600, 0.05, 0.2);
      else if (name === 'clack') { knock(900, 0.06, 0.5); tone(170, 0, 0.07, 0.1); }
      else if (name === 'good') { tone(880, 0, 0.35, 0.09); tone(1318.5, 0.09, 0.45, 0.08); }
      else if (name === 'bad') { tone(196, 0, 0.22, 0.1, 'triangle'); tone(155.6, 0.1, 0.28, 0.09, 'triangle'); }
      else if (name === 'win') [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, i * 0.12, 0.7, 0.1));
    } catch (e) { /* no audio available */ }
  }

  // ---------- Paper confetti for a win

  const canvas = document.getElementById('confetti');
  let confettiRaf = 0;
  function stopConfetti() { cancelAnimationFrame(confettiRaf); canvas.width = canvas.width; canvas.style.display = 'none'; }
  function confetti() {
    stopConfetti();
    if (calm.matches) return;
    const W = 480, H = 700, dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.style.display = 'block';
    canvas.width = W * dpr; canvas.height = H * dpr;
    const g = canvas.getContext('2d');
    const colors = ['#E2B04A', '#F6EEDC', '#C2416B', '#2F6FD0', '#2FA37A', '#7A55C7'];
    const bits = [...Array(70)].map(() => ({
      x: Math.random() * W, y: -20 - Math.random() * 260, vx: (Math.random() - 0.5) * 1.6, vy: 1.6 + Math.random() * 2.2,
      w: 6 + Math.random() * 7, hh: 9 + Math.random() * 8, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.18, c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    const tick = now => {
      const age = now - t0;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, W, H);
      g.globalAlpha = Math.max(0, Math.min(1, (3600 - age) / 700));
      for (const b of bits) {
        b.x += b.vx + Math.sin((age + b.a * 400) / 500) * 0.5; b.y += b.vy; b.a += b.va;
        g.save(); g.translate(b.x, b.y); g.rotate(b.a); g.scale(1, Math.cos(b.a * 1.7));
        g.fillStyle = b.c; g.fillRect(-b.w / 2, -b.hh / 2, b.w, b.hh);
        g.restore();
      }
      if (age < 3600) confettiRaf = requestAnimationFrame(tick); else stopConfetti();
    };
    confettiRaf = requestAnimationFrame(tick);
  }

  // ---------- Screen plumbing

  let cur = { name: '' };      // which screen is showing
  let live = null;             // the puzzle in play; kept when you step away so going back doesn't lose your work
  let overlay = null;
  let login = !!(NATIVE && NATIVE.login);

  function killLive() {
    if (!live) return;
    live.timers.forEach(clearTimeout);
    if (live.api && live.api.destroy) live.api.destroy();
    live = null;
  }
  function enter(name, extra) {
    closeSheet();
    stopConfetti();
    cur = Object.assign({ name }, extra);
  }
  function show(...kids) {
    const el = h('div.screen.s-' + cur.name, null, kids);
    app.replaceChildren(el);
    return el;
  }
  function bar(title, left, ...right) {
    const el = h('header.bar', null, left, h('h1', null, title), right);
    let down = null, dragging = false;
    el.addEventListener('pointerdown', e => {
      if (e.button || e.target.closest('button')) return;
      down = { x: e.screenX, y: e.screenY };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    });
    el.addEventListener('pointermove', e => {
      if (!down) return;
      if (!dragging && Math.hypot(e.screenX - down.x, e.screenY - down.y) > 3) { dragging = true; post('dragStart'); }
      if (dragging) post('drag');
    });
    const end = () => { if (dragging) post('dragEnd'); down = null; dragging = false; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    return el;
  }
  const iconBtn = (ic, label, fn) => h('button.icon-btn', { type: 'button', 'aria-label': label, title: label, html: icon(ic), onclick: fn });
  const backBtn = fn => iconBtn(IC.back, 'Back', fn);

  function sheet(o) {
    closeSheet();
    const el = h('div.overlay', { role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title },
      h('div.sheet' + (o.cls ? '.' + o.cls : ''), null, o.top, h('h2', null, o.title), o.body, h('div.sheet-actions', null, o.actions)));
    const behind = app.firstChild;
    if (behind) behind.inert = true;
    app.append(el);
    overlay = { el, esc: o.esc, behind };
    const first = el.querySelector('.btn.primary') || el.querySelector('button');
    if (first) first.focus();
  }
  function closeSheet() {
    if (!overlay) return;
    overlay.el.remove();
    if (overlay.behind) overlay.behind.inert = false;
    overlay = null;
  }
  const btn = (label, fn, primary) => h('button.btn' + (primary ? '.primary' : ''), { type: 'button', onclick: fn }, label);

  function goBack() {
    if (cur.name === 'play') return cur.daily ? home() : lobby(cur.id);
    if (cur.name === 'home' || !cur.name) return post('close');
    home();
  }

  // ---------- Home

  function home(deal, justSolved) {
    enter('home');
    const ids = dailyIds(), done = state.daily.done;
    const solved = ids.filter(id => done[id]).length, nextId = ids.find(id => !done[id]), streak = streakNow();
    const dateText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    const animate = deal && !calm.matches;

    const cards = ids.map((id, i) => {
      const g = BS.games[id], s = done[id] || 0;
      const flipped = s && !animate && id !== justSolved;
      const c = h('button.card' + (flipped ? '.flipped' : ''), {
        type: 'button', style: `--i:${i};--tilt:${[-4, 2, -1, 3, -3][i]}deg;--c:${g.color}`,
        'aria-label': g.name + ', ' + g.cat + (s ? ', solved with ' + s + (s === 1 ? ' star' : ' stars') : ', not solved yet'),
        onclick: () => play(id, state.daily.lv[id], true)
      }, h('span.card-in', null,
        h('span.card-front', null, h('span.card-ico', { html: icon(g.icon) }), h('span.card-name', null, g.name)),
        h('span.card-back', null, h('span.card-stars', { html: starRow(s) }), h('span.card-name', null, g.name))));
      if (s && !flipped) setTimeout(() => c.classList.add('flipped'), animate ? 900 + i * 110 : 350);
      return c;
    });

    const all = CATS.flatMap(c => BS.order.filter(id => BS.games[id].cat === c)).map(id => {
      const g = BS.games[id], n = solvedCount(id);
      return h('button.game', { type: 'button', style: `--c:${g.color}`, onclick: () => lobby(id) },
        h('span.game-ico', { html: icon(g.icon) }),
        h('span.game-txt', null, h('b', null, g.name), h('small', null, n ? g.cat + ', level ' + nextLevel(id) : g.cat)));
    });

    show(
      bar('Brain Spark', h('span.logo', { html: icon(IC.spark) }),
        streak ? h('span.streak', { title: 'Days in a row with all five solved', html: icon(IC.star, 'star on') + '<span>' + streak + (streak === 1 ? ' day' : ' days') + '</span>' }) : null,
        iconBtn(IC.gear, 'Settings', settings),
        bridge ? iconBtn(IC.close, 'Close', () => post('close')) : null),
      h('div.scroll', null,
        h('section.daily', null,
          h('div.row', null, h('h2', null, 'Today’s five'), h('span.date', null, dateText)),
          h('div.hand' + (animate ? '.deal' : ''), null, cards),
          h('div.row.daily-foot', null,
            h('p', null, solved === 5 ? 'All five solved. See you tomorrow!' : solved ? solved + ' of 5 solved' : 'One puzzle of each kind, fresh every day.'),
            nextId ? btn(solved ? 'Play next' : 'Start', () => play(nextId, state.daily.lv[nextId], true), true) : null)),
        h('h2.all-title', null, 'All puzzles'),
        h('div.games', null, all)));
    if (deal && !calm.matches) sfx('flip');
  }

  // ---------- Game lobby

  function lobby(id, band) {
    enter('lobby', { id });
    const g = BS.games[id], next = nextLevel(id), p = prog(id), n = solvedCount(id);
    if (band == null) band = BS.band(next);
    const tabs = BS.BANDS.map((name, b) => h('button.tab', { type: 'button', role: 'tab', 'aria-selected': String(b === band), onclick: () => lobby(id, b) }, name));
    const levels = [...Array(100).keys()].map(k => {
      const L = band * 100 + k + 1, s = +p[L - 1];
      return h('button.lv' + (s ? '.won' : '') + (L === next && !s ? '.next' : ''), {
        type: 'button', 'aria-label': 'Level ' + L + (s ? ', ' + s + (s === 1 ? ' star' : ' stars') : ''), onclick: () => play(id, L)
      }, h('b', null, L), h('i', { html: s ? starRow(s) : '' }));
    });
    const el = show(
      bar(g.name, backBtn(home)),
      h('div.scroll', null,
        h('p.tagline', null, g.tagline),
        btn(n === BS.LEVELS ? 'Play level ' + next + ' again' : n ? 'Continue: level ' + next : 'Start: level 1', () => play(id, next), true),
        h('p.sum', null, n ? n + ' of ' + BS.LEVELS + ' solved, ' + starCount(id) + (starCount(id) === 1 ? ' star' : ' stars') : BS.LEVELS + ' puzzles, from gentle to expert. Start anywhere you like.'),
        h('div.tabs', { role: 'tablist', 'aria-label': 'Difficulty' }, tabs),
        h('div.levels', null, levels),
        h('h2', null, 'How to play'),
        h('ol.how', null, g.how.map(s => h('li', null, s)))));
    el.style.setProperty('--c', g.color);
  }

  // ---------- Play

  function play(id, level, daily) {
    const key = id + ':' + level + ':' + (daily ? state.daily.date : '');
    enter('play', { id, level, daily: !!daily });
    if (live && live.key === key && !live.over) { app.replaceChildren(live.el); return; }
    killLive();

    const g = BS.games[id];
    const puzzle = BS.puzzle(id, level, daily ? 'd' + state.daily.date : undefined);
    const allow = puzzle.allow || Infinity;
    let hints = 0, mistakes = 0;
    const me = live = { key, over: false, timers: [], api: null, el: null };
    const later = (fn, ms) => me.timers.push(setTimeout(fn, ms));

    const pips = h('span.pips', { role: 'img' });
    const progress = h('span.progress');
    const status = h('p.status', { role: 'status', 'aria-live': 'polite' });
    const board = h('div.board.g-' + id);
    const left = () => Math.max(1, 3 - hints - Math.floor(mistakes / allow));
    const drawPips = () => {
      const s = left();
      pips.innerHTML = starRow(s);
      pips.setAttribute('aria-label', 'Solve it now for ' + s + (s === 1 ? ' star' : ' stars'));
    };
    const ctx = {
      settings: state.settings, sfx,
      status: t => { status.textContent = t; },
      progress: (i, n, word) => { progress.textContent = (word || 'Round') + ' ' + i + ' of ' + n; },
      mistake: () => { mistakes++; drawPips(); },
      hintUsed: () => { hints++; drawPips(); },
      win: o => {
        if (me.over) return;
        me.over = true;
        const stars = Math.max(1, Math.min(3, (o && o.stars) || 3) - hints - Math.floor(mistakes / allow));
        later(() => won(id, level, !!daily, stars), 700);
      },
      fail: msg => {
        if (me.over) return;
        me.over = true;
        later(() => lost(id, level, !!daily, msg), 700);
      }
    };
    const hintBtn = h('button.btn.hint', { type: 'button', onclick: () => { hintBtn.blur(); if (!me.over && me.api.hint) me.api.hint(); } }, 'Hint');
    me.el = show(
      bar(g.name, backBtn(goBack), pips, hintBtn, iconBtn(IC.help, 'How to play', () => howTo(g))),
      h('div.sub', null, h('span', null, daily ? 'Today’s five, ' + BS.BANDS[BS.band(level)].toLowerCase() : 'Level ' + level + ', ' + BS.BANDS[BS.band(level)].toLowerCase()), progress),
      board, status);
    me.el.style.setProperty('--c', g.color);
    drawPips();
    me.api = g.mount(board, puzzle, ctx) || {};
    if (!state.seen[id]) { state.seen[id] = 1; save(); howTo(g); }
  }

  function howTo(g) {
    sheet({
      title: 'How to play ' + g.name, cls: 'how-sheet',
      body: h('ol.how', null, g.how.map(s => h('li', null, s))),
      actions: btn('Got it', closeSheet, true),
      esc: closeSheet
    });
  }

  function won(id, level, daily, stars) {
    if (cur.name !== 'play' || cur.id !== id || cur.level !== level) return;
    const g = BS.games[id];
    let actions, note, esc;
    if (daily) {
      const ids = dailyIds();
      const first = !state.daily.done[id];
      state.daily.done[id] = Math.max(state.daily.done[id] || 0, stars);
      const count = ids.filter(x => state.daily.done[x]).length, nextId = ids.find(x => !state.daily.done[x]);
      if (count === 5 && state.streak.last !== today()) state.streak = { last: today(), n: state.streak.last === yesterday() ? state.streak.n + 1 : 1 };
      const backHome = () => home(false, first ? id : null);
      note = count === 5 ? 'That’s all five for today. ' + (state.streak.n > 1 ? state.streak.n + ' days in a row!' : 'Come back tomorrow for five more.') : count + ' of today’s five solved.';
      actions = nextId ? [btn('Next of today’s five', () => play(nextId, state.daily.lv[nextId], true), true), btn('Back to the table', backHome)]
        : [btn('Back to the table', backHome, true)];
      esc = backHome;
    } else {
      record(id, level, stars);
      note = g.name + ', level ' + level;
      actions = level < BS.LEVELS ? [btn('Next puzzle', () => play(id, level + 1), true), btn('All levels', () => lobby(id))] : [btn('All levels', () => lobby(id), true)];
      esc = () => lobby(id);
    }
    save();
    sfx('win');
    confetti();
    const titles = ['Nicely done', 'Well played', 'Lovely work', 'Beautifully solved'];
    sheet({
      title: titles[(level + stars) % titles.length], cls: 'win',
      top: h('div.win-stars', { role: 'img', 'aria-label': stars + (stars === 1 ? ' star' : ' stars'), html: starRow(stars, 'stamp') }),
      body: h('p', null, note), actions, esc
    });
  }

  function lost(id, level, daily, msg) {
    if (cur.name !== 'play' || cur.id !== id || cur.level !== level) return;
    sheet({
      title: 'So close', cls: 'lost',
      body: h('p', null, msg + ' Would you like another go?'),
      actions: [btn('Try again', () => { killLive(); play(id, level, daily); }, true), btn('Back', () => { killLive(); goBack(); })],
      esc: () => { killLive(); goBack(); }
    });
  }

  // ---------- Settings

  function settings() {
    enter('settings');
    const s = state.settings;
    const set = (k, v) => { s[k] = v; save(); applySettings(); settings(); };
    const toggle = (label, on, fn, note) => h('div.set-row', null,
      h('span.set-label', null, label, note ? h('small', null, note) : null),
      h('button.switch', { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label, onclick: fn }, h('i')));
    const choice = (label, opts, value, fn, cls) => h('div.set-block', null,
      h('span.set-label', null, label),
      h('div.seg' + (cls ? '.' + cls : ''), { role: 'radiogroup', 'aria-label': label }, opts.map(o =>
        h('button', { type: 'button', role: 'radio', 'aria-checked': String(o[0] === value), 'data-v': o[0], onclick: () => fn(o[0]) }, o[1]))));

    show(
      bar('Settings', backBtn(home)),
      h('div.scroll', null,
        choice('Table', [['green', 'Green felt'], ['blue', 'Midnight'], ['burgundy', 'Burgundy']], s.table, v => set('table', v), 'swatches'),
        choice('Size', [[1, 'Standard'], [1.15, 'Large'], [1.3, 'Extra large']], s.size, v => set('size', v)),
        toggle('Sounds', s.sounds, () => { s.sounds = !s.sounds; save(); settings(); sfx('good'); }),
        toggle('Show Sudoku mistakes as I go', s.sudokuMistakes, () => set('sudokuMistakes', !s.sudokuMistakes), 'Wrong digits are marked straight away.'),
        bridge ? toggle('Open at login', login, () => post('loginItem', { on: !login }), 'Brain Spark waits in the menu bar.') : null,
        h('div.set-foot', null,
          btn('Reset progress', askReset),
          bridge ? btn('Quit Brain Spark', () => post('quit')) : null),
        h('p.version', null, 'Brain Spark ' + ((NATIVE && NATIVE.version) || '1.0.0') + '. ' + BS.order.length * BS.LEVELS + ' puzzles, no timers.')));
  }
  function askReset() {
    sheet({
      title: 'Reset all progress?',
      body: h('p', null, 'This erases every star, your Today’s five results and your streak. It can’t be undone.'),
      actions: [btn('Keep my progress', closeSheet, true), btn('Erase everything', () => {
        const keep = state.settings;
        killLive();
        state = fresh(); state.settings = keep;
        save(); settings();
      })],
      esc: closeSheet
    });
  }

  // ---------- Keyboard and native hooks

  document.addEventListener('keydown', e => {
    if (e.metaKey && e.key === 'q') return post('quit');
    if (e.metaKey && e.key === 'w') return post('close');
    if (e.key === 'Escape') {
      e.preventDefault();
      if (overlay) { if (overlay.esc) overlay.esc(); } else goBack();
      return;
    }
    if (overlay || e.altKey || cur.name !== 'play' || !live || live.over || !live.api.key) return;
    if (live.api.key(e)) e.preventDefault();
  });
  document.addEventListener('contextmenu', e => e.preventDefault());

  BS.onShow = () => {
    if (cur.name === 'home') home(true);
    else if (state.daily.date !== today() && cur.name !== 'play') home(true);
  };
  BS.openDaily = () => home(true);
  BS.setLogin = on => { login = !!on; if (cur.name === 'settings') settings(); };
  BS.nav = { home, lobby, play, settings };

  applySettings();
  home(true);
})();
