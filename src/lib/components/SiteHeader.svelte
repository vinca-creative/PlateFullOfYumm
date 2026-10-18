<script lang="ts">
  import { basePath as base } from '#lib/config.ts';
  import logo from '../../images/platefullofyum-logo.svg';
  import { onMount } from 'svelte';
  import type { TaxonomyTerm } from '#lib/content/types.ts';
  let { categories = [], aboutPath = null }: { categories?: TaxonomyTerm[]; aboutPath?: string | null } = $props();
  let menuOpen = $state(true);
  let categoryMenuOpen = $state(false);
  function closeMenus() {
    categoryMenuOpen = false;
    menuOpen = !window.matchMedia('(max-width: 600px)').matches;
  }
  onMount(() => {
    const media = window.matchMedia('(max-width: 600px)');
    menuOpen = !media.matches;
    const onChange = (event: MediaQueryListEvent) => { menuOpen = !event.matches; };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  });
</script>

<a class="skip" href="#main">Skip to content</a>
<header>
  <a class="brand" href="{base}/" aria-label="Plate Full of Yum home">
    <img class="brand-logo" src={logo} alt="" width="689" height="180" />
  </a>
  <details class="nav-menu" bind:open={menuOpen}>
    <summary aria-label="Open main navigation">Menu</summary>
    <nav aria-label="Main navigation">
      <a href="{base}/recipes/" onclick={closeMenus}>Recipes</a>
      {#if aboutPath}<a href="{base}{aboutPath}" onclick={closeMenus}>About Asha</a>{/if}
      {#if categories.length}
        <details class="category-menu" bind:open={categoryMenuOpen}>
          <summary>Browse categories</summary>
          <div class="category-links">{#each categories as category (category.id)}<a href="{base}{category.path}" onclick={closeMenus}>{category.name}</a>{/each}</div>
        </details>
      {/if}
      <a href="{base}/recipes/#search" onclick={closeMenus}>Search</a>
    </nav>
  </details>
</header>

<style>
  .nav-menu { display: contents; }
  .nav-menu > summary { display: none; }
  .category-menu { position: relative; }
  nav summary { list-style: none; color: var(--ink); cursor: pointer; }
  header { padding: 12px 0; }
  .brand-logo { display: block; width: clamp(170px, 18vw, 220px); height: auto; }
  nav summary::-webkit-details-marker { display: none; }
  .category-links { position: absolute; z-index: 3; right: 0; top: calc(100% + .5rem); min-width: 12rem; padding: .6rem; display: grid; gap: .25rem; background: var(--paper); border: 1px solid var(--line); box-shadow: 0 .5rem 1.5rem #25392e1c; }
  .category-links a { padding: .5rem; }
  nav a:hover, nav summary:hover { border-bottom: 1px solid; }
  :global(:focus-visible) { outline: 3px solid #9c6349; outline-offset: 5px; }
  @media (max-width: 900px) {
    header { gap: 16px; }
    nav { gap: 16px; }
  }
  @media (max-width: 600px) {
    header { position: relative; }
    .nav-menu { display: block; position: static; }
    .nav-menu > summary { display: block; order: 2; padding: 10px 18px; border: 1px solid #b4bdaa; border-radius: 30px; color: var(--forest); font: 12px Arial, Helvetica, sans-serif; cursor: pointer; }
    nav { display: none; position: absolute; z-index: 4; top: calc(100% - 1px); left: 0; right: 0; width: auto; padding: 12px 6%; flex-direction: column; align-items: stretch; gap: 0; background: var(--paper); border-bottom: 1px solid var(--line); }
    .nav-menu[open] nav { display: flex; }
    nav > a, nav summary { display: block; min-height: 44px; padding: 14px 0; }
    .category-links { position: static; box-shadow: none; border: 0; padding-left: .75rem; }
  }
  @media print { header { display: none !important; } }
</style>
