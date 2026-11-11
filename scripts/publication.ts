import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;

function isCanonicalRoute(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[?#]/.test(path)) return false;
  try {
    const url = new URL(path, 'https://route-validation.invalid');
    return url.origin === 'https://route-validation.invalid' && url.pathname === path && !url.search && !url.hash;
  } catch { return false; }
}

export function smokeBaselineRoutes(routes: unknown): string[] {
  if (!Array.isArray(routes) || !routes.every((path) => typeof path === 'string' && isCanonicalRoute(path))) {
    throw new Error('The smoke baseline route inventory is invalid.');
  }
  return [...new Set(routes as string[])].sort();
}

function publicOriginFromEnvironment(): URL {
  const value = process.env.PFOY_PUBLIC_SITE_ORIGIN;
  if (!value) throw new Error('PFOY_PUBLIC_SITE_ORIGIN is required.');
  let origin: URL;
  try { origin = new URL(value); } catch { throw new Error('PFOY_PUBLIC_SITE_ORIGIN must be a valid HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('PFOY_PUBLIC_SITE_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.');
  }
  return origin;
}

async function request(url: URL, accept: string): Promise<Response> {
  try {
    return await fetch(url, {
      method: 'GET', headers: { accept }, cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`Public release check failed for ${url.pathname}: ${String(error)}`);
  }
}

function decodeXml(value: string): string {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

function sitemapUrls(xml: string): string[] {
  return [...xml.matchAll(/<(?:loc)>([\s\S]*?)<\/(?:loc)>/gi)].map((match) => decodeXml(match[1]!.trim()));
}

function parseRoute(urlValue: string, origin: URL): string {
  let url: URL;
  try { url = new URL(urlValue); } catch { throw new Error('Sitemap contains an invalid URL.'); }
  if (url.origin !== origin.origin || url.search || url.hash || !url.pathname.startsWith('/')) throw new Error('Sitemap contains a URL outside the configured public origin.');
  return url.pathname;
}

async function responseText(response: Response, path: string): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared !== null && Number(declared) > MAX_SITEMAP_BYTES) throw new Error(`Public sitemap ${path} exceeds the size limit.`);
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_SITEMAP_BYTES) throw new Error(`Public sitemap ${path} exceeds the size limit.`);
  return text;
}

async function liveSitemapRoutes(origin: URL, allowMissing: boolean): Promise<string[]> {
  const roots = ['/sitemap.xml', '/sitemap_index.xml', '/wp-sitemap.xml'].map((path) => new URL(path, origin));
  const rootUrls = new Set(roots.map((url) => url.href));
  const pending = [...roots];
  const visited = new Set<string>();
  const routes = new Set<string>();
  let foundRoot = false;
  while (pending.length) {
    const sitemap = pending.shift()!;
    if (visited.has(sitemap.href)) continue;
    if (visited.size >= 20) throw new Error('Public sitemap index exceeds the safety limit.');
    visited.add(sitemap.href);
    const response = await request(sitemap, 'application/xml,text/xml;q=0.9,*/*;q=0.1');
    if (response.status === 404 && allowMissing && rootUrls.has(sitemap.href)) continue;
    if (!response.ok) throw new Error(`Public sitemap ${sitemap.pathname} returned HTTP ${response.status}.`);
    if (rootUrls.has(sitemap.href)) foundRoot = true;
    const text = await responseText(response, sitemap.pathname);
    const locations = sitemapUrls(text);
    if (!locations.length) throw new Error(`Public sitemap ${sitemap.pathname} contains no locations.`);
    if (text.toLowerCase().includes('<sitemapindex')) {
      for (const location of locations) {
        const url = new URL(location);
        if (url.origin !== origin.origin || url.search || url.hash) throw new Error('Public sitemap index contains a URL outside the configured public origin.');
        pending.push(url);
      }
    } else {
      for (const location of locations) routes.add(parseRoute(location, origin));
    }
  }
  if (!foundRoot && !allowMissing) throw new Error('No public sitemap endpoint was available.');
  return smokeBaselineRoutes([...routes]);
}

async function localHtmlRoutes(): Promise<string[]> {
  const buildRoot = resolve('build');
  const routes: string[] = [];
  async function visit(directory: string, relativeDirectory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await visit(resolve(directory, entry.name), relativePath);
      } else if (entry.isFile() && entry.name === 'index.html') {
        routes.push(relativeDirectory ? `/${relativeDirectory}/` : '/');
      }
    }
  }
  await visit(resolve('build'), '');
  return smokeBaselineRoutes(routes);
}

async function localSitemapRoutes(origin: URL): Promise<string[]> {
  let xml: string;
  try { xml = await readFile(resolve('build/sitemap.xml'), 'utf8'); }
  catch (error) { throw new Error('The complete build is missing build/sitemap.xml.', { cause: error }); }
  const locations = sitemapUrls(xml);
  if (!locations.length) throw new Error('The generated sitemap contains no locations.');
  return smokeBaselineRoutes(locations.map((location) => parseRoute(location, origin)));
}

