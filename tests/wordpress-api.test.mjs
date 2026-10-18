import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchWordPressSnapshot } from '../src/lib/content/wordpress-api.ts';

const seo = { title: 'Banana bread', description: 'Description', canonical: 'https://example.test/banana-bread/', robots: 'index,follow', og_title: 'Banana bread', og_description: 'Description', og_image: null };
function post({ id = 1, content = '<div id="mv-creation-82">card</div>', yoast_head_json = seo, link = 'https://example.test/banana-bread/', title = 'Banana Bread' } = {}) {
  return {
    id, slug: 'banana-bread', status: 'publish', link, title: { rendered: title }, excerpt: { rendered: '<p>Excerpt</p>' },
    content: { rendered: content }, date_gmt: '2025-01-01T00:00:00', modified_gmt: '2025-01-02T00:00:00',
    author: 5, comment_status: 'open', yoast_head_json,
    _embedded: {
      author: [{ name: 'Asha G', email: 'private@example.test', description: 'Biography not selected for export' }],
      'wp:term': [
        [{ id: 3, name: 'Baking', slug: 'baking', taxonomy: 'category', link: 'https://example.test/category/baking/' }],
        [{ id: 4, name: 'bread', slug: 'bread', taxonomy: 'post_tag' }]
      ],
      'wp:featuredmedia': [{
        id: 10, source_url: 'https://example.test/uploads/banana-bread.jpg', alt_text: 'Banana bread',
        media_details: {
          width: 1200, height: 800,
          sizes: { medium: { source_url: 'https://example.test/uploads/banana-bread-400.jpg', width: 400, height: 267 } }
        }
      }]
    }
  };
}
function page(path = '/banana-bread/') {
  return { id: 11, status: 'publish', link: `https://example.test${path}`, title: { rendered: 'About' }, excerpt: { rendered: '' }, content: { rendered: '<p>Page content</p>' }, date_gmt: '2025-01-01T00:00:00', modified_gmt: '2025-01-02T00:00:00', comment_status: 'closed', yoast_head_json: { ...seo, canonical: `https://example.test${path}` }, _embedded: { author: [{ name: 'Asha G' }], 'wp:term': [[], []] } };
}
function card(overrides = {}) {
  return {
    id: 82, type: 'recipe', canonical_post_id: '1', original_post_id: '1',
    title: 'Chocolate Chip Banana Bread', description: '<p>Rich and tender.</p>',
    supplies: [
      { id: 100, original_text: '2 cups flour', group: 'mv-has-no-group', position: '0' },
      { id: 101, original_text: '1 cup chips', group: 'Mix-ins', position: '1' }
    ],
    instructions: '<ol><li>Mix ingredients.</li><li>Bake until done.</li></ol>',
    prep_time: '900', active_time: '3000', additional_time: '1800', total_time: '5700', yield: '1 loaf',
    nutrition: { serving_size: '1', number_of_servings: '10', calories: '233', total_fat: '7', source: 'API Ninjas Nutrition' },
    ...overrides
  };
}
function response(body, headers = {}, status = 200, type = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'content-type': type, ...headers } });
}
function publicComment(overrides = {}) {
  return {
    id: 91, post: 1, parent: 0, author_name: 'A Reader',
    date_gmt: '2025-01-03T00:00:00', content: { rendered: '<p>Thanks!</p>' },
    ...overrides
  };
}
function wpCommentsResponse(url, comments = []) {
  const postId = Number(url.searchParams.get('post'));
  const pageNo = Number(url.searchParams.get('page') ?? 1);
  const perPage = Number(url.searchParams.get('per_page') ?? 100);
  const records = comments.filter((comment) => Number(comment.post) === postId);
  const pageCount = Math.ceil(records.length / perPage);
  return response(records.slice((pageNo - 1) * perPage, pageNo * perPage), {
    'X-WP-TotalPages': String(pageCount), 'X-WP-Total': String(records.length)
  });
}
function createFetcher({ posts = [post()], pages = [], cards = new Map([[82, card()]]), comments = new Map(), changedCard, html = '<html><head><title>Banana bread</title><meta name="description" content="Description"><meta name="robots" content="index,follow"><meta property="og:title" content="Banana bread"><meta property="og:description" content="Description"><link rel="canonical" href="https://example.test/banana-bread/"></head></html>', unavailablePage = false } = {}) {
  const calls = [];
  let cardRequests = 0;
  const fetcher = async (input, init) => {
    const url = new URL(input); calls.push({ url, init });
    if (url.pathname.endsWith('/wp/v2/comments')) return wpCommentsResponse(url, comments.get(Number(url.searchParams.get('post'))) ?? []);
    if (url.pathname.endsWith('/wp/v2/posts') || url.pathname.endsWith('/wp/v2/pages')) {
      const collection = url.pathname.endsWith('/posts') ? posts : pages;
      const pageNo = Number(url.searchParams.get('page') ?? 1);
      return response(collection.slice((pageNo - 1) * 100, pageNo * 100), { 'X-WP-TotalPages': String(Math.ceil(collection.length / 100)), 'X-WP-Total': String(collection.length) });
    }
    const cardMatch = url.pathname.match(/\/mv-create\/v1\/creations\/(\d+)$/);
    if (cardMatch) {
      cardRequests += 1;
      return response(changedCard && cardRequests > 1 ? changedCard : cards.get(Number(cardMatch[1])) ?? { code: 'missing' });
    }
    if (unavailablePage) return response('Missing', {}, 404, 'text/html');
    return response(html, {}, 200, 'text/html');
  };
  return { fetcher, calls };
}

