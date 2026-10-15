import { marked } from 'marked';
import type { Media, Project, SignInfo } from './content';
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

/** The neighborhood guide sign: what this neighborhood is, plus my recommendations when I have added them. */
export function openSign(info: SignInfo): void {
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
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as HTMLElement).closest('.close')) dialog.close();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
}

function shell(cls: string, inner: string): HTMLDialogElement {
  const dialog = document.createElement('dialog');
  dialog.className = `panel ${cls}`;
  dialog.innerHTML = `<button class="close" aria-label="Close">×</button>${inner}`;
  dialog.addEventListener('close', () => dialog.remove());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || (e.target as HTMLElement).closest('.close')) dialog.close();
  });
  document.body.appendChild(dialog);
  dialog.showModal();
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
