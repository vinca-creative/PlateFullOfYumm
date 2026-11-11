import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { transformSnapshotOrigin } from '../scripts/transform-snapshot-origin.ts';

const productionOrigin = 'https://platefullofyum.com';
const pagesOrigin = 'https://example-owner.github.io';

function snapshotWithItem(overrides = {}) {
  return {
    contract_version: 1,
    revision: 'old-revision',
    fetched_at: '2026-10-19T00:00:00.000Z',
    items: [{
      post_id: 1,
      path: '/recipe/',
      content_html: '<p><a href="https://platefullofyum.com/article/?q=1#story">Internal</a> <a href="//platefullofyum.com/relative">Protocol-relative</a> <a href="https://external.example/page">External</a> <a href="/relative/path">Relative</a> <img src="https://platefullofyum.com/wp-content/uploads/photo.jpg"></p>',
      seo: {
        canonical: 'https://platefullofyum.com/recipe/?view=full#intro',
        og_image: 'https://platefullofyum.com/wp-content/uploads/og.jpg'
      },
      image: { src: 'https://platefullofyum.com/wp-content/uploads/featured.jpg' },
      ...overrides
    }],
    categories: [],
    tags: []
  };
}

test('rewrites only production-origin canonicals and authored anchor links, then rehashes items', async () => {
  const source = snapshotWithItem();
  const result = await transformSnapshotOrigin(source, productionOrigin, pagesOrigin, '/recipe-project');
  const [item] = result.items;

  assert.equal(item.seo.canonical, `${pagesOrigin}/recipe-project/recipe/?view=full#intro`);
  assert.match(item.content_html, new RegExp(`href="${pagesOrigin}/recipe-project/article/\\?q=1#story"`));
  assert.match(item.content_html, new RegExp(`href="${pagesOrigin}/recipe-project/relative"`));
  assert.match(item.content_html, /href="https:\/\/external\.example\/page"/);
  assert.match(item.content_html, /href="\/relative\/path"/);
  assert.match(item.content_html, /src="https:\/\/platefullofyum\.com\/wp-content\/uploads\/photo\.jpg"/);
  assert.equal(item.image.src, 'https://platefullofyum.com/wp-content/uploads/featured.jpg');
  assert.equal(item.seo.og_image, 'https://platefullofyum.com/wp-content/uploads/og.jpg');
  assert.equal(result.fetched_at, source.fetched_at);
  assert.equal(result.revision, createHash('sha256').update(JSON.stringify({ items: result.items, categories: result.categories, tags: result.tags })).digest('hex'));
  assert.equal(source.items[0].seo.canonical, `${productionOrigin}/recipe/?view=full#intro`);
});

test('empty base preserves root behavior', async () => {
  const source = snapshotWithItem();
  const result = await transformSnapshotOrigin(source, productionOrigin, pagesOrigin, '');
  assert.equal(result.items[0].seo.canonical, `${pagesOrigin}/recipe/?view=full#intro`);
  assert.match(result.items[0].content_html, new RegExp(`href="${pagesOrigin}/article/\\?q=1#story"`));
});

test('rejects unsafe Pages base paths', async () => {
  for (const basePath of ['recipe-project', '//owner/repo', '/repo/', '/repo?query', '/repo#fragment', '/repo/../other', '/repo/./other']) {
    await assert.rejects(transformSnapshotOrigin(snapshotWithItem(), productionOrigin, pagesOrigin, basePath), /Pages base path/);
  }
});

test('leaves canonical and anchor URLs on other origins unchanged', async () => {
  const source = snapshotWithItem({
    content_html: '<a href="https://www.platefullofyum.com/other/">Other host</a>',
    seo: { canonical: 'https://www.platefullofyum.com/recipe/' }
  });
  const result = await transformSnapshotOrigin(source, productionOrigin, pagesOrigin, '/recipe-project');
  assert.equal(result.items[0].seo.canonical, 'https://www.platefullofyum.com/recipe/');
  assert.match(result.items[0].content_html, /href="https:\/\/www\.platefullofyum\.com\/other\/"/);
});

