import { createHash } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFragment, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import type { ContentSnapshot, PublicContentItem } from '../src/lib/content/types.ts';

function normalizeOrigin(value: string, name: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be an HTTP(S) origin.`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password
    || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new Error(`${name} must be an HTTP(S) origin without a path, query, or fragment.`);
  }
  return parsed.origin;
}

function findAnchors(node: DefaultTreeAdapterMap['node'], anchors: DefaultTreeAdapterMap['element'][]): void {
  if ('tagName' in node && node.tagName === 'a') anchors.push(node);
  if ('childNodes' in node) for (const child of node.childNodes) findAnchors(child, anchors);
  if ('content' in node) findAnchors(node.content, anchors);
}

function validatePagesBasePath(value: string): string {
  if (value === '') return value;
  if (!value.startsWith('/') || value.startsWith('//') || value.endsWith('/')
    || value.includes('?') || value.includes('#')
    || value.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new Error('Pages base path must be empty or a safe absolute pathname without query, fragment, dot segments, or trailing slash.');
  }
  return value;
}

function rewriteAnchorOrigins(html: string, productionOrigin: string, pagesOrigin: string, pagesBasePath: string): string {
  const fragment = parseFragment(html);
  const anchors: DefaultTreeAdapterMap['element'][] = [];
  findAnchors(fragment, anchors);
  for (const anchor of anchors) {
    const href = anchor.attrs.find((attribute) => attribute.name === 'href');
    if (!href || !/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(href.value)) continue;
    try {
      const url = new URL(href.value, productionOrigin);
      if (url.origin === productionOrigin) href.value = `${pagesOrigin}${pagesBasePath}${url.pathname}${url.search}${url.hash}`;
    } catch {
      // Invalid authored URLs are left exactly as authored for the normal content sanitizer.
    }
  }
  return serialize(fragment);
}

export async function transformSnapshotOrigin(
  snapshot: ContentSnapshot,
  productionPublicOrigin: string,
  pagesOrigin: string,
  pagesBasePath = ''
): Promise<ContentSnapshot> {
  const productionOrigin = normalizeOrigin(productionPublicOrigin, 'Production public origin');
  const targetOrigin = normalizeOrigin(pagesOrigin, 'GitHub Pages origin');
  const basePath = validatePagesBasePath(pagesBasePath);
  if (!snapshot || !Array.isArray(snapshot.items)) throw new Error('Content snapshot must contain an items array.');

  const items: PublicContentItem[] = snapshot.items.map((item) => {
    if (!item || typeof item !== 'object' || typeof item.content_html !== 'string' || !item.seo || typeof item.seo !== 'object') {
      throw new Error('Content snapshot contains an invalid public item.');
    }
    const seo = { ...item.seo };
    if (typeof seo.canonical === 'string') {
      const canonical = new URL(seo.canonical);
      if (canonical.origin === productionOrigin) seo.canonical = `${targetOrigin}${basePath}${canonical.pathname}${canonical.search}${canonical.hash}`;
    }
    return {
      ...item,
      content_html: rewriteAnchorOrigins(item.content_html, productionOrigin, targetOrigin, basePath),
      seo
    };
  });
  const revision = createHash('sha256').update(JSON.stringify({ items, categories: snapshot.categories, tags: snapshot.tags })).digest('hex');
  return { ...snapshot, revision, items };
}

async function main(productionPublicOrigin: string | undefined, pagesOrigin: string | undefined, pagesBasePath: string | undefined): Promise<void> {
  if (!productionPublicOrigin || !pagesOrigin || pagesBasePath === undefined) throw new Error('Usage: transform-snapshot-origin.ts <production-public-origin> <github-pages-origin> <pages-base-path>');
  validatePagesBasePath(pagesBasePath);
  const snapshotPath = resolve('content-snapshot/snapshot.json');
  const temporaryPath = resolve(`content-snapshot/.snapshot-origin-${process.pid}.tmp`);
  const snapshot = JSON.parse(await readFile(snapshotPath, 'utf8')) as ContentSnapshot;
  const transformed = await transformSnapshotOrigin(snapshot, productionPublicOrigin, pagesOrigin, pagesBasePath);
  try {
    await writeFile(temporaryPath, `${JSON.stringify(transformed)}\n`, { flag: 'wx' });
    await rename(temporaryPath, snapshotPath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv[2], process.argv[3], process.argv[4]).catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}

