import './style.css';
import { marked } from 'marked';
import { projects, siteInfo, type Media, type Project } from './content';
import { NEIGHBORHOODS, neighborhoodFor, type Category } from './neighborhoods';

type View = 'explore' | 'browse';

const app = document.getElementById('app')!;
let filter: Category | 'all' = 'all';

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const asset = (p: string) => import.meta.env.BASE_URL + p.replace(/^\//, '');

// "2025-05" -> "May 2025", "2025" -> "2025"
function formatDate(p: Project): string {
  if (p.dateLabel) return p.dateLabel;
  const d = p.date;
  const m = /^(\d{4})-(\d{2})/.exec(d);
  if (!m) return d;
  const month = new Date(Number(m[1]), Number(m[2]) - 1).toLocaleString('en-US', { month: 'short' });
  return `${month} ${m[1]}`;
}

const currentView =(): View => (location.hash === '#/explore' ? 'explore' : 'browse');

function header(view: View): string {
  const tab = (v: View, label: string) =>
    `<a class="tab${view === v ? ' active' : ''}" href="#/${v}" aria-current="${view === v ? 'page' : 'false'}">${label}</a>`;
  return `
    <header class="top">
      <div>
        <h1>${esc(siteInfo.name)}</h1>
        <p class="tagline">${esc(siteInfo.tagline)}</p>
      </div>
      <nav class="modes" aria-label="View mode">
        ${tab('explore', '🗽 Explore the city')}
        ${tab('browse', '📜 Browse all work')}
      </nav>
    </header>`;
}

function card(p: Project): string {
  const n = neighborhoodFor(p.category);
  const media = p.cover
    ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy" />`
    : `<span class="icon" aria-hidden="true">${n.icon}</span>`;
  return `
    <button class="card" data-slug="${esc(p.slug)}" style="--accent:${n.color}">
      <div class="media">${media}</div>
      <div class="meta">
        <span class="badge">${esc(n.name)}</span>
        <span class="date">${esc(formatDate(p))}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </button>`;
}

function renderBrowse(): string {
  const chip = (value: Category | 'all', label: string) =>
    `<button class="chip${filter === value ? ' active' : ''}" data-filter="${value}">${label}</button>`;
  const careerItems = projects.filter((p) => p.showIn.includes('career'));
  const shown = careerItems.filter((p) => filter === 'all' || p.category === filter);
  return `
    <section class="filters" aria-label="Filter by neighborhood">
      ${chip('all', 'All')}
      ${NEIGHBORHOODS.filter((n) => careerItems.some((p) => p.category === n.category))
        .map((n) => chip(n.category, `${n.icon} ${esc(n.name)}`))
        .join('')}
    </section>
    <section class="grid">${shown.map(card).join('') || '<p>Nothing here yet.</p>'}</section>
    <footer class="foot">${siteInfo.links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join('')}</footer>`;
}

function renderExplore(): string {
  return `
    <section class="placeholder">
      <h2>The city is under construction 🚧</h2>
      <p>The walkable New York map is coming. For now, you can browse everything in list form.</p>
      <a class="tab active" href="#/browse">📜 Browse all work</a>
    </section>`;
}

function mediaHtml(m: Media): string {
  const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  if (m.type === 'image') return `<figure class="media-item"><img src="${esc(asset(m.src))}" alt="${esc(m.caption ?? '')}" loading="lazy" />${cap}</figure>`;
  if (m.type === 'video') return `<figure class="media-item"><video src="${esc(asset(m.src))}" controls preload="none" playsinline></video>${cap}</figure>`;
  const id = encodeURIComponent(m.src);
  return `<figure class="media-item"><iframe src="https://www.youtube-nocookie.com/embed/${id}" loading="lazy" title="${esc(m.caption ?? 'Video')}" allowfullscreen></iframe>${cap}</figure>`;
}

function openProject(slug: string): void {
  const p = projects.find((x) => x.slug === slug);
  if (!p) return;
  const n = neighborhoodFor(p.category);
  const dialog = document.createElement('dialog');
  dialog.className = 'panel';
  dialog.style.setProperty('--accent', n.color);
  dialog.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <span class="badge">${n.icon} ${esc(n.name)}</span>
    <span class="date">${esc(formatDate(p))}</span>
    <h2>${esc(p.title)}</h2>
    <ul class="tags">${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${p.cover ? `<img class="hero" src="${esc(asset(p.cover))}" alt="" />` : ''}
    <div class="body">${marked.parse(p.body, { async: false })}</div>
    ${p.media.map(mediaHtml).join('')}
    <div class="links">${p.links
      .map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join('')}</div>`;
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as HTMLElement).closest('.close')) dialog.close();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
}

function render(): void {
  const view = currentView();
  app.innerHTML = header(view) + (view === 'explore' ? renderExplore() : renderBrowse());
}

app.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const chip = target.closest<HTMLElement>('[data-filter]');
  if (chip) {
    filter = chip.dataset.filter as Category | 'all';
    render();
    return;
  }
  const cardEl = target.closest<HTMLElement>('[data-slug]');
  if (cardEl) openProject(cardEl.dataset.slug!);
});

window.addEventListener('hashchange', render);
render();
