(() => {
  const field = document.querySelector('.field');
  if (!field) return;
  const countEl = document.querySelector('.harvest');

  const TILES = 24;
  const STAGE_MS = 5000; // seed → sprout → leafy → ready
  const KEY = 'yt-farm-v1';

  // 8×8 pixel sprites. Each letter is a colour, "." is empty.
  const C = { s: '#5a3d24', g: '#5f8a3a', l: '#8ab44f', o: '#e07b2e', w: '#efe9dc', p: '#8a4f9e', r: '#d4423a', y: '#f2c94c' };
  const SPRITES = {
    seed:   ['........', '........', '........', '........', '........', '........', '..s..s..', '........'],
    sprout: ['........', '........', '........', '........', '...l.l..', '....g...', '....g...', '........'],
    leafy:  ['........', '........', '..l...l.', '...lgl..', '..lgggl.', '....g...', '....g...', '........'],
    carrot: ['..l.l.l.', '...lgl..', '....g...', '...ooo..', '...ooo..', '....o...', '....o...', '........'],
    turnip: ['...l.l..', '....g...', '...www..', '..wwwww.', '..ppwpp.', '...ppp..', '....p...', '........'],
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
    b.addEventListener('click', () => act(i));
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

  buttons.forEach((_, i) => paint(i));
  showCount();

  // Only tick while the field is on screen.
  let timer = null;
  const tick = () => buttons.forEach((_, i) => paint(i));
  new IntersectionObserver(([e]) => {
    clearInterval(timer);
    if (e.isIntersecting) { tick(); timer = setInterval(tick, 500); }
  }).observe(field);
})();
