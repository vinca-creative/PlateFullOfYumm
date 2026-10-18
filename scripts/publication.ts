import { appendFile, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REVISION_PATTERN = /^(0|[1-9][0-9]{0,19})$/;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;

type PublicationStatus = {
  contract_version: 1;
  enabled: true;
  desired_revision: string;
  deployed_revision: string;
  outcome: 'pending' | 'dispatched' | 'failed' | 'deployed';
};

export function assertReleaseMarker(value: unknown, expectedRevision: string, expectedSha: string): void {
  revision(expectedRevision, 'expected source revision');
  if (!/^[0-9a-f]{40,64}$/i.test(expectedSha)) throw new Error('Expected release SHA is invalid.');
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('The public release marker is missing or invalid.');
  const marker = value as { source_revision?: unknown; release_sha?: unknown; routes?: unknown };
  if (marker.source_revision !== expectedRevision || marker.release_sha !== expectedSha) {
    throw new Error('The public release marker does not match the expected source revision and release SHA.');
  }
  if (marker.routes !== undefined) validateRouteInventory(marker.routes);
}

function validateRouteInventory(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((path) => typeof path === 'string' && isCanonicalRoute(path))) {
    throw new Error('The release marker route inventory is invalid.');
  }
  return [...new Set(value as string[])].sort();
}

function isCanonicalRoute(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\') || /[?#]/.test(path)) return false;
  try {
    const url = new URL(path, 'https://route-validation.invalid');
    return url.origin === 'https://route-validation.invalid' && url.pathname === path && !url.search && !url.hash;
  } catch { return false; }
}

export function smokeBaselineRoutes(liveRoutes: string[], releaseMarker: unknown): string[] {
  let manifestRoutes: unknown;
  if (typeof releaseMarker === 'object' && releaseMarker !== null && !Array.isArray(releaseMarker)) {
    const marker = releaseMarker as { source_revision?: unknown; release_sha?: unknown; routes?: unknown };
    if (marker.routes !== undefined) {
      revision(marker.source_revision, 'release marker source revision');
      if (typeof marker.release_sha !== 'string' || !/^[0-9a-f]{40,64}$/i.test(marker.release_sha)) throw new Error('Release marker SHA is invalid.');
      manifestRoutes = marker.routes;
    }
  }
  if (manifestRoutes === undefined) return [...new Set(liveRoutes)].sort();
  return [...new Set([...liveRoutes, ...validateRouteInventory(manifestRoutes)])].sort();
}

function apiRootFromEnvironment(): URL {
  const value = process.env.PFOY_WORDPRESS_API_ROOT;
  if (!value) throw new Error('PFOY_WORDPRESS_API_ROOT is required.');
  let root: URL;
  try { root = new URL(value); } catch { throw new Error('PFOY_WORDPRESS_API_ROOT must be an absolute HTTP(S) URL.'); }
  if (!['http:', 'https:'].includes(root.protocol) || root.username || root.password || root.search || root.hash) {
    throw new Error('PFOY_WORDPRESS_API_ROOT must be an HTTP(S) URL without credentials, query, or fragment.');
  }
  if (!root.pathname.endsWith('/')) root.pathname += '/';
  return root;
}

function publicationUrl(apiRoot: URL, route: string): URL {
  return new URL(`pfoy/v1/publication/${route}`, apiRoot);
}

function revision(value: unknown, field: string): string {
  if (typeof value !== 'string' || !REVISION_PATTERN.test(value)) throw new Error(`WordPress publication ${field} is invalid.`);
  return value;
}

export function parsePublicationStatus(value: unknown): PublicationStatus {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('WordPress publication status is invalid.');
  const status = value as Record<string, unknown>;
  if (status.contract_version !== 1 || status.enabled !== true) throw new Error('WordPress publication integration is disabled or misconfigured.');
  const desired_revision = revision(status.desired_revision, 'desired_revision');
  const deployed_revision = revision(status.deployed_revision, 'deployed_revision');
  if (BigInt(deployed_revision) > BigInt(desired_revision)) throw new Error('WordPress deployed revision is ahead of the desired revision.');
  if (!['pending', 'dispatched', 'failed', 'deployed'].includes(String(status.outcome))) throw new Error('WordPress publication outcome is invalid.');
  if (status.outcome === 'deployed' && desired_revision !== deployed_revision) throw new Error('WordPress publication status claims an unmatched deployment.');
  return {
    contract_version: 1,
    enabled: true,
    desired_revision,
    deployed_revision,
    outcome: status.outcome as PublicationStatus['outcome']
  };
}

