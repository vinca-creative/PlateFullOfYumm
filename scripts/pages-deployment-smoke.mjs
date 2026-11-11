import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

function fail(message) { throw new Error(`GitHub Pages smoke: ${message}`); }

function pagePath(value, basePath) {
  const path = new URL(value).pathname;
  if (path !== basePath && !path.startsWith(`${basePath}/`)) fail(`URL ${value} is outside repository base path ${basePath}.`);
  return path.slice(basePath.length) || '/';
}

function sameHostUrl(value, origin, basePath, label) {
  let url;
  try { url = new URL(value, `${origin}${basePath}/`); } catch { fail(`${label} has an invalid URL: ${value}`); }
  if (url.origin !== origin) fail(`${label} points off-origin: ${url.href}`);
  pagePath(url.href, basePath);
  return url;
}

export async function runPagesSmoke({ pageUrl, basePath, fetchImpl = fetch }) {
  let deployment;
  try { deployment = new URL(pageUrl); } catch { fail('deploy-pages did not provide a valid page_url.'); }
  if (!['https:', 'http:'].includes(deployment.protocol) || deployment.username || deployment.password || deployment.search || deployment.hash) fail('page_url must be a plain HTTP(S) deployment origin/path.');
  const origin = deployment.origin;
  const base = `/${String(basePath).replace(/^\/+|\/+$/g, '')}`;
  if (base === '/') fail('repository base path is required.');
  if (deployment.pathname.replace(/\/$/, '') !== base) fail(`page_url path must match repository base path ${base}.`);
  const requested = new Set();
  async function get(path, expected = 200) {
    const url = `${origin}${base}${path === '/' ? '/' : path}`;
    requested.add(url);
    const response = await fetchImpl(url, { redirect: 'manual' });
    if (response.status !== expected) fail(`${path} returned HTTP ${response.status}; expected ${expected}.`);
    if (response.status >= 300 && response.status < 400) fail(`${path} redirected unexpectedly.`);
    return response;
  }
  async function body(path, type) {
    const response = await get(path);
    if (!(response.headers.get('content-type') ?? '').toLowerCase().includes(type)) fail(`${path} has an unexpected content type.`);
    return response.text();
  }
  const xml = await body('/sitemap.xml', 'xml');
  const sitemapLocations = [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((m) => m[1].trim().replaceAll('&amp;', '&'));
  if (!sitemapLocations.length) fail('sitemap.xml contains no routes.');
  const routes = [...new Set(sitemapLocations.map((loc) => {
    const url = sameHostUrl(loc, origin, base, 'Sitemap URL');
    if (url.search || url.hash) fail(`Sitemap URL must not include query or fragment: ${url.href}`);
    return pagePath(url.href, base);
  }))];
  for (const path of new Set(['/', '/recipes/', ...routes])) {
    const html = await body(path, 'text/html');
    const canonical = [...html.matchAll(/<link\b[^>]*>/gi)].flatMap(([tag]) => {
      const rel = tag.match(/\brel=["']([^"']+)["']/i)?.[1];
      const href = tag.match(/\bhref=["']([^"']+)["']/i)?.[1];
      return rel?.toLowerCase().split(/\s+/).includes('canonical') && href ? [href] : [];
    });
    if (!canonical.some((href) => {
      const url = sameHostUrl(href, origin, base, `Canonical URL on ${path}`);
      return pagePath(url.href, base) === path;
    })) fail(`${path} is missing a same-host canonical URL with the repository base path.`);
    const refs = [...html.matchAll(/\b(?:href|src|poster)=["']([^"']+)["']/gi)].map((m) => m[1]);
    for (const ref of refs) {
      if (!ref || ref.startsWith('#') || /^(?:mailto:|tel:|javascript:|data:|blob:)/i.test(ref)) continue;
      let url;
      try { url = new URL(ref, `${origin}${base}/`); } catch { fail(`Invalid link on ${path}: ${ref}`); }
      if (url.origin !== origin) continue;
      const route = pagePath(url.href, base);
      if (/\/_app\/.*\.(?:js|css)(?:$|\?)/i.test(url.pathname) || /\.(?:png|jpe?g|gif|webp|avif|svg|ico)(?:$|\?)/i.test(url.pathname)) {
        const asset = await get(route);
        const contentType = (asset.headers.get('content-type') ?? '').toLowerCase();
        if (/\.(?:js)(?:$|\?)/i.test(url.pathname) && !/(?:javascript|ecmascript)/.test(contentType)) fail(`JavaScript asset ${route} has an unexpected content type.`);
        if (/\.(?:css)(?:$|\?)/i.test(url.pathname) && !contentType.includes('text/css')) fail(`CSS asset ${route} has an unexpected content type.`);
        if (/\.(?:png|jpe?g|gif|webp|avif|svg|ico)(?:$|\?)/i.test(url.pathname) && !contentType.startsWith('image/')) fail(`Image asset ${route} has an unexpected content type.`);
      } else if (url.pathname.startsWith(`${base}/`) && !/\.(?:xml|json|txt|js|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?)(?:$|\?)/i.test(url.pathname)) {
        const linked = await get(route);
        if (!linked.headers.get('content-type')?.toLowerCase().includes('text/html')) fail(`Internal link ${route} is not an HTML page.`);
      }
    }
  }
  await body('/rss.xml', 'xml');
  const search = await body('/search.json', 'application/json');
  try { JSON.parse(search); } catch { fail('search.json is not valid JSON.'); }
  await body('/404.html', 'text/html');
  const missing = `/.pfoy-pages-smoke-${Date.now()}-missing/`;
  await get(missing, 404);
  return { routes: routes.length, requests: requested.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPagesSmoke({ pageUrl: process.env.PAGES_PAGE_URL, basePath: process.env.PAGES_BASE_PATH }).then(({ routes, requests }) => {
    console.info(`Verified GitHub Pages smoke: ${routes} sitemap routes and ${requests} requests.`);
  }).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