async function writeSmokeBaseline(): Promise<void> {
  const origin = publicOriginFromEnvironment();
  const routes = await liveSitemapRoutes(origin, true);
  const output = process.env.PFOY_SMOKE_BASELINE_FILE ?? resolve(process.env.RUNNER_TEMP ?? '.', 'pfoy-smoke-baseline.json');
  await writeFile(output, `${JSON.stringify({ origin: origin.origin, routes })}\n`, { mode: 0o600 });
  console.info(`Captured ${routes.length} pre-release public routes for removal checks.`);
}

async function fetchPublicPath(origin: URL, path: string): Promise<Response> {
  return await request(new URL(path, origin), 'text/html,application/json,application/xml,text/xml,*/*;q=0.1');
}

async function assertRouteStatus(origin: URL, path: string, expected: number): Promise<Response> {
  const response = await fetchPublicPath(origin, path);
  if (response.status !== expected) throw new Error(`Public release check for ${path} returned HTTP ${response.status}; expected ${expected}.`);
  return response;
}

async function runSmokeChecks(): Promise<void> {
  const origin = publicOriginFromEnvironment();
  const baselinePath = process.env.PFOY_SMOKE_BASELINE_FILE ?? resolve(process.env.RUNNER_TEMP ?? '.', 'pfoy-smoke-baseline.json');
  let baseline: unknown;
  try { baseline = JSON.parse(await readFile(baselinePath, 'utf8')); }
  catch (error) { throw new Error('The pre-release route baseline is unavailable.', { cause: error }); }
  if (typeof baseline !== 'object' || baseline === null || Array.isArray(baseline)) throw new Error('The pre-release route baseline is invalid.');
  const old = baseline as { origin?: unknown; routes?: unknown };
  if (old.origin !== origin.origin) throw new Error('The pre-release route baseline does not match the configured public origin.');
  const oldRoutes = smokeBaselineRoutes(old.routes);
  const routes = await localSitemapRoutes(origin);
  const htmlRoutes = await localHtmlRoutes();
  const htmlRouteSet = new Set(htmlRoutes);
  if (!htmlRouteSet.has('/')) throw new Error('The static build is missing the public home page.');
  for (const path of routes) if (!htmlRouteSet.has(path)) throw new Error(`Generated sitemap path ${path} is absent from the static build.`);
  const checks = [...new Set([...htmlRoutes, ...routes, '/sitemap.xml', '/rss.xml', '/search.json', '/404.html'])];
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(8, checks.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= checks.length) return;
      const path = checks[index]!;
      const response = await assertRouteStatus(origin, path, 200);
      const type = (response.headers.get('content-type') ?? '').toLowerCase();
      if (path.endsWith('.json') ? !type.includes('application/json') : path.endsWith('.xml') ? !/(?:application|text)\/(?:xml|rss\+xml)/.test(type) : !type.includes('text/html')) {
        throw new Error(`Public release check for ${path} returned an unexpected content type.`);
      }
      const body = await response.text();
      if (!body.trim()) throw new Error(`Public release check for ${path} returned an empty response.`);
      if (path === '/search.json') {
        try { JSON.parse(body); } catch { throw new Error('Public search index is not valid JSON.'); }
      }
      if (path === '/') {
        const asset = body.match(/(?:src|href)=["'](\/_app\/[^"']+\.(?:js|css)(?:\?[^"']*)?)["']/i)?.[1];
        if (!asset) throw new Error('Public home page does not reference a generated application asset.');
        const assetResponse = await assertRouteStatus(origin, new URL(asset, origin).pathname, 200);
        const assetType = (assetResponse.headers.get('content-type') ?? '').toLowerCase();
        if (!/(?:javascript|text\/css)/.test(assetType)) throw new Error('The public application asset returned an unexpected content type.');
        await assetResponse.body?.cancel();
      }
    }
  }));
  const removed = oldRoutes.filter((path) => !htmlRouteSet.has(path));
  await Promise.all(removed.map(async (path) => {
    const response = await assertRouteStatus(origin, path, 404);
    await response.body?.cancel();
  }));
  const missingPath = `/.pfoy-release-smoke-${process.env.GITHUB_SHA ?? 'not-found'}.html`;
  const notFound = await assertRouteStatus(origin, missingPath, 404);
  await notFound.body?.cancel();
  console.info(`Verified ${checks.length} public paths, ${removed.length} removals, the application asset, and a true 404.`);
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command === 'capture-smoke-baseline') {
    await writeSmokeBaseline();
    return;
  }
  if (command === 'smoke') {
    await runSmokeChecks();
    return;
  }
  throw new Error('Use capture-smoke-baseline or smoke.');
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
