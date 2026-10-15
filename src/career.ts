import { projects, siteInfo, type Project } from './content';
import { CAREER_ORDER, neighborhoodFor, type Category } from './neighborhoods';
import { openProject } from './panel';
import { asset, esc, formatDate } from './util';

let filter: Category | 'all' = 'all';

const STROKE = 'fill="none" stroke="#3b2f3a" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"';
// Floating decorations: [svg, left %, top %, size px, parallax speed, rotation deg]
const ART: [string, number, number, number, number, number][] = [
  [`<svg viewBox="0 0 80 50" ${STROKE}><rect x="4" y="6" width="72" height="38" rx="19" fill="#3d4a7a"/><path d="M24 17v16M16 25h16" stroke="#fdf6ec" stroke-width="5"/><circle cx="56" cy="20" r="4.5" fill="#f6c453"/><circle cx="64" cy="29" r="4.5" fill="#4f9d8f"/></svg>`, 64, 1.5, 110, 0.18, -12],
  [`<svg viewBox="0 0 60 60" ${STROKE}><path d="M30 5l7 17 18 2-14 12 5 18-16-10-16 10 5-18L5 24l18-2z" fill="#f6c453"/></svg>`, 88, 9, 64, 0.32, 14],
  [`<svg viewBox="0 0 70 70" ${STROKE}><path d="M35 6l24 12v26L35 56 11 44V18z" fill="#9a6fd1"/><path d="M11 18l24 12 24-12M35 30v26" /></svg>`, 82, 24, 84, 0.22, 8],
  [`<svg viewBox="0 0 90 50" ${STROKE}><path d="M26 8L6 25l20 17M64 8l20 17-20 17M52 4L38 46" stroke="#4c7bd9" stroke-width="5"/></svg>`, 4, 30, 100, 0.28, 6],
  [`<svg viewBox="0 0 60 60" ${STROKE}><rect x="8" y="8" width="44" height="44" rx="9" fill="#fdf6ec"/><circle cx="21" cy="21" r="4" fill="#e8505b"/><circle cx="39" cy="21" r="4" fill="#e8505b"/><circle cx="30" cy="30" r="4" fill="#e8505b"/><circle cx="21" cy="39" r="4" fill="#e8505b"/><circle cx="39" cy="39" r="4" fill="#e8505b"/></svg>`, 90, 42, 70, 0.4, -16],
  [`<svg viewBox="0 0 70 50" ${STROKE}><path d="M6 36c0-10 6-14 16-14h26c10 0 16 4 16 14v6H6z" fill="#f6c453"/><path d="M20 22l6-12h18l6 12" fill="#fff3c4"/><circle cx="20" cy="43" r="6" fill="#4a4354"/><circle cx="52" cy="43" r="6" fill="#4a4354"/></svg>`, 7, 52, 96, 0.2, -4],
  [`<svg viewBox="0 0 60 60" ${STROKE}><circle cx="30" cy="30" r="22" fill="#a5cf9a"/><path d="M14 34c8-8 14 6 22-2s8-6 10-4" /></svg>`, 86, 60, 74, 0.35, 0],
  [`<svg viewBox="0 0 60 60" ${STROKE}><path d="M30 52S6 38 6 21c0-8 6-13 12-13 6 0 10 4 12 8 2-4 6-8 12-8 6 0 12 5 12 13 0 17-24 31-24 31z" fill="#e8505b"/></svg>`, 12, 70, 70, 0.3, 10],
  [`<svg viewBox="0 0 60 60" ${STROKE}><path d="M8 8h44v34H28L16 54V42H8z" fill="#cfe8f3"/><path d="M18 20h24M18 30h16" /></svg>`, 92, 76, 80, 0.26, -8],
  [`<svg viewBox="0 0 60 60" ${STROKE}><path d="M30 6v48M6 30h48M14 14l32 32M46 14L14 46" stroke="#e9a23b" stroke-width="4"/></svg>`, 5, 86, 60, 0.38, 20],
  [`<svg viewBox="0 0 70 50" ${STROKE}><rect x="6" y="6" width="58" height="38" rx="6" fill="#fdf6ec"/><path d="M12 36l12-14 10 10 8-8 14 12" stroke="#4f9d8f"/><circle cx="50" cy="18" r="4" fill="#f6c453"/></svg>`, 84, 92, 90, 0.2, 6],
];

