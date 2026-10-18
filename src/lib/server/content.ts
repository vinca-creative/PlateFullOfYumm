import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseContentPage } from '#lib/content/validate.ts';
import type { ContentSnapshot, PublicContentItem } from '#lib/content/types.ts';
import { publicConfig } from '#lib/config.ts';

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
  const sourceRevision = source.source_revision;
  const validSourceRevision = typeof sourceRevision === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(sourceRevision);
  const requireSourceRevision = process.env.PFOY_REQUIRE_SOURCE_REVISION === 'true';
  const expectedSourceRevision = process.env.EXPECTED_SOURCE_REVISION;
  if ((sourceRevision !== undefined && !validSourceRevision) || (requireSourceRevision && (!validSourceRevision || sourceRevision !== expectedSourceRevision))) {
    throw new Error('Content snapshot is missing or mismatched for the expected WordPress source revision');
  }
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
  cached = {
    contract_version: 1,
    revision: parsed.revision,
    ...(validSourceRevision ? { source_revision: sourceRevision as string } : {}),
    fetched_at: source.fetched_at,
    items: parsed.items
  };
  return cached;
}

export function getPublicRoutes(): string[] {
  const routes = new Set<string>();
  const items = getSnapshot().items;
  const itemPaths = new Set(items.map((item) => item.path));
  const reserved = new Set(['/recipes/', '/rss.xml', '/sitemap.xml', '/search.json', '/404.html']);
  for (const item of items) {
    if (item.path === '/') continue;
    if (reserved.has(item.path)) throw new Error(`Content permalink conflicts with a reserved site route: ${item.path}`);
    routes.add(item.path.replace(/^\/+|\/+$/g, ''));
  }
  const categoryPaths = new Map<string, number>();
  for (const item of items) for (const category of item.categories) {
    if (reserved.has(category.path)) throw new Error(`Category path conflicts with a reserved site route: ${category.path}`);
    if (itemPaths.has(category.path)) throw new Error(`Category path conflicts with a content permalink: ${category.path}`);
    const existing = categoryPaths.get(category.path);
    if (existing !== undefined && existing !== category.id) throw new Error(`Different categories share the public path ${category.path}`);
    categoryPaths.set(category.path, category.id);
    routes.add(category.path.replace(/^\/+|\/+$/g, ''));
  }
  return [...routes].filter(Boolean).sort();
}

export function findItem(path: string): PublicContentItem | undefined {
  return getSnapshot().items.find((item) => item.path === path);
}
