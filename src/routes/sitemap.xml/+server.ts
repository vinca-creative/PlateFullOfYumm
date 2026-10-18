import type { RequestHandler } from './$types';
import { basePath as base, publicConfig } from '#lib/config.ts';
import { getSnapshot } from '#lib/server/content.ts';

export const prerender = true;
const noindex = /(?:^|[,\s])noindex(?:[,\s]|$)/i;

function xml(value: string): string { return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }

export const GET: RequestHandler = () => {
  const snapshot = getSnapshot();
  const isIndexable = (robots: string) => !/(?:^|[,\s])noindex(?:[,\s]|$)/i.test(robots);
  const indexable = snapshot.items.filter((item) => isIndexable(item.seo.robots));
  const urls = new Map<string, string>();
  const fetchedAt = new Date(snapshot.fetched_at).toISOString();
  const frontPage = snapshot.items.find((item) => item.path === '/');
  if (!frontPage || isIndexable(frontPage.seo.robots)) urls.set(`${publicConfig.siteOrigin}${base}/`, fetchedAt);
  urls.set(`${publicConfig.siteOrigin}${base}/recipes/`, fetchedAt);
  for (const item of indexable) {
    const canonical = new URL(item.seo.canonical);
    urls.set(base && canonical.origin === publicConfig.siteOrigin ? `${canonical.origin}${base}${canonical.pathname}${canonical.search}${canonical.hash}` : item.seo.canonical, item.date_modified);
  }
  const categories = new Map(snapshot.items.flatMap((item) => item.categories.map((term) => [term.path, term] as const)));
  for (const category of categories.values()) urls.set(`${publicConfig.siteOrigin}${base}${category.path}`, fetchedAt);
  const body = [...urls].map(([loc, modified]) => `<url><loc>${xml(loc)}</loc><lastmod>${xml(new Date(modified).toISOString())}</lastmod></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
