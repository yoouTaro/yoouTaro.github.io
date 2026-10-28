(() => {
  const field = document.querySelector('.field');
  if (!field) return;
  const countEl = document.querySelector('.harvest');

  const TILES = 24;
  const STAGE_MS = 5000; // seed → sprout → leafy → ready
  const KEY = 'yt-farm-v1';

  // 8×8 pixel sprites. Each letter is a colour, "." is empty.
  const C = { h: '#2a1d14', k: '#e8b48a', e: '#141210', t: '#3d6fa8', n: '#3a3530', b: '#5a3d24', s: '#5a3d24', g: '#5f8a3a', l: '#8ab44f', o: '#e07b2e', w: '#efe9dc', p: '#8a4f9e', r: '#d4423a', y: '#f2c94c' };
  const SPRITES = {
    seed:   ['........', '........', '........', '........', '........', '........', '..s..s..', '........'],
    sprout: ['........', '........', '........', '........', '...l.l..', '....g...', '....g...', '........'],
    leafy:  ['........', '........', '..l...l.', '...lgl..', '..lgggl.', '....g...', '....g...', '........'],
    carrot: ['..l.l.l.', '...lgl..', '....g...', '...ooo..', '...ooo..', '....o...', '....o...', '........'],
    turnip: ['...l.l..', '....g...', '...www..', '..wwwww.', '..ppwpp.', '...ppp..', '....p...', '........'],
    taro:   ['..hhhh..', '.hhhhhh.', '.hkkkkh.', '..kkkek.', '..tttt..', '.kttttk.', '..nnnn..', '..b..b..'],
    berry:  ['..l..l..', '...gg...', '..rrrr..', '.rryrrr.', '.rrrryr.', '..ryrr..', '...rr...', '........'],
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

  let state;
  try { state = JSON.parse(localStorage.getItem(KEY)); } catch { state = null; }
  if (!state || !Array.isArray(state.tiles) || state.tiles.length !== TILES) {
    state = { harvested: 0, tiles: Array(TILES).fill(null) };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

  const stageOf = (t) => {
    const n = Math.floor((Date.now() - t.at) / STAGE_MS);
    return n >= 3 ? t.crop : ['seed', 'sprout', 'leafy'][n];
  };

  const buttons = state.tiles.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.addEventListener('click', () => { if (i !== at) { taro.classList.toggle('left', i % cols() < at % cols()); at = i; place(true); } act(i); });
    field.append(b);
    return b;
  });

  function paint(i) {
    const t = state.tiles[i];
    const b = buttons[i];
    const stage = t ? stageOf(t) : '';
    if (b.dataset.stage === stage) return;
    b.dataset.stage = stage;
    b.classList.toggle('ready', CROPS.includes(stage));
    b.innerHTML = stage ? art[stage] : '';
    b.setAttribute('aria-label', !t ? 'Empty soil, plant a seed'
      : CROPS.includes(stage) ? `Ripe ${stage}, harvest it` : `Growing (${stage})`);
  }

  function act(i) {
    const t = state.tiles[i];
    if (!t) {
      state.tiles[i] = { crop: CROPS[Math.floor(Math.random() * CROPS.length)], at: Date.now() };
    } else if (CROPS.includes(stageOf(t))) {
      state.tiles[i] = null;
      state.harvested += 1;
    } else return;
    save();
    paint(i);
    if (!state.tiles[i]) pop(buttons[i]);
    showCount();
  }

  function pop(b) {
    const s = document.createElement('span');
    s.className = 'pop';
    s.textContent = '+1';
    b.append(s);
    setTimeout(() => s.remove(), 700);
  }

  function showCount() {
    const n = state.harvested;
    countEl.textContent = n ? `${n} harvested` : 'Nothing harvested yet';
  }

  // Taro walks tile to tile.
  const taro = document.createElement('div');
  taro.className = 'taro';
  taro.innerHTML = art.taro + '<span class="taro-name">Taro</span>';
  field.append(taro);
  let at = 0;

  const cols = () => getComputedStyle(field).gridTemplateColumns.split(' ').length;
  function place(step) {
    const b = buttons[at];
    taro.style.width = `${b.offsetWidth}px`;
    taro.style.height = `${b.offsetHeight}px`;
    taro.style.transform = `translate(${b.offsetLeft}px, ${b.offsetTop - b.offsetHeight * 0.18}px)`;
    buttons.forEach((x, i) => x.classList.toggle('here', i === at));
    if (step) { taro.classList.remove('step'); void taro.offsetWidth; taro.classList.add('step'); }
  }
  function move(dx, dy) {
    const c = cols(), x = at % c, y = Math.floor(at / c), rows = Math.ceil(TILES / c);
    const nx = Math.min(c - 1, Math.max(0, x + dx)), ny = Math.min(rows - 1, Math.max(0, y + dy));
    if (dx) taro.classList.toggle('left', dx < 0);
    const next = ny * c + nx;
    if (next === at || next >= TILES) return;
    at = next;
    place(true);
  }

  const KEYS = { w: [0, -1], a: [-1, 0], s: [0, 1], d: [1, 0], arrowup: [0, -1], arrowleft: [-1, 0], arrowdown: [0, 1], arrowright: [1, 0] };
  let visible = false;
  addEventListener('keydown', (e) => {
    if (!visible || e.metaKey || e.ctrlKey || e.altKey || e.target.closest?.('input, textarea, [contenteditable]')) return;
    const k = e.key.toLowerCase();
    if (KEYS[k]) { e.preventDefault(); move(...KEYS[k]); }
    else if (k === 'e' || k === ' ' || (k === 'enter' && !e.target.closest?.('a, button'))) { e.preventDefault(); act(at); }
  });
  new ResizeObserver(() => place(false)).observe(field);

  buttons.forEach((_, i) => paint(i));
  showCount();
  place(false);

  // Only tick while the field is on screen.
  let timer = null;
  const tick = () => buttons.forEach((_, i) => paint(i));
  new IntersectionObserver(([e]) => {
    clearInterval(timer);
    visible = e.isIntersecting;
    if (visible) { tick(); timer = setInterval(tick, 500); }
  }).observe(field);
})();
