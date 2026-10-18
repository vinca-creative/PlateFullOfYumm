import { projectSearchRecipe } from '#lib/server/recipe-projection.ts';
import type { RequestHandler } from './$types';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;
export const GET: RequestHandler = () => {
  const snapshot = getSnapshot();
  const recipes = snapshot.items.filter((item) => item.kind === 'recipe').map((item) => {
    const { post_id, ...recipe } = projectSearchRecipe(item);
    return { id: post_id, ...recipe };
  });
  return new Response(JSON.stringify({ revision: snapshot.revision, recipes }), { headers: { 'content-type': 'application/json; charset=utf-8' } });
};
