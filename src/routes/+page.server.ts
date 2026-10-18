import type { PageServerLoad } from './$types';
import { getSnapshot } from '#lib/server/content.ts';
import { projectRecipe } from '#lib/server/recipe-projection.ts';

export const prerender = true;

export const load: PageServerLoad = () => {
  const items = getSnapshot().items;
  const sorted = [...items].sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published));
  const recipes = sorted.filter((item) => item.kind === 'recipe');
  const categories = new Map(items.flatMap((item) => item.categories.map(({ id, name, path, slug }) => [id, { id, name, path, slug }] as const)));
  const categoryList = [...categories.values()];
  const articles = sorted.filter((item) => item.kind === 'article');
  const balancedBitesArticle = articles.find((item) => item.categories.some((category) => category.slug === 'balanced-bites')) ?? null;
  const balancedBitesCategory = categoryList.find((category) => category.slug === 'balanced-bites') ?? null;
  const frontPage = items.find((item) => item.path === '/') ?? null;
  return {
    frontPage: frontPage ? {
      seo: frontPage.seo,
      image: frontPage.image ? { src: frontPage.image.src } : null
    } : null,
    featured: recipes[0] ? projectRecipe(recipes[0]) : null,
    recipes: recipes.slice(0, 6).map(projectRecipe),
    stories: articles.filter((story) => story.post_id !== balancedBitesArticle?.post_id).slice(0, 3)
      .map(({ post_id, path, title }) => ({ post_id, path, title })),
    balancedBitesArticle: balancedBitesArticle ? {
      path: balancedBitesArticle.path,
      title: balancedBitesArticle.title,
      excerpt: balancedBitesArticle.excerpt,
      image: balancedBitesArticle.image ? {
        src: balancedBitesArticle.image.src,
        alt: balancedBitesArticle.image.alt,
        width: balancedBitesArticle.image.width,
        height: balancedBitesArticle.image.height
      } : null
    } : null,
    balancedBitesCategory: balancedBitesCategory ? {
      path: balancedBitesCategory.path,
      name: balancedBitesCategory.name
    } : null,
    categories: categoryList.sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, name, path }) => ({ id, name, path }))
  };
};
