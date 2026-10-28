(() => {
  const field = document.querySelector('.field');
  if (!field) return;
  const countEl = document.querySelector('.harvest');
  const soundBtn = document.querySelector('.sound');

  const SIZE = 4;
  const TILES = SIZE * SIZE;
  const STAGE_MS = 3000; // seed → sprout → leafy → ripe
  const REPLANT_MS = 1200; // empty soil gets a new seed after this
  const KEY = 'yt-farm-v3';

  // 8×8 pixel sprites. Each letter is a colour, "." is empty.
  const C = { h: '#2a1d14', k: '#e8b48a', e: '#141210', t: '#3d6fa8', n: '#3a3530', b: '#5a3d24', s: '#5a3d24', g: '#5f8a3a', l: '#8ab44f', o: '#e07b2e', w: '#efe9dc', p: '#8a4f9e', r: '#d4423a', y: '#f2c94c' };
  const SPRITES = {
    seed:   ['........', '........', '........', '........', '........', '........', '..s..s..', '........'],
    sprout: ['........', '........', '........', '........', '...l.l..', '....g...', '....g...', '........'],
    leafy:  ['........', '........', '..l...l.', '...lgl..', '..lgggl.', '....g...', '....g...', '........'],
    carrot: ['..l.l.l.', '...lgl..', '....g...', '...ooo..', '...ooo..', '....o...', '....o...', '........'],
    turnip: ['...l.l..', '....g...', '...www..', '..wwwww.', '..ppwpp.', '...ppp..', '....p...', '........'],
    berry:  ['..l..l..', '...gg...', '..rrrr..', '.rryrrr.', '.rrrryr.', '..ryrr..', '...rr...', '........'],
    taro:   ['..hhhh..', '.hhhhhh.', '.hkkkkh.', '..kkkek.', '..tttt..', '.kttttk.', '..nnnn..', '..b..b..'],
  };
  const CROPS = ['carrot', 'turnip', 'berry'];

  const svg = (rows) => {
    let out = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${C[ch]}"/>`;
    }));
    return `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
  };
  const art = Object.fromEntries(Object.entries(SPRITES).map(([k, v]) => [k, svg(v)]));

  // Sound: tiny chiptune blips made with Web Audio, no files.
  let ctx = null;
  let muted = localStorage.getItem('yt-farm-muted') === '1';
  function blip(notes, type = 'square', vol = 0.06) {
    if (muted) return;
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    let t = ctx.currentTime;
    notes.forEach(([freq, dur]) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.8;
    });
  }
  const sfx = {
    step: () => blip([[180, 0.05]], 'triangle', 0.08),
    harvest: () => blip([[660, 0.08], [880, 0.08], [1320, 0.16]]),
    bump: () => blip([[90, 0.08]], 'square', 0.04),
  };
  function showSound() {
    soundBtn.textContent = muted ? 'Sound off' : 'Sound on';
    soundBtn.setAttribute('aria-pressed', String(!muted));
  }
  soundBtn.addEventListener('click', () => {
    muted = !muted;
    localStorage.setItem('yt-farm-muted', muted ? '1' : '0');
    showSound();
    sfx.harvest();
  });
  showSound();

  // Field state survives reloads.
  const newCrop = (at = Date.now()) => ({ crop: CROPS[Math.floor(Math.random() * CROPS.length)], at });
  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state || !Array.isArray(state.tiles) || state.tiles.length !== TILES) {
    // Start with a field already growing at mixed stages.
    state = { harvested: 0, tiles: Array.from({ length: TILES }, () => newCrop(Date.now() - Math.random() * STAGE_MS * 4)) };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const stageOf = (t) => {
    if (t.empty) return '';
    const n = Math.floor((Date.now() - t.at) / STAGE_MS);
    return n >= 3 ? t.crop : ['seed', 'sprout', 'leafy'][n];
  };
  const ripe = (i) => CROPS.includes(stageOf(state.tiles[i]));

  const tiles = state.tiles.map((_, i) => {
    const d = document.createElement('div');
    d.className = 'tile';
    d.addEventListener('click', () => walkTo(i));
    field.append(d);
    return d;
  });

  function paint(i) {
    const t = state.tiles[i];
    // Harvested soil gets a fresh seed on its own.
    if (t.empty && Date.now() - t.at > REPLANT_MS) state.tiles[i] = newCrop();
    const stage = stageOf(state.tiles[i]);
    const d = tiles[i];
    if (d.dataset.stage === stage) return;
    d.dataset.stage = stage;
    d.classList.toggle('ready', CROPS.includes(stage));
    d.innerHTML = stage ? art[stage] : '';
  }

  function harvest(i, quiet) {
    if (!ripe(i)) return;
    state.tiles[i] = { empty: true, at: Date.now() };
    state.harvested += 1;
    save();
    paint(i);
    const s = document.createElement('span');
    s.className = 'pop';
    s.textContent = '+1';
    tiles[i].append(s);
    setTimeout(() => s.remove(), 700);
    if (!quiet) sfx.harvest();
    showCount();
  }

  function showCount() {
    countEl.textContent = `${state.harvested} harvested`;
  }

  // Taro walks tile to tile and picks whatever is ripe where he stands.
  const taro = document.createElement('div');
  taro.className = 'taro';
  taro.innerHTML = art.taro + '<span class="taro-name">Taro</span>';
  field.append(taro);
  let at = 0;

  function place(step) {
    const d = tiles[at];
    taro.style.width = `${d.offsetWidth}px`;
    taro.style.height = `${d.offsetHeight}px`;
    taro.style.transform = `translate(${d.offsetLeft}px, ${d.offsetTop - d.offsetHeight * 0.18}px)`;
    if (step) { taro.classList.remove('step'); void taro.offsetWidth; taro.classList.add('step'); }
  }
  function move(dx, dy, byPlayer) {
    const x = at % SIZE, y = Math.floor(at / SIZE);
    const nx = Math.min(SIZE - 1, Math.max(0, x + dx)), ny = Math.min(SIZE - 1, Math.max(0, y + dy));
    if (dx) taro.classList.toggle('left', dx < 0);
    const next = ny * SIZE + nx;
    if (next === at) { if (byPlayer) sfx.bump(); return; }
    at = next;
    place(true);
    if (byPlayer) sfx.step();
    harvest(at, !byPlayer);
  }
  // Clicking a tile walks Taro there one step at a time.
  let path = null;
  function walkTo(i) {
    lastInput = Date.now();
    clearInterval(path);
    const go = () => {
      const dx = (i % SIZE) - (at % SIZE), dy = Math.floor(i / SIZE) - Math.floor(at / SIZE);
      if (!dx && !dy) { clearInterval(path); harvest(at); return; }
      if (dx) move(Math.sign(dx), 0, true); else move(0, Math.sign(dy), true);
    };
    go();
    path = setInterval(go, 170);
  }

  const KEYS = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };
  let visible = false;
  let lastInput = 0;
  addEventListener('keydown', (e) => {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (KEYS[k]) {
      e.preventDefault();
      lastInput = Date.now();
      clearInterval(path);
      move(...KEYS[k], true);
    } else if (k === 'e' || k === ' ') {
      e.preventDefault();
      lastInput = Date.now();
      harvest(at);
    }
  });
  new ResizeObserver(() => place(false)).observe(field);

  tiles.forEach((_, i) => paint(i));
  showCount();
  place(false);

  // When nobody is playing, Taro wanders on his own (quietly).
  const DIRS = [[0, -1], [-1, 0], [0, 1], [1, 0]];
  let wanderAt = 0;
  let timer = null;
  const tick = () => {
    tiles.forEach((_, i) => paint(i));
    if (Date.now() - lastInput < 4000 || Date.now() < wanderAt) return;
    wanderAt = Date.now() + 900 + Math.random() * 900;
    move(...DIRS[Math.floor(Math.random() * 4)], false);
  };
  // Only tick while the field is on screen.
  new IntersectionObserver(([e]) => {
    clearInterval(timer);
    visible = e.isIntersecting;
    if (visible) { tick(); timer = setInterval(tick, 300); }
  }).observe(field);
})();