const opts = (fetcher) => ({ fetcher, publicOrigin: 'https://example.test', cmsOrigin: 'https://example.test' });

test('imports paginated published posts/pages into validated normalized public snapshot', async () => {
  const pagedPost = post();
  const pagedPage = page('/about/');
  const calls = [];
  let phase = 0;
  const fetcher = async (input, init) => {
    const url = new URL(input); calls.push({ url, init });
    if (url.pathname.endsWith('/wp/v2/comments')) return wpCommentsResponse(url);
    if (url.pathname.endsWith('/wp/v2/posts')) {
      const p = Number(url.searchParams.get('page') ?? 1);
      return response(p === 1 ? [pagedPost] : [], { 'X-WP-TotalPages': p === 1 ? '1' : '1', 'X-WP-Total': '1' });
    }
    if (url.pathname.endsWith('/wp/v2/pages')) return response(url.searchParams.get('page') === '1' ? [pagedPage] : [], { 'X-WP-TotalPages': '1', 'X-WP-Total': '1' });
    if (url.pathname.endsWith('/82')) { phase += 1; return response(card()); }
    return response('<html></html>', {}, 200, 'text/html');
  };
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  assert.equal(snapshot.contract_version, 1);
  assert.equal(snapshot.items.length, 2);
  assert.doesNotMatch(JSON.stringify(snapshot), /private@example\.test|Biography not selected/);
  const recipeItem = snapshot.items.find((item) => item.kind === 'recipe');
  assert.equal(recipeItem.card_id, 82);
  assert.equal(recipeItem.image.alt, 'Banana bread');
  assert.equal(recipeItem.image.width, 1200);
  assert.deepEqual(recipeItem.image.variants, [{ src: 'https://example.test/uploads/banana-bread-400.jpg', width: 400, height: 267 }]);
  assert.deepEqual(recipeItem.recipe.notes, []);
  assert.equal(recipeItem.recipe.rating, null);
  assert.deepEqual(recipeItem.recipe.ingredients[0], { name: '', items: [{ id: 100, text: '2 cups flour' }] });
  assert.deepEqual(recipeItem.recipe.instructions.map((step) => step.text), ['Mix ingredients.', 'Bake until done.']);
  assert.equal(recipeItem.recipe.total_seconds, 5700);
  assert.equal(recipeItem.recipe.nutrition.servings, '10');
  assert.deepEqual(recipeItem.recipe.nutrition.values, { calories: '233', total_fat: '7' });
  assert.equal(recipeItem.recipe.nutrition.source, 'API Ninjas Nutrition');
  assert.equal(snapshot.items.find((item) => item.kind === 'page').path, '/about/');
  assert.ok(calls.every(({ init }) => init.cache === 'no-store' && init.method === 'GET'));
  assert.ok(calls.filter(({ url }) => /\/wp\/v2\/(posts|pages)$/.test(url.pathname)).every(({ url }) => url.searchParams.get('status') === 'publish' && url.searchParams.get('context') === 'view' && url.searchParams.get('_embed') === '1' && url.searchParams.get('per_page') === '100'));
  assert.ok(calls.some(({ url }) => url.pathname.endsWith('/wp/v2/comments') && url.searchParams.get('status') === 'approve' && url.searchParams.get('context') === 'view' && url.searchParams.get('_fields') === 'id,post,parent,author_name,date_gmt,content'));
  assert.ok(calls.every(({ url }) => !url.pathname.includes('/pfoy/v1/')));
});

