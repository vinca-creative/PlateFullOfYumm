import type {
  ContentKind,
  ContentPage,
  IngredientGroup,
  PublicContentItem,
  PublicImage,
  PublicRecipe,
  PublicSeo,
  RecipeNutrition,
  RecipeRating,
  TaxonomyTerm
} from './types.ts';

const NUTRITION_FIELDS: Record<string, true> = {
  calories: true,
  total_fat: true,
  saturated_fat: true,
  trans_fat: true,
  unsaturated_fat: true,
  cholesterol: true,
  sodium: true,
  carbohydrates: true,
  fiber: true,
  sugar: true,
  protein: true
};

const PUBLIC_COMMENT_FIELDS: Record<string, true> = {
  id: true,
  post_id: true,
  parent: true,
  author: true,
  date: true,
  content: true
};

function record(value: unknown, at: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${at} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, at: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '')) {
    throw new Error(`${at} must be ${allowEmpty ? 'a string' : 'a non-empty string'}`);
  }
  return value;
}

function integer(value: unknown, at: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) {
    throw new Error(`${at} must be an integer >= ${minimum}`);
  }
  return value as number;
}

function nullableText(value: unknown, at: string): string | null {
  return value === null ? null : text(value, at, true);
}

function publicUrl(value: unknown, at: string): string {
  const url = text(value, at);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${at} must be an absolute URL`);
  }
  if (
    (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') ||
    parsed.username !== '' ||
    parsed.password !== ''
  ) {
    throw new Error(`${at} must use HTTP or HTTPS without embedded credentials`);
  }
  return url;
}

function taxonomy(value: unknown, at: string, category: boolean): TaxonomyTerm[] {
  if (!Array.isArray(value)) throw new Error(`${at} must be an array`);
  return value.map((entry, index) => {
    const term = record(entry, `${at}[${index}]`);
    const base = {
      id: integer(term.id, `${at}[${index}].id`, 1),
      name: text(term.name, `${at}[${index}].name`),
      slug: text(term.slug, `${at}[${index}].slug`)
    };
    return category
      ? { ...base, path: publicPath(term.path, `${at}[${index}].path`) }
      : { ...base, path: '' };
  });
}

function publicPath(value: unknown, at: string): string {
  const path = text(value, at);
  if (
    !path.startsWith('/') ||
    !path.endsWith('/') ||
    path.startsWith('//') ||
    path.includes('?') ||
    path.includes('#') ||
    path.includes('\\')
  ) {
    throw new Error(`${at} must be a public path with a trailing slash`);
  }
  const resolved = new URL(path, 'https://public.example');
  if (resolved.pathname !== path) throw new Error(`${at} contains a non-canonical path`);
  return path;
}

function image(value: unknown, at: string): PublicImage | null {
  if (value === null) return null;
  const image = record(value, at);
  if (!Array.isArray(image.variants)) throw new Error(`${at}.variants must be an array`);
  return {
    src: publicUrl(image.src, `${at}.src`),
    alt: text(image.alt, `${at}.alt`, true),
    width: integer(image.width, `${at}.width`, 1),
    height: integer(image.height, `${at}.height`, 1),
    variants: image.variants.map((entry, index) => {
      const variant = record(entry, `${at}.variants[${index}]`);
      return {
        src: publicUrl(variant.src, `${at}.variants[${index}].src`),
        width: integer(variant.width, `${at}.variants[${index}].width`, 1),
        height: integer(variant.height, `${at}.variants[${index}].height`, 1)
      };
    })
  };
}

function seo(value: unknown, at: string): PublicSeo {
  const seo = record(value, at);
  return {
    title: text(seo.title, `${at}.title`, true),
    description: text(seo.description, `${at}.description`, true),
    canonical: publicUrl(seo.canonical, `${at}.canonical`),
    robots: text(seo.robots, `${at}.robots`, true),
    og_title: text(seo.og_title, `${at}.og_title`, true),
    og_description: text(seo.og_description, `${at}.og_description`, true),
    og_image: seo.og_image === null ? null : publicUrl(seo.og_image, `${at}.og_image`)
  };
}

function nutrition(value: unknown, at: string): RecipeNutrition | null {
  if (value === null) return null;
  const nutrition = record(value, at);
  const values = record(nutrition.values, `${at}.values`);
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (NUTRITION_FIELDS[key] !== true) throw new Error(`${at}.values contains unsupported field ${key}`);
    normalized[key] = text(value, `${at}.values.${key}`, true);
  }
  return {
    serving_size: nullableText(nutrition.serving_size, `${at}.serving_size`),
    servings: nullableText(nutrition.servings, `${at}.servings`),
    values: normalized,
    source: nullableText(nutrition.source, `${at}.source`)
  };
}

function rating(value: unknown, at: string): RecipeRating | null {
  if (value === null) return null;
  const rating = record(value, at);
  if (typeof rating.value !== 'number' || !Number.isFinite(rating.value) || rating.value < 0 || rating.value > 5) {
    throw new Error(`${at}.value must be a source-backed number between 0 and 5`);
  }
  return {
    value: rating.value,
    count: integer(rating.count, `${at}.count`, 0)
  };
}

function recipe(value: unknown, at: string): PublicRecipe | null {
  if (value === null) return null;
  const recipe = record(value, at);
  if (!Array.isArray(recipe.ingredients) || !Array.isArray(recipe.instructions) || !Array.isArray(recipe.notes)) {
    throw new Error(`${at} must contain ingredients, instructions, and notes arrays`);
  }
  const ingredients: IngredientGroup[] = recipe.ingredients.map((groupValue, groupIndex) => {
    const group = record(groupValue, `${at}.ingredients[${groupIndex}]`);
    if (!Array.isArray(group.items)) throw new Error(`${at}.ingredients[${groupIndex}].items must be an array`);
    return {
      name: text(group.name, `${at}.ingredients[${groupIndex}].name`, true),
      items: group.items.map((itemValue, itemIndex) => {
        const item = record(itemValue, `${at}.ingredients[${groupIndex}].items[${itemIndex}]`);
        return {
          id: integer(item.id, `${at}.ingredients[${groupIndex}].items[${itemIndex}].id`, 1),
          text: text(item.text, `${at}.ingredients[${groupIndex}].items[${itemIndex}].text`)
        };
      })
    };
  });
  const instructions = recipe.instructions.map((stepValue, stepIndex) => {
    const step = record(stepValue, `${at}.instructions[${stepIndex}]`);
    return {
      id: text(step.id, `${at}.instructions[${stepIndex}].id`),
      text: text(step.text, `${at}.instructions[${stepIndex}].text`)
    };
  });
  const times = ['prep_seconds', 'active_seconds', 'additional_seconds', 'total_seconds'] as const;
  const parsedTimes = Object.fromEntries(times.map((key) => {
    const raw = recipe[key];
    return [key, raw === null ? null : integer(raw, `${at}.${key}`, 0)];
  })) as Pick<PublicRecipe, (typeof times)[number]>;
  return {
    title: text(recipe.title, `${at}.title`),
    description: text(recipe.description, `${at}.description`, true),
    ingredients,
    instructions,
    ...parsedTimes,
    yield: nullableText(recipe.yield, `${at}.yield`),
    notes: recipe.notes.map((note, index) => text(note, `${at}.notes[${index}]`)),
    nutrition: nutrition(recipe.nutrition, `${at}.nutrition`),
    rating: rating(recipe.rating, `${at}.rating`)
  };
}

function contentKind(value: unknown, at: string): ContentKind {
  if (value !== 'recipe' && value !== 'article' && value !== 'page') {
    throw new Error(`${at} must be recipe, article, or page`);
  }
  return value;
}

function contentItem(value: unknown, at: string): PublicContentItem {
  const item = record(value, at);
  const author = record(item.author, `${at}.author`);
  const kind = contentKind(item.kind, `${at}.kind`);
  const cardId = item.card_id === null ? null : integer(item.card_id, `${at}.card_id`, 1);
  const recipeData = recipe(item.recipe, `${at}.recipe`);
  if (kind === 'recipe' && (cardId === null || recipeData === null)) {
    throw new Error(`${at} is classified as a recipe but has no valid Create card`);
  }
  if (kind !== 'recipe' && recipeData !== null) {
    throw new Error(`${at} is classified as ${kind} but contains recipe data`);
  }
  if (typeof item.comments_open !== 'boolean') throw new Error(`${at}.comments_open must be a boolean`);
  const commentsCount = item.comments_count === undefined ? undefined : integer(item.comments_count, `${at}.comments_count`, 0);
  let comments: PublicContentItem['comments'];
  if (item.comments !== undefined) {
    if (!Array.isArray(item.comments)) throw new Error(`${at}.comments must be an array`);
    comments = item.comments.map((value, index) => {
      const commentAt = `${at}.comments[${index}]`;
      const comment = record(value, commentAt);
      const date = text(comment.date, `${commentAt}.date`);
      if (!Number.isFinite(Date.parse(date))) throw new Error(`${commentAt}.date is invalid`);
      if (Object.keys(comment).some((key) => !(key in PUBLIC_COMMENT_FIELDS))) {
        throw new Error(`${commentAt} contains unsupported private or moderation fields`);
      }
      const parsed = {
        id: integer(comment.id, `${commentAt}.id`, 1),
        post_id: integer(comment.post_id, `${commentAt}.post_id`, 1),
        parent: integer(comment.parent, `${commentAt}.parent`, 0),
        author: text(comment.author, `${commentAt}.author`),
        date,
        content: text(comment.content, `${commentAt}.content`)
      };
      if (parsed.post_id !== item.post_id) throw new Error(`${commentAt}.post_id does not match its post`);
      return parsed;
    });
    const ids = new Set<number>();
    for (const comment of comments) {
      if (ids.has(comment.id)) throw new Error(`${at}.comments contains a duplicate comment ID`);
      if (comment.parent !== 0 && !ids.has(comment.parent)) throw new Error(`${at}.comments contains a reply before its visible parent`);
      ids.add(comment.id);
    }
    if (commentsCount !== undefined && commentsCount !== comments.length) throw new Error(`${at}.comments_count does not match its complete approved comments array`);
  }
  const datePublished = text(item.date_published, `${at}.date_published`);
  const dateModified = text(item.date_modified, `${at}.date_modified`);
  if (!Number.isFinite(Date.parse(datePublished)) || !Number.isFinite(Date.parse(dateModified))) {
    throw new Error(`${at} has an invalid publication or modification date`);
  }
  return {
    post_id: integer(item.post_id, `${at}.post_id`, 1),
    card_id: cardId,
    kind,
    path: publicPath(item.path, `${at}.path`),
    title: text(item.title, `${at}.title`),
    excerpt: text(item.excerpt, `${at}.excerpt`, true),
    content_html: text(item.content_html, `${at}.content_html`, true),
    date_published: datePublished,
    date_modified: dateModified,
    author: { name: text(author.name, `${at}.author.name`) },
    categories: taxonomy(item.categories, `${at}.categories`, true),
    tags: taxonomy(item.tags, `${at}.tags`, false).map(({ id, name, slug }) => ({ id, name, slug })),
    image: image(item.image, `${at}.image`),
    seo: seo(item.seo, `${at}.seo`),
    comments_open: item.comments_open,
    ...(commentsCount === undefined ? {} : { comments_count: commentsCount }),
    ...(comments === undefined ? {} : { comments }),
    recipe: recipeData
  };

}
export function parseContentPage(value: unknown): ContentPage {
  const page = record(value, 'content page');
  if (page.contract_version !== 1) throw new Error('Unsupported content contract version');
  if (!Array.isArray(page.items)) throw new Error('content page.items must be an array');
  const parsedItems = page.items.map((item, index) => contentItem(item, `content page.items[${index}]`));
  const result: ContentPage = {
    contract_version: 1,
    revision: text(page.revision, 'content page.revision'),
    page: integer(page.page, 'content page.page', 1),
    per_page: integer(page.per_page, 'content page.per_page', 1),
    total_pages: integer(page.total_pages, 'content page.total_pages', 1),
    total_records: integer(page.total_records, 'content page.total_records', 1),
    complete: page.complete === true,
    items: parsedItems
  };
  if (page.complete !== true) throw new Error(`content page ${result.page} is not complete`);
  if (parsedItems.length > result.per_page) throw new Error(`content page ${result.page} exceeds its declared page size`);
  if (result.page > result.total_pages) throw new Error(`content page ${result.page} exceeds total_pages`);
  return result;
}