const parts = (p: Project) => p.categories.map((c) => neighborhoodFor(c));

function card(p: Project): string {
  const n = neighborhoodFor(p.category);
  const media = p.cover
    ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy" />`
    : `<span class="icon" aria-hidden="true">${n.icon}</span>`;
  return `
    <button class="card reveal" data-slug="${esc(p.slug)}" style="--accent:${n.color}">
      <div class="media">${media}</div>
      <div class="meta">
        <span class="badge">${esc(n.label)}</span>
        <span class="date">${esc(formatDate(p))}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <ul class="tags">${parts(p).map((x) => `<li class="place">📍 ${esc(x.name)}</li>`).join('')}${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </button>`;
}

function timelineItem(p: Project): string {
  const n = neighborhoodFor(p.category);
  return `
    <li class="tl-item reveal" style="--accent:${n.color}">
      <span class="tl-dot"></span>
      <button class="tl-card" data-slug="${esc(p.slug)}">
        <span class="date">${esc(formatDate(p))}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </button>
    </li>`;
}

function photoHtml(): string {
  const src = siteInfo.photo ? asset(siteInfo.photo) : asset('art-v3/player.svg');
  const cls = siteInfo.photo ? 'photo' : 'photo illustrated';
  return `
    <div class="photo-wrap">
      <span class="ring"></span>
      <div class="${cls}"><img src="${esc(src)}" alt="Portrait of ${esc(siteInfo.name)}" /></div>
      <span class="chip-float c1">🎮 Game dev</span><span class="chip-float c2">💻 Engineer</span><span class="chip-float c3">🧪 Playtester</span>
    </div>`;
}

const careerItems = () => projects.filter((p) => p.showIn.includes('career'));

function projectsBody(): string {
  const items = careerItems();
  const cats = CAREER_ORDER.filter((c) => items.some((p) => p.categories.includes(c)));
  const shown = items.filter((p) => filter === 'all' || p.categories.includes(filter));
  const chip = (value: Category | 'all', label: string) =>
    `<button class="chip${filter === value ? ' active' : ''}" data-filter="${value}">${label}</button>`;
  return `<div class="filters">${chip('all', 'All')}${cats.map((c) => chip(c, `${neighborhoodFor(c).icon} ${esc(neighborhoodFor(c).label)}`)).join('')}</div>
      <div class="grid">${shown.map(card).join('') || '<p>Nothing here yet.</p>'}</div>`;
}

