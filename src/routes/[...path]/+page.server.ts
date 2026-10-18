import { parseFragment, serializeOuter } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';
import { basePath as base } from '#lib/config.ts';
import { error } from '@sveltejs/kit';
import type { EntryGenerator, PageServerLoad } from './$types';
import { getPublicRoutes, getSnapshot, findItem } from '#lib/server/content.ts';
import type { PublicContentItem } from '#lib/content/types.ts';
import { publicConfig } from '#lib/config.ts';

export const prerender = true;
export const entries: EntryGenerator = () => getPublicRoutes().map((path) => ({ path }));

function duration(seconds: number | null): string | undefined {
  if (seconds === null) return undefined;
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `PT${hours ? `${hours}H` : ''}${rest ? `${rest}M` : ''}${!hours && !rest ? '0M' : ''}`;
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function recipeSchema(item: PublicContentItem) {
  const recipe = item.recipe;
  if (!recipe) return null;
  const result: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description || item.seo.description,
    author: { '@type': 'Person', name: item.author.name },
    datePublished: item.date_published,
    dateModified: item.date_modified,
    mainEntityOfPage: item.seo.canonical,
    recipeIngredient: recipe.ingredients.flatMap((group) => group.items.map((ingredient) => ingredient.text)),
    recipeInstructions: recipe.instructions.map((step) => ({ '@type': 'HowToStep', text: step.text, url: `${item.seo.canonical}#${step.id}` }))
  };
  if (item.image) result.image = [item.image.src];
  const prep = duration(recipe.prep_seconds);
  const cook = duration(recipe.active_seconds);
  const total = duration(recipe.total_seconds);
  if (prep) result.prepTime = prep;
  if (cook) result.cookTime = cook;
  if (total) result.totalTime = total;
  if (recipe.yield) result.recipeYield = recipe.yield;
  if (recipe.rating) result.aggregateRating = { '@type': 'AggregateRating', ratingValue: recipe.rating.value, ratingCount: recipe.rating.count };
  if (recipe.nutrition && Object.keys(recipe.nutrition.values).length) {
    const nutrition: Record<string, string> = { '@type': 'NutritionInformation' };
    const fields: Record<string, string> = { calories: 'calories', total_fat: 'fatContent', saturated_fat: 'saturatedFatContent', trans_fat: 'transFatContent', cholesterol: 'cholesterolContent', sodium: 'sodiumContent', carbohydrates: 'carbohydrateContent', fiber: 'fiberContent', sugar: 'sugarContent', protein: 'proteinContent' };
    for (const [source, schema] of Object.entries(fields)) if (recipe.nutrition.values[source]) nutrition[schema] = recipe.nutrition.values[source];
    if (recipe.nutrition.serving_size) nutrition.servingSize = recipe.nutrition.serving_size;
    if (Object.keys(nutrition).length > 1) result.nutrition = nutrition;
  }
  return result;
}

type BodySegment = { html: string; card: boolean };

function bodyParts(html: string, cardId: number | null): BodySegment[] {
  if (cardId === null) return [{ html, card: false }];
  const fragment = parseFragment(html);
  const markerId = String(cardId);
  function isMarker(node: DefaultTreeAdapterMap['node']): boolean {
    return 'tagName' in node && node.tagName === 'div' && 'attrs' in node
      && node.attrs.some((attribute) => attribute.name === 'data-pfoy-recipe-card' && attribute.value === markerId);
  }
  function containsMarker(node: DefaultTreeAdapterMap['node']): boolean {
    return isMarker(node) || ('childNodes' in node && node.childNodes.some(containsMarker));
  }
  function combineAdjacent(segments: BodySegment[]): BodySegment[] {
    const result: BodySegment[] = [];
    for (const segment of segments) {
      const previous = result.at(-1);
      if (!segment.card && previous && !previous.card) previous.html += segment.html;
      else result.push({ ...segment });
    }
    return result;
  }
  function split(node: DefaultTreeAdapterMap['node']): BodySegment[] {
    if (isMarker(node)) return [{ html: '', card: true }];
    if (!containsMarker(node) || !('tagName' in node && 'childNodes' in node)) return [{ html: serializeOuter(node), card: false }];
    const children = combineAdjacent(node.childNodes.flatMap(split));
    const savedChildren = node.childNodes;
    node.childNodes = [];
    const empty = serializeOuter(node);
    node.childNodes = savedChildren;
    const openEnd = empty.indexOf('>') + 1;
    const closeStart = empty.lastIndexOf('</');
    if (openEnd === 0 || closeStart < openEnd) throw new Error('Could not split recipe marker from its HTML container');
    const opening = empty.slice(0, openEnd);
    const closing = empty.slice(closeStart);
    const firstHtml = children.findIndex((segment) => !segment.card);
    return children.map((segment, index) => segment.card ? segment : {
      html: `${index === firstHtml ? opening : opening.replace(/\s+id="[^"]*"/i, '')}${segment.html}${closing}`,
      card: false
    });
  }
  return combineAdjacent(fragment.childNodes.flatMap(split));
}

