import { parseFragment, parse, serialize } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { normalizeContentItem } from './normalize.ts';
import { parseContentPage } from './validate.ts';
import type { ContentKind, ContentSnapshot, PublicContentItem, PublicRecipe, PublicSeo, TaxonomyTerm } from './types.ts';

const PAGE_SIZE = 100;
const CONCURRENCY = 4;
const MAX_PAGES = 10_000;
const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
type RecordValue = Record<string, unknown>;
type Options = { fetcher?: typeof fetch; publicOrigin?: string; cmsOrigin?: string };
type SeoBits = Partial<PublicSeo>;
async function sha256(value: string): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function object(value: unknown, at: string): RecordValue {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${at} must be an object`);
  return value as RecordValue;
}
function string(value: unknown, at: string, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim())) throw new Error(`${at} must be ${empty ? 'a string' : 'a non-empty string'}`);
  return value;
}
function integer(value: unknown, at: string, min = 0): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (!Number.isSafeInteger(parsed) || (parsed as number) < min) throw new Error(`${at} must be an integer >= ${min}`);
  return parsed as number;
}
function htmlText(value: unknown, at: string, empty = false): string {
  const source = typeof value === 'object' && value !== null && 'rendered' in value ? (value as RecordValue).rendered : value;
  if (typeof source !== 'string') throw new Error(`${at} must be rendered HTML`);
  const fragment = parseFragment(source);
  function textOf(node: DefaultTreeAdapterMap['node']): string {
    if ('value' in node) return node.value;
    if (!('childNodes' in node)) return '';
    return node.childNodes.map(textOf).join('tagName' in node && node.tagName === 'li' ? ' ' : '');
  }
  const text = textOf(fragment).replace(/\s+/g, ' ').trim();
  if (!empty && !text) throw new Error(`${at} must not be empty`);
  return text;
}
function attrs(node: DefaultTreeAdapterMap['node']): Record<string, string> {
  if (!('attrs' in node)) return {};
  return Object.fromEntries(node.attrs.map((attr) => [attr.name, attr.value]));
}
function findNodes(node: DefaultTreeAdapterMap['node'], predicate: (node: DefaultTreeAdapterMap['node']) => boolean): DefaultTreeAdapterMap['node'][] {
  const result: DefaultTreeAdapterMap['node'][] = [];
  if (predicate(node)) result.push(node);
  if ('childNodes' in node) for (const child of node.childNodes) result.push(...findNodes(child, predicate));
  if ('content' in node) result.push(...findNodes(node.content, predicate));
  return result;
}
function createId(html: string, postId: number): number {
  const ids = [...html.matchAll(/\bid\s*=\s*(["'])mv-creation-(\d+)\1/gi)].map((match) => Number(match[2]));
  const blocks = [...html.matchAll(/<!--\s*wp:mv-create\/[^\s{]+\s+(\{.*?\})\s*-->/gs)];
  for (const block of blocks) {
    try {
      const attrsValue = JSON.parse(block[1]) as RecordValue;
      const value = attrsValue.id ?? attrsValue.cardId ?? attrsValue.card_id ?? attrsValue.creationId ?? attrsValue.creation_id;
      if (Number.isSafeInteger(Number(value)) && Number(value) > 0) ids.push(Number(value));
    } catch { /* malformed block is not a card reference */ }
  }
  const unique = [...new Set(ids)];
  if (unique.length !== 1 || ids.length !== 1) throw new Error(`Post ${postId} must contain exactly one mv-creation-{id} Create embed`);
  return integer(unique[0], `Post ${postId} Create ID`, 1);
}
function origin(value: string, at: string): string {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`${at} must be a valid HTTP(S) origin`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash || url.username || url.password) throw new Error(`${at} must be an HTTP(S) origin without credentials or a path`);
  return url.origin;
}
function taxonomy(values: unknown, category: boolean, at: string, allowedOrigins: string[]): TaxonomyTerm[] {
  if (!Array.isArray(values)) throw new Error(`${at} must be an array`);
  return values.map((value, index) => {
    const term = object(value, `${at}[${index}]`);
    const base = { id: integer(term.id, `${at}[${index}].id`, 1), name: htmlText(term.name, `${at}[${index}].name`), slug: string(term.slug, `${at}[${index}].slug`) };
    let linkedPath: string | undefined;
    if (typeof term.link === 'string') {
      let url: URL;
      try { url = new URL(term.link); } catch { throw new Error(`${at}[${index}].link must be an absolute URL`); }
      if (!allowedOrigins.includes(url.origin) || url.search || url.hash || !url.pathname.startsWith('/') || !url.pathname.endsWith('/')) throw new Error(`${at}[${index}].link is outside the configured WordPress/public origins or is not a canonical path`);
      linkedPath = url.pathname;
    }
    if (category && !linkedPath) throw new Error(`${at}[${index}] is missing its public category URL`);
    return { ...base, path: category ? linkedPath! : '' };
  }).sort((left, right) => left.id - right.id);
}
function pathFromLink(link: string, publicOrigin: string, cmsOrigin: string): string {
  const url = new URL(link);
  if (![publicOrigin, cmsOrigin].includes(url.origin) || url.search || url.hash || !url.pathname.startsWith('/') || !url.pathname.endsWith('/')) throw new Error(`WordPress link ${link} is not a canonical public or CMS path`);
  return url.pathname;
}
function wordpressDate(gmt: unknown, _local: unknown, at: string): string {
  if (gmt === null || gmt === undefined || gmt === '') throw new Error(`${at} is missing required date_gmt`);
  const raw = string(gmt, at);
  return !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? `${raw}Z` : raw;
}
function toSeconds(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' || (typeof value === 'string' && /^\d+$/.test(value))) return integer(value, 'Create duration');
  if (typeof value === 'string' && /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i.test(value)) {
    const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i)!;
    return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
  }
  return null;
}
function recipe(cardValue: unknown, cardId: number, postId: number): PublicRecipe {
  const card = object(cardValue, `Create card ${cardId}`);
  if (integer(card.id ?? cardId, `Create card ${cardId} ID`, 1) !== cardId) throw new Error(`Create card ${cardId} returned a mismatched ID`);
  if (card.type !== 'recipe') throw new Error(`Create card ${cardId} is not type recipe`);
  const postMatches = [card.canonical_post_id, card.original_post_id].some((sourceId) => sourceId !== null && sourceId !== undefined && String(sourceId) === String(postId));
  if (!postMatches) throw new Error(`Create card ${cardId} does not belong to WordPress post ${postId}`);
  if (!Array.isArray(card.supplies)) throw new Error(`Create card ${cardId} supplies must be an array`);
  const grouped = new Map<string, { position: number; items: Array<{ position: number; id: number; text: string }> }>();
  card.supplies.forEach((raw, index) => {
    const supply = object(raw, `Create card ${cardId} supplies[${index}]`);
    const text = string(supply.original_text, `Create card ${cardId} supply original_text`, true);
    if (!text.trim()) return;
    const id = integer(supply.id, `Create card ${cardId} supply ID`, 1);
    const name = typeof supply.group === 'string' && supply.group !== 'mv-has-no-group' ? supply.group.trim() : '';
    const position = supply.position === undefined ? index : integer(supply.position, `Create card ${cardId} supply position`);
    const group = grouped.get(name) ?? { position, items: [] };
    group.position = Math.min(group.position, position);
    group.items.push({ position, id, text });
    grouped.set(name, group);
  });
  const ingredients = [...grouped].sort((a, b) => a[1].position - b[1].position).map(([name, group]) => ({ name, items: group.items.sort((a, b) => a.position - b.position).map(({ id, text }) => ({ id, text })) }));
  if (!ingredients.length) throw new Error(`Create card ${cardId} must provide at least one ingredient`);
  const rawInstructions = card.instructions;
  let rawSteps: unknown[] = [];
  if (typeof rawInstructions === 'string') {
    const fragment = parseFragment(rawInstructions);
    rawSteps = findNodes(fragment, (node) => 'tagName' in node && node.tagName === 'li');
    if (!rawSteps.length) {
      const paragraphs = findNodes(fragment, (node) => 'tagName' in node && node.tagName === 'p');
      const numberedParagraphs = paragraphs.map((paragraph) => {
        const markup = serialize(paragraph as DefaultTreeAdapterMap['parentNode']).replace(/^<p[^>]*>|<\/p>$/gi, '');
        const lines = markup.split(/<br\s*\/?>/i).map((line) => htmlText(line, `Create card ${cardId} instruction`, true));
        if (lines.length < 2 || lines.some((line) => !/^\d+[.)]\s+\S/.test(line))) return null;
        return lines.map((line) => line.replace(/^\d+[.)]\s+/, '').trim());
      });
      if (numberedParagraphs.length > 0 && numberedParagraphs.every((lines) => lines !== null)) {
        rawSteps = numberedParagraphs.flatMap((lines) => lines ?? []);
      } else {
        const children = (fragment as DefaultTreeAdapterMap['parentNode']).childNodes;
        const nodes = children.filter((node) => !('value' in node && node.value.trim() === ''));
        const headingSteps: string[] = [];
        let valid = true;
        for (let index = 0; index < nodes.length;) {
          const node = nodes[index];
          if ('tagName' in node && node.tagName === 'ol' && !(node as DefaultTreeAdapterMap['parentNode']).childNodes.some((child) => !('value' in child && child.value.trim() === ''))) {
            index += 1;
            continue;
          }
          if (!('tagName' in node) || node.tagName !== 'h3') { valid = false; break; }
          const heading = htmlText(serialize(node as DefaultTreeAdapterMap['parentNode']), `Create card ${cardId} instruction`, true);
          if (!/^Step\s+\d+\s*:/i.test(heading)) { valid = false; break; }
          index += 1;
          const paragraphs: string[] = [];
          while (index < nodes.length) {
            const paragraph = nodes[index]!;
            if (!('tagName' in paragraph) || paragraph.tagName !== 'p') break;
            paragraphs.push(htmlText(serialize(paragraph as DefaultTreeAdapterMap['parentNode']), `Create card ${cardId} instruction`, true));
            index += 1;
          }
          if (!paragraphs.length || paragraphs.some((paragraph) => !paragraph)) { valid = false; break; }
          headingSteps.push(`${heading} ${paragraphs.join(' ')}`);
        }
        if (valid && headingSteps.length) rawSteps = headingSteps;
      }
    }
  } else if (Array.isArray(rawInstructions)) rawSteps = rawInstructions;
  else throw new Error(`Create card ${cardId} instructions must be an array or HTML`);
  const instructions = rawSteps.map((step, index) => {
    if (typeof step === 'string') return { id: `step-${index + 1}`, text: htmlText(step, `Create card ${cardId} instruction`) };
    if (typeof step === 'object' && step !== null && 'tagName' in step) {
      return { id: attrs(step as DefaultTreeAdapterMap['node']).id || `step-${index + 1}`, text: htmlText(serialize(step as DefaultTreeAdapterMap['parentNode']), `Create card ${cardId} instruction`) };
    }
    const item = object(step, `Create card ${cardId} instruction`);
    return { id: item.id === undefined || item.id === null || item.id === '' ? `step-${index + 1}` : String(item.id), text: htmlText(item.text ?? item.instruction, `Create card ${cardId} instruction`) };
  });
  if (!instructions.length) throw new Error(`Create card ${cardId} has no extractable instructions`);
  const nutritionData = card.nutrition && typeof card.nutrition === 'object' ? card.nutrition as RecordValue : null;
  let nutrition = null;
  if (nutritionData && Object.keys(nutritionData).length) {
    const source = nutritionData.values && typeof nutritionData.values === 'object' ? nutritionData.values as RecordValue : nutritionData;
    const values: Record<string, string> = {};
    for (const key of ['calories', 'total_fat', 'saturated_fat', 'trans_fat', 'unsaturated_fat', 'cholesterol', 'sodium', 'carbohydrates', 'fiber', 'sugar', 'protein']) if (source[key] !== undefined && source[key] !== null) values[key] = String(source[key]);
    nutrition = { serving_size: nutritionData.serving_size == null ? null : String(nutritionData.serving_size), servings: (nutritionData.servings ?? nutritionData.number_of_servings) == null ? null : String(nutritionData.servings ?? nutritionData.number_of_servings), values, source: nutritionData.source == null ? null : String(nutritionData.source) };
  }
  let rating = null;
  for (const key of ['rating', 'aggregate_rating', 'aggregateRating']) {
    const raw = card[key];
    if (raw === undefined || raw === null) continue;
    const value = typeof raw === 'object' ? (raw as RecordValue).value ?? (raw as RecordValue).ratingValue : raw;
    const count = typeof raw === 'object' ? (raw as RecordValue).count ?? (raw as RecordValue).ratingCount ?? card.rating_count : card.rating_count;
    if (Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= 5 && Number.isSafeInteger(Number(count)) && Number(count) > 0) rating = { value: Number(value), count: Number(count) };
    break;
  }
  let notes: string[] = [];
  const rawNotes = card.notes ?? card.recipe_notes;
  if (typeof rawNotes === 'string') notes = rawNotes.split(/\r\n|\r|\n/).map((note) => htmlText(note, 'Create note', true)).filter(Boolean);
  else if (Array.isArray(rawNotes)) notes = rawNotes.map((note) => htmlText(note, 'Create note', true)).filter(Boolean);
  return {
    title: htmlText(card.title, `Create card ${cardId} title`), description: htmlText(card.description ?? '', `Create card ${cardId} description`, true), ingredients, instructions,
    prep_seconds: toSeconds(card.prep_time ?? card.prep_seconds ?? card.prep_time_seconds ?? card.prepTime),
    active_seconds: toSeconds(card.active_time ?? card.active_seconds ?? card.active_time_seconds),
    additional_seconds: toSeconds(card.additional_time ?? card.additional_seconds ?? card.additional_time_seconds),
    total_seconds: toSeconds(card.total_time ?? card.total_seconds ?? card.total_time_seconds ?? card.totalTime),
    yield: (card.yield ?? card.recipe_yield) == null ? null : String(card.yield ?? card.recipe_yield), notes, nutrition, rating
  };
}
function seoFromRest(post: RecordValue): SeoBits {
  const raw = post.pfoy_seo ?? post.yoast_head_json ?? post.seo ?? post.rank_math_seo;
  if (!raw || typeof raw !== 'object') return {};
  const seo = raw as RecordValue;
  const image = seo.og_image ?? seo['og:image'] ?? seo.open_graph_images;
  const images = Array.isArray(image) ? image : [image];
  const ogImage = images.map((candidate) => {
    if (typeof candidate === 'string') return candidate;
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return '';
    const url = (candidate as RecordValue).url;
    return typeof url === 'string' ? url : '';
  }).find(Boolean) ?? null;
  return { title: seo.title as string, description: (seo.description ?? seo.meta_description) as string, canonical: (seo.canonical ?? seo.permalink) as string, robots: typeof seo.robots === 'string' ? seo.robots : Array.isArray(seo.robots) ? seo.robots.map((r) => typeof r === 'string' ? r : '').filter(Boolean).join(', ') : undefined, og_title: (seo.og_title ?? seo['og:title'] ?? seo.open_graph_title ?? seo.title) as string, og_description: (seo.og_description ?? seo['og:description'] ?? seo.open_graph_description ?? seo.description) as string, og_image: ogImage };
}
function mergeSeo(rest: SeoBits, head: SeoBits): SeoBits {
  return {
    title: rest.title || head.title,
    description: rest.description || head.description,
    canonical: rest.canonical || head.canonical,
    robots: rest.robots || head.robots,
    og_title: rest.og_title || head.og_title,
    og_description: rest.og_description || head.og_description,
    og_image: rest.og_image ?? head.og_image ?? null
  };
}
function seoFromHtml(html: string): SeoBits {
  const doc = parse(html);
  const meta: Record<string, string> = {};
  for (const node of findNodes(doc, (n) => 'tagName' in n && n.tagName === 'meta')) {
    const a = attrs(node); const key = (a.property ?? a.name ?? '').toLowerCase(); if (key) meta[key] = a.content ?? '';
  }
  const titleNode = findNodes(doc, (n) => 'tagName' in n && n.tagName === 'title')[0];
  const canonicalNode = findNodes(doc, (n) => 'tagName' in n && n.tagName === 'link' && attrs(n).rel?.toLowerCase().split(/\s+/).includes('canonical'))[0];
  const canonicalAttrs = canonicalNode ? attrs(canonicalNode) : {};
  const title = titleNode ? htmlText(textOfNode(titleNode), 'SEO title') : undefined;
  return { title, description: meta.description, canonical: canonicalAttrs.href, robots: meta.robots, og_title: meta['og:title'] ?? title, og_description: meta['og:description'] ?? meta.description, og_image: meta['og:image'] ?? null };
}
function textOfNode(node: DefaultTreeAdapterMap['node']): string {
  if ('value' in node) return node.value;
  if (!('childNodes' in node)) return '';
  return node.childNodes.map(textOfNode).join(' ');
}
async function mapLimit<T, R>(values: T[], limit: number, mapper: (value: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(values.length); let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => { while (true) { const index = next++; if (index >= values.length) return; results[index] = await mapper(values[index]!, index); } }));
  return results;
}
function sourceRecordForComparison(record: RecordValue): RecordValue {
  const stable = { ...record };
  for (const key of ['categories', 'tags']) {
    const ids = stable[key];
    if (Array.isArray(ids)) stable[key] = [...ids].sort((left, right) => Number(left) - Number(right));
  }
  if (Array.isArray(stable.class_list)) stable.class_list = [...stable.class_list].sort();
  const embedded = stable._embedded;
  if (embedded && typeof embedded === 'object' && !Array.isArray(embedded)) {
    const value = embedded as RecordValue;
    const termSets = value['wp:term'];
    if (Array.isArray(termSets)) {
      const sortedTermSets = termSets.map((set) => Array.isArray(set)
        ? [...set].sort((left, right) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))))
        : set).sort((left, right) => String(JSON.stringify(left)).localeCompare(String(JSON.stringify(right))));
      stable._embedded = { ...value, 'wp:term': sortedTermSets };
    }
  }
  return stable;
}

export async function fetchWordPressSnapshot(apiRoot: string, options: Options = {}): Promise<ContentSnapshot> {
  if (Boolean(options.publicOrigin) !== Boolean(options.cmsOrigin)) throw new Error('Both publicOrigin and cmsOrigin must be configured together');
  let root: URL;
  try { root = new URL(apiRoot); } catch { throw new Error('apiRoot must be an absolute HTTP(S) URL'); }
  if (!['http:', 'https:'].includes(root.protocol) || root.username || root.password || root.search || root.hash) throw new Error('apiRoot must be an HTTP(S) URL without credentials, query, or fragment');
  const cmsOrigin = origin(options.cmsOrigin ?? root.origin, 'cmsOrigin');
  const publicOrigin = origin(options.publicOrigin ?? cmsOrigin, 'publicOrigin');
  if (root.origin !== cmsOrigin) throw new Error(`apiRoot origin ${root.origin} must match cmsOrigin ${cmsOrigin}`);
  const fetcher = options.fetcher ?? fetch;
  const api = root.href.endsWith('/') ? root.href : `${root.href}/`;
  async function request(url: URL, json: boolean): Promise<{ value: unknown; response: Response }> {
    let response: Response;
    try { response = await fetcher(url, { method: 'GET', headers: { accept: json ? 'application/json' : 'text/html' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(TIMEOUT_MS) }); }
    catch (error) { throw new Error(`Public content request ${url.href} failed: ${String(error)}`); }
    if (!response.ok) throw new Error(`Public content request ${url.href} returned HTTP ${response.status}`);
    if (json && !(response.headers.get('content-type') ?? '').toLowerCase().includes('application/json')) throw new Error(`Public content request ${url.href} did not return JSON`);
    const declaredLength = response.headers.get('content-length');
    if (declaredLength !== null && Number(declaredLength) > MAX_RESPONSE_BYTES) throw new Error(`Public content request ${url.href} exceeds the ${MAX_RESPONSE_BYTES}-byte response limit`);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) {
            await reader.cancel();
            throw new Error(`Public content request ${url.href} exceeds the ${MAX_RESPONSE_BYTES}-byte response limit`);
          }
          chunks.push(value);
        }
      }
      const buffer = new Uint8Array(bytes);
      let offset = 0;
      for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
      const body = new TextDecoder().decode(buffer);
      return { value: json ? JSON.parse(body) as unknown : body, response };
    } catch (error) {
      throw new Error(`Public content request ${url.href} has invalid ${json ? 'JSON' : 'HTML'} or exceeded its response limit: ${String(error)}`);
    } finally {
      reader?.releaseLock();
    }
  }
  async function resolvedSeo(post: RecordValue, id: number, path: string, link: string, excerpt: string): Promise<SeoBits> {
    const sourceTitle = htmlText(post.title, `Post ${id} title`, true);
    let seo = seoFromRest(post);
    if (!seo.title || !seo.description || !seo.canonical || !seo.robots || !seo.og_title || !seo.og_description) {
      const pageUrl = new URL(path, new URL(link).origin);
      const publicPage = await request(pageUrl, false);
      seo = mergeSeo(seo, seoFromHtml(publicPage.value as string));
    }
    const title = sourceTitle || seo.title || '';
    if (!title) throw new Error(`Post ${id} has no title in WordPress REST or its public page head`);
    const canonical = new URL(seo.canonical || new URL(path, publicOrigin).href);
    if (canonical.origin === cmsOrigin) {
      seo.canonical = new URL(`${canonical.pathname}${canonical.search}${canonical.hash}`, publicOrigin).href;
    } else if (canonical.origin === publicOrigin) {
      seo.canonical = canonical.href;
    } else {
      throw new Error(`Canonical URL ${canonical.href} is outside the configured public origin`);
    }
    return {
      title: seo.title || title,
      description: seo.description || excerpt,
      canonical: seo.canonical,
      robots: seo.robots || 'index,follow',
      og_title: seo.og_title || seo.title || title,
      og_description: seo.og_description || seo.description || excerpt,
      og_image: seo.og_image ?? null
    };
  }
  async function collect(type: 'posts' | 'pages'): Promise<{ records: RecordValue[]; pages: number; totals: number[] }> {
    const base = new URL(`wp/v2/${type}`, api);
    for (const [key, value] of Object.entries({ status: 'publish', context: 'view', _embed: '1', per_page: String(PAGE_SIZE), page: '1' })) base.searchParams.set(key, value);
    const first = await request(new URL(base), true);
    const totalPages = integer(first.response.headers.get('x-wp-totalpages'), `${type} X-WP-TotalPages`, 0);
    const totalRecords = integer(first.response.headers.get('x-wp-total'), `${type} X-WP-Total`, 0);
    if (totalPages > MAX_PAGES) throw new Error(`${type} exceeds the ${MAX_PAGES}-page safety limit`);
    if ((totalRecords === 0) !== (totalPages === 0)) throw new Error(`${type} pagination totals are inconsistent`);
    const firstRecords = first.value;
    if (!Array.isArray(firstRecords)) throw new Error(`${type} page 1 must be an array`);
    const all: RecordValue[][] = [firstRecords.map((r, i) => object(r, `${type}[${i}]`))];
    for (let start = 2; start <= totalPages; start += CONCURRENCY) {
      const pages = await Promise.all(Array.from({ length: Math.min(CONCURRENCY, totalPages - start + 1) }, async (_, offset) => {
        const url = new URL(base); url.searchParams.set('page', String(start + offset));
        const result = await request(url, true); const count = integer(result.response.headers.get('x-wp-totalpages'), `${type} X-WP-TotalPages`, 0);
        if (count !== totalPages || integer(result.response.headers.get('x-wp-total'), `${type} X-WP-Total`, 0) !== totalRecords) throw new Error(`${type} pagination totals changed during retrieval`);
        if (!Array.isArray(result.value)) throw new Error(`${type} page ${start + offset} must be an array`);
        return (result.value as unknown[]).map((r, i) => object(r, `${type}[${start + offset}][${i}]`));
      })); all.push(...pages);
    }
    const records = all.flat();
    if (records.length !== totalRecords) throw new Error(`${type} expected ${totalRecords} records but retrieved ${records.length}`);
    for (const [index, record] of records.entries()) if (record.status !== 'publish') throw new Error(`${type}[${index}] was returned with non-public status ${String(record.status)}`);
    return { records: records.filter((record) => typeof record.password !== 'string' || record.password === '').filter((record) => !(record.content && typeof record.content === 'object' && (record.content as RecordValue).protected === true)), pages: totalPages, totals: [totalPages, totalRecords] };
  }
  async function collectComments(postId: number): Promise<{ comments: NonNullable<PublicContentItem['comments']>; count: number }> {
    const base = new URL('wp/v2/comments', api);
    for (const [key, value] of Object.entries({
      post: String(postId),
      status: 'approve',
      context: 'view',
      per_page: String(PAGE_SIZE),
      orderby: 'date',
      order: 'asc',
      _fields: 'id,post,parent,author_name,date_gmt,content',
      page: '1'
    })) base.searchParams.set(key, value);

    const first = await request(new URL(base), true);
    const totalPages = integer(first.response.headers.get('x-wp-totalpages'), `Post ${postId} comments X-WP-TotalPages`, 0);
    const totalRecords = integer(first.response.headers.get('x-wp-total'), `Post ${postId} comments X-WP-Total`, 0);
    if (totalPages > MAX_PAGES || ((totalRecords === 0) !== (totalPages === 0)) || !Array.isArray(first.value)) {
      throw new Error(`Post ${postId} has inconsistent public comment pagination`);
    }
    const pages: unknown[][] = [first.value];
    if (totalPages > 1) {
      const laterPages = await mapLimit(Array.from({ length: totalPages - 1 }, (_, index) => index + 2), CONCURRENCY, async (pageNumber) => {
        const url = new URL(base);
        url.searchParams.set('page', String(pageNumber));
        const result = await request(url, true);
        const pageTotalPages = integer(result.response.headers.get('x-wp-totalpages'), `Post ${postId} comments page ${pageNumber} X-WP-TotalPages`, 0);
        const pageTotalRecords = integer(result.response.headers.get('x-wp-total'), `Post ${postId} comments page ${pageNumber} X-WP-Total`, 0);
        if (pageTotalPages !== totalPages || pageTotalRecords !== totalRecords || !Array.isArray(result.value)) {
          throw new Error(`Post ${postId} comment pagination changed during retrieval`);
        }
        return result.value;
      });
      pages.push(...laterPages);
    }
    const comments = pages.flatMap((page) => page.map((value, index) => {
      const comment = object(value, `Post ${postId} comment ${index}`);
      if (integer(comment.post, `Post ${postId} comment post`, 1) !== postId) {
        throw new Error(`Post ${postId} received a comment associated with another post`);
      }
      const content = object(comment.content, `Post ${postId} comment content`);
      return {
        id: integer(comment.id, `Post ${postId} comment id`, 1),
        post_id: postId,
        parent: integer(comment.parent, `Post ${postId} comment parent`, 0),
        author: htmlText(comment.author_name, `Post ${postId} comment author`),
        date: wordpressDate(comment.date_gmt, comment.date, `Post ${postId} comment date`),
        content: htmlText(content.rendered, `Post ${postId} comment text`)
      };
    }));
    if (comments.length !== totalRecords || new Set(comments.map(({ id }) => id)).size !== comments.length) {
      throw new Error(`Post ${postId} comment export is incomplete or inconsistent`);
    }
    comments.sort((left, right) => Date.parse(left.date) - Date.parse(right.date) || left.id - right.id);
    return { comments, count: totalRecords };
  }
  const [posts, pages] = await Promise.all([collect('posts'), collect('pages')]);
  const records = [...posts.records.map((post) => ({ post, kind: 'post' as const })), ...pages.records.map((post) => ({ post, kind: 'page' as const }))];
  const ids = new Set<number>(); const paths = new Set<string>();
  for (const { post } of records) { const id = integer(post.id, 'WordPress post id', 1); if (ids.has(id)) throw new Error(`Duplicate public post id ${id}`); ids.add(id); }
  const mapped = await mapLimit(records, CONCURRENCY, async ({ post, kind }): Promise<PublicContentItem> => {
    const id = integer(post.id, 'WordPress post id', 1);
    const link = string(post.link, `Post ${id} link`);
    const path = pathFromLink(link, publicOrigin, cmsOrigin);
    if (paths.has(path)) throw new Error(`Duplicate public path ${path}`); paths.add(path);
    const contentHtml = string(object(post.content, `Post ${id} content`).rendered, `Post ${id} content.rendered`, true);
    const cardId = kind === 'post' && /mv-creation-\d+/.test(contentHtml) ? createId(contentHtml, id) : null;
    let contentKind: ContentKind;
    let recipeData: PublicRecipe | null = null;
    if (kind === 'page') contentKind = 'page';
    else if (cardId !== null) {
      contentKind = 'recipe';
      const card = await request(new URL(`mv-create/v1/creations/${cardId}`, api), true);
      recipeData = recipe(card.value, cardId, id);
    } else {
      contentKind = 'article';
    }
    const embedded = object(post._embedded ?? {}, `Post ${id} _embedded`);
    const authorValues = embedded.author; const author = Array.isArray(authorValues) ? object(authorValues[0], `Post ${id} author`) : null;
    if (!author) throw new Error(`Post ${id} is missing embedded author data`);
    const terms = embedded['wp:term']; const termSets = Array.isArray(terms) ? terms : [];
    const categoryTerms = termSets.flatMap((set) => Array.isArray(set) ? set.filter((term) => typeof term === 'object' && term !== null && (term as RecordValue).taxonomy === 'category') : []);
    const tagTerms = termSets.flatMap((set) => Array.isArray(set) ? set.filter((term) => typeof term === 'object' && term !== null && (term as RecordValue).taxonomy === 'post_tag') : []);
    const categories = taxonomy(categoryTerms, true, `Post ${id} categories`, [publicOrigin, cmsOrigin]); const tags = taxonomy(tagTerms, false, `Post ${id} tags`, [publicOrigin, cmsOrigin]);
    const mediaValues = embedded['wp:featuredmedia']; const media = Array.isArray(mediaValues) && mediaValues.length ? object(mediaValues[0], `Post ${id} featured media`) : null;
    let image = null;
    if (media) {
      const mediaUrl = string(media.source_url, `Post ${id} featured image URL`); const mediaDetails = object(media.media_details ?? {}, `Post ${id} media details`);
      const width = integer(mediaDetails.width, `Post ${id} image width`, 1); const height = integer(mediaDetails.height, `Post ${id} image height`, 1);
      const sizes = mediaDetails.sizes && typeof mediaDetails.sizes === 'object' ? mediaDetails.sizes as RecordValue : {};
      const variants = Object.values(sizes).flatMap((raw) => { if (!raw || typeof raw !== 'object') return []; const size = raw as RecordValue; if (typeof size.source_url !== 'string') return []; return [{ src: size.source_url, width: integer(size.width, `Post ${id} image variant width`, 1), height: integer(size.height, `Post ${id} image variant height`, 1) }]; });
      image = { src: mediaUrl, alt: typeof media.alt_text === 'string' ? media.alt_text : '', width, height, variants };
    }
    if (contentKind === 'recipe' && image === null) throw new Error(`Post ${id} is missing its required featured image`);
    const commentSnapshot = await collectComments(id);
    const excerpt = htmlText(object(post.excerpt, `Post ${id} excerpt`).rendered, `Post ${id} excerpt`, true);
    const seo = await resolvedSeo(post, id, path, link, excerpt);
    const title = seo.title || '';
    const item: PublicContentItem = {
      post_id: id, card_id: cardId, kind: contentKind, path,
      title, excerpt, content_html: contentHtml,
      date_published: wordpressDate(post.date_gmt, post.date, `Post ${id} date`), date_modified: wordpressDate(post.modified_gmt, post.modified, `Post ${id} modified`),
      author: { name: htmlText(author.name, `Post ${id} author name`) }, categories, tags, image,
      seo: { title: seo.title!, description: seo.description!, canonical: seo.canonical!, robots: seo.robots!, og_title: seo.og_title!, og_description: seo.og_description!, og_image: seo.og_image ?? null },
      comments_open: post.comment_status === 'open', comments_count: commentSnapshot.count,
      comments: commentSnapshot.comments, recipe: recipeData
    };
    const validated = parseContentPage({ contract_version: 1, revision: 'validation', page: 1, per_page: 1, total_pages: 1, total_records: 1, complete: true, items: [item] }).items[0]!;
    return normalizeContentItem(validated, { publicOrigin, cmsOrigin });
  });
  if (mapped.length !== records.length) throw new Error(`Snapshot expected ${records.length} eligible records but mapped ${mapped.length}`);
  const projection = JSON.stringify(mapped);
  const revision = await sha256(projection);
  const [secondPosts, secondPages] = await Promise.all([collect('posts'), collect('pages')]);
  if (secondPosts.totals[0] !== posts.totals[0] || secondPosts.totals[1] !== posts.totals[1] || secondPages.totals[0] !== pages.totals[0] || secondPages.totals[1] !== pages.totals[1]) throw new Error('WordPress content totals changed during retrieval');
  const secondRecords = [...secondPosts.records.map((post) => ({ post, kind: 'post' as const })), ...secondPages.records.map((post) => ({ post, kind: 'page' as const }))];
  const secondIds = secondRecords.map(({ post }) => integer(post.id, 'WordPress post id', 1)).sort((a, b) => a - b);
  const firstIds = records.map(({ post }) => integer(post.id, 'WordPress post id', 1)).sort((a, b) => a - b);
  if (JSON.stringify(secondIds) !== JSON.stringify(firstIds)) throw new Error('WordPress content changed during retrieval (IDs differ)');
  const confirmed = await mapLimit(secondRecords, CONCURRENCY, async ({ post, kind }, index) => {
    const id = integer(post.id, 'WordPress post id', 1); const path = pathFromLink(string(post.link, `Post ${id} link`), publicOrigin, cmsOrigin);
    const rendered = string(object(post.content, `Post ${id} content`).rendered, `Post ${id} content.rendered`, true);
    const cardId = kind === 'post' && /mv-creation-\d+/.test(rendered) ? createId(rendered, id) : null;
    let secondRecipe: PublicRecipe | null = null;
    if (cardId !== null) {
      const cardResponse = await request(new URL(`mv-create/v1/creations/${cardId}`, api), true);
      secondRecipe = recipe(cardResponse.value, cardId, id);
    }
    if (cardId !== mapped[index]!.card_id || JSON.stringify(secondRecipe) !== JSON.stringify(mapped[index]!.recipe)) throw new Error(`Public content revision changed for post ${id}`);
    return { id, path, raw: post };
  });
  if (JSON.stringify(confirmed.map(({ id, path, raw }) => ({ id, path, raw: sourceRecordForComparison(raw) }))) !== JSON.stringify(records.map(({ post }) => ({ id: integer(post.id, 'WordPress post id', 1), path: pathFromLink(string(post.link, 'WordPress link'), publicOrigin, cmsOrigin), raw: sourceRecordForComparison(post) })))) throw new Error('WordPress content revision changed during retrieval');
  const secondMapped = await mapLimit(secondRecords, CONCURRENCY, async ({ post }, index) => {
    const item = mapped[index]!;
    const liveComments = await collectComments(item.post_id);
    if (JSON.stringify(liveComments.comments) !== JSON.stringify(item.comments) || liveComments.count !== item.comments_count) {
      throw new Error(`Approved comments changed during retrieval for post ${item.post_id}`);
    }
    const link = string(post.link, `Post ${item.post_id} link`);
    const seo = await resolvedSeo(post, item.post_id, item.path, link, item.excerpt);
    return { ...item, seo: { title: seo.title!, description: seo.description!, canonical: seo.canonical!, robots: seo.robots!, og_title: seo.og_title!, og_description: seo.og_description!, og_image: seo.og_image ?? null } };
  });
  const secondRevision = await sha256(JSON.stringify(secondMapped));
  if (revision !== secondRevision) throw new Error(`Public content revision changed during retrieval (started at ${revision}, ended at ${secondRevision})`);
  return { contract_version: 1, revision, fetched_at: new Date().toISOString(), items: mapped };
}
