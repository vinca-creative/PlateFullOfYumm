import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseContentPage, parseTaxonomyTerms } from '../src/lib/content/validate.ts';
import { getLegacyRouteEntries } from '../src/lib/server/legacy-routes.ts';

const MAX_FILES = 20_000;
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const PRIVATE_FIELD = /^(?:email|user_email|author_email|comment_author_email|ip|ip_address|user_ip|comment_author_ip|password|passwd|user_pass|secret|access_token|refresh_token|api_key|private_key|authorization|auth_token|token)$/i;
const CREDENTIAL = /(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b)/;

function fail(message: string): never { throw new Error(`Static artifact audit: ${message}`); }
function routeFile(path: string): string {
  if (/^\/[^/]+\.(?:html|xml|json|txt)$/.test(path)) return path.slice(1);
  return path === '/' ? 'index.html' : `${path.replace(/^\/+|\/+$/g, '')}/index.html`;
}
 
async function filesIn(directory: string, prefix = ''): Promise<Array<{ path: string; bytes: number }>> {
  const output: Array<{ path: string; bytes: number }> = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) fail(`symbolic links are not allowed in build output: ${path}`);
    if (entry.isDirectory()) output.push(...await filesIn(resolve(directory, entry.name), path));
    else if (entry.isFile()) output.push({ path, bytes: (await stat(resolve(directory, entry.name))).size });
    else fail(`unsupported build output entry: ${path}`);
  }
  return output;
}

function checkPrivateJson(value: unknown, at: string): void {
  if (Array.isArray(value)) { value.forEach((item, index) => checkPrivateJson(item, `${at}[${index}]`)); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_FIELD.test(key)) fail(`private source projection field '${key}' found in ${at}`);
    checkPrivateJson(item, `${at}.${key}`);
  }
}

function localReference(value: string, basePath: string, localOrigins: Set<string>): string | undefined {
  const ref = value.trim();
  if (!ref || ref.startsWith('#') || /^(?:data:|mailto:|tel:|javascript:|blob:)/i.test(ref)) return;
  let url: URL;
  try { url = new URL(ref, 'https://artifact.invalid/'); } catch { fail(`invalid asset reference '${ref}'`); }
  if (url.origin !== 'https://artifact.invalid' && !localOrigins.has(url.origin)) return;
  let pathname = decodeURIComponent(url.pathname);
  if (basePath) {
    if (pathname === basePath) pathname = '/';
    else if (pathname.startsWith(`${basePath}/`)) pathname = pathname.slice(basePath.length);
    else if (pathname.startsWith('/')) fail(`local reference '${ref}' does not use the configured base path ${basePath}`);
  }
  return pathname;
}

