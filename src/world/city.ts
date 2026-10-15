import { about, projects, worldEntries, type Project } from '../content';
import { NEIGHBORHOODS, SPOT_POS, neighborhoodFor, type Category } from '../neighborhoods';
import { esc } from '../util';

// Stylized NYC from above. Manhattan runs diagonally from its south tip (bottom-left) to the north (top-right),
// Brooklyn and Queens are to the east (right), New Jersey to the west (left).
const MAP_W = 2000;
const MAP_H = 1400;
const S = { x: 340, y: 1190 };
const N = { x: 1720, y: 170 };
const DX = N.x - S.x;
const DY = N.y - S.y;
const LEN = Math.hypot(DX, DY);
const UX = DX / LEN;
const UY = DY / LEN;
const NX = -UY; // unit vector pointing east (across the island)
const NY = UX;

type P = { x: number; y: number };
const pt = (t: number, off: number): P => ({ x: S.x + DX * t + NX * off, y: S.y + DY * t + NY * off });
const halfW = (t: number): number => (t < 0 ? 22 : t < 0.07 ? 22 + (t / 0.07) * 70 : t > 0.92 ? 92 - ((t - 0.92) / 0.1) * 44 : 92);
const ANGLE = (Math.atan2(DY, DX) * 180) / Math.PI;

function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed smooth path (Catmull-Rom converted to cubic Beziers). */
function smooth(pts: P[]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(p2.x - (p3.x - p1.x) / 6)} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d + 'Z';
}

function shore(ts: number[], offFn: (t: number, i: number) => number): P[] {
  return ts.map((t, i) => pt(t, offFn(t, i)));
}
const steps = (a: number, b: number, k: number): number[] => {
  const out: number[] = [];
  for (let t = a; t <= b + 1e-9; t += k) out.push(+t.toFixed(4));
  return out;
};

export interface CityCallbacks {
  enter: (category: Category) => void;
  open: (entry: Project) => void;
  toast: (msg: string) => void;
}

export interface CityHandle {
  /** show the map; `from` zooms out of that neighborhood */
  show(from?: Category): void;
  hide(): void;
  destroy(): void;
}

interface Beacon { category: Category; x: number; y: number; live: boolean }

const BUILDING_COLORS = ['#e8a598', '#f0c987', '#a8c9d8', '#b9d3a8', '#d6b8e0', '#f2d6b3', '#9fb4c8', '#e6b8c6', '#cfc8d6'];