export async function fetchPublicationStatus(apiRoot: URL, fetcher: typeof fetch = fetch): Promise<PublicationStatus> {
  let response: Response;
  try {
    response = await fetcher(publicationUrl(apiRoot, 'status'), {
      method: 'GET', headers: { accept: 'application/json' }, cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`WordPress publication status request failed: ${String(error)}`);
  }
  if (!response.ok) throw new Error(`WordPress publication status returned HTTP ${response.status}.`);
  const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
  if (!contentType.includes('application/json')) throw new Error('WordPress publication status did not return JSON.');
  let value: unknown;
  try { value = await response.json(); } catch { throw new Error('WordPress publication status returned invalid JSON.'); }
  return parsePublicationStatus(value);
}

export async function assertCurrentRevision(apiRoot: URL, expectedRevision: string, fetcher: typeof fetch = fetch): Promise<PublicationStatus> {
  const expected = revision(expectedRevision, 'expected revision');
  const status = await fetchPublicationStatus(apiRoot, fetcher);
  if (status.desired_revision !== expected) {
    throw new Error(`WordPress source revision changed (expected ${expected}, current ${status.desired_revision}).`);
  }
  return status;
}

export function acknowledgementSignature(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function publicOriginFromEnvironment(): URL {
  const value = requiredEnvironment('PFOY_PUBLIC_SITE_ORIGIN');
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
  return [...routes].sort();
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
  await visit(buildRoot, '');
  return routes.sort();
}

async function localSitemapRoutes(origin: URL): Promise<string[]> {
  let xml: string;
  try { xml = await readFile(resolve('build/sitemap.xml'), 'utf8'); }
  catch (error) { throw new Error('The complete build is missing build/sitemap.xml.', { cause: error }); }
  const locations = sitemapUrls(xml);
  if (!locations.length) throw new Error('The generated sitemap contains no locations.');
  return [...new Set(locations.map((location) => parseRoute(location, origin)))].sort();
}

async function writeSmokeBaseline(): Promise<void> {
  const origin = publicOriginFromEnvironment();
  const liveRoutes = await liveSitemapRoutes(origin, true);
  let releaseMarker: unknown;
  try {
    const response = await fetchPublicPath(origin, '/release.json');
    if (response.ok) releaseMarker = JSON.parse(await response.text());
  } catch {
    // Older deployed releases do not publish a release marker; their live sitemap remains the baseline.
  }
  const routes = smokeBaselineRoutes(liveRoutes, releaseMarker);
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
  if (old.origin !== origin.origin || !Array.isArray(old.routes) || !old.routes.every((path) => typeof path === 'string')) throw new Error('The pre-release route baseline does not match the configured public origin.');
  const routes = await localSitemapRoutes(origin);
  const htmlRoutes = await localHtmlRoutes();
  const htmlRouteSet = new Set(htmlRoutes);
  if (!htmlRouteSet.has('/')) throw new Error('The static build is missing the public home page.');
  for (const path of routes) if (!htmlRouteSet.has(path)) throw new Error(`Generated sitemap path ${path} is absent from the static build.`);
  const expectedRevision = process.env.EXPECTED_SOURCE_REVISION;
  const expectedSha = process.env.PFOY_RELEASE_SHA;
  if (!expectedRevision || !expectedSha) throw new Error('Expected source revision and release SHA are required for public smoke checks.');
  const checks = [...new Set([...htmlRoutes, ...routes, '/release.json', '/sitemap.xml', '/rss.xml', '/search.json', '/404.html'])];
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
      if (path === '/release.json') {
        try { assertReleaseMarker(JSON.parse(body), expectedRevision, expectedSha); }
        catch (error) { throw new Error(`Public release marker verification failed: ${String(error)}`); }
      }
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
  const removed = (old.routes as string[]).filter((path) => !htmlRouteSet.has(path));
  await Promise.all(removed.map(async (path) => {
    const response = await assertRouteStatus(origin, path, 404);
    await response.body?.cancel();
  }));
  const missingPath = `/.pfoy-release-smoke-${process.env.GITHUB_SHA ?? 'not-found'}.html`;
  const notFound = await assertRouteStatus(origin, missingPath, 404);
  await notFound.body?.cancel();
  console.info(`Verified ${checks.length} public paths, ${removed.length} removals, the application asset, and a true 404.`);
}

async function sendAcknowledgement(outcome: 'deployed' | 'failed', sourceRevision: string, failureCode: string | null, deploymentState: string): Promise<void> {
  const apiRoot = apiRootFromEnvironment();
  const secret = requiredEnvironment('PFOY_PUBLICATION_ACK_SECRET');
  const runId = requiredEnvironment('GITHUB_RUN_ID');
  const runAttempt = requiredEnvironment('GITHUB_RUN_ATTEMPT');
  const repository = requiredEnvironment('GITHUB_REPOSITORY');
  const workflow = requiredEnvironment('GITHUB_WORKFLOW');
  const sha = requiredEnvironment('PFOY_RELEASE_SHA');
  const revisionValue = revision(sourceRevision, 'acknowledgement revision');
  if (!/^[1-9][0-9]{0,19}$/.test(runId) || !/^[1-9][0-9]{0,4}$/.test(runAttempt) || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[0-9a-f]{40,64}$/i.test(sha)) {
    throw new Error('GitHub release identity is invalid.');
  }
  if (outcome === 'deployed' && (deploymentState !== 'complete' || failureCode !== null)) throw new Error('Successful acknowledgement requires a completed deployment and public smoke checks.');
  if (outcome === 'failed' && (!['not_started', 'upload_attempted', 'upload_completed'].includes(deploymentState) || !['build_failed', 'source_changed', 'deploy_failed', 'smoke_failed', 'configuration_missing'].includes(String(failureCode)))) {
    throw new Error('Failure acknowledgement metadata is invalid.');
  }
  const body = JSON.stringify({
    contract_version: 1,
    revision: revisionValue,
    outcome,
    failure_code: failureCode,
    deployment_state: deploymentState,
    repository,
    run_id: runId,
    run_attempt: runAttempt,
    workflow,
    sha,
    deployment_id: `${runId}-${runAttempt}`
  });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = acknowledgementSignature(secret, timestamp, body);
  let response: Response;
  try {
    response = await fetch(publicationUrl(apiRoot, 'ack'), {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json', 'x-pfoy-timestamp': timestamp, 'x-pfoy-signature': signature },
      body, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`WordPress publication acknowledgement request failed: ${String(error)}`);
  }
  if (!response.ok) throw new Error(`WordPress publication acknowledgement returned HTTP ${response.status}; no success was recorded.`);
  let result: unknown;
  try { result = await response.json(); } catch { throw new Error('WordPress publication acknowledgement returned invalid JSON.'); }
  if (typeof result !== 'object' || result === null || (result as Record<string, unknown>).accepted !== true) throw new Error('WordPress did not confirm the publication acknowledgement.');
  console.info(`WordPress recorded the ${outcome} outcome for source revision ${revisionValue}.`);
}

async function writeReleaseMarker(sourceRevision: string, releaseSha: string): Promise<void> {
  revision(sourceRevision, 'release marker source revision');
  if (!/^[0-9a-f]{40,64}$/i.test(releaseSha)) throw new Error('Release marker SHA is invalid.');
  const routes = await localHtmlRoutes();
  await writeFile(resolve('build/release.json'), `${JSON.stringify({ source_revision: sourceRevision, release_sha: releaseSha, routes })}\n`, { flag: 'wx' });
}

async function main(): Promise<void> {
  const [command, ...args] = process.argv.slice(2);
  const apiRoot = apiRootFromEnvironment();
  if (command === 'source') {
    const status = await fetchPublicationStatus(apiRoot);
    const output = process.env.GITHUB_OUTPUT;
    if (output) await appendFile(output, `source_revision=${status.desired_revision}\n`);
    else console.info(`Current WordPress source revision: ${status.desired_revision}`);
    return;
  }
  if (command === 'assert-current') {
    const expected = args[0] ?? process.env.EXPECTED_SOURCE_REVISION;
    if (!expected) throw new Error('An expected WordPress source revision is required.');
    const status = await assertCurrentRevision(apiRoot, expected);
    console.info(`WordPress source revision ${status.desired_revision} is current.`);
    return;
  }
  if (command === 'capture-smoke-baseline') {
    await writeSmokeBaseline();
    return;
  }
  if (command === 'write-release-marker') {
    const sourceRevision = args[0];
    const releaseSha = args[1];
    if (!sourceRevision || !releaseSha) throw new Error('A source revision and release SHA are required to write the release marker.');
    await writeReleaseMarker(sourceRevision, releaseSha);
    return;
  }
  if (command === 'smoke') {
    await runSmokeChecks();
    return;
  }
  if (command === 'acknowledge') {
    const outcome = args[0];
    const sourceRevision = args[1];
    const failureCode = args[2] ?? null;
    const deploymentState = args[3] ?? (outcome === 'deployed' ? 'complete' : process.env.PFOY_DEPLOYMENT_STATE ?? 'not_started');
    if (!sourceRevision || (outcome !== 'deployed' && outcome !== 'failed')) throw new Error('A valid acknowledgement outcome and source revision are required.');
    await sendAcknowledgement(outcome, sourceRevision, failureCode, deploymentState);
    return;
  }
  throw new Error('Use source, assert-current, capture-smoke-baseline, write-release-marker, smoke, or acknowledge.');
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