function references(source: string, path: string): string[] {
  const result: string[] = [];
  if (/\.(?:html|svg)$/i.test(path)) {
    for (const match of source.matchAll(/\b(?:href|src|poster|action|data-src)\s*=\s*(["'])(.*?)\1/gi)) result.push(match[2]!);
    for (const match of source.matchAll(/\bsrcset\s*=\s*(["'])(.*?)\1/gi)) for (const candidate of match[2]!.split(',')) result.push(candidate.trim().split(/\s+/)[0]!);
  }
  if (/\.(?:html|css|svg)$/i.test(path)) {
    for (const match of source.matchAll(/url\(\s*(["']?)(.*?)\1\s*\)/gi)) result.push(match[2]!);
  }
  return result;
}


/** Validate a completed host build against the exact public snapshot used to create it. */
export async function auditStaticArtifact(options: { buildDirectory: string; snapshotFile: string; basePath: string; manifestFile: string }): Promise<{ revision: string; routes: string[]; assets: string[] }> {
  const base = options.basePath === '' || options.basePath === '/' ? '' : `/${options.basePath.replace(/^\/+|\/+$/g, '')}`;
  if (options.basePath && !/^\/?[A-Za-z0-9._~-]+(?:\/[A-Za-z0-9._~-]+)*\/?$/.test(options.basePath)) fail(`invalid host base path '${options.basePath}'`);
  const snapshotRaw: unknown = JSON.parse(await readFile(resolve(options.snapshotFile), 'utf8'));
  if (!snapshotRaw || typeof snapshotRaw !== 'object' || Array.isArray(snapshotRaw)) fail('snapshot must be a complete object');
  const snapshot = snapshotRaw as Record<string, unknown>;
  checkPrivateJson(snapshotRaw, 'content snapshot');
  if (snapshot.contract_version !== 1 || typeof snapshot.revision !== 'string' || !/^[a-f0-9]{64}$/.test(snapshot.revision) || typeof snapshot.fetched_at !== 'string' || !Number.isFinite(Date.parse(snapshot.fetched_at)) || !Array.isArray(snapshot.items) || snapshot.items.length === 0) fail('snapshot metadata or completeness is invalid');
  const items = snapshot.items as unknown[];
  const categories = parseTaxonomyTerms(snapshot.categories, 'snapshot.categories');
  const tags = parseTaxonomyTerms(snapshot.tags, 'snapshot.tags');
  if (createHash('sha256').update(JSON.stringify({ items, categories, tags })).digest('hex') !== snapshot.revision) fail('snapshot content does not match its declared revision');
  const parsed = parseContentPage({ contract_version: 1, revision: snapshot.revision, page: 1, per_page: items.length, total_pages: 1, total_records: items.length, complete: true, items });
  const localOrigins = new Set(parsed.items.map((item) => new URL(item.seo.canonical).origin));
  const paths = new Set<string>(); const ids = new Set<number>();
  for (const item of parsed.items) {
    if (paths.has(item.path) || ids.has(item.post_id)) fail(`snapshot has duplicate content path or ID at ${item.path}`);
    paths.add(item.path); ids.add(item.post_id);
  }
  const reservedRoutes = new Set<string>(['/', '/recipes/', '/rss.xml', '/sitemap.xml', '/search.json', '/404.html', ...getLegacyRouteEntries().map((r) => `/${r}/`)]);
  const routes = new Set(reservedRoutes);
  for (const item of parsed.items) if (item.path !== '/') routes.add(item.path);
  for (const [label, collection] of [['category', categories], ['tag', tags]] as const) {
    for (const term of collection) {
      if (paths.has(term.path) || reservedRoutes.has(term.path)) fail(`snapshot ${label} path conflicts at ${term.path}`);
      paths.add(term.path); routes.add(term.path);
    }
  }
  const root = resolve(options.buildDirectory);
  const files = await filesIn(root);
  if (files.length > MAX_FILES) fail(`build has ${files.length} files; Workers limit is ${MAX_FILES}`);
  for (const file of files) if (file.bytes > MAX_FILE_BYTES) fail(`${file.path} is ${file.bytes} bytes; Workers per-file limit is ${MAX_FILE_BYTES} bytes`);
  const byPath = new Set(files.map((file) => file.path));
  const required = ['404.html', 'recipes/index.html', 'rss.xml', 'sitemap.xml', 'search.json'];
  for (const path of required) if (!byPath.has(path)) fail(`required output file is missing: ${path}`);
  for (const route of routes) {
    const expected = routeFile(route);
    if (!byPath.has(expected)) fail(`expected route ${route} is missing output file ${expected}`);
  }
  const assets = new Set<string>();
  for (const file of files) {
    if (!/\.(?:html|json|xml|txt|css|js|mjs|svg)$/i.test(file.path)) continue;
    const content = await readFile(resolve(root, file.path), 'utf8');
    if (/\.json$/i.test(file.path)) {
      let value: unknown;
      try { value = JSON.parse(content); } catch { fail(`invalid JSON output: ${file.path}`); }
      checkPrivateJson(value, file.path);
    }
    if (/\.html$/i.test(file.path)) {
      for (const match of content.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
        let projection: unknown;
        try { projection = JSON.parse(match[1]!); } catch { fail(`invalid serialized JSON-LD projection in ${file.path}`); }
        checkPrivateJson(projection, `${file.path} JSON-LD`);
      }
    }
    if (CREDENTIAL.test(content)) fail(`high-confidence credential pattern found in ${file.path}`);
    for (const ref of references(content, file.path)) {
      const path = localReference(ref, base, localOrigins);
      if (path === undefined) continue;
      const normalized = path.replace(/^\/+|\/+$/g, '');
      if (normalized.split('/').includes('..')) fail(`unsafe local asset reference '${ref}' in ${file.path}`);
      const candidates = [normalized, normalized ? `${normalized}/index.html` : 'index.html'];
      const target = candidates.find((candidate) => byPath.has(candidate));
      if (!target) fail(`local asset reference '${ref}' in ${file.path} has no output file`);
      assets.add(target);
    }
  }
  const manifest = { contract_version: 1, revision: snapshot.revision, base_path: base, routes: [...routes].sort(), assets: [...assets].sort(), files: files.map(({ path, bytes }) => ({ path, bytes })).sort((a, b) => a.path.localeCompare(b.path)) };
  await mkdir(resolve(options.manifestFile, '..'), { recursive: true });
  await writeFile(resolve(options.manifestFile), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
  return { revision: snapshot.revision, routes: manifest.routes, assets: manifest.assets };
}

async function main(): Promise<void> {
  const [buildDirectory, snapshotFile, basePath = '', manifestFile] = process.argv.slice(2);
  if (!buildDirectory || !snapshotFile || manifestFile === undefined) fail('usage: static-artifact-audit.ts <build-directory> <snapshot.json> <base-path> <manifest-file-outside-build>');
  if (relative(resolve(buildDirectory), resolve(manifestFile)).split(sep)[0] !== '..') fail('manifest must be written outside the public build directory');
  const result = await auditStaticArtifact({ buildDirectory, snapshotFile, basePath, manifestFile });
  console.info(`Audited ${result.routes.length} routes and ${result.assets.length} referenced assets for revision ${result.revision}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
}
