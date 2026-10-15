import { about, projects, worldEntries, type Project } from '../content';
import { HOME_LL, NEIGHBORHOODS, SPOT_POS, neighborhoodFor, type Category } from '../neighborhoods';
import { esc } from '../util';
import { BOROUGH_PATHS, BOROUGH_RINGS, GEO } from './nycGeo';

// North is up, like Google Maps. Shorelines come from NYC Open Data borough boundaries (see nycGeo.ts).
const MAP_W = GEO.width;
const MAP_H = GEO.height;

type P = { x: number; y: number };
const xy = ([lat, lon]: [number, number]): P => ({ x: (lon - GEO.lon0) * GEO.kx, y: (GEO.lat0 - lat) * GEO.k });
const ANGLE = 29; // Manhattan's street grid is rotated about 29 degrees from north
const AVE = { x: Math.sin((ANGLE * Math.PI) / 180), y: -Math.cos((ANGLE * Math.PI) / 180) }; // up an avenue
const STR = { x: -AVE.y, y: AVE.x }; // along a street

// Area shown when the whole city is in view: Lower Manhattan to Central Park, plus north Brooklyn.
const FOCUS_A = xy([40.806, -74.04]);
const FOCUS_B = xy([40.652, -73.93]);
const FOCUS = { x: FOCUS_A.x, y: FOCUS_A.y, w: FOCUS_B.x - FOCUS_A.x, h: FOCUS_B.y - FOCUS_A.y };

