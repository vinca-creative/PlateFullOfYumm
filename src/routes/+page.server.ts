import type { PageServerLoad } from './$types';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;

export const load: PageServerLoad = () => {
  const items = getSnapshot().items;
  const sorted = [...items].sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published));
  const recipes = sorted.filter((item) => item.kind === 'recipe');
  const categories = new Map(items.flatMap((item) => item.categories.map((category) => [category.id, category] as const)));
  const categoryList = [...categories.values()];
  const articles = sorted.filter((item) => item.kind === 'article');
  const balancedBitesArticle = articles.find((item) => item.categories.some((category) => category.slug === 'balanced-bites')) ?? null;
  const balancedBitesCategory = categoryList.find((category) => category.slug === 'balanced-bites') ?? null;
  return {
    frontPage: items.find((item) => item.path === '/') ?? null,
    featured: recipes[0] ?? null,
    recipes: recipes.slice(0, 6),
    stories: articles.filter((story) => story.post_id !== balancedBitesArticle?.post_id).slice(0, 3),
    balancedBitesArticle,
    balancedBitesCategory,
    categories: categoryList.sort((a, b) => a.name.localeCompare(b.name))
  };
};