export const load: PageServerLoad = ({ params }) => {
  const path = `/${params.path.replace(/^\/+|\/+$/g, '')}/`;
  const item = findItem(path);
  const snapshot = getSnapshot();
  const category = snapshot.items.flatMap((entry) => entry.categories).find((term) => term.path === path);
  if (!item && !category) error(404, 'This page could not be found.');
  const categoryItems = category ? snapshot.items.filter((entry) => entry.categories.some((term) => term.id === category.id))
    .map(({ post_id, path, image, kind, title, excerpt }) => ({
      post_id,
      path,
      kind,
      title,
      excerpt,
      image: image ? { src: image.src, alt: image.alt, width: image.width, height: image.height } : null
    })) : [];
  const schemas: unknown[] = [];
  const withBasePath = (value: string) => {
    if (!base) return value;
    const url = new URL(value);
    if (url.origin !== publicConfig.siteOrigin) return value;
    if (url.pathname === base || url.pathname.startsWith(`${base}/`)) return value;
    url.pathname = `${base}${url.pathname}`;
    return url.toString();
  };
  const seo = item ? { ...item.seo, canonical: withBasePath(item.seo.canonical) } : null;
  const itemWithCanonical = item && seo ? { ...item, seo } : item;
  const recipe = itemWithCanonical ? recipeSchema(itemWithCanonical) : null;
  if (recipe) schemas.push(recipe);
  if (itemWithCanonical && itemWithCanonical.kind !== 'page') schemas.push({ '@context': 'https://schema.org', '@type': 'Article', headline: itemWithCanonical.title, description: itemWithCanonical.seo.description, datePublished: itemWithCanonical.date_published, dateModified: itemWithCanonical.date_modified, author: { '@type': 'Person', name: itemWithCanonical.author.name }, mainEntityOfPage: itemWithCanonical.seo.canonical, ...(itemWithCanonical.image ? { image: [itemWithCanonical.image.src] } : {}) });
  const absoluteUrl = (localPath: string) => `${publicConfig.siteOrigin}${base}${localPath}`;
  const crumbs = [{ name: 'Home', url: absoluteUrl('/') }];
  if (category) crumbs.push({ name: category.name, url: absoluteUrl(category.path) });
  else if (itemWithCanonical) {
    const term = itemWithCanonical.categories[0];
    if (term) crumbs.push({ name: term.name, url: absoluteUrl(term.path) });
    crumbs.push({ name: itemWithCanonical.title, url: itemWithCanonical.seo.canonical });
  }
  schemas.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: crumb.url })) });
  if (itemWithCanonical && itemWithCanonical.kind !== 'page') schemas.push({ '@context': 'https://schema.org', '@type': 'Person', name: itemWithCanonical.author.name });
  const serializedItem = itemWithCanonical ? (({ content_html, ...rest }) => rest)(itemWithCanonical) : null;
  return {
    item: serializedItem,
    category,
    categoryItems,
    segments: item ? bodyParts(item.content_html, item.card_id).map((segment) => ({
      ...segment,
      html: segment.html.replace(/(href=["'])\/(?!\/)/g, `$1${base}/`)
    })) : [],
    schemas: schemas.map(safeJson),
    canonical: seo?.canonical ?? absoluteUrl(category?.path ?? '/'),
    seo
  };
};
