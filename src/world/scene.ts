import { worldEntries, type Project, type SignInfo, signFor } from '../content';
import { neighborhoodFor, type Category } from '../neighborhoods';
import { asset, esc } from '../util';

export interface SceneCallbacks {
  /** walk into the subway to go back to the city map */
  exit: () => void;
  open: (entry: Project) => void;
  sign: (info: SignInfo) => void;
}
export interface SceneHandle { destroy(): void }

const BW = 560, BH = 420; // block size
const AW = 170, SH = 150; // avenue (vertical road) width, street (horizontal road) height
const BUILD_W = 230;
const M = 300; // backdrop margin around the streets, so the screen never shows empty space

/** viewBox heights of the 3D building sprites (all are 282 wide) */
const SPRITE_H: Record<string, number> = {
  arcade: 260, lab: 260, bank: 260, gallery: 260, warehouse: 280, office: 300, flatiron: 320, hall: 260, bodega: 240, gym: 260, pizza: 260,
};
const SPRITES = Object.keys(SPRITE_H);
/** standalone props: native size and on-screen width */
const PROPS: Record<string, { vbw: number; vbh: number; w: number }> = {
  'bike-rack': { vbw: 260, vbh: 130, w: 330 },
  picnic: { vbw: 240, vbh: 140, w: 330 },
  bridge: { vbw: 340, vbh: 240, w: 340 },
};

interface Landmark {
  title: string; sub: string; icon: string; color: string;
  x: number; y: number; node: HTMLElement;
  entry?: Project; sign?: SignInfo; exit?: boolean; action?: string;
}

let playerSvg: Promise<string> | null = null;
const loadPlayer = () => (playerSvg ??= fetch(asset('art-v3/player.svg')).then((r) => r.text()));

const px = (n: number) => `${Math.round(n)}px`;
const zOf = (y: number) => String(Math.round(y + M + 10));

function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function actionLabel(a?: string): string {
  if (!a) return '';
  if (a === 'bike') return '🚲 F: ride';
  if (a === 'reps') return '💪 F: lift';
  if (a === 'photo') return '📸 F: photo';
  if (a.startsWith('snack:')) return `${a.slice(6)} F: snack`;
  return '';
}

