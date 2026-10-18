import assert from 'node:assert/strict';
import test from 'node:test';
import { parseContentPage } from '../src/lib/content/validate.ts';
import { normalizeContentItem } from '../src/lib/content/normalize.ts';
import { projectRecipe, projectSearchRecipe } from '../src/lib/server/recipe-projection.ts';
function item(overrides = {}) {
  return {
    post_id: 1084,
    card_id: null,
    kind: 'article',
    path: '/banana-bread/',
    title: 'Banana Bread',
    excerpt: 'Editorial copy.',
    content_html: '<p>Editorial copy.</p>',
    date_published: '2026-08-24T02:30:00Z',
    date_modified: '2026-08-24T02:30:00Z',
    author: { name: 'Asha G' },
    categories: [{ id: 9, name: 'Baking', slug: 'baking', path: '/category/baking/' }],
    tags: [{ id: 14, name: 'Family', slug: 'family', path: '' }],
    image: null,
    seo: {
      title: 'Banana Bread', description: 'A simple recipe.', canonical: 'https://platefullofyum.com/banana-bread/',
      robots: 'index,follow', og_title: 'Banana Bread', og_description: 'A simple recipe.', og_image: null
    },
    comments_open: true,
    recipe: null,
    ...overrides
  };
}

test('sanitizes article HTML and maps CMS links onto the public origin', () => {
  const normalized = normalizeContentItem(item({
    content_html: '<h2 id="story">Story</h2><p><a href="https://cms.example.test/some-article/" onclick="alert(1)">Read</a> <a href="javascript:alert(2)">unsafe</a> <a href="https://cms.example.test/wp-content/uploads/food.jpg">image</a></p><script>alert(3)</script>',
    seo: { ...item().seo, canonical: 'https://cms.example.test/banana-bread/' }
  }), { publicOrigin: 'https://platefullofyum.com', cmsOrigin: 'https://cms.example.test' });

  assert.match(normalized.content_html, /<h2 id="story">Story<\/h2>/);
  assert.match(normalized.content_html, /href="https:\/\/platefullofyum\.com\/some-article\/"/);
  assert.match(normalized.content_html, /href="https:\/\/cms\.example\.test\/wp-content\/uploads\/food\.jpg"/);
  assert.match(normalized.content_html, /<a>unsafe<\/a>/);
  assert.equal(normalized.seo.canonical, 'https://platefullofyum.com/banana-bread/');
  assert.doesNotMatch(normalized.content_html, /onclick|javascript:|<script|alert/);
});

test('replaces the matching ID-only Create region with a safe recipe marker', () => {
  const normalized = normalizeContentItem(item({
    kind: 'recipe',
    card_id: 1164,
    content_html: '<p>Before.</p><section id="mv-creation-1164"><script>alert(1)</script><h2>Duplicate card</h2></section><p>After.</p>',
    recipe: { title: 'Banana bread' }
  }));

  assert.match(normalized.content_html, /data-pfoy-recipe-card="1164"/);
  assert.match(normalized.content_html, /Before\./);
  assert.match(normalized.content_html, /After\./);
  assert.doesNotMatch(normalized.content_html, /Duplicate card|<script|alert/);
});

test('rejects a Create card embedded in an article', () => {
  assert.throws(() => normalizeContentItem(item({
    content_html: '<section id="mv-creation-1164" class="mv-create-card">card</section>'
  })), /does not match its declared content kind and card ID/);
});
test('validates public comment snapshots and excludes private or unassociated data', () => {
  const source = item({
    comments_count: 2,
    comments: [
      { id: 91, post_id: 1084, parent: 0, author: 'A reader', date: '2026-09-01T10:00:00Z', content: 'Thanks!' },
      { id: 92, post_id: 1084, parent: 91, author: 'Asha', date: '2026-09-01T11:00:00Z', content: 'Welcome!' }
    ]
  });
  const parsed = parseContentPage({
    contract_version: 1, revision: 'test', page: 1, per_page: 1, total_pages: 1,
    total_records: 1, complete: true, items: [source]
  }).items[0];
  assert.equal(parsed.seo.og_image, null);
  assert.equal(parsed.comments_count, 2);
  assert.equal(parsed.comments[1].parent, 91);
  assert.throws(() => parseContentPage({
    contract_version: 1, revision: 'test', page: 1, per_page: 1, total_pages: 1,
    total_records: 1, complete: true,
    items: [item({ comments: [{ ...source.comments[0], email: 'private@example.test' }] })]
  }), /private or moderation fields/);
  assert.throws(() => parseContentPage({
    contract_version: 1, revision: 'test', page: 1, per_page: 1, total_pages: 1,
    total_records: 1, complete: true,
    items: [item({ comments: [{ ...source.comments[1], parent: 999 }] })]
  }), /before its visible parent/);
});

test('shares recipe list projection without sending ingredients to browse data', () => {
  const source = item({
    kind: 'recipe',
    recipe: {
      title: 'Banana Bread',
      description: 'A recipe description.',
      ingredients: [{ name: 'Batter', items: [{ id: 1, text: '2 bananas' }, { id: 2, text: '1 cup flour' }] }]
    }
  });
  const browse = projectRecipe(source);
  const search = projectSearchRecipe(source);

  assert.deepEqual(Object.keys(browse), ['post_id', 'title', 'excerpt', 'path', 'image', 'categories']);
  assert.equal(browse.excerpt, 'Editorial copy.');
  assert.deepEqual(search.ingredients, ['2 bananas', '1 cup flour']);
});
