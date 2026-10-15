import { marked } from 'marked';
import type { Media, Project } from './content';
import { neighborhoodFor } from './neighborhoods';
import { asset, esc, formatDate } from './util';

function mediaHtml(m: Media): string {
  const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  if (m.type === 'image') return `<figure class="media-item"><img src="${esc(asset(m.src))}" alt="${esc(m.caption ?? '')}" loading="lazy" />${cap}</figure>`;
  if (m.type === 'video') return `<figure class="media-item"><video src="${esc(asset(m.src))}" controls preload="none" playsinline></video>${cap}</figure>`;
  const id = encodeURIComponent(m.src);
  return `<figure class="media-item"><iframe src="https://www.youtube-nocookie.com/embed/${id}" loading="lazy" title="${esc(m.caption ?? 'Video')}" allowfullscreen></iframe>${cap}</figure>`;
}

/** Open a project in a modal panel. Used by the career page and the world. */
export function openProject(p: Project): void {
  const n = neighborhoodFor(p.category);
  const dialog = document.createElement('dialog');
  dialog.className = 'panel';
  dialog.style.setProperty('--accent', n.color);
  dialog.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <span class="badge">${n.icon} ${esc(n.label)}</span>
    <span class="date">${esc(formatDate(p))}</span>
    <h2>${esc(p.title)}</h2>
    <ul class="tags">${p.categories.map((c) => `<li class="place">📍 ${esc(neighborhoodFor(c).name)}</li>`).join('')}${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
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
