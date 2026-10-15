import { about, worldEntries, type Project } from '../content';
import { HOME_LL, NEIGHBORHOODS, neighborhoodFor, type Category } from '../neighborhoods';
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
function scaleAround(pts: [number, number][], k: number): [number, number][] {
  const la = pts.reduce((a, p) => a + p[0], 0) / pts.length, lo = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([y, x]) => [la + (y - la) * k, lo + (x - lo) * k]);
}
// Prospect Park, drawn bigger than life so Brooklyn has room to hold the hobbies
const PROSPECT_PARK = scaleAround([[40.6746, -73.9695], [40.665, -73.9783], [40.6545, -73.9734], [40.6535, -73.968], [40.664, -73.9622], [40.67, -73.9625]], 1.7);
const BRIDGES: { a: [number, number]; b: [number, number] }[] = [
  { a: [40.7122, -74.0003], b: [40.7005, -73.9965] }, // Brooklyn Bridge
  { a: [40.7157, -73.9922], b: [40.7035, -73.9903] }, // Manhattan Bridge
  { a: [40.7145, -73.9777], b: [40.7115, -73.9627] }, // Williamsburg Bridge
  { a: [40.7577, -73.961], b: [40.7539, -73.9387] }, // Queensboro Bridge
];

const PINK = '#f48fb1';
const LILAC = '#b794f6'; // the W line: C and W, for Christina Wu
const ICONS_LL: [number, number][] = [[40.7484, -73.9857], [40.7516, -73.9755], [40.7127, -74.0134]];
/** which of my two lines serve each neighborhood */
const SERVED: Record<string, ('C' | 'W')[]> = {
  games: ['C', 'W'], playtesting: ['C'], engineering: ['C', 'W'], apps: ['W'], modeling: ['C'], design: ['C', 'W'], experience: ['W'], involvement: ['W'], spots: ['C'],
};
const bulletSvg = (r: number, line: 'C' | 'W') => {
  const letter = line === 'C'
    ? `<path d="M${(r * 0.45).toFixed(1)} ${(-r * 0.5).toFixed(1)}A${(r * 0.58).toFixed(1)} ${(r * 0.58).toFixed(1)} 0 1 0 ${(r * 0.45).toFixed(1)} ${(r * 0.5).toFixed(1)}" fill="none" stroke="#fdf6ec" stroke-width="${(r * 0.3).toFixed(1)}" stroke-linecap="round"/>`
    : `<path d="M${(-r * 0.6).toFixed(1)} ${(-r * 0.45).toFixed(1)}L${(-r * 0.3).toFixed(1)} ${(r * 0.5).toFixed(1)}L0 ${(-r * 0.1).toFixed(1)}L${(r * 0.3).toFixed(1)} ${(r * 0.5).toFixed(1)}L${(r * 0.6).toFixed(1)} ${(-r * 0.45).toFixed(1)}" fill="none" stroke="#fdf6ec" stroke-width="${(r * 0.26).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<circle r="${r}" fill="${line === 'C' ? PINK : LILAC}" stroke="#3b2f3a" stroke-width="3"/>${letter}`;
};

