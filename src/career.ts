import { projects, siteInfo, type Project } from './content';
import { CAREER_ORDER, neighborhoodFor, type Category } from './neighborhoods';
import { openProject } from './panel';
import { asset, esc, formatDate } from './util';

let filter: Category | 'all' = 'all';

function card(p: Project): string {
  const n = neighborhoodFor(p.category);
  const media = p.cover
    ? `<img src="${esc(asset(p.cover))}" alt="" loading="lazy" />`
    : `<span class="icon" aria-hidden="true">${n.icon}</span>`;
  return `
    <button class="card" data-slug="${esc(p.slug)}" style="--accent:${n.color}">
      <div class="media">${media}</div>
      <div class="meta">
        <span class="badge">${esc(n.label)}</span>
        <span class="date">${esc(formatDate(p))}</span>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.summary)}</p>
        <ul class="tags"><li class="place">📍 ${esc(n.name)}</li>${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
      </div>
    </button>`;
}

/** The career page: every professional entry, grouped by category, neighborhood shown as a tag. */
export function renderCareer(root: HTMLElement): void {
  const items = projects.filter((p) => p.showIn.includes('career'));
  const cats = CAREER_ORDER.filter((c) => items.some((p) => p.category === c));
  const shown = items.filter((p) => filter === 'all' || p.category === filter);
  const chip = (value: Category | 'all', label: string) =>
    `<button class="chip${filter === value ? ' active' : ''}" data-filter="${value}">${label}</button>`;

  root.innerHTML = `
    <section class="filters" aria-label="Filter by category">
      ${chip('all', 'All')}
      ${cats.map((c) => chip(c, `${neighborhoodFor(c).icon} ${esc(neighborhoodFor(c).label)}`)).join('')}
    </section>
    <section class="grid">${shown.map(card).join('') || '<p>Nothing here yet.</p>'}</section>
    <footer class="foot">${siteInfo.links
      .map((l) => `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join('')}</footer>`;

  root.onclick = (e) => {
    const target = e.target as HTMLElement;
    const chipEl = target.closest<HTMLElement>('[data-filter]');
    if (chipEl) {
      filter = chipEl.dataset.filter as Category | 'all';
      renderCareer(root);
      return;
    }
    const cardEl = target.closest<HTMLElement>('[data-slug]');
    const p = projects.find((x) => x.slug === cardEl?.dataset.slug);
    if (p) openProject(p);
  };
}