test('imports numbered Create instructions split from a paragraph when list items are absent', async () => {
  const instructions = '<ol><p>1. Slice the sweet potato into rounds.<br/>2. Steam for 5–10 minutes until fork tender.<br/>3. Crush shallots, chillies, and salt using a mortar and pestle.<br/>4. Add melted coconut oil and mix well.<br/>5. Serve warm with steamed sweet potatoes.</p></ol>';
  const record = post({ id: 995, content: '<div id="mv-creation-76">card</div>' });
  const sourceCard = card({
    id: 76, canonical_post_id: '995', original_post_id: '995', instructions
  });
  const { fetcher } = createFetcher({ posts: [record], cards: new Map([[76, sourceCard]]) });
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  const recipeItem = snapshot.items.find((item) => item.kind === 'recipe');
  const expected = [
    'Slice the sweet potato into rounds.',
    'Steam for 5–10 minutes until fork tender.',
    'Crush shallots, chillies, and salt using a mortar and pestle.',
    'Add melted coconut oil and mix well.',
    'Serve warm with steamed sweet potatoes.'
  ];
  assert.deepEqual(recipeItem.recipe.instructions.map((step) => step.text), expected);
  assert.deepEqual(recipeItem.recipe.instructions.map((step) => step.id), expected.map((_, index) => `step-${index + 1}`));
});

test('imports Create instructions grouped by Step headings and following paragraphs', async () => {
  const instructions = '<ol></ol><h3>Step 1: Prepare the Florets</h3><p>Wash the cauliflower florets thoroughly. Bring a large pot of water to a boil and blanch them.</p><h3>Step 2: Spice It Up</h3><p>If you like an extra kick, add more chili flakes.</p><h3>Step 3: Make the Sauce</h3><p>Whisk the sauce ingredients together until smooth.</p><h3>Step 4: Cook the Cauliflower</h3><p>Add the florets to the sauce and stir well.</p><p>Simmer until tender, stirring occasionally.</p><h3>Step 6: Serve</h3><p>Serve hot with fresh herbs.</p>';
  const record = post({ id: 995, content: '<div id="mv-creation-41">card</div>' });
  const sourceCard = card({ id: 41, canonical_post_id: '995', original_post_id: '995', instructions });
  const { fetcher } = createFetcher({ posts: [record], cards: new Map([[41, sourceCard]]) });
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  const steps = snapshot.items.find((item) => item.kind === 'recipe').recipe.instructions.map((step) => step.text);
  assert.equal(steps.length, 5);
  assert.deepEqual(steps.map((step) => step.slice(0, step.indexOf(':') + 1)), [
    'Step 1:', 'Step 2:', 'Step 3:', 'Step 4:', 'Step 6:'
  ]);
  assert.deepEqual(steps, [
    'Step 1: Prepare the Florets Wash the cauliflower florets thoroughly. Bring a large pot of water to a boil and blanch them.',
    'Step 2: Spice It Up If you like an extra kick, add more chili flakes.',
    'Step 3: Make the Sauce Whisk the sauce ingredients together until smooth.',
    'Step 4: Cook the Cauliflower Add the florets to the sauce and stir well. Simmer until tender, stirring occasionally.',
    'Step 6: Serve Serve hot with fresh herbs.'
  ]);
});

