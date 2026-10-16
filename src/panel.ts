import { marked } from 'marked';
import type { Media, Project, SignInfo } from './content';
import { neighborhoodFor } from './neighborhoods';
import { asset, esc, formatDate } from './util';

function mediaEl(m: Media): string {
  const poster = m.poster ? ` poster="${esc(asset(m.poster))}"` : '';
  if (m.type === 'image') return `<img src="${esc(asset(m.src))}" alt="${esc(m.title ?? m.caption ?? '')}" loading="lazy" />`;
  if (m.type === 'video') return `<video src="${esc(asset(m.src))}"${poster} controls controlsList="nofullscreen" preload="none" playsinline muted></video><button type="button" class="vfs" aria-label="Full screen" title="Full screen">⛶</button>`;
  if (m.type === 'youtube') return `<iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(m.src)}" loading="lazy" title="${esc(m.title ?? m.caption ?? 'Video')}" allowfullscreen></iframe>`;
  return '';
}

function mediaHtml(m: Media, i: number): string {
  // a feature block: numbered heading, the media, then what I built and what the video shows
  if (m.title) {
    const work = m.work ? `<div class="feat-label">The work</div><div class="feat-text">${marked.parse(m.work, { async: false })}</div>` : '';
    const watch = m.caption ? `<div class="feat-label">${m.type === 'image' ? 'In the shot' : 'In the video'}</div><div class="feat-text"><p>${esc(m.caption)}</p></div>` : '';
    const code = m.code ? `<pre class="feat-code"><code>${esc(m.code)}</code></pre>` : '';
    return `<section class="feature"><h3><span class="feat-n">${i + 1}</span>${esc(m.title)}</h3>${m.type === 'note' ? '' : `<figure class="media-item">${mediaEl(m)}</figure>`}${work}${code}${watch}</section>`;
  }
  const cap = m.caption ? `<figcaption>${esc(m.caption)}</figcaption>` : '';
  return `<figure class="media-item">${mediaEl(m)}${cap}</figure>`;
}

/**
 * Shared dialog wiring. The X closes on tap (pointerup as well as click, since phones can drop the click),
 * a tap outside the card closes it, and the tap that opened the card can't immediately close it.
 */
function wire(dialog: HTMLDialogElement): void {
  const openedAt = performance.now();
  const closeIt = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener('close', () => dialog.remove());
  // Phones sometimes drop the click, so pointerup is the fallback. It waits, so the click that follows a tap lands on the X
  // and not on whatever card sits behind the dialog once it has closed.
  dialog.addEventListener('pointerup', (e) => {
    if ((e.target as HTMLElement).closest('.close')) window.setTimeout(closeIt, 400);
  });
  dialog.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.close')) { closeIt(); return; }
    if ((e.target as HTMLElement).closest('.vfs, .media-item.maxed')) return; // the full-window video sits outside the card's box
    if (performance.now() - openedAt < 450) return; // the finger that opened the card
    const r = dialog.getBoundingClientRect();
    const outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) closeIt();
  });
  wireVideos(dialog);
  document.body.appendChild(dialog);
  dialog.showModal();
}


/** Full screen for videos. Native full screen is flaky inside a dialog, so try it first and fall back to a fixed full-window view. */
function wireVideos(dialog: HTMLDialogElement): void {
  dialog.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('.vfs');
    if (!btn) return;
    const fig = btn.closest<HTMLElement>('.media-item')!;
    const video = fig.querySelector('video')!;
    if (fig.classList.contains('maxed')) { fig.classList.remove('maxed'); btn.textContent = '⛶'; return; }
    try {
      if (video.requestFullscreen) {
        // some embedded browsers never answer, so don't wait forever
        await Promise.race([video.requestFullscreen(), new Promise((r) => setTimeout(r, 500))]);
        if (document.fullscreenElement) return;
      } else {
        const v = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
        if (v.webkitEnterFullscreen) { v.webkitEnterFullscreen(); return; }
      }
    } catch { /* fall through to the in-page view */ }
    fig.classList.add('maxed');
    btn.textContent = '✕';
  });
}

/** Only one card at a time, so a stray tap can't stack cards behind each other. */
const cardOpen = () => !!document.querySelector('dialog.panel[open]');

/**
 * Open a project in a modal panel. On the career page every category shows its neighborhood as a tag. Opened from the map, the card
 * shows only the neighborhood you are standing in, and its other categories appear as separate overlap tags.
 */
