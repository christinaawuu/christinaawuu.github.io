import { parse } from 'yaml';
import { NEIGHBORHOODS, type Category } from './neighborhoods';
import site from '../content/site.json';

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  slug: string;
  title: string;
  category: Category;
  date: string;
  dateLabel?: string;
  summary: string;
  tags: string[];
  cover?: string;
  featured: boolean;
  links: ProjectLink[];
  body: string;
}

export const siteInfo = site as {
  name: string;
  tagline: string;
  links: ProjectLink[];
};

// Every markdown file in content/projects is bundled at build time. This is the "database".
const files = import.meta.glob('/content/projects/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const CATEGORIES = new Set<string>(NEIGHBORHOODS.map((n) => n.category));

function toProject(path: string, raw: string): Project | null {
  const slug = path.split('/').pop()!.replace(/\.md$/, '');
  if (slug.startsWith('_')) return null;

  const match = FRONTMATTER.exec(raw);
  if (!match) {
    console.warn(`[content] ${slug}: missing frontmatter, skipped`);
    return null;
  }
  const data = (parse(match[1]) ?? {}) as Record<string, unknown>;
  if (data.draft === true) return null;

  if (typeof data.title !== 'string' || !data.title) {
    console.warn(`[content] ${slug}: "title" is required, skipped`);
    return null;
  }
  if (typeof data.category !== 'string' || !CATEGORIES.has(data.category)) {
    console.warn(`[content] ${slug}: unknown category "${data.category}", skipped`);
    return null;
  }

  const links = Array.isArray(data.links)
    ? (data.links as ProjectLink[]).filter((l) => l?.label && l?.url)
    : [];

  return {
    slug,
    title: data.title,
    category: data.category as Category,
    date: String(data.date ?? ''),
    dateLabel: typeof data.dateLabel === 'string' ? data.dateLabel : undefined,
    summary: String(data.summary ?? ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    cover: typeof data.cover === 'string' ? data.cover : undefined,
    featured: data.featured === true,
    links,
    body: match[2].trim(),
  };
}

export const projects: Project[] = Object.entries(files)
  .map(([path, raw]) => toProject(path, raw))
  .filter((p): p is Project => p !== null)
  .sort((a, b) => Number(b.featured) - Number(a.featured) || b.date.localeCompare(a.date));
