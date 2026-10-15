import type { Project } from './content';

export const esc = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Resolve a file in public/ against the site's base path (works on localhost and GitHub Pages). */
export const asset = (p: string): string => import.meta.env.BASE_URL + p.replace(/^\//, '');

// "2025-05" -> "May 2025", "2025" -> "2025"; dateLabel wins when present
export function formatDate(p: Project): string {
  if (p.dateLabel) return p.dateLabel;
  const m = /^(\d{4})-(\d{2})/.exec(p.date);
  if (!m) return p.date;
  const month = new Date(Number(m[1]), Number(m[2]) - 1).toLocaleString('en-US', { month: 'short' });
  return `${month} ${m[1]}`;
}