export function openProject(p: Project, _from: 'career' | 'world' = 'career'): void {
  if (cardOpen()) return;
  const n = neighborhoodFor(p.category);
  // one place tag (where its building stands on the map), with its other categories as overlap chips
  const placeTags = `<li class="place">📍 ${esc(n.name)}</li>${p.categories.slice(1).map((c) => `<li class="overlap" style="--oc:${neighborhoodFor(c).color}">${neighborhoodFor(c).icon} ${esc(neighborhoodFor(c).label)}</li>`).join('')}`;
  const dialog = document.createElement('dialog');
  dialog.className = 'panel';
  dialog.style.setProperty('--accent', n.color);
  dialog.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <span class="badge">${n.icon} ${esc(n.label)}</span>
    <span class="date">${esc(formatDate(p))}</span>
    <h2>${esc(p.title)}</h2>
    <ul class="tags">${placeTags}${p.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>
    ${p.cover ? `<img class="hero" src="${esc(asset(p.cover))}" alt="" />` : ''}
    <div class="body">${marked.parse(p.body, { async: false })}</div>
    ${p.media.some((m) => m.title) ? '<h3 class="feat-head">What I built</h3>' : ''}${p.media.map(mediaHtml).join('')}
    <div class="links">${p.links
      .map((l) => `<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`)
      .join('')}</div>`;
  wire(dialog);
}

/** The neighborhood guide sign: what this neighborhood is, plus my recommendations when I have added them. */
export function openSign(info: SignInfo): void {
  if (cardOpen()) return;
  const n = neighborhoodFor(info.category);
  const dialog = document.createElement('dialog');
  dialog.className = 'panel sign-panel';
  dialog.style.setProperty('--accent', n.color);
  dialog.innerHTML = `
    <button class="close" aria-label="Close">×</button>
    <span class="badge">${n.icon} ${esc(n.name)} · ${esc(n.label)}</span>
    <h2>${esc(info.title || n.name)}</h2>
    <div class="body">${marked.parse(info.body, { async: false })}</div>
    ${info.picks.length ? `<h3 class="picks-h">📍 My picks</h3><ul class="picks">${info.picks.map((p) => `<li><b>${esc(p.name)}</b>${p.note ? `<span>${esc(p.note)}</span>` : ''}</li>`).join('')}</ul>` : ''}`;
  wire(dialog);
}

function shell(cls: string, inner: string): HTMLDialogElement {
  document.querySelector('dialog.panel[open]')?.dispatchEvent(new Event('close')); // replace whatever is open
  const dialog = document.createElement('dialog');
  dialog.className = `panel ${cls}`;
  dialog.innerHTML = `<button class="close" aria-label="Close">×</button>${inner}`;
  wire(dialog);
  return dialog;
}

/** Show the resume PDF right on the page, with open-in-new-tab and download buttons (phones often can't preview PDFs inline). */
export function openResume(label: string, url: string): void {
  const href = esc(url);
  shell('wide resume-panel', `
    <h2>📄 ${esc(label)}</h2>
    <div class="links"><a class="btn" href="${href}" target="_blank" rel="noopener">Open in a new tab</a><a class="btn pink" href="${href}" download>⬇ Download PDF</a></div>
    <iframe class="pdf" src="${href}#view=FitH" title="${esc(label)}"></iframe>
    <p class="hint">If the preview doesn't show on your device, use the buttons above.</p>`);
}

/**
 * A contact form. With a form endpoint configured (contactEndpoint in site.json) it sends the message directly;
 * otherwise it opens the visitor's email app with the message filled in.
 */
export function openContact(email: string, endpoint?: string): void {
  const dlg = shell('contact-panel', `
    <h2>✉️ Say hi</h2>
    <p class="muted">Send me a note about a project, a role, or just to chat.</p>
    <form class="contact-form" novalidate>
      <label>Your name<input name="name" required autocomplete="name" /></label>
      <label>Your email<input name="email" type="email" required autocomplete="email" /></label>
      <label>Message<textarea name="message" rows="5" required></textarea></label>
      <input name="website" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
      <div class="form-actions"><button class="btn" type="submit">Send message</button><button class="btn alt" type="button" data-copy>Copy my email</button></div>
      <p class="form-status" role="status"></p>
    </form>`);
  const form = dlg.querySelector<HTMLFormElement>('form')!;
  const status = dlg.querySelector<HTMLElement>('.form-status')!;
  dlg.querySelector('[data-copy]')!.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(email); status.textContent = `Copied ${email}`; }
    catch { status.textContent = `My email is ${email}`; }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(form);
    const name = String(f.get('name') ?? '').trim(), from = String(f.get('email') ?? '').trim(), message = String(f.get('message') ?? '').trim();
    if (f.get('website')) return; // spam trap
    if (!name || !/^\S+@\S+\.\S+$/.test(from) || !message) { status.textContent = 'Please add your name, a valid email, and a message.'; return; }
    if (endpoint) {
      status.textContent = 'Sending…';
      try {
        const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ name, email: from, message }) });
        if (!res.ok) throw new Error(String(res.status));
        form.reset();
        status.textContent = 'Thanks! Your message is on its way. I will get back to you soon.';
        return;
      } catch {
        status.textContent = 'That did not go through, so I am opening your email app instead.';
      }
    }
    const subject = encodeURIComponent(`Hello from your portfolio, from ${name}`);
    const body = encodeURIComponent(`Hi Christina,\n\n${message}\n\n${name}\n${from}`);
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    status.textContent = `Your email app should open with the message ready. If it doesn't, copy my email (${email}) and paste it in.`;
  });
}
