import { getSnapshot } from './content.ts';
import { publicConfig } from '#lib/config.ts';

function xml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

export function rssResponse(): Response {
  const items = getSnapshot().items.filter((item) => item.kind !== 'page').sort((a, b) => Date.parse(b.date_published) - Date.parse(a.date_published));
  const feed = items.map((item) => `<item><title>${xml(item.title)}</title><link>${xml(item.seo.canonical)}</link><guid isPermaLink="true">${xml(item.seo.canonical)}</guid><pubDate>${xml(new Date(item.date_published).toUTCString())}</pubDate><description>${xml(item.seo.description)}</description></item>`).join('');
  const document = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Plate Full of Yum</title><link>${xml(publicConfig.siteOrigin)}</link><description>Recipes and stories from Asha’s kitchen.</description><language>en</language>${feed}</channel></rss>`;
  return new Response(document, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
