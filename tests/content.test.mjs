import assert from 'node:assert/strict';
import test from 'node:test';
import { parseContentPage, parseTaxonomyTerms } from '../src/lib/content/validate.ts';
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

test('removes WordPress query pagination blocks that link to REST page APIs', () => {
  const normalized = normalizeContentItem(item({
    content_html: '<p>Keep this story.</p><nav class="wp-block-query-pagination"><a href="https://cms.example.test/wp-json/wp/v2/pages/page/2/?page=1">2</a></nav><p>Keep this too.</p>'
  }), { publicOrigin: 'https://platefullofyum.com', cmsOrigin: 'https://cms.example.test' });

  assert.match(normalized.content_html, /Keep this story\./);
  assert.match(normalized.content_html, /Keep this too\./);
  assert.doesNotMatch(normalized.content_html, /wp-json|wp-block-query-pagination/);
});

test('drops source REST API links instead of publishing them as local pages', () => {
  const normalized = normalizeContentItem(item({
    content_html: '<div><span>1</span><a href="https://cms.example.test/wp-json/wp/v2/pages/page/2/?page=1">2</a><a href="https://cms.example.test/banana-bread/">Current article</a></div>'
  }), { publicOrigin: 'https://platefullofyum.com', cmsOrigin: 'https://cms.example.test' });

  assert.doesNotMatch(normalized.content_html, /wp-json/);
  assert.match(normalized.content_html, /href="https:\/\/platefullofyum\.com\/banana-bread\/"/);
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

test('preserves linked WordPress tag archive paths in the validated snapshot', () => {
  const linkedTag = { id: 14, name: 'Family', slug: 'family', path: '/tag/family/' };
  const source = item({ tags: [linkedTag] });
  const parsed = parseContentPage({
    contract_version: 1, revision: 'test', page: 1, per_page: 1, total_pages: 1,
    total_records: 1, complete: true, items: [source]
  }).items[0];

  assert.equal(parsed.tags[0].path, linkedTag.path);
  assert.equal(item().tags[0].path, '');
});
test('validates standalone empty taxonomy records and fails closed on duplicate or invalid paths', () => {
  const terms = parseTaxonomyTerms([{ id: 24, name: 'Kid-friendly', slug: 'kid-friendly', path: '/category/kid-friendly/', description: 'Family meals' }], 'categories');
  assert.equal(terms[0].description, 'Family meals');
  assert.throws(() => parseTaxonomyTerms([{ ...terms[0], path: 'https://cms.example/category/kid-friendly/' }], 'categories'), /public path/);
  assert.throws(() => parseTaxonomyTerms([terms[0], terms[0]], 'categories'), /duplicate IDs or paths/);
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
    image: {
      src: 'https://platefullofyum.com/banana-bread.jpg',
      alt: 'Banana bread',
      width: 1200,
      height: 800,
      variants: [{ src: 'https://platefullofyum.com/banana-bread-small.jpg', width: 400, height: 267 }]
    },
    recipe: {
      title: 'Banana Bread',
      description: 'A recipe description.',
      ingredients: [{ name: 'Batter', items: [{ id: 1, text: '2 bananas' }, { id: 2, text: '1 cup flour' }] }]
    }
  });
  const browse = projectRecipe(source);
  const search = projectSearchRecipe(source);

  assert.deepEqual(Object.keys(browse), ['post_id', 'title', 'excerpt', 'path', 'image', 'categories']);
  assert.deepEqual(Object.keys(browse.image), ['src', 'alt', 'width', 'height']);
  assert.equal('variants' in search.image, false);
  assert.equal(browse.excerpt, 'Editorial copy.');
  assert.deepEqual(search.ingredients, ['2 bananas', '1 cup flour']);
});
