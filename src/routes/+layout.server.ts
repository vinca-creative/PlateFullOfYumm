import type { LayoutServerLoad } from './$types';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;

export const load: LayoutServerLoad = () => {
  const snapshot = getSnapshot();
  const categories = new Map(snapshot.categories.map((term) => [term.path, term] as const));
  const pages = snapshot.items.filter((item) => item.kind === 'page').map(({ post_id, title, path }) => ({ post_id, title, path }));
  return { categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)), pages };
};