function page(): string {
  const jobs = careerItems().filter((p) => p.category === 'experience');

  return `
    <div class="bg-art" aria-hidden="true">${ART.map(
      ([svg, l, t, size, speed, rot]) =>
        `<span class="art-item" data-speed="${speed}" style="left:${l}%;top:${t}%;width:${size}px;--rot:${rot}deg"><span class="float">${svg}</span></span>`
    ).join('')}</div>

    <section class="hero" id="career-top">
      <div class="hero-text">
        <p class="eyebrow reveal">${esc(siteInfo.roles)}</p>
        <h1 class="reveal">${esc(siteInfo.name)}</h1>
        <p class="headline reveal">${esc(siteInfo.headline)}</p>
        <p class="intro reveal">${esc(siteInfo.intro)}</p>
        <div class="hero-actions reveal">
          <a class="btn-big" href="#/explore">🗽 Explore my NYC</a>
          ${siteInfo.links.map((l) => `<a class="btn-ghost" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}
          ${(siteInfo.resumes ?? []).map((l) => `<a class="btn-ghost" href="${esc(l.url.startsWith('http') ? l.url : asset(l.url))}" target="_blank" rel="noopener">📄 ${esc(l.label)}</a>`).join('')}
        </div>
      </div>
      ${photoHtml()}
    </section>

    <section class="stats">
      ${siteInfo.stats.map((s) => `<div class="stat reveal"><b data-count="${s.value}" data-suffix="${esc(s.suffix ?? '')}">0${esc(s.suffix ?? '')}</b><span>${esc(s.label)}</span></div>`).join('')}
    </section>

    <section class="block" id="career-experience">
      <h2 class="reveal">Experience</h2>
      <ol class="timeline">${jobs.map(timelineItem).join('')}</ol>
    </section>

    ${siteInfo.education ? `<section class="block" id="career-education">
      <h2 class="reveal">Education</h2>
      <div class="edu reveal"><div><h3>${esc(siteInfo.education.school)}</h3><p>${esc(siteInfo.education.degree)} · ${esc(siteInfo.education.years)}</p></div>
        <ul class="awards">${siteInfo.education.awards.map((a) => `<li>🏅 ${esc(a)}</li>`).join('')}</ul></div>
    </section>` : ''}

    <section class="block" id="career-skills">
      <h2 class="reveal">Skills</h2>
      <div class="skills">${siteInfo.skills.map((g) => `
        <div class="skill-group reveal"><h3>${esc(g.group)}</h3><ul>${g.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>`).join('')}
      </div>
    </section>

    <section class="block" id="career-projects">
      <h2 class="reveal">Work by category</h2>
      <div id="proj-body">${projectsBody()}</div>
    </section>

    <footer class="foot big">
      <p class="reveal">Want to see more? <a href="#/explore">Walk around my NYC</a> to meet the people, places, and projects behind this page.</p>
      <div>${siteInfo.links.map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join('')}</div>
    </footer>`;
}

/**
 * Render the career page. Returns a cleanup function that removes the scroll listeners.
 */
export function renderCareer(root: HTMLElement): () => void {
  root.innerHTML = page();

  /* reveal on scroll */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }),
    { threshold: 0.12 }
  );
  root.querySelectorAll('.reveal').forEach((n) => io.observe(n));

  /* count-up stats */
  const countIo = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    countIo.unobserve(e.target);
    const el = e.target as HTMLElement;
    const goal = Number(el.dataset.count), suffix = el.dataset.suffix ?? '';
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = goal + suffix; return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / 1100);
      el.textContent = Math.round(goal * (1 - Math.pow(1 - k, 3))) + suffix;
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.6 });
  root.querySelectorAll('[data-count]').forEach((n) => countIo.observe(n));

  /* parallax background + timeline progress */
  const items = [...root.querySelectorAll<HTMLElement>('.art-item')];
  const timeline = root.querySelector<HTMLElement>('.timeline');
  let ticking = false;
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    for (const it of items) it.style.setProperty('--py', `${(y * Number(it.dataset.speed) * -1).toFixed(1)}px`);
    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const k = Math.max(0, Math.min(1, (innerHeight * 0.65 - r.top) / r.height));
      timeline.style.setProperty('--tl', k.toFixed(3));
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  update();

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const chipEl = target.closest<HTMLElement>('[data-filter]');
    if (chipEl) {
      filter = chipEl.dataset.filter as Category | 'all';
      const body = root.querySelector<HTMLElement>('#proj-body')!;
      body.innerHTML = projectsBody();
      body.querySelectorAll('.reveal').forEach((n) => io.observe(n));
      return;
    }
    const cardEl = target.closest<HTMLElement>('[data-slug]');
    const p = projects.find((x) => x.slug === cardEl?.dataset.slug);
    if (p) openProject(p);
  };

  return () => {
    io.disconnect();
    countIo.disconnect();
    window.removeEventListener('scroll', onScroll);
  };
}
