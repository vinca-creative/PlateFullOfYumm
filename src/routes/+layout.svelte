<script lang="ts">
  import '../../template/website/assets/theme.css';
  import '../../template/website/assets/pages.css';
  import SiteHeader from '#lib/components/SiteHeader.svelte';
  import type { LayoutData } from './$types';
  let { data, children }: { data: LayoutData; children: import('svelte').Snippet } = $props();
  const aboutPage = $derived(data.pages.find((page) => /about|asha/i.test(`${page.title} ${page.path}`)));
  const legalPages = $derived(data.pages.filter((page) => /privacy|disclaimer|terms/i.test(`${page.title} ${page.path}`)));
</script>

<svelte:head>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#faf8f3" />
</svelte:head>

<div class="top">A LITTLE EVERYDAY DELICIOUS.</div>
<SiteHeader categories={data.categories} aboutPath={aboutPage?.path ?? null} />
{@render children()}
<footer class="site-footer">
  <div class="footer-inner wrap">
    <div><a class="footer-brand" href="/">Plate Full of Yum</a><p>Good food, thoughtful stories, and recipes from Asha’s kitchen.</p></div>
    <nav aria-label="Footer navigation"><a href="/recipes/">Browse recipes</a>{#if aboutPage}<a href={aboutPage.path}>About Asha</a>{/if}{#each legalPages as page (page.post_id)}<a href={page.path}>{page.title}</a>{/each}<a href="/rss.xml">RSS feed</a><a href="/sitemap.xml">Sitemap</a></nav>
    <p class="copyright">© {new Date().getFullYear()} Plate Full of Yum</p>
  </div>
</footer>

<style>
  :global(body) { min-width: 320px; background: var(--paper); color: var(--ink); font-family: Arial, Helvetica, sans-serif; }
  :global(:focus-visible) { outline: 3px solid #9c6349; outline-offset: 5px; }
  :global(a) { color: inherit; }
  .top { padding: 12px; background: var(--forest); color: white; text-align: center; font-size: 11px; letter-spacing: 1.7px; }
  .site-footer { background: var(--forest); color: #edf0e7; }
  .footer-inner { display: grid; grid-template-columns: 1fr auto; gap: 1.5rem 3rem; padding-block: 2.5rem; font: .95rem/1.6 Arial, sans-serif; }
  .footer-brand { color: inherit; font: 600 1.5rem Georgia,serif; }
  .footer-inner p { color: #becabb; }
  .footer-inner nav { display: flex; flex-wrap: wrap; gap: .8rem 1.3rem; align-content: start; }
  .copyright { grid-column: 1 / -1; margin: 0; border-top: 1px solid #607064; padding-top: 1rem; font-size: .82rem; }
  @media(max-width: 650px) { .footer-inner { grid-template-columns: 1fr; gap: .5rem; } .footer-inner nav { flex-direction: column; gap: .5rem; } }
  @media(prefers-reduced-motion: reduce) { :global(html) { scroll-behavior: auto; } }
  @media print { .site-footer, .top { display: none !important; } }
</style>
