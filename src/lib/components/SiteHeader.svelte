<script lang="ts">
  import { onMount } from 'svelte';
  import type { TaxonomyTerm } from '#lib/content/types.ts';
  let { categories = [], aboutPath = null }: { categories?: TaxonomyTerm[]; aboutPath?: string | null } = $props();
  const balancedBitesCategory = $derived(categories.find((category) => category.slug === 'balanced-bites') ?? null);
  let menuOpen = $state(true);
  onMount(() => {
    const media = window.matchMedia('(max-width: 680px)');
    menuOpen = !media.matches;
    const onChange = (event: MediaQueryListEvent) => { menuOpen = !event.matches; };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });
</script>

<a class="skip-link" href="#main">Skip to content</a>
<header class="masthead">
  <a class="brand" href="/" aria-label="Plate Full of Yum home">
    <span class="brand-mark" aria-hidden="true">P</span>
    <span>Plate Full <em>of</em> Yum</span>
  </a>
  <details class="nav-menu" bind:open={menuOpen}>
    <summary aria-label="Open main navigation">Menu</summary>
    <nav aria-label="Main navigation">
      <a href="/recipes/">Recipes</a>
      {#if aboutPath}<a href={aboutPath}>About Asha</a>{/if}
      {#if balancedBitesCategory}<a href={balancedBitesCategory.path}>Balanced Bites</a>{/if}
      {#if categories.length}
        <details class="category-menu">
          <summary>Browse categories</summary>
          <div class="category-links">{#each categories as category (category.id)}<a href={category.path}>{category.name}</a>{/each}</div>
        </details>
      {/if}
      <a href="/recipes/#search">Search</a>
    </nav>
  </details>
</header>

<style>
  .skip-link { position: absolute; z-index: 5; top: -5rem; left: 1rem; padding: .7rem 1rem; background: #fff; color: #252a25; }
  .skip-link:focus { top: 1rem; }
  .masthead { min-height: 4.75rem; padding: .6rem max(1.25rem, calc((100vw - 75rem) / 2)); display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; background: #fff; border-bottom: 1px solid #dadcd4; }
  .brand { display: flex; gap: .65rem; align-items: center; color: #252a25; text-decoration: none; font: 700 1.05rem/1.1 Georgia, serif; white-space: nowrap; }
  .brand em { font-weight: 400; }
  .brand-mark { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border: 1px solid #46543c; border-radius: 50%; color: #46543c; font: italic 1.25rem Georgia,serif; }
  .nav-menu > summary { display: none; }
  nav { display: flex; align-items: center; gap: clamp(.8rem, 2vw, 1.8rem); font: 600 .9rem/1.3 system-ui,sans-serif; }
  nav a, summary { color: #252a25; text-decoration: none; cursor: pointer; }
  nav a:hover, summary:hover { color: #46543c; text-decoration: underline; text-underline-offset: .2em; }
  .category-menu { position: relative; }
  summary { list-style: none; } summary::-webkit-details-marker { display: none; }
  .category-links { position: absolute; z-index: 3; right: 0; top: 1.6rem; min-width: 12rem; padding: .6rem; display: grid; gap: .25rem; background: white; border: 1px solid #dadcd4; box-shadow: 0 .5rem 1.5rem #252a251c; }
  .category-links a { padding: .5rem; }
  :global(:focus-visible) { outline: 3px solid #995a42; outline-offset: 3px; }
  @media (max-width: 680px) {
    .masthead { position: relative; min-height: 4rem; }
    .nav-menu > summary { display: block; min-height: 2.75rem; padding: .75rem .9rem; border-radius: .35rem; background: #46543c; color: white; font: 600 .9rem/1.2 system-ui,sans-serif; }
    nav { display: none; position: absolute; z-index: 4; top: calc(100% + .6rem); right: 0; min-width: min(20rem, calc(100vw - 2rem)); padding: .7rem 1.1rem 1rem; flex-direction: column; align-items: stretch; gap: 0; background: white; border: 1px solid #dadcd4; box-shadow: 0 .5rem 1.5rem #252a251c; }
    .nav-menu[open] nav { display: flex; }
    nav > a, nav summary { display: block; min-height: 2.75rem; padding: .75rem 0; }
    .category-links { position: static; box-shadow: none; border: 0; padding-left: .75rem; }
  }
  @media print { .masthead { display: none !important; } }
</style>
