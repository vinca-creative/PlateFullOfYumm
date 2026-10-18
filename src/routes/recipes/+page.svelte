<script lang="ts">
  import { basePath as base, publicConfig } from '#lib/config.ts';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  type SearchRecipe = {
    id: number;
    title: string;
    path: string;
    excerpt: string;
    categories: Array<{ id: number; name: string; path: string }>;
    image: { src: string; alt: string; width: number; height: number } | null;
    ingredients: string[];
  };
  let { data }: { data: PageData } = $props();
  const socialImage = $derived(data.recipes.find((recipe) => recipe.image)?.image?.src ?? null);
  let query = $state('');
  let category = $state('');
  let recipes = $state<SearchRecipe[]>([]);
  let searchState = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');

  function isSearchIndex(value: unknown): value is { revision: string; recipes: SearchRecipe[] } {
    if (!value || typeof value !== 'object') return false;
    const payload = value as Record<string, unknown>;
    return typeof payload.revision === 'string' && Array.isArray(payload.recipes) && payload.recipes.every((entry: unknown) => {
      if (!entry || typeof entry !== 'object') return false;
      const recipe = entry as Record<string, unknown>;
      const image = recipe.image;
      const validImage = image === null || (!!image && typeof image === 'object'
        && typeof (image as Record<string, unknown>).src === 'string'
        && typeof (image as Record<string, unknown>).alt === 'string'
        && Number.isSafeInteger((image as Record<string, unknown>).width)
        && Number.isSafeInteger((image as Record<string, unknown>).height));
      return Number.isSafeInteger(recipe.id) && Number(recipe.id) > 0
        && typeof recipe.title === 'string' && typeof recipe.path === 'string' && recipe.path.startsWith('/')
        && typeof recipe.excerpt === 'string' && validImage
        && Array.isArray(recipe.categories) && recipe.categories.every((term: unknown) => !!term && typeof term === 'object'
          && Number.isSafeInteger((term as Record<string, unknown>).id)
          && typeof (term as Record<string, unknown>).name === 'string'
          && typeof (term as Record<string, unknown>).path === 'string')
        && Array.isArray(recipe.ingredients) && recipe.ingredients.every((ingredient: unknown) => typeof ingredient === 'string');
    });
  }

  onMount(async () => {
    searchState = 'loading';
    try {
      const response = await fetch(`${base}/search.json`, { headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Search index request failed');
      const payload: unknown = await response.json();
      if (!isSearchIndex(payload)) throw new Error('Search index response is invalid');
      recipes = payload.recipes;
      searchState = 'ready';
    } catch {
      searchState = 'failed';
    }
  });

  const matches = $derived.by(() => {
    if (searchState !== 'ready') return [];
    const needle = query.trim().toLocaleLowerCase();
    return recipes.filter((recipe) => (!category || recipe.categories.some((term) => String(term.id) === category)) && (!needle || `${recipe.title} ${recipe.excerpt} ${recipe.ingredients.join(' ')}`.toLocaleLowerCase().includes(needle)));
  });
</script>

<svelte:head>
  <title>Recipes | Plate Full of Yum</title>
  <meta name="description" content="Browse and search recipes from Asha’s kitchen." />
  <link rel="canonical" href={`${publicConfig.siteOrigin}${base}/recipes/`} />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="Recipes | Plate Full of Yum" />
  <meta property="og:description" content="Browse and search recipes from Asha’s kitchen." />
  <meta property="og:url" content={`${publicConfig.siteOrigin}${base}/recipes/`} />
  {#if socialImage}<meta property="og:image" content={socialImage} />{/if}
  <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

<main id="main" class="wrap listing">
  <section class="page-intro"><p class="eyebrow">Find something good</p><h1>Recipes</h1>
  <p class="intro">Search Asha’s recipes by name or ingredient, or browse by category.</p></section>
  <noscript><p class="empty">Active search needs JavaScript. All published recipes and their category links remain browseable below.</p></noscript>
  <section id="search" aria-label="Search recipes">
    <div class="filters index-controls"><label class="search" for="recipe-search"><span aria-hidden="true">⌕</span><input id="recipe-search" type="search" bind:value={query} placeholder="Search recipes or ingredients…" aria-label="Recipe or ingredient" /></label><label class="category-filter" for="category-filter"><span class="eyebrow">Category</span><select id="category-filter" bind:value={category} aria-label="Filter by category"><option value="">All categories</option>{#each data.categories as item (item.id)}<option value={String(item.id)}>{item.name}</option>{/each}</select></label></div>
    {#if searchState === 'loading'}
      <p class="result-count" role="status">Loading recipe search…</p>
    {:else if searchState === 'failed'}
      <p class="empty" role="status">Recipe search is unavailable right now. The published recipe list remains available below.</p>
    {:else if searchState === 'ready'}
      <p class="result-count" aria-live="polite">{query || category ? `${matches.length} ${matches.length === 1 ? 'recipe' : 'recipes'} found` : `${matches.length} recipes`}</p>
      {#if matches.length}
        <div class="grid">{#each matches as recipe (recipe.id)}<a class="card" href="{base}{recipe.path}">{#if recipe.image}<img src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}<div><h3>{recipe.title}</h3><p>{recipe.excerpt}</p>{#if recipe.categories.length}<span>{recipe.categories.map((term) => term.name).join(' · ')}</span>{/if}</div></a>{/each}</div>
      {:else if query || category}
        <p class="empty" role="status">No recipes match your search. Try another word or category.</p>
      {:else}
        <p class="empty">Recipes will appear here when they are available in the published content.</p>
      {/if}
    {/if}
    {#if searchState !== 'ready'}
    <h2 class="browse-heading">Browse all published recipes</h2>
    <nav class="category-browse" aria-label="Recipe categories">
      <ul>{#each data.categories as item (item.id)}<li><a href="{base}{item.path}">{item.name}</a></li>{/each}</ul>
    </nav>
    <div class="grid">{#each data.recipes as recipe (recipe.post_id)}<a class="card" href="{base}{recipe.path}">{#if recipe.image}<img src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}<div><h3>{recipe.title}</h3><p>{recipe.excerpt}</p>{#if recipe.categories.length}<span>{recipe.categories.map((term) => term.name).join(' · ')}</span>{/if}</div></a>{/each}</div>
    {/if}
  </section>
</main>

<style>
  .wrap { max-width: 1440px; min-height: 70vh; margin: auto; padding: 0 5.5% 3rem; }
  .listing { padding-bottom: 45px; }
  .page-intro { padding: 25px 0 40px; max-width: 850px; }
  .eyebrow { margin: 0 0 .5rem; color: var(--forest); font: 700 .75rem/1.4 Arial,Helvetica,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  .page-intro h1 { margin: 20px 0; font: normal clamp(38px,5vw,64px)/1.06 Georgia,serif; letter-spacing: -2px; }
  .intro { color: var(--muted); font: 16px/1.8 Arial,Helvetica,sans-serif; }
  .filters.index-controls { margin-bottom: 30px; }
  .filters.index-controls .search { flex: 1; min-width: 220px; }
  .category-filter { display: flex; align-items: center; gap: 12px; }
  .category-filter .eyebrow { margin: 0; }
  .category-filter select { min-width: 0; padding: 12px; border: 1px solid var(--sage); border-radius: 20px; background: transparent; color: var(--ink); font: 12px Arial,Helvetica,sans-serif; }
  .result-count { margin: 0 0 25px; color: var(--muted); font: 12px Arial,Helvetica,sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 24px; row-gap: 35px; }
  .card { display: block; min-width: 0; color: var(--ink); text-decoration: none; }
  .card:hover img { filter: brightness(.92); }
  .card img { display: block; width: 100%; height: 285px; border-radius: 4px; object-fit: cover; transition: filter .2s; }
  .card > div { padding: 0; }
  .card h3 { margin: 0 0 12px; font: normal 23px/1.2 Georgia,serif; letter-spacing: -.4px; }
  .card p { margin: 0 0 12px; color: var(--muted); font: 15px/1.6 Arial,Helvetica,sans-serif; }
  .card span { color: var(--muted); font: 9px Arial,Helvetica,sans-serif; letter-spacing: 1.3px; text-transform: uppercase; }
  .empty { padding: 30px 0; color: var(--muted); font: 15px/1.6 Arial,Helvetica,sans-serif; }
  .browse-heading { margin: 2rem 0 1rem; font: normal 25px Georgia,serif; }
  .category-browse ul { display: flex; flex-wrap: wrap; gap: 10px; margin: .5rem 0 1.2rem; padding: 0; list-style: none; font: 12px Arial,Helvetica,sans-serif; }
  .category-browse a { display: inline-flex; min-height: 2.75rem; align-items: center; padding: 10px 16px; border: 1px solid var(--sage); border-radius: 30px; color: var(--forest); }
  @media(max-width:900px) { .grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 23px 15px; } .card img { height: 330px; } }
  @media(max-width:600px) { .grid { gap: 23px 15px; } .card img { height: 210px; } .category-filter { width: 100%; justify-content: space-between; } }
</style>