export function createScene(root: HTMLElement, category: Category, cb: SceneCallbacks): SceneHandle {
  const nb = neighborhoodFor(category);
  const entries = worldEntries(category);
  const count = Math.max(entries.length, 1);
  const rows = count <= 3 ? 1 : 2;
  const cols = Math.ceil(count / rows);
  const W = AW * (cols + 1) + BW * cols;
  const H = SH * (rows + 1) + BH * rows;
  const r = rng(category.length * 97 + count);

  const stage = document.createElement('div');
  stage.className = 'scene';
  const world = document.createElement('div');
  world.className = 'scene-world';
  world.style.cssText = `width:${W}px;height:${H}px;`;
  stage.appendChild(world);
  const prompt = document.createElement('div');
  prompt.className = 'scene-prompt';
  prompt.style.display = 'none';
  const toastEl = document.createElement('div');
  toastEl.className = 'scene-toast';
  stage.append(prompt, toastEl);
  root.appendChild(stage);

  const el = (cls: string, css: Record<string, string>, parent: HTMLElement = world) => {
    const d = document.createElement('div');
    d.className = cls;
    Object.assign(d.style, css);
    parent.appendChild(d);
    return d;
  };

  /* ---------- ground ---------- */
  const AVE = Array.from({ length: cols + 1 }, (_, i) => i * (BW + AW));
  const ST = Array.from({ length: rows + 1 }, (_, j) => j * (BH + SH));
  world.style.background = '#5b5566';
  AVE.forEach((x) => el('abs', { left: px(x + AW / 2 - 3), top: '0', width: '6px', height: px(H), background: 'repeating-linear-gradient(180deg,#f6c453 0 30px,transparent 30px 60px)' }));
  ST.forEach((y) => el('abs', { top: px(y + SH / 2 - 3), left: '0', width: px(W), height: '6px', background: 'repeating-linear-gradient(90deg,#fdf6ec 0 30px,transparent 30px 60px)', opacity: '.85' }));
  AVE.forEach((x) => ST.forEach((y) => el('abs', { left: px(x), top: px(y), width: px(AW), height: px(SH), background: '#5b5566' })));

  const bars = (dir: string) => `repeating-linear-gradient(${dir},#fdf6ec 0 8px,transparent 8px 18px)`;
  AVE.forEach((x) => ST.forEach((y) => {
    if (x - 40 >= 0) el('abs', { left: px(x - 40), top: px(y + 4), width: '34px', height: px(SH - 8), background: bars('180deg'), opacity: '.85' });
    if (x + AW + 40 <= W) el('abs', { left: px(x + AW + 6), top: px(y + 4), width: '34px', height: px(SH - 8), background: bars('180deg'), opacity: '.85' });
    if (y - 40 >= 0) el('abs', { left: px(x + 4), top: px(y - 40), width: px(AW - 8), height: '34px', background: bars('90deg'), opacity: '.85' });
    if (y + SH + 40 <= H) el('abs', { left: px(x + 4), top: px(y + SH + 6), width: px(AW - 8), height: '34px', background: bars('90deg'), opacity: '.85' });
  }));

  const blockPos = (idx: number) => ({ x: AVE[idx % cols] + AW, y: ST[Math.floor(idx / cols)] + SH });
  const tiles = `repeating-linear-gradient(90deg,transparent 0 59px,rgba(0,0,0,.05) 59px 61px),${nb.lot}`;
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    const idx = rr * cols + c;
    const entry = entries[idx];
    const empty = idx >= entries.length;
    const bx = AVE[c] + AW, by = ST[rr] + SH;
    const blk = el('abs', { left: px(bx), top: px(by), width: px(BW), height: px(BH), borderRadius: '16px', background: '#e6dcc8', boxShadow: 'inset 0 0 0 4px #cfc8d6, 0 8px 0 rgba(59,47,58,.28)' });
    el('abs', { left: '22px', top: '22px', right: '22px', bottom: '22px', borderRadius: '10px', background: empty || entry?.park ? '#a5cf9a' : tiles }, blk);
  }
  const roadLabel = (x: number, y: number, t: string, vertical = false) => { el(`road-label${vertical ? ' v' : ''}`, { left: px(x), top: px(y) }).textContent = t; };
  ST.forEach((y, j) => { roadLabel(220 + j * 130, y + 14, ['W 57TH ST', 'W 42ND ST', 'W 34TH ST'][j % 3]); });
  AVE.forEach((x, i) => { roadLabel(x + 22, 200 + i * 60, ['8TH AVE', 'BROADWAY', '5TH AVE', '3RD AVE'][i % 4], true); });

  /* ---------- entities ---------- */
  const blockers: number[][] = [];
  const landmarks: Landmark[] = [];
  function ent(src: string, vbw: number, vbh: number, left: number, bottom: number, w: number, block?: number[], css = '') {
    const h = (w * vbh) / vbw;
    const d = el('ent', { left: px(left), top: px(bottom - h), width: px(w), height: px(h), zIndex: zOf(bottom) });
    const img = document.createElement('img');
    img.src = asset(src); img.alt = ''; img.draggable = false;
    if (css) img.style.filter = css;
    d.appendChild(img);
    if (block) blockers.push(block);
    return { d, top: bottom - h, h, bottom };
  }
  const tree = (l: number, b: number, w = 96, solid = true) =>
    ent('art/props/tree.svg', 110, 140, l, b, w, solid ? [l + w * 0.4, b - 16, l + w * 0.6, b] : undefined);

  entries.forEach((entry, idx) => {
    const { x: bx, y: by } = blockPos(idx);
    const bottom = by + BH - 70;
    let node: HTMLElement, tagTop: number, tagLeft: number, lx: number;

    if (entry.prop && PROPS[entry.prop]) {
      const p = PROPS[entry.prop];
      const left = bx + (BW - p.w) / 2;
      const e = ent(`art/props/${entry.prop}.svg`, p.vbw, p.vbh, left, bottom, p.w, [left + 14, bottom - 36, left + p.w - 14, bottom - 4]);
      node = e.d; tagTop = e.top - 12; tagLeft = left + p.w * 0.5; lx = left + p.w * 0.5;
    } else {
      const sprite = entry.building && SPRITE_H[entry.building] ? entry.building : nb.building;
      const left = bx + (BW - BUILD_W) / 2;
      const hue = !entry.building && idx > 0 ? ((idx * 41) % 60) - 30 : 0;
      const e = ent(`art-v3/buildings/${sprite}.svg`, 282, SPRITE_H[sprite] ?? nb.buildingH, left, bottom, BUILD_W, [left + 6, bottom - 58, left + BUILD_W - 6, bottom - 4], hue ? `hue-rotate(${hue}deg)` : '');
      node = e.d; tagTop = e.top - 16; tagLeft = left + BUILD_W * 0.45; lx = left + BUILD_W * 0.43;
    }
    const tag = el('tag', { left: px(tagLeft), top: px(tagTop) });
    tag.style.setProperty('--c', nb.color);
    tag.textContent = entry.title;
    landmarks.push({ title: entry.title, sub: nb.label, icon: nb.icon, color: nb.color, x: lx, y: bottom + 12, node, entry, action: entry.action });

    // greenery and street furniture around each lot
    const seed = (idx * 53 + 17) % 100;
    tree(bx + 40 + (seed % 24), by + 230, 100);
    tree(bx + BW - 140 - (seed % 20), by + 245, 96);
    if (entry.park) { tree(bx + 120, by + 160, 90); tree(bx + BW - 200, by + 150, 90); }
    else ent('art/props/bench.svg', 110, 70, bx + BW - 190, by + BH - 50, 82, [bx + BW - 186, by + BH - 70, bx + BW - 112, by + BH - 50]);
    ent('art/props/hydrant.svg', 50, 64, bx + BW - 70, by + BH - 4, 28, [bx + BW - 66, by + BH - 16, bx + BW - 46, by + BH - 4]);
  });

  // trees fill any empty park blocks
  for (let idx = entries.length; idx < rows * cols; idx++) {
    const { x: bx, y: by } = blockPos(idx);
    [[80, 210], [250, 190], [420, 240], [140, 340], [340, 360]].forEach(([dx, dy]) => tree(bx + dx, by + dy, 96));
  }

  // corner lamps
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    const bx = AVE[c] + AW, by = ST[rr] + SH;
    [[bx + 8, by + BH - 6], [bx + BW - 40, by + BH - 6]].forEach(([l, b]) =>
      ent('art/props/streetlamp.svg', 60, 150, l, b, 34, [l + 12, b - 10, l + 22, b]));
  }

  // subway entrance (your way back to the NYC map) and the neighborhood sign, by the spawn point
  const sw = blockPos((rows - 1) * cols);
  const subway = ent('art/props/subway-entrance.svg', 140, 150, sw.x + 60, sw.y + BH + 2, 112, [sw.x + 70, sw.y + BH - 24, sw.x + 162, sw.y + BH + 2]);
  landmarks.push({ title: 'NYC map', sub: 'Take the subway back', icon: '🚇', color: '#2f7d5b', x: sw.x + 116, y: sw.y + BH + 18, node: subway.d, exit: true });
  const sTag = el('tag', { left: px(sw.x + 116), top: px(subway.top - 12) });
  sTag.style.setProperty('--c', '#2f7d5b');
  sTag.textContent = '🚇 NYC map';

  const signInfo = signFor(category);
  if (signInfo) {
    const sx = sw.x + 215;
    const sign = ent('art/props/sign.svg', 110, 150, sx, sw.y + BH + 4, 80, [sx + 24, sw.y + BH - 12, sx + 56, sw.y + BH + 4]);
    landmarks.push({ title: 'Neighborhood guide', sub: nb.name, icon: 'ℹ️', color: nb.color, x: sx + 40, y: sw.y + BH + 20, node: sign.d, sign: signInfo });
    const t = el('tag', { left: px(sx + 40), top: px(sign.top - 6) });
    t.style.setProperty('--c', nb.color);
    t.textContent = `ℹ️ ${nb.name} guide`;
  }

  /* ---------- backdrop: skyline, hedges, and trees so no screen edge is ever empty ---------- */
  const strip = (l: number, t: number, w: number, h: number) =>
    el('abs', { left: px(l), top: px(t), width: px(w), height: px(h), background: tiles, boxShadow: 'inset 0 0 0 3px rgba(59,47,58,.08)' });
  strip(-M, -90, W + 2 * M, 90); strip(-M, H, W + 2 * M, 90); strip(-90, -90, 90, H + 180); strip(W, -90, 90, H + 180);
  const backBuilding = (l: number, b: number, w: number) => {
    const sprite = SPRITES[Math.floor(r() * SPRITES.length)];
    ent(`art-v3/buildings/${sprite}.svg`, 282, SPRITE_H[sprite], l, b, w, undefined, `hue-rotate(${Math.floor(r() * 60 - 30)}deg) saturate(.9)`);
  };
  for (let x = -M; x < W + M; x += 195) backBuilding(x + r() * 20, -8, 190);
  for (let x = -M + 90; x < W + M; x += 215) backBuilding(x + r() * 20, -150, 170);
  // bottom: tree line
  for (let x = -M; x < W + M; x += 125) {
    tree(x + r() * 30, H + 150 + r() * 20, 100);
    if (r() > 0.45) tree(x + 60 + r() * 20, H + 250 + r() * 20, 96);
  }
  // sides: skyline and trees
  for (let y = 60; y < H + 120; y += 190) {
    backBuilding(-M + 20 + r() * 20, y + 200, 170);
    backBuilding(W + 20 + r() * 40, y + 200, 170);
    tree(-120 + r() * 20, y + 120, 96); tree(W + 40 + r() * 30, y + 100, 96);
  }

  /* ---------- traffic ---------- */
  interface Car { d: HTMLElement; kind: 'E' | 'W' | 'S' | 'N'; x: number; y: number; speed: number }
  const cars: Car[] = [];
  const addCar = (kind: Car['kind'], x: number, y: number, speed: number) => {
    const d = el('ent', { width: '92px', height: '49px' });
    const i = document.createElement('img'); i.src = asset('art-v2/props/taxi.svg'); i.draggable = false; d.appendChild(i);
    cars.push({ d, kind, x, y, speed });
  };
  ST.forEach((y, j) => {
    addCar('E', (j * 420) % W, y + SH / 2 + 28, 120 + j * 15);
    addCar('W', W - ((j * 300 + 200) % W), y + SH / 2 - 28, 110 + j * 20);
  });
  AVE.forEach((x, i) => {
    if (i % 2 === 0) addCar('S', x + AW / 2 - 28, (i * 260) % H, 115);
    else addCar('N', x + AW / 2 + 28, H - ((i * 200) % H), 125);
  });
  const placeCar = (c: Car) => {
    const tf = c.kind === 'W' ? 'scaleX(-1)' : c.kind === 'S' ? 'rotate(90deg)' : c.kind === 'N' ? 'rotate(-90deg)' : '';
    c.d.style.transform = `translate(${c.x - 46}px, ${c.y - 24}px) ${tf}`;
    c.d.style.zIndex = zOf(c.y);
  };

  /* ---------- player ---------- */
  const player = { x: sw.x + 116, y: ST[rows] + SH / 2 + 10, speed: 230, dir: 'front', moving: false, target: null as { x: number; y: number } | null };
  const pEl = el('ent player', { width: '56px', height: '87px' });
  void loadPlayer().then((t) => { if (alive) pEl.innerHTML = t; });

  const keys = new Set<string>();
  const dirKey: Record<string, string> = { arrowleft: 'a', arrowright: 'd', arrowup: 'w', arrowdown: 's' };
  const onKeyDown = (e: KeyboardEvent) => {
    if (document.querySelector('dialog[open]')) return;
    const k = dirKey[e.key.toLowerCase()] ?? e.key.toLowerCase();
    if (k === 'e' || k === 'enter') interact();
    else if (k === 'f') doAction();
    else if (k.length === 1 && 'wasd'.includes(k)) { keys.add(k); e.preventDefault(); }
  };
  const onKeyUp = (e: KeyboardEvent) => keys.delete(dirKey[e.key.toLowerCase()] ?? e.key.toLowerCase());
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  const hit = (x: number, y: number) => {
    const x0 = x - 10, x1 = x + 10, y0 = y - 8;
    return blockers.some(([a, b, c, d]) => x1 > a && x0 < c && y > b && y0 < d);
  };

  /* ---------- camera ---------- */
  let scale = 1, camX = 0, camY = 0;
  const resize = () => {
    const base = Math.max(0.55, Math.min(1.15, innerWidth / 1100));
    // zoom in just enough that the backdrop always fills the screen
    scale = Math.max(base, Math.min(1.4, innerHeight / (H + 2 * M)), Math.min(1.4, innerWidth / (W + 2 * M)));
  };
  window.addEventListener('resize', resize);
  resize();
  function camera() {
    const vw = innerWidth / scale, vh = innerHeight / scale;
    const ew = W + 2 * M, eh = H + 2 * M;
    camX = vw >= ew ? -M - (vw - ew) / 2 : Math.max(-M, Math.min(W + M - vw, player.x - vw / 2));
    camY = vh >= eh ? -M - (vh - eh) / 2 : Math.max(-M, Math.min(H + M - vh, player.y - vh / 2));
    world.style.transform = `scale(${scale}) translate(${-camX}px, ${-camY}px)`;
  }

  /* ---------- tap to move ---------- */
  stage.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('.scene-prompt')) return;
    const wx = e.clientX / scale + camX, wy = e.clientY / scale + camY;
    player.target = { x: wx, y: wy };
    const rip = el('ripple', { left: px(wx), top: px(wy) });
    setTimeout(() => rip.remove(), 650);
  });

  /* ---------- interaction ---------- */
  let nearest: Landmark | null = null;
  let toastTimer = 0;
  let riding = false;
  let reps = 0;
  function say(msg: string) {
    toastEl.textContent = msg;
    toastEl.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => { toastEl.style.display = 'none'; }, 2600);
  }
  function interact() {
    if (!nearest) return;
    if (nearest.exit) cb.exit();
    else if (nearest.sign) cb.sign(nearest.sign);
    else if (nearest.entry) cb.open(nearest.entry);
  }
  function pop(emoji: string, x: number, y: number, n = 7) {
    for (let i = 0; i < n; i++) {
      const p = el('pop', { left: px(x + (Math.random() - 0.5) * 120), top: px(y), animationDelay: `${i * 70}ms`, zIndex: '99999' });
      p.textContent = emoji;
      setTimeout(() => p.remove(), 1500 + i * 70);
    }
  }
  function doAction() {
    // F hops off the bike from anywhere
    if (riding) { riding = false; pEl.classList.remove('riding'); player.speed = 230; say('Back on foot.'); return; }
    const l = nearest;
    if (!l?.action) return;
    const a = l.action;
    if (a === 'bike') {
      riding = true; pEl.classList.add('riding'); player.speed = 390;
      say('🚲 You\'re riding! Press F to hop off.');
    } else if (a === 'reps') {
      reps++;
      l.node.classList.remove('shake'); void l.node.offsetWidth; l.node.classList.add('shake');
      pop('💪', l.x, l.y - 150, 1);
      say(reps % 10 === 0 ? `🔥 Set of ${reps} done!` : `💪 Rep ${reps}`);
    } else if (a === 'photo') {
      const f = document.createElement('div');
      f.className = 'flash';
      stage.appendChild(f);
      setTimeout(() => f.remove(), 600);
      say('📸 Great shot of the Brooklyn Bridge!');
    } else if (a.startsWith('snack:')) {
      const emoji = a.slice(6);
      pop(emoji, l.x, l.y - 80);
      say(`${emoji} Yum!`);
    }
  }
  prompt.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if ((e.target as HTMLElement).closest('.act')) doAction(); else interact();
  });

  /* ---------- loop ---------- */
  let alive = true;
  let last = performance.now();
  function frame(now: number) {
    if (!alive) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let dx = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    let dy = (keys.has('s') ? 1 : 0) - (keys.has('w') ? 1 : 0);
    if (dx || dy) player.target = null;
    else if (player.target) {
      const tx = player.target.x - player.x, ty = player.target.y - player.y, d = Math.hypot(tx, ty);
      if (d < 6) player.target = null; else { dx = tx / d; dy = ty / d; }
    }
    const len = Math.hypot(dx, dy);
    player.moving = len > 0;
    if (player.moving) {
      dx /= len; dy /= len;
      const nx = Math.max(16, Math.min(W - 16, player.x + dx * player.speed * dt));
      const ny = Math.max(60, Math.min(H - 4, player.y + dy * player.speed * dt));
      let moved = false;
      if (!hit(nx, player.y)) { player.x = nx; moved = true; }
      if (!hit(player.x, ny)) { player.y = ny; moved = true; }
      if (!moved) player.target = null;
      player.dir = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'back' : 'front';
    }
    pEl.style.left = px(player.x - 28); pEl.style.top = px(player.y - 78); pEl.style.zIndex = zOf(player.y);
    const svg = pEl.firstElementChild as SVGElement | null;
    if (svg) { svg.dataset.dir = player.dir; svg.classList.toggle('moving', player.moving); }

    cars.forEach((c) => {
      const s = c.speed * dt;
      if (c.kind === 'E') c.x = c.x + s > W + 120 ? -120 : c.x + s;
      if (c.kind === 'W') c.x = c.x - s < -120 ? W + 120 : c.x - s;
      if (c.kind === 'S') c.y = c.y + s > H + 120 ? -120 : c.y + s;
      if (c.kind === 'N') c.y = c.y - s < -120 ? H + 120 : c.y - s;
      placeCar(c);
    });

    let best = 125;
    nearest = null;
    landmarks.forEach((l) => {
      const d = Math.hypot(l.x - player.x, l.y - player.y);
      if (d < best) { best = d; nearest = l; }
      l.node.classList.remove('near');
    });
    const near = nearest as Landmark | null;
    if (near) {
      near.node.classList.add('near');
      prompt.style.display = 'flex';
      prompt.style.setProperty('--c', near.color);
      const act = actionLabel(near.action);
      prompt.innerHTML = `<span class="pt">${near.icon} <b>${esc(near.title)}</b> · ${esc(near.sub)} <span>(press E or tap)</span></span>${act ? `<button class="act">${esc(act)}</button>` : ''}`;
    } else prompt.style.display = 'none';

    camera();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // short welcome toast
  say(`${nb.icon} ${nb.name}: ${nb.blurb}`);

  return {
    destroy() {
      alive = false;
      clearTimeout(toastTimer);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', resize);
      stage.remove();
    },
  };
}