function rng(seed: number): () => number {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Closed smooth path through points (Catmull-Rom converted to cubic Beziers). */
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

function inside(ring: number[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; i += 2) {
    const xi = ring[i], yi = ring[i + 1], xj = ring[j], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    j = i;
  }
  return c;
}

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

interface Beacon extends P { category: Category; live: boolean }

const BUILDING_COLORS = ['#e8a598', '#f0c987', '#a8c9d8', '#b9d3a8', '#d6b8e0', '#f2d6b3', '#9fb4c8', '#e6b8c6', '#cfc8d6'];

// New Jersey is not in the NYC data, so its shoreline is traced by hand (latitude, longitude).
const NJ: [number, number][] = [
  [40.95, -73.9], [40.9, -73.92], [40.865, -73.947], [40.8517, -73.957], [40.827, -73.973], [40.8, -73.998], [40.78, -74.015], [40.7685, -74.02],
  [40.75, -74.0235], [40.737, -74.029], [40.719, -74.0345], [40.71, -74.047], [40.699, -74.058], [40.685, -74.062], [40.67, -74.069], [40.655, -74.072],
  [40.64, -74.065], [40.62, -74.08], [40.55, -74.12], [40.55, -74.3], [40.95, -74.3],
];
const CENTRAL_PARK: [number, number][] = [[40.7677, -73.9818], [40.7644, -73.9731], [40.7968, -73.9519], [40.8003, -73.9581]];
const PROSPECT_PARK: [number, number][] = [[40.6746, -73.9695], [40.665, -73.9783], [40.6545, -73.9734], [40.6535, -73.968], [40.664, -73.9622], [40.67, -73.9625]];
const BRIDGES: { a: [number, number]; b: [number, number] }[] = [
  { a: [40.712, -73.9995], b: [40.7033, -73.993] }, // Brooklyn Bridge
  { a: [40.7155, -73.9915], b: [40.7055, -73.9895] }, // Manhattan Bridge
  { a: [40.7145, -73.9777], b: [40.7115, -73.9627] }, // Williamsburg Bridge
  { a: [40.7577, -73.961], b: [40.7539, -73.9387] }, // Queensboro Bridge
];

export function createCity(root: HTMLElement, cb: CityCallbacks): CityHandle {
  const wrap = document.createElement('div');
  wrap.className = 'city';
  root.appendChild(wrap);

  /* ---------- beacons and pins ---------- */
  const beacons: Beacon[] = NEIGHBORHOODS.filter((n) => n.category !== 'spots').map((n) => ({
    category: n.category, ...xy(n.ll), live: worldEntries(n.category).length > 0,
  }));
  const pins = Object.entries(SPOT_POS)
    .map(([slug, pos]) => ({ slug, entry: projects.find((p) => p.slug === slug), pos }))
    .filter((p) => p.entry && p.entry.showIn.includes('world'))
    .map((p) => ({ ...p, ...xy(p.pos.ll) }));
  const home = about ? { entry: about, ...xy(HOME_LL) } : null;
  const keepClear: P[] = [...beacons, ...pins, ...(home ? [home] : [])];

  /* ---------- decoration: tiny buildings ---------- */
  const parkPts = (poly: [number, number][]) => poly.map(xy);
  const cpFlat = parkPts(CENTRAL_PARK).flatMap((p) => [p.x, p.y]);
  const ppFlat = parkPts(PROSPECT_PARK).flatMap((p) => [p.x, p.y]);
  const inPark = (x: number, y: number) => inside(cpFlat, x, y) || inside(ppFlat, x, y);
  const near = (x: number, y: number, r: number) => keepClear.some((k) => Math.hypot(k.x - x, k.y - y) < r);

  const buildingSymbol = `
    <symbol id="b" viewBox="0 0 20 30">
      <rect x="2" y="9" width="12" height="19" rx="1.5" fill="currentColor" stroke="#3b2f3a" stroke-width="1.4"/>
      <path d="M14 9l4-4v19l-4 4z" fill="currentColor" stroke="#3b2f3a" stroke-width="1.4"/><path d="M14 9l4-4v19l-4 4z" fill="#000" opacity=".22"/>
      <path d="M2 9l4-4h12l-4 4z" fill="#fff" opacity=".45" stroke="#3b2f3a" stroke-width="1.4"/>
      <g fill="#fff6c8" opacity=".9"><rect x="4" y="12" width="3" height="3"/><rect x="9" y="12" width="3" height="3"/><rect x="4" y="18" width="3" height="3"/><rect x="9" y="18" width="3" height="3"/></g>
    </symbol>`;

  const bldgs: { x: number; y: number; w: number; h: number; c: string }[] = [];
  const dr = rng(21);
  const pick = () => BUILDING_COLORS[Math.floor(dr() * BUILDING_COLORS.length)];
  const manhattan = BOROUGH_RINGS.Manhattan;
  const cx = FOCUS.x + FOCUS.w / 2, cy = FOCUS.y + FOCUS.h / 2;
  // Manhattan: a dense grid aligned with the island's street grid
  for (let u = -1500; u <= 1700; u += 26) {
    for (let v = -420; v <= 420; v += 24) {
      const x = cx + AVE.x * u + STR.x * v + (dr() - 0.5) * 8;
      const y = cy + AVE.y * u + STR.y * v + (dr() - 0.5) * 8;
      if (!inside(manhattan, x, y) || inPark(x, y) || near(x, y, 52)) continue;
      const h = 24 + dr() * 26 + (u > -150 && u < 400 ? 14 : 0);
      bldgs.push({ x, y, w: h * 0.66, h, c: pick() });
    }
  }
  // Other boroughs: sparser, smaller
  for (const name of ['Brooklyn', 'Queens', 'Bronx']) {
    const ring = BOROUGH_RINGS[name];
    for (let x = FOCUS.x - 700; x < FOCUS.x + FOCUS.w + 900; x += 58) {
      for (let y = FOCUS.y - 500; y < FOCUS.y + FOCUS.h + 700; y += 58) {
        const px = x + (dr() - 0.5) * 30, py = y + (dr() - 0.5) * 30;
        if (dr() < 0.45 || !inside(ring, px, py) || inPark(px, py) || near(px, py, 52)) continue;
        const h = 16 + dr() * 16;
        bldgs.push({ x: px, y: py, w: h * 0.66, h, c: pick() });
      }
    }
  }
  bldgs.sort((a, b) => a.y - b.y);
  const bldgSvg = bldgs
    .map((b) => `<use href="#b" x="${(b.x - b.w / 2).toFixed(0)}" y="${(b.y - b.h).toFixed(0)}" width="${b.w.toFixed(0)}" height="${b.h.toFixed(0)}" style="color:${b.c}"/>`)
    .join('');

  // street grid, clipped to Manhattan
  const gridLines: string[] = [];
  for (let u = -1700; u <= 1900; u += 34) {
    const a = { x: cx + AVE.x * u - STR.x * 600, y: cy + AVE.y * u - STR.y * 600 };
    const b = { x: cx + AVE.x * u + STR.x * 600, y: cy + AVE.y * u + STR.y * 600 };
    gridLines.push(`M${a.x.toFixed(0)} ${a.y.toFixed(0)}L${b.x.toFixed(0)} ${b.y.toFixed(0)}`);
  }
  for (let v = -420; v <= 420; v += 60) {
    const a = { x: cx + STR.x * v - AVE.x * 1900, y: cy + STR.y * v - AVE.y * 1900 };
    const b = { x: cx + STR.x * v + AVE.x * 1900, y: cy + STR.y * v + AVE.y * 1900 };
    gridLines.push(`M${a.x.toFixed(0)} ${a.y.toFixed(0)}L${b.x.toFixed(0)} ${b.y.toFixed(0)}`);
  }

  const poly = (pts: P[]) => pts.map((p) => `${p.x.toFixed(0)},${p.y.toFixed(0)}`).join(' ');
  const njPath = 'M' + NJ.map((ll) => { const p = xy(ll); return `${p.x.toFixed(0)} ${p.y.toFixed(0)}`; }).join('L') + 'Z';
  const bridgeSvg = BRIDGES.map(({ a, b }, i) => {
    const pa = xy(a), pb = xy(b), m1 = { x: pa.x + (pb.x - pa.x) * 0.3, y: pa.y + (pb.y - pa.y) * 0.3 }, m2 = { x: pa.x + (pb.x - pa.x) * 0.7, y: pa.y + (pb.y - pa.y) * 0.7 };
    const w = i === 0 ? 6 : 5;
    return `<path d="M${pa.x.toFixed(0)} ${pa.y.toFixed(0)}L${pb.x.toFixed(0)} ${pb.y.toFixed(0)}" stroke="#3b2f3a" stroke-width="${w + 4}" stroke-linecap="round"/>
      <path d="M${pa.x.toFixed(0)} ${pa.y.toFixed(0)}L${pb.x.toFixed(0)} ${pb.y.toFixed(0)}" stroke="#d9d3c4" stroke-width="${w}" stroke-linecap="round"/>
      <circle cx="${m1.x.toFixed(0)}" cy="${m1.y.toFixed(0)}" r="8" fill="#cfc8d6" stroke="#3b2f3a" stroke-width="3"/><circle cx="${m2.x.toFixed(0)}" cy="${m2.y.toFixed(0)}" r="8" fill="#cfc8d6" stroke="#3b2f3a" stroke-width="3"/>`;
  }).join('');

  const label = (ll: [number, number], text: string, rot: number, cls = 'city-water-label') => {
    const p = xy(ll);
    return `<text x="${p.x.toFixed(0)}" y="${p.y.toFixed(0)}" transform="rotate(${rot} ${p.x.toFixed(0)} ${p.y.toFixed(0)})" class="${cls}" text-anchor="middle">${text}</text>`;
  };
  const statue = xy([40.6892, -74.0445]);
  const pond = xy([40.7855, -73.9625]);
  const boat = (ll: [number, number], cls: string, hat: string) => {
    const p = xy(ll);
    return `<g class="boat ${cls}"><g transform="translate(${p.x.toFixed(0)} ${p.y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3"><path d="M-30 0h60l-8 14h-44z" fill="#fff"/><rect x="-12" y="-12" width="24" height="12" fill="${hat}"/></g></g>`;
  };

  /* ---------- beacons ---------- */
  const gradDefs = NEIGHBORHOODS.map(
    (n) => `<linearGradient id="beam-${n.category}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${n.color}" stop-opacity=".95"/><stop offset="1" stop-color="${n.color}" stop-opacity="0"/></linearGradient>`
  ).join('');

  /** Pill label beside a beacon. side "r" extends to the right, "l" to the left, so neighbours don't overlap. */
  const pill = (icon: string, text: string, color: string, side: 'l' | 'r') => {
    const w = Math.max(70, text.length * 7.8 + 44);
    const x = side === 'r' ? 20 : -20 - w;
    return `<g class="lbl" data-off="30"><rect x="${x}" y="-15" width="${w}" height="30" rx="15" fill="#fff" stroke="${color}" stroke-width="3"/>
      <text x="${x + 13}" y="6" font-size="15">${icon}</text><text x="${x + 35}" y="5.5" class="city-label-text">${esc(text)}</text></g>`;
  };

  const beaconSvg = [...beacons]
    .sort((a, b) => a.y - b.y)
    .map((b) => {
      const n = neighborhoodFor(b.category);
      const count = worldEntries(b.category).length;
      if (!b.live) {
        return `<g class="beacon dim" transform="translate(${b.x.toFixed(0)} ${b.y.toFixed(0)})" data-cat="${b.category}">
          <circle r="40" fill="transparent"/><ellipse rx="26" ry="12" fill="#fff" opacity=".5" stroke="#3b2f3a" stroke-width="2.5" stroke-dasharray="6 5"/>
          ${pill(n.icon, `${n.name} · soon`, '#b9b2c6', n.labelSide)}</g>`;
      }
      return `<g class="beacon" transform="translate(${b.x.toFixed(0)} ${b.y.toFixed(0)})" data-cat="${b.category}">
        <circle r="40" fill="transparent"/>
        <rect x="-9" y="-150" width="18" height="150" fill="url(#beam-${b.category})" class="beam"/>
        <ellipse class="pulse" rx="30" ry="14" fill="none" stroke="${n.color}" stroke-width="4"/>
        <ellipse rx="22" ry="10" fill="${n.color}" opacity=".9" stroke="#3b2f3a" stroke-width="3"/>
        <circle cy="-4" r="7" fill="#fff6c8" stroke="#3b2f3a" stroke-width="2.5"/>
        ${pill(n.icon, `${n.name} · ${count}`, n.color, n.labelSide)}</g>`;
    })
    .join('');

  const pinSvg =
    pins
      .map(
        (p) => `<g class="pin" transform="translate(${p.x.toFixed(0)} ${p.y.toFixed(0)})" data-slug="${esc(p.slug)}">
        <circle r="30" fill="transparent"/>
        <ellipse class="pulse" rx="20" ry="9" fill="none" stroke="#2f7d5b" stroke-width="3"/>
        <circle r="17" fill="#fff" stroke="#2f7d5b" stroke-width="3.5"/><text y="6" text-anchor="middle" font-size="18">${p.pos.icon}</text>
        <g class="lbl" data-off="22"><rect x="18" y="-12" width="150" height="24" rx="12" fill="#fff" stroke="#2f7d5b" stroke-width="2.5"/><text x="93" y="4.5" text-anchor="middle" class="city-label-text small">${esc(p.entry!.title.length > 24 ? p.entry!.title.slice(0, 23) + '…' : p.entry!.title)}</text></g></g>`
      )
      .join('') +
    (home
      ? `<g class="pin home" transform="translate(${home.x.toFixed(0)} ${home.y.toFixed(0)})" data-slug="${esc(home.entry.slug)}">
        <circle r="40" fill="transparent"/>
        <ellipse class="pulse" rx="30" ry="13" fill="none" stroke="#e8505b" stroke-width="4"/>
        <circle r="22" fill="#fff" stroke="#e8505b" stroke-width="4"/><text y="8" text-anchor="middle" font-size="24">🏠</text>
        <g class="lbl" data-off="26"><rect x="28" y="-15" width="104" height="30" rx="15" fill="#fff" stroke="#e8505b" stroke-width="3"/><text x="80" y="5.5" text-anchor="middle" class="city-label-text">About me</text></g></g>`
      : '');

  const landFill = (name: string) => (name === 'Manhattan' ? '#f6ecd6' : '#e8ecd0');
  const boroughSvg = Object.entries(BOROUGH_PATHS)
    .sort(([a], [b]) => Number(a === 'Manhattan') - Number(b === 'Manhattan'))
    .map(([name, d]) => `<path d="${d}" fill="${landFill(name)}" stroke="#3b2f3a" stroke-width="${name === 'Manhattan' ? 6 : 5}" stroke-linejoin="round"/>`)
    .join('');

  wrap.innerHTML = `
    <svg class="city-svg" aria-label="Map of New York City with my neighborhoods" role="img">
      <defs>${gradDefs}${buildingSymbol}
        <pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15q15-12 30 0t30 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/></pattern>
        <clipPath id="manhattan-clip"><path d="${BOROUGH_PATHS.Manhattan}"/></clipPath>
      </defs>
      <rect class="city-water" x="-8000" y="-8000" width="20000" height="20000" fill="#8fc9e0"/>
      <rect x="-8000" y="-8000" width="20000" height="20000" fill="url(#waves)"/>
      <g id="cam">
        <path d="${njPath}" fill="#dfe8c8" stroke="#3b2f3a" stroke-width="5" stroke-linejoin="round"/>
        ${boroughSvg}
        <g clip-path="url(#manhattan-clip)"><path d="${gridLines.join('')}" stroke="#3b2f3a" stroke-opacity=".11" stroke-width="2" fill="none"/></g>
        <polygon points="${poly(parkPts(CENTRAL_PARK))}" fill="#a5cf9a" stroke="#3b2f3a" stroke-width="4" stroke-linejoin="round"/>
        <path d="${smooth(parkPts(PROSPECT_PARK))}" fill="#a5cf9a" stroke="#3b2f3a" stroke-width="4" stroke-linejoin="round"/>
        <ellipse cx="${pond.x.toFixed(0)}" cy="${pond.y.toFixed(0)}" rx="26" ry="14" fill="#7fc4e0" stroke="#3b2f3a" stroke-width="3" transform="rotate(${ANGLE} ${pond.x.toFixed(0)} ${pond.y.toFixed(0)})"/>
        ${bridgeSvg}
        ${label([40.775, -74.03], 'HUDSON RIVER', -61)}${label([40.77, -73.935], 'EAST RIVER', -61)}${label([40.62, -74.03], 'UPPER BAY', 0)}
        ${label([40.67, -73.93], 'BROOKLYN', 0)}${label([40.755, -73.88], 'QUEENS', 0)}${label([40.83, -73.9], 'THE BRONX', 0)}${label([40.74, -74.065], 'NEW JERSEY', -61)}
        ${label([40.786, -73.966], 'CENTRAL PARK', -61, 'city-park-label')}${label([40.659, -73.969], 'PROSPECT PARK', -61, 'city-park-label')}
        <g transform="translate(${statue.x.toFixed(0)} ${statue.y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3" stroke-linejoin="round">
          <ellipse cy="16" rx="22" ry="9" fill="#cdbf9f"/><rect x="-8" y="-4" width="16" height="20" fill="#b9c9bb"/><path d="M-12 -4l12-26 12 26z" fill="#8fc7ae"/><path d="M10 -22l8-14" stroke-width="4"/><circle cx="19" cy="-39" r="5" fill="#ffd36e"/></g>
        ${boat([40.757, -74.0155], 'b1', '#e8505b')}${boat([40.727, -73.9715], 'b2', '#f6c453')}${boat([40.665, -74.035], 'b3', '#4f9d8f')}
        ${bldgSvg}
        ${pinSvg}
        ${beaconSvg}
      </g>
    </svg>
    <div class="city-hint"></div>
    <div class="city-zoom"><button data-zoom="in" aria-label="Zoom in">+</button><button data-zoom="out" aria-label="Zoom out">−</button><button data-zoom="fit" aria-label="Show the whole city" class="fit">⤢</button></div>`;

  const svg = wrap.querySelector<SVGSVGElement>('.city-svg')!;
  const cam = svg.querySelector<SVGGElement>('#cam')!;
  const hint = wrap.querySelector<HTMLElement>('.city-hint')!;
  const labels = [...svg.querySelectorAll<SVGGElement>('.lbl')];

  /* ---------- camera ---------- */
  let vw = 0, vh = 0, fit = 1, s = 1, tx = 0, ty = 0;
  let placed = false;
  const maxZoom = () => fit * 9;
  const small = () => vw < 700;

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
  /** World point (wx, wy) in the middle of the screen at zoom ns. */
  const centerOn = (wx: number, wy: number, ns: number) => { s = ns; tx = vw / 2 - wx * ns; ty = vh / 2 - wy * ns; clampPan(); apply(); };
  const fitView = () => centerOn(FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, fit);
  /** Phones start zoomed in on "About me"; swipe and pinch to explore the rest. */
  function startView(): void {
    if (small() && home) {
      centerOn(home.x, home.y - 40, fit * 2.5);
      hint.textContent = 'Swipe to explore · pinch to zoom out';
    } else {
      fitView();
      hint.textContent = 'Tap a glowing light, or zoom into one';
    }
  }
  function measure(): void {
    vw = wrap.clientWidth || innerWidth;
    vh = wrap.clientHeight || innerHeight;
    const oldFit = fit;
    fit = Math.min(vw / FOCUS.w, vh / FOCUS.h) * 0.98;
    if (!placed) { placed = true; startView(); }
    else if (s <= oldFit * 1.001) fitView();
    else { clampPan(); apply(); }
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
    const tx1 = vw / 2 - cx * ns, ty1 = vh / 2 - cy * ns;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms), e = ease(k);
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
      else afterZoom();
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
    if (dir === 'fit') { void animateTo(fit, FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, 450); return; }
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
        centerOn(b.x, b.y - 40, fit * 5.2);
        void animateTo(fit, FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, 800);
      }
    },
    hide() { cancelAnimationFrame(anim); wrap.style.display = 'none'; },
    destroy() { cancelAnimationFrame(anim); clearTimeout(settle); ro.disconnect(); wrap.remove(); },
  };
}
