import type { LayoutServerLoad } from './$types';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;

export const load: LayoutServerLoad = () => {
  const items = getSnapshot().items;
  const categories = new Map(items.flatMap((item) => item.categories.map((term) => [term.path, term] as const)));
  const pages = items.filter((item) => item.kind === 'page').map(({ post_id, title, path }) => ({ post_id, title, path }));
  return { categories: [...categories.values()].sort((a, b) => a.name.localeCompare(b.name)), pages };
};