test('ignores empty Create ingredient rows without losing authored items', async () => {
  const sourceCard = card({
    supplies: [
      ...card().supplies,
      { id: 102, original_text: '', group: 'Empty', position: '2' },
      { id: 103, original_text: '  ', group: 'Empty', position: '3' }
    ]
  });
  const { fetcher } = createFetcher({ cards: new Map([[82, sourceCard]]) });
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  const recipeItem = snapshot.items.find((item) => item.kind === 'recipe');
  assert.deepEqual(recipeItem.recipe.ingredients, [
    { name: '', items: [{ id: 100, text: '2 cups flour' }] },
    { name: 'Mix-ins', items: [{ id: 101, text: '1 cup chips' }] }
  ]);
});
test('imports approved public comments across core REST pages without leaking private fields', async () => {
  const comments = Array.from({ length: 101 }, (_, index) => publicComment({
    id: index + 1,
    parent: index === 100 ? 1 : 0,
    date_gmt: new Date(Date.UTC(2025, 0, 1, 0, index)).toISOString().replace(/Z$/, ''),
    content: { rendered: `<p>Comment ${index + 1}</p>` },
    author_email: 'private@example.test',
    author_ip: '192.0.2.1'
  }));
  const { fetcher, calls } = createFetcher({ comments: new Map([[1, comments]]) });
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  const recipe = snapshot.items.find((item) => item.kind === 'recipe');
  assert.equal(recipe.comments_count, 101);
  assert.equal(recipe.comments[0].content, 'Comment 1');
  assert.equal(recipe.comments[100].parent, 1);
  assert.equal(recipe.comments[100].content, 'Comment 101');
  assert.doesNotMatch(JSON.stringify(recipe.comments), /private@example\.test|192\.0\.2\.1|author_email|author_ip/);
  const commentCalls = calls.filter(({ url }) => url.pathname.endsWith('/wp/v2/comments'));
  assert.deepEqual(commentCalls.map(({ url }) => Number(url.searchParams.get('page'))).sort(), [1, 1, 2, 2]);
  assert.ok(commentCalls.every(({ url }) => url.searchParams.get('status') === 'approve' && url.searchParams.get('post') === '1'));
});

test('imports cardless posts as articles without custom classification and validates linked Create cards', async () => {
  const article = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [post({ content: '<p>Editorial body</p>' })] }).fetcher));
  assert.equal(article.items[0].kind, 'article');
  assert.equal(article.items[0].seo.og_image, null);
  assert.equal(article.items[0].card_id, null);
  assert.equal(article.items[0].recipe, null);
  for (const [record, cards, pattern] of [
    [post(), new Map([[82, card({ type: 'article' })]]), /not type recipe/],
    [post(), new Map([[82, card({ canonical_post_id: '99', original_post_id: '99' })]]), /does not belong/]
  ]) {
    const { fetcher } = createFetcher({ posts: [record], cards });
    await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher)), pattern);
  }
});

test('rejects duplicate paths, missing data, unsafe origins, and unavailable public pages', async () => {
  const duplicate = post({ id: 2 });
  const duplicateFetcher = createFetcher({ posts: [post(), duplicate] }).fetcher;
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(duplicateFetcher)), /Duplicate public path/);
  await assert.rejects(fetchWordPressSnapshot('https://user:password@example.test/wp-json/', opts(createFetcher().fetcher)), /without credentials/);
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', { fetcher: createFetcher({ posts: [post({ content: '<p>No card</p>' })] }).fetcher, publicOrigin: 'https://example.test' }), /Both publicOrigin and cmsOrigin/);
  const { fetcher } = createFetcher({ posts: [post({ yoast_head_json: null })], unavailablePage: true });
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher)), /HTTP 404/);
});

test('rejects source changes between uncached retrievals', async () => {
  const { fetcher } = createFetcher({ changedCard: card({ title: 'Changed recipe' }) });
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher)), /revision changed/);
});

test('ignores unstable taxonomy ordering but rejects changed term membership', async () => {
  function reorderedFetcher(changeMembership = false) {
    const record = post();
    record.categories = [3];
    record.tags = [6, 4];
    record.class_list = ['tag-six', 'tag-four'];
    record._embedded['wp:term'][1].push({ id: 6, name: 'fruit', slug: 'fruit', taxonomy: 'post_tag' });
    const base = createFetcher({ posts: [record] }).fetcher;
    let postPass = 0;
    return async (input, init) => {
      const url = new URL(input);
      const result = await base(input, init);
      if (!url.pathname.endsWith('/wp/v2/posts')) return result;
      postPass += 1;
      const records = await result.json();
      if (postPass === 2) {
        records[0].categories.reverse();
        records[0].tags.reverse();
        records[0].class_list.reverse();
        records[0]._embedded['wp:term'].reverse();
        for (const terms of records[0]._embedded['wp:term']) terms.reverse();
        if (changeMembership) {
          records[0].tags.pop();
          records[0]._embedded['wp:term'].find((terms) => terms[0]?.taxonomy === 'post_tag').pop();
        }
      }
      return response(records, Object.fromEntries(result.headers));
    };
  }

  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(reorderedFetcher()));
  assert.deepEqual(snapshot.items[0].tags.map(({ id }) => id), [4, 6]);
  assert.equal(snapshot.items[0].categories[0].id, 3);

  await assert.rejects(
    fetchWordPressSnapshot('https://example.test/wp-json/', opts(reorderedFetcher(true))),
    /revision changed during retrieval/
  );
});

