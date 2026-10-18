import type { PublicContentItem } from '#lib/content/types.ts';

export function projectRecipe(item: PublicContentItem) {
  const image = item.image ? {
    src: item.image.src,
    alt: item.image.alt,
    width: item.image.width,
    height: item.image.height
  } : null;
  return {
    post_id: item.post_id,
    title: item.title,
    excerpt: item.excerpt || item.recipe?.description || '',
    path: item.path,
    image,
    categories: item.categories.map(({ id, name, path }) => ({ id, name, path }))
  };
}

export function projectSearchRecipe(item: PublicContentItem) {
  return {
    ...projectRecipe(item),
    ingredients: item.recipe?.ingredients.flatMap((group) => group.items.map((ingredient) => ingredient.text)) ?? []
  };
}
