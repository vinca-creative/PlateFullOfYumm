import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseContentPage, parseTaxonomyTerms } from '#lib/content/validate.ts';
import { publicConfig } from '#lib/config.ts';
import type { ContentSnapshot, PublicContentItem } from '#lib/content/types.ts';

let cached: ContentSnapshot | undefined;

/** Load only the complete importer artifact; absence or corruption is a build error. */
export function getSnapshot(): ContentSnapshot {
  if (cached) return cached;
  const filename = resolve(process.cwd(), 'content-snapshot/snapshot.json');
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(filename, 'utf8'));
  } catch (error) {
    throw new Error(`Required validated content snapshot is unavailable at ${filename}`, { cause: error });
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Content snapshot must be an object');
  const source = raw as Record<string, unknown>;
  if (source.contract_version !== 1 || typeof source.revision !== 'string' || !source.revision || typeof source.fetched_at !== 'string' || !Number.isFinite(Date.parse(source.fetched_at)) || !Array.isArray(source.items)) {
    throw new Error('Content snapshot metadata is invalid');
  }
  const items = source.items;
  const parsed = parseContentPage({
    contract_version: 1,
    revision: source.revision,
    page: 1,
    per_page: Math.max(items.length, 1),
    total_pages: 1,
    total_records: items.length,
    complete: true,
    items
  });
  const categories = parseTaxonomyTerms(source.categories, 'snapshot.categories');
  const tags = parseTaxonomyTerms(source.tags, 'snapshot.tags');
  const paths = new Set<string>();
  const ids = new Set<number>();
  const publicOrigin = new URL(publicConfig.siteOrigin).origin;
  for (const item of parsed.items) {
    if (paths.has(item.path)) throw new Error(`Duplicate public path in snapshot: ${item.path}`);
    if (ids.has(item.post_id)) throw new Error(`Duplicate public post id in snapshot: ${item.post_id}`);
    paths.add(item.path);
    ids.add(item.post_id);
    if (new URL(item.seo.canonical).origin !== publicOrigin) throw new Error(`Canonical URL is outside the configured public origin: ${item.seo.canonical}`);
  }
  for (const [label, terms] of [['Category', categories], ['Tag', tags]] as const) {
    for (const term of terms) {
      if (paths.has(term.path)) throw new Error(`${label} path conflicts with a content permalink or taxonomy path: ${term.path}`);
      paths.add(term.path);
    }
  }
  cached = {
    contract_version: 1,
    revision: parsed.revision,
    fetched_at: source.fetched_at,
    items: parsed.items,
    categories,
    tags
  };
  return cached;
}

export function getPublicRoutes(): string[] {
  const routes = new Set<string>();
  const snapshot = getSnapshot();
  const items = snapshot.items;
  const itemPaths = new Set(items.map((item) => item.path));
  const reserved = new Set(['/recipes/', '/rss.xml', '/sitemap.xml', '/search.json', '/404.html']);
  for (const item of items) {
    if (item.path === '/') continue;
    if (reserved.has(item.path)) throw new Error(`Content permalink conflicts with a reserved site route: ${item.path}`);
    routes.add(item.path.replace(/^\/+|\/+$/g, ''));
  }
  for (const [label, terms] of [['Category', snapshot.categories], ['Tag', snapshot.tags]] as const) {
    for (const term of terms) {
      if (reserved.has(term.path)) throw new Error(`${label} path conflicts with a reserved site route: ${term.path}`);
      if (itemPaths.has(term.path)) throw new Error(`${label} path conflicts with a content permalink: ${term.path}`);
      routes.add(term.path.replace(/^\/+|\/+$/g, ''));
    }
  }
  return [...routes].filter(Boolean).sort();
}

export function findItem(path: string): PublicContentItem | undefined {
  return getSnapshot().items.find((item) => item.path === path);
}