test('preserves authored REST SEO, then defaults SEO-empty records without inventing content or imagery', async () => {
  const authored = { title: 'Source title', description: 'Source description', canonical: 'https://example.test/authored/', robots: 'noindex,nofollow', og_title: 'Social title', og_description: 'Social description', og_image: 'https://example.test/social.jpg' };
  const authoredPage = page('/authored/');
  authoredPage.yoast_head_json = authored;
  const authoredSnapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [], pages: [authoredPage] }).fetcher));
  assert.deepEqual(authoredSnapshot.items[0].seo, authored);
  const head = page('/head-seo/');
  head.title = { rendered: '' };
  head.yoast_head_json = null;
  const headHtml = '<html><head><title>Head title</title><meta name="description" content="Head description"><meta name="robots" content="noindex,follow"><meta property="og:title" content="Social title"><meta property="og:description" content="Social description"><meta property="og:image" content="https://example.test/social.jpg"><link rel="canonical" href="https://example.test/head-seo/"></head></html>';
  const headSnapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [], pages: [head], html: headHtml }).fetcher));
  assert.equal(headSnapshot.items[0].title, 'Head title');
  assert.deepEqual(headSnapshot.items[0].seo, { title: 'Head title', description: 'Head description', canonical: 'https://example.test/head-seo/', robots: 'noindex,follow', og_title: 'Social title', og_description: 'Social description', og_image: 'https://example.test/social.jpg' });

  const empty = page('/recipe-dietary/');
  empty.id = 905;
  empty.title = { rendered: 'Recipe dietary' };
  empty.excerpt = { rendered: '' };
  empty.content = { rendered: '' };
  empty.yoast_head_json = {};
  const emptySnapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [], pages: [empty], html: '<html><head><title>Recipe dietary</title><link rel="canonical" href="https://example.test/recipe-dietary/"><meta name="robots" content="index,follow"></head></html>' }).fetcher));
  assert.deepEqual(emptySnapshot.items[0].seo, { title: 'Recipe dietary', description: '', canonical: 'https://example.test/recipe-dietary/', robots: 'index,follow', og_title: 'Recipe dietary', og_description: '', og_image: null });
  assert.equal(emptySnapshot.items[0].excerpt, '');
  assert.equal(emptySnapshot.items[0].image, null);
  assert.equal(emptySnapshot.items[0].content_html, '');
});

test('imports Yoast Open Graph image arrays and image objects', async () => {
  const arrayPage = page('/array-image/');
  arrayPage.id = 906;
  arrayPage.yoast_head_json = { ...seo, canonical: 'https://example.test/array-image/', open_graph_images: [{ url: 'https://example.test/first-social.jpg', width: 1200 }, { url: 'https://example.test/second-social.jpg' }] };
  const objectPage = page('/object-image/');
  objectPage.id = 907;
  objectPage.yoast_head_json = { ...seo, canonical: 'https://example.test/object-image/', open_graph_images: { url: 'https://example.test/object-social.jpg', width: 800 } };
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [], pages: [arrayPage, objectPage] }).fetcher));
  assert.equal(snapshot.items.find((item) => item.post_id === 906).seo.og_image, 'https://example.test/first-social.jpg');
  assert.equal(snapshot.items.find((item) => item.post_id === 907).seo.og_image, 'https://example.test/object-social.jpg');
});

