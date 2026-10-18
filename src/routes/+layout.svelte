<script lang="ts">
  import { basePath as base } from '#lib/config.ts';
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
  <meta name="theme-color" content="#2f4639" />
</svelte:head>

<div class="top">A LITTLE EVERYDAY DELICIOUS.</div>
<div class="wrap">
  <SiteHeader categories={data.categories} aboutPath={aboutPage?.path ?? null} />
</div>
{@render children()}
<footer class="site-footer">
  <div class="footer-inner wrap">
    <div><a class="footer-brand" href="{base}/">plate full <em>of</em> yum ✳</a><p>Good food, thoughtful stories, and recipes from Asha’s kitchen.</p></div>
    <nav aria-label="Footer navigation"><a href="{base}/recipes/">Browse recipes</a>{#if aboutPage}<a href="{base}{aboutPage.path}">About Asha</a>{/if}{#each legalPages as page (page.post_id)}<a href="{base}{page.path}">{page.title}</a>{/each}<a href="{base}/rss.xml">RSS feed</a><a href="{base}/sitemap.xml">Sitemap</a></nav>
    <small class="copyright">© {new Date().getFullYear()} Plate Full of Yum</small>
  </div>
</footer>

<style>
  :global(body) { min-width: 320px; }
  .footer-brand { color: inherit; font: 28px Georgia, serif; letter-spacing: -1.6px; }
  .footer-brand em { color: #a9b69d; font-weight: normal; }
  .footer-inner { gap: 1rem 2rem; }
  .footer-inner p { color: #becabb; font-size: 12px; }
  .footer-inner nav { flex-wrap: wrap; gap: .8rem 1.3rem; font-size: 12px; }
  .copyright { color: #becabb; }
  @media (max-width: 600px) {
    .footer-inner { align-items: start; gap: 20px; flex-direction: column; }
    .footer-inner nav { flex-direction: column; gap: .5rem; }
  }
  @media (prefers-reduced-motion: reduce) { :global(html) { scroll-behavior: auto; } }
  @media print { .site-footer, .top { display: none !important; } }
</style>