export function createCity(root: HTMLElement, cb: CityCallbacks): CityHandle {
  const wrap = document.createElement('div');
  wrap.className = 'city';
  root.appendChild(wrap);

  /* ---------- beacons and pins ---------- */
  const beacons: Beacon[] = NEIGHBORHOODS.map((n) => ({
    category: n.category, ...xy(n.ll), live: worldEntries(n.category).length > 0,
  }));
  // hobby spots now live inside the Brooklyn neighborhood; only the About me pin sits on the map
  const pins: { slug: string; entry?: Project; x: number; y: number; pos: { icon: string } }[] = [];
  const home = about ? { entry: about, ...xy(HOME_LL) } : null;
  const keepClear: P[] = [...beacons, ...pins, ...(home ? [home] : []), ...ICONS_LL.map(xy)];

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
  // Downtown Brooklyn: a cluster of high-rises
  {
    const dtb = xy([40.6925, -73.989]);
    for (let dx = -120; dx <= 120; dx += 22) {
      for (let dy = -100; dy <= 100; dy += 20) {
        const d = Math.hypot(dx, dy);
        if (d > 125) continue;
        const x = dtb.x + dx + (dr() - 0.5) * 8, y = dtb.y + dy + (dr() - 0.5) * 8;
        if (!inside(BOROUGH_RINGS.Brooklyn, x, y) || inPark(x, y) || near(x, y, 50)) continue;
        const h = 38 + dr() * 30 - d * 0.12;
        bldgs.push({ x, y, w: h * 0.62, h, c: pick() });
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
        ${(SERVED[b.category] ?? []).map((l, i, a) => `<g transform="translate(${(i - (a.length - 1) / 2) * 26} 28)">${bulletSvg(11, l)}</g>`).join('')}
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


  /* ---------- polish: the C and W trains, more parks, landmarks, clouds ---------- */
  const NB = Object.fromEntries(NEIGHBORHOODS.map((n) => [n.category, n.ll])) as Record<string, [number, number]>;
  // Stylized routes that run through the neighborhoods each line really serves.
  const C_LINE: [number, number][] = [
    [40.8407, -73.94], [40.8277, -73.9442], [40.8004, -73.9582], [40.7916, -73.9645], [40.7814, -73.9722], [40.7683, -73.9819], NB.games,
    [40.7573, -73.9898], [40.7523, -73.9933], NB.playtesting, [40.7326, -74.0003], NB.design, [40.7131, -74.0093], NB.engineering, NB.modeling,
    [40.6993, -73.9905], [40.6924, -73.9873], [40.6884, -73.9851], [40.6745, -73.9765], NB.spots,
  ];
  const W_LINE: [number, number][] = [
    [40.7508, -73.9402], [40.7627, -73.9676], [40.7647, -73.9732], NB.experience, [40.7646, -73.9807], [40.7599, -73.9843], NB.games,
    [40.7497, -73.9877], NB.apps, NB.involvement, [40.7304, -73.9925], [40.7243, -73.9977], NB.design, [40.7133, -74.0069], NB.engineering, [40.703, -74.0129],
  ];
  const STOPS: { ll: [number, number]; name: string; line: 'C' | 'W' }[] = [
    { ll: [40.7683, -73.9819], name: 'Columbus Circle', line: 'C' }, { ll: [40.7573, -73.9898], name: 'Port Authority', line: 'C' },
    { ll: [40.7523, -73.9933], name: '34 St-Penn Station', line: 'C' }, { ll: [40.7326, -74.0003], name: 'W 4 St', line: 'C' },
    { ll: [40.7131, -74.0093], name: 'Chambers St', line: 'C' }, { ll: [40.6993, -73.9905], name: 'High St', line: 'C' },
    { ll: [40.6884, -73.9851], name: 'Hoyt-Schermerhorn', line: 'C' }, { ll: [40.6745, -73.9765], name: 'Grand Army Plaza', line: 'C' },
    { ll: [40.7508, -73.9402], name: 'Queensboro Plaza', line: 'W' }, { ll: [40.7627, -73.9676], name: 'Lexington Av/59 St', line: 'W' },
    { ll: [40.7647, -73.9732], name: '5 Av/59 St', line: 'W' }, { ll: [40.7646, -73.9807], name: '57 St-7 Av', line: 'W' },
    { ll: [40.7497, -73.9877], name: '34 St-Herald Sq', line: 'W' }, { ll: [40.7304, -73.9925], name: '8 St-NYU', line: 'W' },
    { ll: [40.7243, -73.9977], name: 'Prince St', line: 'W' }, { ll: [40.7133, -74.0069], name: 'City Hall', line: 'W' }, { ll: [40.703, -74.0129], name: 'Whitehall St', line: 'W' },
  ];
  const pathOf = (pts: [number, number][]) => 'M' + pts.map(xy).map((q) => `${q.x.toFixed(0)} ${q.y.toFixed(0)}`).join('L');
  const cPath = pathOf(C_LINE), wPath = pathOf(W_LINE);
  const lineSvg = (d: string, color: string) => `
    <path d="${d}" fill="none" stroke="#3b2f3a" stroke-width="11" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="2 14" stroke-linecap="round" class="c-flow"/>`;
  const endBullet = (ll: [number, number], line: 'C' | 'W') => { const q = xy(ll); return `<g transform="translate(${q.x.toFixed(0)} ${(q.y - 26).toFixed(0)})">${bulletSvg(14, line)}</g>`; };
  const cLineSvg = `
    ${lineSvg(cPath, PINK)}${lineSvg(wPath, LILAC)}
    ${STOPS.map((st) => {
      const q = xy(st.ll);
      const color = st.line === 'C' ? PINK : LILAC;
      return `<g transform="translate(${q.x.toFixed(0)} ${q.y.toFixed(0)})"><circle r="6" fill="#fdf6ec" stroke="#3b2f3a" stroke-width="3"/>
        <g class="lbl zoomed-far" data-off="16"><rect x="-62" y="-10" width="124" height="20" rx="10" fill="#fff" stroke="${color}" stroke-width="2.5"/><text y="4" text-anchor="middle" class="city-label-text tiny">${esc(st.name)}</text></g></g>`;
    }).join('')}
    ${endBullet(C_LINE[0], 'C')}${endBullet(NB.spots, 'C')}${endBullet(W_LINE[0], 'W')}${endBullet(W_LINE[W_LINE.length - 1], 'W')}`;

  const blob = (ll: [number, number], rx: number, ry: number, rot = ANGLE) => {
    const q = xy(ll);
    return `<ellipse cx="${q.x.toFixed(0)}" cy="${q.y.toFixed(0)}" rx="${rx}" ry="${ry}" fill="#a5cf9a" stroke="#3b2f3a" stroke-width="3" transform="rotate(${rot} ${q.x.toFixed(0)} ${q.y.toFixed(0)})"/>`;
  };
  const extraParks = [
    blob([40.7308, -73.9973], 15, 15), blob([40.7359, -73.9903], 14, 9), blob([40.7421, -73.9879], 12, 8), blob([40.7536, -73.9832], 22, 9),
    blob([40.7033, -74.017], 26, 20), blob([40.7015, -73.9965], 36, 10, -35), blob([40.7169, -73.9777], 18, 12),
  ].join('');

  const icon = (ll: [number, number], name: string, art: string) => {
    const q = xy(ll);
    return `<g transform="translate(${q.x.toFixed(0)} ${q.y.toFixed(0)})" stroke="#3b2f3a" stroke-width="3" stroke-linejoin="round"><g transform="scale(1.6)">${art}</g>
      <g class="lbl zoomed-only" data-off="14"><rect x="-80" y="-11" width="160" height="22" rx="11" fill="#fff" stroke="#3b2f3a" stroke-width="2"/><text y="4.5" text-anchor="middle" class="city-label-text small">${esc(name)}</text></g></g>`;
  };

  const libertyArt = `<g transform="scale(.66)">
      <ellipse cy="6" rx="46" ry="15" fill="#3b2f3a" opacity=".16" stroke="none"/>
      <ellipse cy="2" rx="40" ry="13" fill="#d8cda8"/><ellipse cy="-1" rx="34" ry="10" fill="#a5cf9a"/>
      <path d="M0 -12 L7 -7 L16 -9 L12 -2 L20 3 L10 4 L7 11 L0 5 L-7 11 L-10 4 L-20 3 L-12 -2 L-16 -9 L-7 -7z" fill="#cdbf9f" stroke-width="2.5"/>
      <rect x="-16" y="-14" width="32" height="10" rx="2" fill="#d6d0dc"/>
      <rect x="-12" y="-36" width="24" height="23" rx="2" fill="#cfc8d6"/>
      <path d="M-12 -30h24M-12 -22h24" stroke-width="1.5" opacity=".35"/>
      <rect x="-14" y="-40" width="28" height="6" rx="2" fill="#e3deea"/>
      <path d="M-9 -40 L-6 -72 L7 -72 L10 -40z" fill="#7fc4a8"/>
      <path d="M-4 -44 L-3 -68M2 -44 L2 -68M7 -44 L6 -68" stroke-width="1.6" opacity=".45"/>
      <path d="M-5 -66 L-10 -86" stroke="#3b2f3a" stroke-width="9" stroke-linecap="round"/>
      <path d="M-5 -66 L-10 -86" stroke="#7fc4a8" stroke-width="5" stroke-linecap="round"/>
      <path d="M-10 -86 L-10 -94" stroke-width="3"/>
      <path d="M-14 -94 h8 l-1 4 h-6z" fill="#7fc4a8" stroke-width="2"/>
      <path class="torch" d="M-10 -96 C-16 -103 -11 -108 -10 -113 C-8 -108 -4 -103 -10 -96z" fill="#ffd36e" stroke-width="2.2"/>
      <path d="M6 -62 L12 -56" stroke="#3b2f3a" stroke-width="8" stroke-linecap="round"/><path d="M6 -62 L12 -56" stroke="#7fc4a8" stroke-width="4" stroke-linecap="round"/>
      <rect x="9" y="-66" width="9" height="13" rx="1.5" transform="rotate(14 13 -60)" fill="#8fd0b4" stroke-width="2.2"/>
      <circle cx="-1" cy="-77" r="5.6" fill="#7fc4a8"/>
      <path d="M-6 -81 L-12 -88M-4 -82.5 L-8 -91M-1.5 -83 L-2 -92M1.5 -83 L4 -91M4 -81.5 L10 -88M6 -79 L13 -84" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M-6 -81 L-12 -88M-4 -82.5 L-8 -91M-1.5 -83 L-2 -92M1.5 -83 L4 -91M4 -81.5 L10 -88M6 -79 L13 -84" stroke="#9ad6bd" stroke-width="1" stroke-linecap="round"/>
    </g>`;
  const landmarkIcons = [
    icon([40.6892, -74.0445], 'Statue of Liberty', libertyArt),
    icon([40.7484, -73.9857], 'Empire State Building', '<ellipse cy="2" rx="18" ry="6" fill="#3b2f3a" opacity=".2" stroke="none"/><rect x="-14" y="-40" width="28" height="40" fill="#cfc8d6"/><rect x="-10" y="-62" width="20" height="22" fill="#bfb8c9"/><rect x="-6" y="-78" width="12" height="16" fill="#cfc8d6"/><path d="M0 -78V-102" stroke-width="3"/>'),
    icon([40.7516, -73.9755], 'Chrysler Building', '<ellipse cy="2" rx="16" ry="5" fill="#3b2f3a" opacity=".2" stroke="none"/><rect x="-11" y="-46" width="22" height="46" fill="#d9d3c4"/><path d="M-11 -46Q0 -84 11 -46z" fill="#e6e1d6"/><path d="M-7 -52Q0 -70 7 -52M-4 -62Q0 -74 4 -62" fill="none" stroke-width="2"/><path d="M0 -78V-94" stroke-width="3"/>'),
    icon([40.7127, -74.0134], 'One World Trade Center', '<ellipse cy="2" rx="16" ry="5" fill="#3b2f3a" opacity=".2" stroke="none"/><path d="M-12 0L-8 -66L0 -74L8 -66L12 0z" fill="#cfe0ee"/><path d="M0 -74V-112" stroke-width="3"/>'),
  ].join('');

  const cloud = (x: number, y: number, k: number, dur: number, delay: number) => `
    <g class="cloud" style="animation-duration:${dur}s;animation-delay:${delay}s"><g transform="translate(${x} ${y}) scale(${k})">
      <g transform="translate(60 120)" opacity=".13" fill="#3b2f3a"><ellipse rx="70" ry="22"/><ellipse cx="50" cy="-8" rx="46" ry="16"/></g>
      <g fill="#fff" opacity=".82"><ellipse rx="64" ry="20"/><ellipse cx="-34" cy="6" rx="38" ry="16"/><ellipse cx="38" cy="4" rx="46" ry="18"/><ellipse cx="6" cy="-14" rx="34" ry="18"/></g></g></g>`;
  const clouds = [cloud(-300, 700, 1.4, 150, 0), cloud(-300, 1500, 1.1, 190, -70), cloud(-300, 2300, 1.6, 170, -120), cloud(-300, 3000, 1.2, 210, -40)].join('');

  const streetLabel = (ll: [number, number], text: string, rot: number) => {
    const q = xy(ll);
    return `<text x="${q.x.toFixed(0)}" y="${q.y.toFixed(0)}" transform="rotate(${rot} ${q.x.toFixed(0)} ${q.y.toFixed(0)})" class="city-street-label zoomed-only" text-anchor="middle">${text}</text>`;
  };
  const streetLabels = [
    streetLabel([40.736, -74.0125], 'WEST SIDE HIGHWAY', -61), streetLabel([40.736, -73.9722], 'FDR DRIVE', -61), streetLabel([40.7565, -74.0095], 'HUDSON YARDS', -61),
    streetLabel([40.7088, -73.9976], 'BROOKLYN BRIDGE', 38), streetLabel([40.7138, -73.9885], 'MANHATTAN BRIDGE', 82), streetLabel([40.7125, -73.9695], 'WILLIAMSBURG BRIDGE', 14), streetLabel([40.7545, -73.95], 'QUEENSBORO BRIDGE', 20),
  ].join('');

  wrap.innerHTML = `
    <svg class="city-svg" aria-label="Map of New York City with my neighborhoods" role="img">
      <defs>${gradDefs}${buildingSymbol}
        <pattern id="waves" width="60" height="30" patternUnits="userSpaceOnUse"><path d="M0 15q15-12 30 0t30 0" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="2"/><animateTransform attributeName="patternTransform" type="translate" from="0 0" to="60 0" dur="9s" repeatCount="indefinite"/></pattern>
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
        ${extraParks}
        ${bridgeSvg}
        ${cLineSvg}
        ${streetLabels}
        ${label([40.775, -74.03], 'HUDSON RIVER', -61)}${label([40.77, -73.935], 'EAST RIVER', -61)}${label([40.62, -74.03], 'UPPER BAY', 0)}
        ${label([40.67, -73.93], 'BROOKLYN', 0)}${label([40.755, -73.88], 'QUEENS', 0)}${label([40.83, -73.9], 'THE BRONX', 0)}${label([40.74, -74.065], 'NEW JERSEY', -61)}
        ${label([40.786, -73.966], 'CENTRAL PARK', -61, 'city-park-label')}${label([40.6445, -73.9695], 'PROSPECT PARK', 0, 'city-park-label')}
        ${boat([40.757, -74.0155], 'b1', '#e8505b')}${boat([40.727, -73.9715], 'b2', '#f6c453')}${boat([40.665, -74.035], 'b3', '#4f9d8f')}
        ${bldgSvg}
        ${landmarkIcons}
        <rect class="night-rect" x="-4000" y="-4000" width="12000" height="12000" fill="#3c4a8c" opacity="0" style="mix-blend-mode:multiply;pointer-events:none"/>
        ${pinSvg}
        ${beaconSvg}
        <g class="clouds" style="pointer-events:none">${clouds}</g>
      </g>
    </svg>
    <div class="city-hint"></div>
    <svg class="city-compass" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28" fill="#fff" stroke="#3b2f3a" stroke-width="3"/><path d="M32 8l8 24-8-5-8 5z" fill="#f48fb1" stroke="#3b2f3a" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 56l-8-24 8 5 8-5z" fill="#cfc8d6" stroke="#3b2f3a" stroke-width="2.5" stroke-linejoin="round"/><text x="32" y="20" text-anchor="middle" font-size="11" font-weight="900" font-family="Arial, sans-serif" fill="#3b2f3a" stroke="#fff" stroke-width="3" paint-order="stroke">N</text></svg>
    <a class="city-skip" href="#/career">⏭ Skip to career page</a>
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
    wrap.classList.toggle('zoomed-far', s >= fit * 4);
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
  const ease = (x: number) => (1 - Math.cos(Math.PI * x)) / 2; // gentle in and out
  let anim = 0;
  // wheel and button zooms glide toward a target instead of jumping
  let tgt: { s: number; tx: number; ty: number } | null = null;
  let smoothRaf = 0;
  const stopSmooth = () => { cancelAnimationFrame(smoothRaf); smoothRaf = 0; tgt = null; };
  function zoomTarget(cx: number, cy: number, factor: number): void {
    cancelAnimationFrame(anim);
    const base = tgt ?? { s, tx, ty };
    const ns = Math.min(maxZoom(), Math.max(fit, base.s * factor));
    let ntx = cx - ((cx - base.tx) * ns) / base.s, nty = cy - ((cy - base.ty) * ns) / base.s;
    const mw = MAP_W * ns, mh = MAP_H * ns;
    ntx = mw <= vw ? (vw - mw) / 2 : Math.min(vw * 0.35, Math.max(vw * 0.65 - mw, ntx));
    nty = mh <= vh ? (vh - mh) / 2 : Math.min(vh * 0.35, Math.max(vh * 0.65 - mh, nty));
    tgt = { s: ns, tx: ntx, ty: nty };
    if (smoothRaf) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!tgt) { smoothRaf = 0; return; }
      const k = 1 - Math.exp(-dt * 9);
      s += (tgt.s - s) * k; tx += (tgt.tx - tx) * k; ty += (tgt.ty - ty) * k;
      apply();
      if (Math.abs(tgt.s - s) < 0.0008 && Math.abs(tgt.tx - tx) < 0.4 && Math.abs(tgt.ty - ty) < 0.4) {
        s = tgt.s; tx = tgt.tx; ty = tgt.ty; tgt = null; smoothRaf = 0; apply(); afterZoom();
        return;
      }
      smoothRaf = requestAnimationFrame(step);
    };
    smoothRaf = requestAnimationFrame(step);
  }
  function animateTo(ns: number, cx: number, cy: number, ms: number, onProgress?: (k: number) => void): Promise<void> {
    cancelAnimationFrame(anim);
    stopSmooth();
    const s0 = s, tx0 = tx, ty0 = ty;
    const tx1 = vw / 2 - cx * ns, ty1 = vh / 2 - cy * ns;
    const t0 = performance.now();
    return new Promise((resolve) => {
      const tick = (now: number) => {
        const k = Math.min(1, (now - t0) / ms), e = ease(k);
        s = s0 * Math.pow(ns / s0, e);
        tx = tx0 + (tx1 - tx0) * e; ty = ty0 + (ty1 - ty0) * e;
        apply();
        onProgress?.(k);
        if (k < 1) anim = requestAnimationFrame(tick); else resolve();
      };
      anim = requestAnimationFrame(tick);
    });
  }
  const beaconOf = (c: Category) => beacons.find((b) => b.category === c)!;

  async function flyInto(cat: Category): Promise<void> {
    const b = beaconOf(cat);
    // the neighborhood fades in while the camera is still gliding, so there is no hard cut
    let entered = false;
    await animateTo(fit * 5.2, b.x, b.y - 40, 1400, (k) => { if (!entered && k > 0.62) { entered = true; cb.enter(cat); } });
    if (!entered) cb.enter(cat);
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
    stopSmooth();
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
    zoomTarget(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });
  wrap.querySelector('.city-zoom')!.addEventListener('click', (e) => {
    const dir = (e.target as HTMLElement).closest<HTMLElement>('[data-zoom]')?.dataset.zoom;
    if (!dir) return;
    if (dir === 'fit') { void animateTo(fit, FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, 900); return; }
    zoomTarget(vw / 2, vh / 2, dir === 'in' ? 1.8 : 1 / 1.8);
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
        void animateTo(fit, FOCUS.x + FOCUS.w / 2, FOCUS.y + FOCUS.h / 2, 1300);
      }
    },
    hide() { cancelAnimationFrame(anim); stopSmooth(); wrap.style.display = 'none'; },
    destroy() { cancelAnimationFrame(anim); clearTimeout(settle); ro.disconnect(); wrap.remove(); },
  };
}
