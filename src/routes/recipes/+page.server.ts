import { projectRecipe } from '#lib/server/recipe-projection.ts';
import type { PageServerLoad } from './$types';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;
export const load: PageServerLoad = () => {
  const snapshot = getSnapshot();
  const recipeItems = snapshot.items.filter((item) => item.kind === 'recipe');
  const recipes = recipeItems.map(projectRecipe);
  const categories = [...new Map(recipeItems.flatMap((item) => item.categories.map((category) => [category.id, category] as const))).values()].sort((a, b) => a.name.localeCompare(b.name));
  return { recipes, categories };
};