test('rejects unavailable canonical page head when SEO absence cannot be confirmed', async () => {
  const { fetcher } = createFetcher({ posts: [], pages: [{ ...page('/recipe-dietary/'), yoast_head_json: {} }], unavailablePage: true });
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher)), /HTTP 404/);
});
test('follows WordPress pagination through all records', async () => {
  const posts = Array.from({ length: 101 }, (_, index) => {
    const id = index + 1;
    return post({ id, content: '<p>Editorial article</p>', link: `https://example.test/article-${id}/`, title: `Article ${id}` });
  });
  const requestedPages = [];
  const fetcher = async (input, init) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/wp/v2/comments')) return wpCommentsResponse(url);
    if (url.pathname.endsWith('/wp/v2/posts')) {
      const pageNumber = Number(url.searchParams.get('page'));
      requestedPages.push(pageNumber);
      return response(posts.slice((pageNumber - 1) * 100, pageNumber * 100), { 'X-WP-TotalPages': '2', 'X-WP-Total': '101' });
    }
    if (url.pathname.endsWith('/wp/v2/pages')) return response([], { 'X-WP-TotalPages': '0', 'X-WP-Total': '0' });
    throw new Error(`Unexpected request ${url}`);
  };
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  assert.equal(snapshot.items.length, 101);
  assert.ok(requestedPages.includes(1));
  assert.ok(requestedPages.includes(2));
});
test('accepts CMS-origin post links, normalizes GMT timestamps, and prefers public pfoy SEO fields', async () => {
  const cmsPost = post({
    content: '<p>Editorial</p>',
    link: 'https://cms.test/editorial/',
    yoast_head_json: { ...seo, title: 'Public SEO title', canonical: 'https://cms.test/editorial/' },
    _embedded: undefined
  });
  cmsPost._embedded = {
    author: [{ name: 'Asha G' }],
    'wp:term': [[{ id: 3, name: 'Baking', slug: 'baking', taxonomy: 'category', link: 'https://cms.test/category/baking/' }], []]
  };
  const fetcher = async (input) => {
    const url = new URL(input);
    if (url.pathname.endsWith('/wp/v2/comments')) return wpCommentsResponse(url);
    if (url.pathname.endsWith('/wp/v2/posts')) return response([cmsPost], { 'X-WP-TotalPages': '1', 'X-WP-Total': '1' });
    if (url.pathname.endsWith('/wp/v2/pages')) return response([], { 'X-WP-TotalPages': '0', 'X-WP-Total': '0' });
    throw new Error(`Unexpected request ${url}`);
  };
  const snapshot = await fetchWordPressSnapshot('https://cms.test/wp-json/', { fetcher, publicOrigin: 'https://example.test', cmsOrigin: 'https://cms.test' });
  assert.equal(snapshot.items[0].path, '/editorial/');
  assert.equal(snapshot.items[0].categories[0].path, '/category/baking/');
  assert.equal(snapshot.items[0].seo.title, 'Public SEO title');
  assert.equal(snapshot.items[0].seo.canonical, 'https://example.test/editorial/');
  assert.equal(snapshot.items[0].date_published, '2025-01-01T00:00:00Z');
});

test('rejects external taxonomy links, excludes protected content, and enforces response limits', async () => {
  for (const termIndex of [0, 1]) {
    const unsafeTerm = post({ content: '<p>Editorial</p>' });
    unsafeTerm._embedded['wp:term'][termIndex][0].link = 'https://attacker.example/category/baking/';
    await assert.rejects(
      fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [unsafeTerm] }).fetcher)),
      /outside the configured/
    );
  }
  const protectedPost = post();
  protectedPost.content.protected = true;
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [protectedPost] }).fetcher));
  assert.deepEqual(snapshot.items, []);
  const hugeResponseFetcher = async () => response([], { 'X-WP-TotalPages': '0', 'X-WP-Total': '0', 'Content-Length': String(33 * 1024 * 1024) });
  await assert.rejects(fetchWordPressSnapshot('https://example.test/wp-json/', opts(hugeResponseFetcher)), /response limit/);
});

test('preserves source-backed ratings and rejects recipes without featured media', async () => {
  const ratedCard = card({ rating: { value: '4.5', count: '12' } });
  const { fetcher } = createFetcher({ cards: new Map([[82, ratedCard]]) });
  const snapshot = await fetchWordPressSnapshot('https://example.test/wp-json/', opts(fetcher));
  assert.deepEqual(snapshot.items[0].recipe.rating, { value: 4.5, count: 12 });

  const missingImage = post();
  missingImage._embedded['wp:featuredmedia'] = [];
  await assert.rejects(
    fetchWordPressSnapshot('https://example.test/wp-json/', opts(createFetcher({ posts: [missingImage] }).fetcher)),
    /missing its required featured image/
  );
});