export function createCity(root: HTMLElement, cb: CityCallbacks): CityHandle {
  const wrap = document.createElement('div');
  wrap.className = 'city';
  root.appendChild(wrap);

  /* ---------- geometry ---------- */
  const rn = rng(7);
  const ts = steps(-0.03, 1.02, 0.04);
  const manhattan = smooth([
    ...shore(ts, (t) => -(halfW(t) + (rn() - 0.5) * 10)),
    ...shore([...ts].reverse(), (t) => halfW(t) + (rn() - 0.5) * 10),
  ]);
  const east = smooth([
    ...shore(steps(-0.07, 0.92, 0.05), (t) => halfW(Math.max(0, t)) + 85 + (rn() - 0.5) * 22),
    ...shore(steps(-0.07, 0.92, 0.05).reverse(), () => 640 + (rn() - 0.5) * 70),
  ]);
  const west = smooth([
    ...shore(steps(-0.03, 0.98, 0.05), (t) => -(halfW(Math.max(0, t)) + 110 + (rn() - 0.5) * 20)),
    ...shore(steps(-0.03, 0.98, 0.05).reverse(), () => -560 + (rn() - 0.5) * 60),
  ]);

  /* ---------- beacons and pins ---------- */
  const beacons: Beacon[] = NEIGHBORHOODS.filter((n) => n.category !== 'spots').map((n) => {
    const p = pt(n.map.t, n.map.off);
    return { category: n.category, x: p.x, y: p.y, live: worldEntries(n.category).length > 0 };
  });
  const pins = Object.entries(SPOT_POS)
    .map(([slug, pos]) => ({ slug, entry: projects.find((p) => p.slug === slug), pos }))
    .filter((p) => p.entry && p.entry.showIn.includes('world'))
    .map((p) => ({ ...p, ...pt(p.pos.t, p.pos.off) }));
  const home = about ? { entry: about, ...pt(0.22, 390) } : null;
  const keepClear: P[] = [...beacons, ...pins, ...(home ? [home] : [])];

  /* ---------- decoration ---------- */
  const buildingSymbol = `
    <symbol id="b" viewBox="0 0 20 30">
      <rect x="2" y="9" width="12" height="19" rx="1.5" fill="currentColor" stroke="#3b2f3a" stroke-width="1.4"/>
      <path d="M14 9l4-4v19l-4 4z" fill="currentColor" stroke="#3b2f3a" stroke-width="1.4"/><path d="M14 9l4-4v19l-4 4z" fill="#000" opacity=".22"/>
      <path d="M2 9l4-4h12l-4 4z" fill="#fff" opacity=".45" stroke="#3b2f3a" stroke-width="1.4"/>
      <g fill="#fff6c8" opacity=".9"><rect x="4" y="12" width="3" height="3"/><rect x="9" y="12" width="3" height="3"/><rect x="4" y="18" width="3" height="3"/><rect x="9" y="18" width="3" height="3"/></g>
    </symbol>`;

  const bldgs: { x: number; y: number; w: number; h: number; c: string }[] = [];
  const dr = rng(21);
  const near = (p: P, r: number) => keepClear.some((k) => Math.hypot(k.x - p.x, k.y - p.y) < r);
  for (const t of steps(0.0, 0.95, 0.0125)) {
    if (t > 0.57 && t < 0.73) continue; // Central Park
    for (let off = -72; off <= 72; off += 24) {
      const p = pt(t, off + (dr() - 0.5) * 8);
      if (near(p, 62)) continue;
      const h = 22 + dr() * 26 + (t > 0.35 && t < 0.5 ? 14 : 0);
      bldgs.push({ x: p.x, y: p.y, w: h * 0.66, h, c: BUILDING_COLORS[Math.floor(dr() * BUILDING_COLORS.length)] });
    }
  }
  for (const t of steps(0.0, 0.8, 0.022)) {
    for (let off = 190; off <= 620; off += 34) {
      if (dr() < 0.5) continue;
      const p = pt(t, off + (dr() - 0.5) * 14);
      if (near(p, 62)) continue;
      const h = 16 + dr() * 14;
      bldgs.push({ x: p.x, y: p.y, w: h * 0.66, h, c: BUILDING_COLORS[Math.floor(dr() * BUILDING_COLORS.length)] });
    }
  }
  bldgs.sort((a, b) => a.y - b.y);
  const bldgSvg = bldgs
    .map((b) => `<use href="#b" x="${(b.x - b.w / 2).toFixed(0)}" y="${(b.y - b.h).toFixed(0)}" width="${b.w.toFixed(0)}" height="${b.h.toFixed(0)}" style="color:${b.c}"/>`)
    .join('');

  const gridLines: string[] = [];
  for (const t of steps(0.02, 0.98, 0.0115)) {
    const a = pt(t, -halfW(t) + 6), b = pt(t, halfW(t) - 6);
    gridLines.push(`M${a.x.toFixed(0)} ${a.y.toFixed(0)}L${b.x.toFixed(0)} ${b.y.toFixed(0)}`);
  }
  for (const off of [-60, -30, 0, 30, 60]) {
    const a = pt(0.08, off), b = pt(0.95, off);
    gridLines.push(`M${a.x.toFixed(0)} ${a.y.toFixed(0)}L${b.x.toFixed(0)} ${b.y.toFixed(0)}`);
  }

  const poly = (pts: P[]) => pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
  const park = poly([pt(0.58, -64), pt(0.72, -64), pt(0.72, 64), pt(0.58, 64)]);
  const pond = pt(0.64, 6);
  const prospect = pt(0.14, 440);
  const bridge = (t: number, w = 5) => {
    const a = pt(t, halfW(t) - 4), b = pt(t, halfW(t) + 90);
    const m1 = pt(t, halfW(t) + 22), m2 = pt(t, halfW(t) + 62);
    return `<path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#3b2f3a" stroke-width="${w + 4}" stroke-linecap="round"/>
      <path d="M${a.x} ${a.y}L${b.x} ${b.y}" stroke="#d9d3c4" stroke-width="${w}" stroke-linecap="round"/>
      <circle cx="${m1.x}" cy="${m1.y}" r="9" fill="#cfc8d6" stroke="#3b2f3a" stroke-width="3"/><circle cx="${m2.x}" cy="${m2.y}" r="9" fill="#cfc8d6" stroke="#3b2f3a" stroke-width="3"/>`;
  };

  const waterLabel = (t: number, off: number, text: string, rot = ANGLE) => {
    const p = pt(t, off);
    return `<text x="${p.x.toFixed(0)}" y="${p.y.toFixed(0)}" transform="rotate(${rot.toFixed(1)} ${p.x.toFixed(0)} ${p.y.toFixed(0)})" class="city-water-label" text-anchor="middle">${text}</text>`;
  };
  const statue = pt(-0.06, -215);
  const empire = pt(0.43, 18);

  /* ---------- beacons ---------- */
  const gradDefs = NEIGHBORHOODS.map(
    (n) => `<linearGradient id="beam-${n.category}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${n.color}" stop-opacity=".95"/><stop offset="1" stop-color="${n.color}" stop-opacity="0"/></linearGradient>`
  ).join('');

  /** Pill label beside a beacon. side "r" extends to the right, "l" to the left, so neighbours don't overlap. */
  const label = (icon: string, text: string, color: string, side: 'l' | 'r' = 'r') => {
    const w = Math.max(70, text.length * 7.8 + 44);
    const x = side === 'r' ? 20 : -20 - w;
    return `<g class="lbl" data-off="30"><rect x="${x}" y="-15" width="${w}" height="30" rx="15" fill="#fff" stroke="${color}" stroke-width="3"/>
      <text x="${x + 13}" y="6" font-size="15">${icon}</text><text x="${x + 35}" y="5.5" class="city-label-text">${esc(text)}</text></g>`;
  };
  const sideOf = (b: Beacon) => neighborhoodFor(b.category).labelSide ?? (neighborhoodFor(b.category).map.off < 20 ? 'l' : 'r');

  const beaconSvg = [...beacons]
    .sort((a, b) => a.y - b.y)
    .map((b) => {
      const n = neighborhoodFor(b.category);
      const count = worldEntries(b.category).length;
      if (!b.live) {
        return `<g class="beacon dim" transform="translate(${b.x.toFixed(0)} ${b.y.toFixed(0)})" data-cat="${b.category}">
          <ellipse rx="26" ry="12" fill="#fff" opacity=".5" stroke="#3b2f3a" stroke-width="2.5" stroke-dasharray="6 5"/>
          ${label(n.icon, `${n.name} · soon`, '#b9b2c6', sideOf(b))}</g>`;
      }
      return `<g class="beacon" transform="translate(${b.x.toFixed(0)} ${b.y.toFixed(0)})" data-cat="${b.category}" style="--c:${n.color}">
        <rect x="-9" y="-150" width="18" height="150" fill="url(#beam-${b.category})" class="beam"/>
        <ellipse class="pulse" rx="30" ry="14" fill="none" stroke="${n.color}" stroke-width="4"/>
        <ellipse rx="22" ry="10" fill="${n.color}" opacity=".9" stroke="#3b2f3a" stroke-width="3"/>
        <circle cy="-4" r="7" fill="#fff6c8" stroke="#3b2f3a" stroke-width="2.5"/>
        ${label(n.icon, `${n.name} · ${count}`, n.color, sideOf(b))}</g>`;
    })
    .join('');

  const pinSvg =
    pins
      .map(
        (p) => `<g class="pin" transform="translate(${p.x.toFixed(0)} ${p.y.toFixed(0)})" data-slug="${esc(p.slug)}">
        <ellipse class="pulse" rx="20" ry="9" fill="none" stroke="#2f7d5b" stroke-width="3"/>
        <circle r="17" fill="#fff" stroke="#2f7d5b" stroke-width="3.5"/><text y="6" text-anchor="middle" font-size="18">${p.pos.icon}</text>
        <g class="lbl" data-off="22"><rect x="18" y="-12" width="150" height="24" rx="12" fill="#fff" stroke="#2f7d5b" stroke-width="2.5"/><text x="93" y="4.5" text-anchor="middle" class="city-label-text small">${esc(p.entry!.title.length > 24 ? p.entry!.title.slice(0, 23) + '…' : p.entry!.title)}</text></g></g>`
      )
      .join('') +
    (home
      ? `<g class="pin home" transform="translate(${home.x.toFixed(0)} ${home.y.toFixed(0)})" data-slug="${esc(home.entry.slug)}">
        <ellipse class="pulse" rx="30" ry="13" fill="none" stroke="#e8505b" stroke-width="4"/>
        <circle r="22" fill="#fff" stroke="#e8505b" stroke-width="4"/><text y="8" text-anchor="middle" font-size="24">🏠</text>
        <g class="lbl" data-off="26"><rect x="28" y="-15" width="104" height="30" rx="15" fill="#fff" stroke="#e8505b" stroke-width="3"/><text x="80" y="5.5" text-anchor="middle" class="city-label-text">About me</text></g></g>`
      : '');

  wrap.innerHTML = `
    <svg class="city-svg" aria-label="Map of New York City with my neighborhoods" role="img">
      <defs>${gradDefs}${buildingSymbol}
        <pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15q15-12 30 0t30 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/></pattern>
      </defs>
      <rect class="city-water" x="-6000" y="-6000" width="14000" height="14000" fill="#8fc9e0"/>
      <rect x="-6000" y="-6000" width="14000" height="14000" fill="url(#waves)"/>
      <g id="cam">
        <path d="${west}" fill="#dfe8c8" stroke="#3b2f3a" stroke-width="5" stroke-linejoin="round"/>
        <path d="${east}" fill="#e8ecd0" stroke="#3b2f3a" stroke-width="5" stroke-linejoin="round"/>
        <path d="${manhattan}" fill="#f6ecd6" stroke="#3b2f3a" stroke-width="6" stroke-linejoin="round"/>
        <path d="${gridLines.join('')}" stroke="#3b2f3a" stroke-opacity=".12" stroke-width="2" fill="none"/>
        <polygon points="${park}" fill="#a5cf9a" stroke="#3b2f3a" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="${pond.x.toFixed(0)}" cy="${pond.y.toFixed(0)}" rx="26" ry="14" fill="#7fc4e0" stroke="#3b2f3a" stroke-width="3" transform="rotate(${ANGLE.toFixed(0)} ${pond.x.toFixed(0)} ${pond.y.toFixed(0)})"/>
        <ellipse cx="${prospect.x.toFixed(0)}" cy="${prospect.y.toFixed(0)}" rx="70" ry="42" fill="#a5cf9a" stroke="#3b2f3a" stroke-width="4"/>
        ${bridge(0.07)}${bridge(0.095, 4)}${bridge(0.15, 4)}${bridge(0.5, 4)}
        ${waterLabel(0.5, -240, 'HUDSON RIVER')}${waterLabel(0.38, 235, 'EAST RIVER')}${waterLabel(-0.14, 40, 'UPPER BAY', 0)}
        ${waterLabel(0.5, 380, 'QUEENS', ANGLE)}${waterLabel(0.2, 510, 'BROOKLYN', ANGLE)}${waterLabel(0.45, -400, 'NEW JERSEY', ANGLE)}
        <text class="city-park-label" x="${pt(0.65, 0).x.toFixed(0)}" y="${(pt(0.65, 0).y + 40).toFixed(0)}" text-anchor="middle">CENTRAL PARK</text>
        <g transform="translate(${statue.x.toFixed(0)} ${statue.y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3" stroke-linejoin="round">
          <ellipse cy="16" rx="22" ry="9" fill="#cdbf9f"/><rect x="-8" y="-4" width="16" height="20" fill="#b9c9bb"/><path d="M-12 -4l12-26 12 26z" fill="#8fc7ae"/><path d="M10 -22l8-14" stroke-width="4"/><circle cx="19" cy="-39" r="5" fill="#ffd36e"/></g>
        <g transform="translate(${empire.x.toFixed(0)} ${empire.y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3" stroke-linejoin="round">
          <rect x="-16" y="-50" width="32" height="50" fill="#cfc8d6"/><rect x="-10" y="-80" width="20" height="30" fill="#bfb8c9"/><rect x="-5" y="-100" width="10" height="20" fill="#cfc8d6"/><path d="M0-100V-124" stroke-width="3"/></g>
        <g class="boat b1"><g transform="translate(${pt(0.3, -190).x.toFixed(0)} ${pt(0.3, -190).y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3"><path d="M-30 0h60l-8 14h-44z" fill="#fff"/><rect x="-12" y="-12" width="24" height="12" fill="#e8505b"/></g></g>
        <g class="boat b2"><g transform="translate(${pt(0.18, 150).x.toFixed(0)} ${pt(0.18, 150).y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3"><path d="M-30 0h60l-8 14h-44z" fill="#fff"/><rect x="-12" y="-12" width="24" height="12" fill="#f6c453"/></g></g>
        <g class="boat b3"><g transform="translate(${pt(-0.1, -80).x.toFixed(0)} ${pt(-0.1, -80).y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3"><path d="M-30 0h60l-8 14h-44z" fill="#fff"/><rect x="-12" y="-12" width="24" height="12" fill="#4f9d8f"/></g></g>
        ${bldgSvg}
        ${pinSvg}
        ${beaconSvg}
      </g>
    </svg>
    <div class="city-hint">Tap a glowing light, or zoom into one</div>
    <div class="city-zoom"><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="out" aria-label="Zoom out">−</button></div>`;

  const svg = wrap.querySelector<SVGSVGElement>('.city-svg')!;
  const cam = svg.querySelector<SVGGElement>('#cam')!;
  const labels = [...svg.querySelectorAll<SVGGElement>('.lbl')];

  /* ---------- camera ---------- */
  let vw = 0, vh = 0, fit = 1, s = 1, tx = 0, ty = 0;
  const maxZoom = () => fit * 8;

  function apply(): void {
    cam.setAttribute('transform', `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${s.toFixed(4)})`);
    wrap.classList.toggle('zoomed', s >= fit * 2.2);
    const k = 1 / s;
    for (const l of labels) l.setAttribute('transform', `scale(${k.toFixed(4)}) translate(0 ${-Number(l.dataset.off)})`);
  }
  function clampPan(): void {
    const mw = MAP_W * s, mh = MAP_H * s;
    tx = mw <= vw ? (vw - mw) / 2 : Math.min(vw * 0.35, Math.max(vw * 0.65 - mw, tx));
    ty = mh <= vh ? (vh - mh) / 2 : Math.min(vh * 0.35, Math.max(vh * 0.65 - mh, ty));
  }
  function measure(): void {
    vw = wrap.clientWidth || innerWidth;
    vh = wrap.clientHeight || innerHeight;
    const oldFit = fit;
    fit = Math.min(vw / MAP_W, vh / MAP_H) * 1.02;
    if (oldFit === 1 || s <= oldFit * 1.001) { s = fit; tx = (vw - MAP_W * s) / 2; ty = (vh - MAP_H * s) / 2; }
    clampPan(); apply();
  }
  function zoomAt(cx: number, cy: number, factor: number): void {
    const ns = Math.min(maxZoom(), Math.max(fit, s * factor));
    tx = cx - ((cx - tx) * ns) / s;
    ty = cy - ((cy - ty) * ns) / s;
    s = ns; clampPan(); apply();
  }
  const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  let anim = 0;
  function animateTo(ns: number, cx: number, cy: number, ms: number): Promise<void> {
    cancelAnimationFrame(anim);
    const s0 = s, tx0 = tx, ty0 = ty;
    // end state: world point (cx, cy) in the middle of the screen
    const tx1 = vw / 2 - cx * ns, ty1 = vh / 2 - cy * ns;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms), e = ease(k);
        // interpolate zoom geometrically so the zoom feels even
        s = s0 * Math.pow(ns / s0, e);
        tx = tx0 + (tx1 - tx0) * e; ty = ty0 + (ty1 - ty0) * e;
        apply();
        if (k < 1) anim = requestAnimationFrame(tick); else resolve();
      };
      anim = requestAnimationFrame(tick);
    });
  }
  const beaconOf = (c: Category) => beacons.find((b) => b.category === c)!;

  async function flyInto(cat: Category): Promise<void> {
    const b = beaconOf(cat);
    await animateTo(fit * 5.2, b.x, b.y - 40, 750);
    cb.enter(cat);
  }

  /* ---------- input ---------- */
  const pointers = new Map<number, P>();
  let drag: { sx: number; sy: number; tx: number; ty: number; moved: boolean; target: Element | null } | null = null;
  let pinch: { dist: number; mid: P } | null = null;
  let settle = 0;

  function afterZoom(): void {
    clearTimeout(settle);
    settle = window.setTimeout(() => {
      if (s < fit * 3.3) return;
      let best: Beacon | null = null, bd = Math.min(vw, vh) * 0.22;
      for (const b of beacons) {
        if (!b.live) continue;
        const d = Math.hypot(b.x * s + tx - vw / 2, b.y * s + ty - vh / 2);
        if (d < bd) { bd = d; best = b; }
      }
      if (best) void flyInto(best.category);
    }, 550);
  }

  svg.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(anim);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) drag = { sx: e.clientX, sy: e.clientY, tx, ty, moved: false, target: e.target as Element };
    else {
      drag = null;
      const [a, b] = [...pointers.values()];
      pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y), mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      zoomAt(mid.x, mid.y, dist / pinch.dist);
      tx += mid.x - pinch.mid.x; ty += mid.y - pinch.mid.y; clampPan(); apply();
      pinch = { dist, mid };
    } else if (drag) {
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (!drag.moved && Math.hypot(dx, dy) > 6) { drag.moved = true; svg.setPointerCapture(e.pointerId); wrap.classList.add('dragging'); }
      if (drag.moved) { tx = drag.tx + dx; ty = drag.ty + dy; clampPan(); apply(); }
    }
  });
  const end = (e: PointerEvent) => {
    const wasTap = drag && !drag.moved && pointers.size === 1;
    const target = drag?.target ?? null;
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    wrap.classList.remove('dragging');
    if (pointers.size === 0) {
      if (wasTap && target) tap(target);
      else if (drag?.moved || pinch === null) afterZoom();
      drag = null;
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    cancelAnimationFrame(anim);
    zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
    afterZoom();
  }, { passive: false });
  wrap.querySelector('.city-zoom')!.addEventListener('click', (e) => {
    const dir = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]')?.dataset.zoom;
    if (!dir) return;
    void animateTo(Math.min(maxZoom(), Math.max(fit, s * (dir === 'in' ? 1.7 : 1 / 1.7))), (vw / 2 - tx) / s, (vh / 2 - ty) / s, 280).then(afterZoom);
  });

  function tap(target: Element): void {
    const bc = target.closest<SVGElement>('[data-cat]');
    if (bc) {
      const cat = bc.getAttribute('data-cat') as Category;
      if (beaconOf(cat).live) void flyInto(cat);
      else cb.toast(`${neighborhoodFor(cat).icon} ${neighborhoodFor(cat).name} is coming soon.`);
      return;
    }
    const pin = target.closest<SVGElement>('[data-slug]');
    if (pin) {
      const slug = pin.getAttribute('data-slug')!;
      const entry = pins.find((p) => p.slug === slug)?.entry ?? (home?.entry.slug === slug ? home.entry : undefined);
      if (entry) cb.open(entry);
    }
  }

  const ro = new ResizeObserver(() => { if (wrap.style.display !== 'none') measure(); });
  ro.observe(wrap);
  measure();

  return {
    show(from) {
      wrap.style.display = '';
      measure();
      if (from) {
        const b = beaconOf(from);
        const s0 = fit * 5.2;
        s = s0; tx = vw / 2 - b.x * s0; ty = vh / 2 - (b.y - 40) * s0; apply();
        void animateTo(fit, MAP_W / 2, MAP_H / 2, 800);
      }
    },
    hide() { cancelAnimationFrame(anim); wrap.style.display = 'none'; },
    destroy() { cancelAnimationFrame(anim); clearTimeout(settle); ro.disconnect(); wrap.remove(); },
  };
}
