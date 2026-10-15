import './style.css';
import './career.css';
import { renderCareer } from './career';
import { siteInfo, worldEntries } from './content';
import { NEIGHBORHOODS, neighborhoodFor, type Category } from './neighborhoods';
import { openContact, openProject, openResume, openSign } from './panel';
import { asset, esc } from './util';
import { createCity, type CityHandle } from './world/city';
import { createScene, type SceneHandle } from './world/scene';

const app = document.getElementById('app')!;
const careerEl = document.createElement('div');
careerEl.id = 'career';
const worldRoot = document.createElement('div');
worldRoot.id = 'world-root';
const hud = document.createElement('div');
hud.id = 'hud';
const toastEl = document.createElement('div');
toastEl.id = 'toast';
app.append(hud, careerEl, worldRoot, toastEl);

let city: CityHandle | null = null;
let scene: SceneHandle | null = null;
let sceneCategory: Category | null = null;
let toastTimer = 0;
let careerCleanup: (() => void) | null = null;

// day / night: follows the visitor's clock until they press the toggle
const saved = localStorage.getItem('theme');
const hour = new Date().getHours();
const setNight = (on: boolean) => document.body.classList.toggle('night', on);
setNight(saved ? saved === 'night' : hour < 6 || hour >= 19);

function toast(msg: string): void {
  toastEl.textContent = msg;
  toastEl.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastEl.style.display = 'none'; }, 3200);
}

function renderHud(mode: 'city' | 'scene' | 'career', category?: Category): void {
  const tab = (href: string, label: string, active: boolean) =>
    `<a class="tab${active ? ' active' : ''}" href="${href}" ${active ? 'aria-current="page"' : ''}>${label}</a>`;
  const nav = `<nav class="modes" aria-label="View mode">${tab('#/explore', '🗽 My NYC', mode !== 'career')}${tab('#/career', '📜 Career', mode === 'career')}</nav>`;
  if (mode === 'career') {
    hud.className = 'hud-career';
    hud.innerHTML = `<a class="brand" href="#/career" data-scroll="top">${esc(siteInfo.name)}</a>
      <div class="anchors"><a href="#/career" data-scroll="experience">Experience</a><a href="#/career" data-scroll="skills">Skills</a><a href="#/career" data-scroll="projects">Work</a><a href="#/career" data-scroll="contact">Contact</a></div>${nav}`;
    return;
  }
  hud.className = 'hud-world';
  const resume = siteInfo.resumes?.[0];
  const tools = `<div class="hud-tools">
    ${resume ? `<a href="${esc(asset(resume.url))}" target="_blank" rel="noopener" data-resume data-label="${esc(resume.label)}">📄 Resume</a>` : ''}
    ${siteInfo.email ? `<a href="mailto:${esc(siteInfo.email)}" data-contact>✉️ Contact</a>` : ''}
    <button class="night-toggle" aria-label="Switch between day and night">${document.body.classList.contains('night') ? '☀️ Day' : '🌙 Night'}</button>
  </div>`;
  if (mode === 'scene' && category) {
    const n = neighborhoodFor(category);
    hud.innerHTML = `<h1>${n.icon} ${esc(n.name)}</h1><p>${esc(n.blurb)}. Walk with WASD or the arrow keys, or tap to move. Press E at a building.</p>
      <a class="hud-btn" href="#/explore">← NYC map</a>${nav}${tools}`;
  } else {
    hud.innerHTML = `<h1>${esc(siteInfo.name)}'s NYC</h1><p>${esc(siteInfo.tagline)}</p>${nav}${tools}`;
  }
}

function stopScene(fade = false): void {
  if (fade) scene?.leave(); else scene?.destroy();
  scene = null;
}

function show(mode: 'career' | 'world'): void {
  careerEl.style.display = mode === 'career' ? '' : 'none';
  worldRoot.style.display = mode === 'world' ? '' : 'none';
  document.body.classList.toggle('mode-world', mode === 'world');
}

function route(): void {
  const hash = location.hash || '#/explore';

  careerCleanup?.();
  careerCleanup = null;
  if (hash.startsWith('#/career')) {
    stopScene();
    show('career');
    renderHud('career');
    careerCleanup = renderCareer(careerEl);
    window.scrollTo(0, 0);
    return;
  }

  show('world');
  const cat = /^#\/explore\/(\w+)/.exec(hash)?.[1] as Category | undefined;
  city ??= createCity(worldRoot, {
    enter: (c) => { location.hash = `#/explore/${c}`; },
    open: (entry) => openProject(entry),
    toast,
  });

  if (cat && NEIGHBORHOODS.some((n) => n.category === cat) && worldEntries(cat).length > 0) {
    if (sceneCategory === cat && scene) return;
    stopScene();
    sceneCategory = cat;
    scene = createScene(worldRoot, cat, {
      exit: () => { location.hash = '#/explore'; },
      open: (entry) => openProject(entry),
      sign: (info) => openSign(info),
    });
    renderHud('scene', cat);
    window.setTimeout(() => city?.hide(), 1100); // the scene fades in over the map, which keeps gliding underneath
    return;
  }

  const from = sceneCategory ?? undefined;
  stopScene(true); // fade out while the map zooms back out
  sceneCategory = null;
  city.show(from);
  renderHud('city');
}

// the career nav scrolls to sections instead of changing the route
hud.addEventListener('click', (e) => {
  const a = (e.target as HTMLElement).closest<HTMLElement>('[data-scroll]');
  if (!a || !location.hash.startsWith('#/career')) return;
  e.preventDefault();
  document.getElementById(`career-${a.dataset.scroll}`)?.scrollIntoView({ behavior: 'smooth' });
});

hud.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('.night-toggle')) return;
  const on = !document.body.classList.contains('night');
  setNight(on);
  localStorage.setItem('theme', on ? 'night' : 'day');
  (e.target as HTMLElement).closest('.night-toggle')!.textContent = on ? '☀️ Day' : '🌙 Night';
});

// resume viewer and contact form, from anywhere on the site
document.addEventListener('click', (e) => {
  const t = e.target as HTMLElement;
  const r = t.closest<HTMLElement>('[data-resume]');
  if (r) { e.preventDefault(); openResume(r.dataset.label ?? 'Resume', r.getAttribute('href')!); return; }
  if (t.closest('[data-contact]') && siteInfo.email) { e.preventDefault(); openContact(siteInfo.email, siteInfo.contactEndpoint || undefined); }
});

window.addEventListener('hashchange', route);
route();
