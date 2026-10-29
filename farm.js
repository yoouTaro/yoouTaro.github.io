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
  const C = { x: '#2a1d14', H: '#e3b55a', h: '#a8452f', d: '#3b2618', k: '#f0c29a', K: '#d9a37a', e: '#1b1410', t: '#f3efe4', u: '#3d6fa8', b: '#5a3d24', s: '#5a3d24', g: '#5f8a3a', l: '#8ab44f', o: '#e07b2e', w: '#efe9dc', p: '#8a4f9e', r: '#d4423a', y: '#f2c94c' };
  const SPRITES = {
    seed:   ['........', '........', '........', '........', '........', '........', '..s..s..', '........'],
    sprout: ['........', '........', '........', '........', '...l.l..', '....g...', '....g...', '........'],
    leafy:  ['........', '........', '..l...l.', '...lgl..', '..lgggl.', '....g...', '....g...', '........'],
    carrot: ['..l.l.l.', '...lgl..', '....g...', '...ooo..', '...ooo..', '....o...', '....o...', '........'],
    turnip: ['...l.l..', '....g...', '...www..', '..wwwww.', '..ppwpp.', '...ppp..', '....p...', '........'],
    berry:  ['..l..l..', '...gg...', '..rrrr..', '.rryrrr.', '.rrrryr.', '..ryrr..', '...rr...', '........'],
    taro:   ['......xxxx......', '....xxHHHHxx....', '...xHHHHHHHHx...', '.xxHHHHHHHHHHxx.', 'xHHHHHHHHHHHHHHx', '.xxhhhhhhhhhhxx.', '..xddkkkkkkddx..', '..xdkkekkekkdx..', '..xkkkkkkkkkkx..', '...xkkkKKkkkx...', '..xttuuuuuuttx..', '.xkttuuuuuuttkx.', '.xkxuuuuuuuxkx..', '...xuuuxxuuux...', '...xbbbx.xbbbx..', '...xxxxx.xxxxx..'],
  };
  const CROPS = ['carrot', 'turnip', 'berry'];

  const svg = (rows) => {
    let out = '';
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== '.') out += `<rect x="${x}" y="${y}" width="1" height="1" fill="${C[ch]}"/>`;
    }));
    return `<svg viewBox="0 0 ${rows[0].length} ${rows.length}" shape-rendering="crispEdges" aria-hidden="true">${out}</svg>`;
  };
  const SWORD = svg(['.w.', '.w.', '.w.', '.w.', '.w.', 'yyy', '.b.', '.b.']);
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
    swish: () => blip([[1400, 0.03], [900, 0.03], [500, 0.05]], 'sawtooth', 0.03),
    boom: () => {
      if (muted) return;
      ctx ||= new (window.AudioContext || window.webkitAudioContext)();
      // A short burst of noise, like a pop and crackle.
      const len = ctx.sampleRate * 0.6;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      g.gain.value = 0.18;
      src.buffer = buf;
      src.connect(g).connect(ctx.destination);
      src.start();
    },
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
    taro.classList.remove('slash'); void taro.offsetWidth; taro.classList.add('slash');
    tiles[i].classList.remove('chop'); void tiles[i].offsetWidth; tiles[i].classList.add('chop');
    if (!quiet) { sfx.swish(); setTimeout(sfx.harvest, 90); }
    showCount();
    if (state.harvested % 10 === 0) fireworks();
  }

  // Every 10th harvest: pixel fireworks over the whole page.
  function fireworks() {
    const cv = document.createElement('canvas');
    cv.className = 'fireworks';
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.width = innerWidth * dpr;
    cv.height = innerHeight * dpr;
    document.body.append(cv);
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    const COLORS = ['#e07b2e', '#f2c94c', '#d4423a', '#8ab44f', '#3d6fa8', '#8a4f9e'];
    const parts = [];
    const burst = (x, y) => {
      const col = COLORS[Math.floor(Math.random() * COLORS.length)];
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * Math.PI * 2, v = 3 + Math.random() * 5;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, col });
      }
      sfx.boom();
    };
    const W = innerWidth, H = innerHeight;
    [0, 350, 700, 1000, 1300].forEach((ms) => setTimeout(() => burst(W * (0.15 + Math.random() * 0.7), H * (0.15 + Math.random() * 0.4)), ms));
    const start = performance.now();
    (function frame(now) {
      g.clearRect(0, 0, W, H);
      parts.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.vx *= 0.985; p.life -= 0.012;
        if (p.life <= 0) return;
        g.globalAlpha = p.life;
        g.fillStyle = p.col;
        g.fillRect(Math.round(p.x), Math.round(p.y), 5, 5);
      });
      if (now - start < 3200) requestAnimationFrame(frame); else cv.remove();
    })(start);
  }

  function showCount() {
    countEl.textContent = `${state.harvested} harvested`;
  }

  // Taro walks tile to tile and picks whatever is ripe where he stands.
  const taro = document.createElement('div');
  taro.className = 'taro';
  taro.innerHTML = `<div class="taro-body">${art.taro}<span class="sword">${SWORD}</span><span class="swoosh"></span></div><span class="taro-name">Taro</span>`;
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
