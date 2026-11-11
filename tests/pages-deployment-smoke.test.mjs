import assert from 'node:assert/strict';
import test from 'node:test';
import { runPagesSmoke } from '../scripts/pages-deployment-smoke.mjs';

function mockFetch({ omitAsset = false, notFoundStatus = 404 } = {}) {
  const calls = [];
  const fetchImpl = async (value) => {
    const url = new URL(value);
    calls.push(url.pathname);
    const path = url.pathname;
    let type = 'text/html';
    let content = '<html><head><link rel="canonical" href="https://owner.github.io/project/"></head><body><a href="/project/recipes/">Recipes</a><script src="/project/_app/immutable/entry.abc123.js"></script><link rel="stylesheet" href="/project/_app/immutable/app.def456.css"><img src="/project/images/food.webp"></body></html>';
    if (path === '/project/sitemap.xml') { type = 'application/xml'; content = '<urlset><url><loc>https://owner.github.io/project/</loc></url><url><loc>https://owner.github.io/project/recipes/</loc></url></urlset>'; }
    else if (path === '/project/rss.xml') { type = 'application/rss+xml'; content = '<rss></rss>'; }
    else if (path === '/project/search.json') { type = 'application/json'; content = '[]'; }
    else if (path === '/project/404.html') content = '<html>404</html>';
    else if (path === '/project/recipes/') content = content.replace('href="https://owner.github.io/project/"', 'href="https://owner.github.io/project/recipes/"');
    else if (path.includes('/_app/')) { type = path.endsWith('.css') ? 'text/css' : 'text/javascript'; content = 'asset'; }
    else if (path.endsWith('.webp')) { type = 'image/webp'; content = 'image'; }
    else if (path.startsWith('/project/.pfoy-pages-smoke-')) return new Response('', { status: notFoundStatus });
    else if (!['/project/', '/project/recipes/'].includes(path)) return new Response('', { status: 404 });
    if (omitAsset && path.endsWith('.js')) return new Response('', { status: 404 });
    return new Response(content, { status: 200, headers: { 'content-type': type } });
  };
  return { fetchImpl, calls };
}

test('Pages smoke checks repository-base routes and assets', async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await runPagesSmoke({ pageUrl: 'https://owner.github.io/project/', basePath: '/project', fetchImpl });
  assert.equal(result.routes, 2);
  assert(calls.includes('/project/recipes/'));
  assert(calls.includes('/project/_app/immutable/entry.abc123.js'));
  assert(calls.includes('/project/images/food.webp'));
});

test('Pages smoke rejects internal links missing the repository base path', async () => {
  const { fetchImpl } = mockFetch();
  const broken = async (url, options) => {
    const response = await fetchImpl(url, options);
    if (new URL(url).pathname === '/project/') {
      const html = (await response.text()).replace('href="/project/recipes/"', 'href="/recipes/"');
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    }
    return response;
  };
  await assert.rejects(runPagesSmoke({ pageUrl: 'https://owner.github.io/project/', basePath: '/project', fetchImpl: broken }), /outside repository base path/);
});

test('Pages smoke rejects missing hashed assets', async () => {
  const { fetchImpl } = mockFetch({ omitAsset: true });
  await assert.rejects(runPagesSmoke({ pageUrl: 'https://owner.github.io/project/', basePath: '/project', fetchImpl }), /returned HTTP 404/);
});

test('Pages smoke requires unknown routes to return a true 404', async () => {
  let missingUrl;
  const { fetchImpl } = mockFetch();
  const wrapped = async (url, options) => {
    if (new URL(url).pathname.includes('.pfoy-pages-smoke-')) { missingUrl = url; return new Response('', { status: 200 }); }
    return fetchImpl(url, options);
  };
  await assert.rejects(runPagesSmoke({ pageUrl: 'https://owner.github.io/project/', basePath: '/project', fetchImpl: wrapped }), /expected 404/);
  assert(missingUrl);
});
