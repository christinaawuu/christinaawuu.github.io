import { parse } from 'yaml';
import { NEIGHBORHOODS, type Category } from './neighborhoods';
import site from '../content/site.json';

export interface ProjectLink {
  label: string;
  url: string;
}

export type Surface = 'world' | 'career';

export interface Media {
  type: 'image' | 'video' | 'youtube';
  src: string;
  caption?: string;
}

export interface Project {
  slug: string;
  title: string;
  /** primary category: decides the neighborhood in the world */
  category: Category;
  /** every category it shows under on the career page (primary first, then `alsoIn`) */
  categories: Category[];
  date: string;
  dateLabel?: string;
  summary: string;
  tags: string[];
  cover?: string;
  featured: boolean;
  links: ProjectLink[];
  media: Media[];
  /** where this entry appears: the walkable world, the career page, or both (default) */
  showIn: Surface[];
  /** world only: which building sprite to use instead of the neighborhood default (e.g. gym, pizza) */
  building?: string;
  /** world only: draw a standalone prop (bike-rack, picnic, bridge) instead of a building */
  prop?: string;
  /** world only: park-style green lot */
  park?: boolean;
  /** world only: a small interaction, e.g. "bike", "reps", "photo", "snack:🍕" */
  action?: string;
  body: string;
}

export interface SiteInfo {
  name: string;
  tagline: string;
  headline: string;
  roles: string;
  intro: string;
  /** optional photo in public/, e.g. "images/christina.jpg" */
  photo?: string;
  links: ProjectLink[];
  stats: { value: number; suffix?: string; label: string }[];
  skills: { group: string; items: string[] }[];
  resumes?: ProjectLink[];
  /** public contact email shown in the Contact section */
  email?: string;
  /** optional Formspree-style URL; when set, the contact form posts to it instead of opening the visitor's mail app */
  contactEndpoint?: string;
  education?: { school: string; degree: string; years: string; awards: string[] };
}
export const siteInfo = site as SiteInfo;

// Every markdown file in content/projects is bundled at build time. This is the "database".
const files = import.meta.glob('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// While developing, add ?drafts to the URL to preview entries marked draft: true.
const SHOW_DRAFTS = import.meta.env.DEV && new URLSearchParams(location.search).has('drafts');

const FRONTMATTER =/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const CATEGORIES = new Set<string>(NEIGHBORHOODS.map((n) => n.category));

function toProject(path: string, raw: string): Project | null {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  if (slug.startsWith('_')) return null;

  const match = FRONTMATTER.exec(raw.replace(/^﻿/, ''));
  if (!match) {
    console.warn(`[content] ${slug}: missing frontmatter, skipped`);
    return null;
  }
  const data = (parse(match[1]) ?? {}) as Record<string, unknown>;
  if (data.draft === true && !SHOW_DRAFTS) return null;

  if (typeof data.title !== 'string' || !data.title) {
    console.warn(`[content] ${slug}: "title" is required, skipped`);
    return null;
  }
  if (typeof data.category !== 'string' || !CATEGORIES.has(data.category)) {
    console.warn(`[content] ${slug}: unknown category "${data.category}", skipped`);
    return null;
  }

  const alsoIn = Array.isArray(data.alsoIn)
    ? (data.alsoIn as unknown[]).map(String).filter((c) => CATEGORIES.has(c) && c !== data.category)
    : [];

  const links = Array.isArray(data.links)
    ? (data.links as ProjectLink[]).filter((l) => l?.label && l?.url)
    : [];

  const media = Array.isArray(data.media)
    ? (data.media as Media[]).filter((m) => m?.src && ['image', 'video', 'youtube'].includes(m.type))
    : [];
  const showIn = Array.isArray(data.showIn)
    ? (data.showIn as string[]).filter((s): s is Surface => s === 'world' || s === 'career')
    : [];

  return {
    slug,
    title: data.title,
    category: data.category as Category,
    categories: [data.category as Category, ...(alsoIn as Category[])],
    date: String(data.date ?? ''),
    dateLabel: typeof data.dateLabel === 'string' ? data.dateLabel : undefined,
    summary: String(data.summary ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    cover: typeof data.cover === 'string' ? data.cover : undefined,
    featured: data.featured === true,
    links,
    media,
    // hobby spots live in the world only unless the entry says otherwise
    showIn: showIn.length ? showIn : data.category === 'spots' ? ['world'] : ['world', 'career'],
    building: typeof data.building === 'string' ? data.building : undefined,
    prop: typeof data.prop === 'string' ? data.prop : undefined,
    park: data.park === true,
    action: typeof data.action === 'string' ? data.action : undefined,
    body: match[2].trim(),
  };
}

export const projects: Project[] = Object.entries(files)
  .map(([path, raw]) => toProject(path, raw))
  .filter((p): p is Project => p !== null)
  .sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));

// content/about.md is the "About me" panel (the home pin on the city map).
const aboutFiles = import.meta.glob('/content/about.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;
export const about: Project | null =
  Object.entries(aboutFiles).map(([path, raw]) => toProject(path, raw))[0] ?? null;

/** Everything that can be opened from the world, by file name. */
export const bySlug = (slug: string): Project | undefined =>
  projects.find((p) => p.slug === slug) ?? (about?.slug === slug ? about : undefined);

/** Entries shown in a neighborhood scene. Brooklyn also holds the "About me" entry first. */
export const worldEntries = (category: Category): Project[] => {
  const list = projects.filter((p) => p.category === category && p.showIn.includes('world'));
  return category === 'spots' && about ? [about, ...list] : list;
};

// content/neighborhoods/<category>.md: the sign at the entrance of each neighborhood.
export interface SignInfo { category: Category; title: string; body: string; picks: { name: string; note?: string }[] }
const signFiles = import.meta.glob('/content/neighborhoods/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const signs = new Map<string, SignInfo>();
for (const raw of Object.values(signFiles)) {
  const m = FRONTMATTER.exec(raw.replace(/^﻿/, ''));
  if (!m) continue;
  const d = (parse(m[1]) ?? {}) as Record<string, unknown>;
  if (typeof d.category !== 'string' || !CATEGORIES.has(d.category)) continue;
  const picks = Array.isArray(d.picks) ? (d.picks as { name?: unknown; note?: unknown }[]).filter((x) => x?.name).map((x) => ({ name: String(x.name), note: x.note ? String(x.note) : undefined })) : [];
  signs.set(d.category, { category: d.category as Category, title: String(d.title ?? ''), body: m[2].trim(), picks });
}
export const signFor = (category: Category): SignInfo | undefined => signs.get(category);
