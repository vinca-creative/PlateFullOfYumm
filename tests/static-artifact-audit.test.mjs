import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { auditStaticArtifact } from '../scripts/static-artifact-audit.ts';

const item = {
  post_id: 1084, card_id: null, kind: 'article', path: '/banana-bread/', title: 'Banana Bread',
  excerpt: 'Editorial copy with ordinary author text.', content_html: '<p>Editorial copy.</p>',
  date_published: '2026-08-24T02:30:00Z', date_modified: '2026-08-24T02:30:00Z', author: { name: 'Asha G' },
  categories: [{ id: 9, name: 'Baking', slug: 'baking', description: '', path: '/category/baking/' }],
  tags: [{ id: 14, name: 'Family', slug: 'family', description: '', path: '' }], image: null,
  seo: { title: 'Banana Bread', description: 'A simple recipe.', canonical: 'https://platefullofyum.com/banana-bread/', robots: 'index,follow', og_title: 'Banana Bread', og_description: 'A simple recipe.', og_image: null },
  comments_open: true, recipe: null
};
const categories = [
  { id: 9, name: 'Baking', slug: 'baking', description: '', path: '/category/baking/' },
  { id: 24, name: 'Kid-friendly', slug: 'kid-friendly', description: 'Family meals', path: '/category/kid-friendly/' }
];
const tags = [{ id: 31, name: 'Lunchbox', slug: 'lunchbox', description: '', path: '/tag/lunchbox/' }];
const snapshot = { contract_version: 1, revision: createHash('sha256').update(JSON.stringify({ items: [item], categories, tags })).digest('hex'), fetched_at: '2026-08-24T02:30:00Z', items: [item], categories, tags };
const routes = ['index.html', 'recipes/index.html', '404.html', 'rss.xml', 'sitemap.xml', 'search.json', 'banana-bread/index.html', 'category/baking/index.html', 'category/kid-friendly/index.html', 'tag/lunchbox/index.html', 'recipe-search/index.html', 'recipe-search-results/index.html', 'recipe-category/index.html', 'recipe-box/index.html', 'easy-instantpot-caramelised-onions/index.html', 'ishtu-potato-stew/index.html'];

async function fixture(callback, options = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'pfoy-artifact-audit-'));
  try {
    const build = resolve(root, 'build');
    await mkdir(build, { recursive: true });
    await writeFile(resolve(root, 'snapshot.json'), JSON.stringify(options.snapshot ?? snapshot));
    for (const path of routes.filter((path) => !(options.omit ?? []).includes(path))) {
      await mkdir(resolve(build, path, '..'), { recursive: true });
      const body = path.endsWith('.html') ? '<!doctype html><html><head></head><body><a href="/demo/banana-bread/">story</a></body></html>' : path === 'search.json' ? '[]' : path === 'sitemap.xml' ? '<urlset></urlset>' : path === 'rss.xml' ? '<rss></rss>' : 'not found';
      await writeFile(resolve(build, path), body);
    }
    return await callback({ root, build, manifest: resolve(root, 'evidence', 'route-asset-manifest.json') });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('audits complete host routes and writes release evidence outside the public build', async () => {
  await fixture(async ({ root, build, manifest }) => {
    const result = await auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest });
    assert.equal(result.revision, snapshot.revision);
    assert.ok(result.routes.includes('/banana-bread/'));
    assert.ok(result.assets.includes('banana-bread/index.html'));
    assert.deepEqual(JSON.parse(await readFile(manifest, 'utf8')).routes, result.routes);
  });
});
test('requires generated routes for standalone zero-item category and tag archives', async () => {
  await fixture(async ({ root, build, manifest }) => {
    const result = await auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest });
    assert.ok(result.routes.includes('/category/kid-friendly/'));
    assert.ok(result.routes.includes('/tag/lunchbox/'));
  });
  await fixture(async ({ root, build, manifest }) => {
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /expected route .*kid-friendly.* missing output file/);
  }, { omit: ['category/kid-friendly/index.html'] });
});

test('does not parse JavaScript URL constructors as asset references', async () => {
  await fixture(async ({ root, build, manifest }) => {
    const chunk = resolve(build, '_app/immutable/chunks/runtime.js');
    await mkdir(resolve(chunk, '..'), { recursive: true });
    await writeFile(chunk, 'const pageUrl = new URL(`a:`);');
    const result = await auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest });
    assert.equal(result.revision, snapshot.revision);
  });
});

test('rejects a snapshot whose contents changed after revision validation', async () => {
  await fixture(async ({ root, build, manifest }) => {
    const changed = { ...snapshot, revision: '0'.repeat(64) };
    await writeFile(resolve(root, 'snapshot.json'), JSON.stringify(changed));
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /snapshot content does not match its declared revision/);
  });
});

test('rejects an omitted snapshot route with an actionable path', async () => {
  await fixture(async ({ root, build, manifest }) => {
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /expected route \/category\/baking\/ is missing output file category\/baking\/index\.html/);
  }, { omit: ['category/baking/index.html'] });
});

test('rejects missing required discovery output and private projections', async () => {
  await fixture(async ({ root, build, manifest }) => {
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /required output file is missing: search\.json/);
  }, { omit: ['search.json'] });
  await fixture(async ({ root, build, manifest }) => {
    const unsafe = { ...snapshot, items: [{ ...item, private_key: 'source-only' }] };
    await writeFile(resolve(root, 'snapshot.json'), JSON.stringify(unsafe));
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '', manifestFile: manifest }), /private source projection field 'private_key'/);
  });
});

test('rejects missing referenced assets and high-confidence credentials', async () => {
  await fixture(async ({ root, build, manifest }) => {
    await writeFile(resolve(build, 'banana-bread/index.html'), '<html><body><img src="https://platefullofyum.com/demo/missing.jpg"></body></html>');
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /has no output file/);
  });
  await fixture(async ({ root, build, manifest }) => {
    await writeFile(resolve(build, 'credential.txt'), 'ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890123456');
    await assert.rejects(auditStaticArtifact({ buildDirectory: build, snapshotFile: resolve(root, 'snapshot.json'), basePath: '/demo', manifestFile: manifest }), /high-confidence credential pattern/);
  });
});
