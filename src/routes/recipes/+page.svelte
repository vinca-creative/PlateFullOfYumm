<script lang="ts">
  import { onMount } from 'svelte';
  import type { PageData } from './$types';
  import { publicConfig } from '#lib/config.ts';
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
      const response = await fetch('/search.json', { headers: { Accept: 'application/json' } });
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
  <link rel="canonical" href={`${publicConfig.siteOrigin}/recipes/`} />
  <meta name="robots" content="index,follow" />
  <meta property="og:title" content="Recipes | Plate Full of Yum" />
  <meta property="og:description" content="Browse and search recipes from Asha’s kitchen." />
  <meta property="og:url" content={`${publicConfig.siteOrigin}/recipes/`} />
  {#if socialImage}<meta property="og:image" content={socialImage} />{/if}
  <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

<main id="main" class="wrap">
  <p class="eyebrow">Find something good</p><h1>Recipes</h1>
  <p class="intro">Search Asha’s recipes by name or ingredient, or browse by category.</p>
  <noscript><p class="empty">Active search needs JavaScript. All published recipes and their category links remain browseable below.</p></noscript>
  <section id="search" class="search-box" aria-labelledby="search-heading">
    <h2 id="search-heading">Search recipes</h2>
    <div class="filters"><label for="recipe-search">Recipe or ingredient</label><input id="recipe-search" type="search" bind:value={query} placeholder="Try chickpeas or banana bread" /><label for="category-filter">Category</label><select id="category-filter" bind:value={category}><option value="">All categories</option>{#each data.categories as item (item.id)}<option value={String(item.id)}>{item.name}</option>{/each}</select></div>
    {#if searchState === 'loading'}
      <p class="result-count" role="status">Loading recipe search…</p>
    {:else if searchState === 'failed'}
      <p class="empty" role="status">Recipe search is unavailable right now. The published recipe list remains available below.</p>
    {:else if searchState === 'ready'}
      <p class="result-count" aria-live="polite">{query || category ? `${matches.length} ${matches.length === 1 ? 'recipe' : 'recipes'} found` : `${matches.length} recipes`}</p>
      {#if matches.length}
        <div class="grid">{#each matches as recipe (recipe.id)}<a class="card" href={recipe.path}>{#if recipe.image}<img src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}<div><h3>{recipe.title}</h3><p>{recipe.excerpt}</p>{#if recipe.categories.length}<span>{recipe.categories.map((term) => term.name).join(' · ')}</span>{/if}</div></a>{/each}</div>
      {:else if query || category}
        <p class="empty" role="status">No recipes match your search. Try another word or category.</p>
      {:else}
        <p class="empty">Recipes will appear here when they are available in the published content.</p>
      {/if}
    {/if}
    {#if searchState !== 'ready'}
    <h2 class="browse-heading">Browse all published recipes</h2>
    <nav class="category-browse" aria-label="Recipe categories">
      <ul>{#each data.categories as item (item.id)}<li><a href={item.path}>{item.name}</a></li>{/each}</ul>
    </nav>
    <div class="grid">{#each data.recipes as recipe (recipe.post_id)}<a class="card" href={recipe.path}>{#if recipe.image}<img src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}<div><h3>{recipe.title}</h3><p>{recipe.excerpt}</p>{#if recipe.categories.length}<span>{recipe.categories.map((term) => term.name).join(' · ')}</span>{/if}</div></a>{/each}</div>
    {/if}
  </section>
</main>

<style>
  .wrap { width: min(100% - 2.5rem, 75rem); min-height: 70vh; margin: auto; padding: 3rem 0 4rem; }
  .eyebrow { color: #46543c; font: 700 .75rem system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { margin: .3rem 0; font: 600 clamp(2.5rem,6vw,4rem)/1.1 Georgia,serif; }
  .intro { color: #5d655b; font: 1.1rem/1.6 system-ui,sans-serif; }
  .search-box { margin-top: 2rem; padding: clamp(1rem,3vw,2rem); background: #f1eee6; border: 1px solid #dadcd4; border-radius: .6rem; }
  .search-box h2 { margin-top: 0; font: 600 1.5rem Georgia,serif; }
  .filters { display: grid; grid-template-columns: minmax(10rem,1fr) minmax(10rem,.6fr); gap: .5rem 1rem; max-width: 48rem; font: 600 .9rem system-ui,sans-serif; }
  .filters label { grid-row: 1; }
  input, select { min-width: 0; min-height: 2.9rem; padding: .6rem .7rem; border: 1px solid #73796e; border-radius: .3rem; background: white; color: #252a25; }
  .result-count { margin: 1.5rem 0 .8rem; font: 600 .9rem system-ui,sans-serif; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,18rem),1fr)); gap: 1rem; }
  .card { overflow: hidden; background: white; border: 1px solid #dadcd4; border-radius: .45rem; color: #252a25; text-decoration: none; }
  .card img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; }
  .card > div { padding: .9rem; }
  .card h3 { margin: 0; font: 600 1.3rem/1.2 Georgia,serif; }
  .card p { color: #5d655b; font: .9rem/1.5 system-ui,sans-serif; }
  .card span { color: #46543c; font: .78rem system-ui,sans-serif; }
  .empty { padding: 1rem; background: white; font: 1rem/1.5 system-ui,sans-serif; }
  .category-browse ul { display: flex; flex-wrap: wrap; gap: .25rem .8rem; margin: .5rem 0 1.2rem; padding: 0; list-style: none; font: 600 .9rem system-ui,sans-serif; }
  .category-browse a { display: inline-flex; min-height: 2.75rem; align-items: center; color: #46543c; text-underline-offset: .18em; }
  @media(max-width:600px) { .filters { grid-template-columns: 1fr; } .filters label { grid-row: auto; margin-top: .4rem; } }
</style>
