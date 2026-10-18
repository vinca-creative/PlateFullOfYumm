<script lang="ts">
  import CommentSnapshot from '#lib/components/CommentSnapshot.svelte';
  import RecipeCard from '#lib/components/RecipeCard.svelte';
  import type { PageData } from './$types';
  let { data }: { data: PageData } = $props();
  const item = $derived(data.item);
  const title = $derived(data.seo?.title ?? `${data.category?.name} recipes | Plate Full of Yum`);
  const description = $derived(data.seo?.description ?? `Browse ${data.category?.name} recipes from Asha's kitchen.`);
  const socialImage = $derived(data.seo?.og_image ?? item?.image?.src ?? data.categoryItems.find((entry) => entry.image)?.image?.src ?? null);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={data.canonical} />
  <meta name="robots" content={data.seo?.robots ?? 'index,follow'} />
  <meta property="og:title" content={data.seo?.og_title ?? title} />
  <meta property="og:description" content={data.seo?.og_description ?? description} />
  <meta property="og:url" content={data.canonical} />
  {#if socialImage}<meta property="og:image" content={socialImage} />{/if}
  <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
  {@html data.schemas.map((schema) => `<script type="application/ld+json">${schema}</script>`).join('')}
</svelte:head>

{#if data.category}
  <main id="main" class="listing wrap">
    <p class="eyebrow">From the archives</p><h1>{data.category.name}</h1><p>Recipes and stories in {data.category.name.toLowerCase()}.</p>
    <div class="grid">{#each data.categoryItems as entry (entry.post_id)}<a class="preview" href={entry.path}>
      {#if entry.image}<img src={entry.image.src} alt={entry.image.alt} width={entry.image.width} height={entry.image.height} loading="lazy" />{/if}
      <div><p class="eyebrow">{entry.kind === 'recipe' ? 'Recipe' : 'Story'}</p><h2>{entry.title}</h2>{#if entry.excerpt}<p>{entry.excerpt}</p>{/if}</div>
    </a>{/each}</div>
  </main>
{:else if item}
  <main id="main" class="article wrap">
    <nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a>{#if item.categories[0]}<span aria-hidden="true"> / </span><a href={item.categories[0].path}>{item.categories[0].name}</a>{/if}</nav>
    <article>
      {#if item.kind === 'recipe'}<p class="eyebrow">{item.categories[0]?.name ?? 'From Asha’s kitchen'}</p>{/if}
      <h1>{item.title}</h1>
      {#if item.excerpt}<p class="dek">{item.excerpt}</p>{/if}
      {#if item.kind !== 'page'}<p class="byline">By {item.author.name} <span aria-hidden="true">·</span> <time datetime={item.date_published}>{new Date(item.date_published).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></p>{/if}
      {#if item.recipe?.rating}<p class="rating" aria-label="Rating summary">Rated {item.recipe.rating.value} out of 5 from {item.recipe.rating.count} ratings</p>{/if}
      {#if item.recipe}
        <div class="quick-actions"><a href="#recipe-card">Jump to recipe</a><button type="button" onclick={() => window.print()}>Print</button></div>
      {/if}
      {#if item.image}<figure class="hero-image"><img src={item.image.src} srcset={item.image.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')} sizes="(max-width: 760px) 100vw, 68rem" alt={item.image.alt} width={item.image.width} height={item.image.height} fetchpriority="high" /><figcaption>{item.image.alt}</figcaption></figure>{/if}
      <div class="editorial-body">{#each data.segments as segment, index (`${index}-${segment.card}`)}{#if segment.card && item.recipe}<RecipeCard recipe={item.recipe} postId={item.post_id} cardId={item.card_id} canonicalUrl={item.seo.canonical} />{:else if segment.html}{@html segment.html}{/if}{/each}</div>
      {#if item.kind !== 'page'}<section class="author-box" aria-label="About the author"><p class="eyebrow">A note from the kitchen</p><h2>{item.author.name}</h2><p>Thanks for cooking along. Find more recipes and stories on <a href="/recipes/">Plate Full of Yum</a>.</p></section>{/if}
      {#if item.kind !== 'page' || (item.comments_count ?? 0) > 0 || (item.comments?.length ?? 0) > 0}
        {#key item.post_id}<CommentSnapshot comments={item.comments} count={item.comments_count} postId={item.post_id} />{/key}
      {/if}
    </article>
  </main>
{/if}

<style>
  .wrap { width: min(100% - 2.5rem, 75rem); margin: 0 auto; }
  .article { padding: 2rem 0 4rem; }
  article { width: min(100%, 49rem); margin: auto; }
  .breadcrumbs { margin-bottom: 2rem; font: .85rem system-ui,sans-serif; color: #5d655b; }
  .breadcrumbs a { color: inherit; }
  .eyebrow { margin: 0 0 .5rem; color: #46543c; font: 700 .75rem/1.4 system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { margin: .2rem 0 .75rem; font: 600 clamp(2.2rem, 6vw, 4rem)/1.08 Georgia,serif; letter-spacing: -.025em; }
  .dek { margin: 0 0 1rem; color: #5d655b; font: 1.2rem/1.55 system-ui,sans-serif; }
  .byline, .rating { font: .9rem/1.5 system-ui,sans-serif; color: #5d655b; }
  .quick-actions { display: flex; gap: .7rem; margin: 1.2rem 0; }
  .quick-actions a, .quick-actions button { display: inline-flex; align-items: center; min-height: 2.75rem; padding: .65rem 1rem; border: 1px solid #46543c; border-radius: .35rem; background: #46543c; color: white; font: 600 .9rem system-ui,sans-serif; text-decoration: none; cursor: pointer; }
  .quick-actions button { background: white; color: #303a2c; }
  .hero-image { margin: 2rem 0; }
  .hero-image img { width: 100%; height: auto; max-height: 42rem; object-fit: cover; border-radius: .5rem; }
  figcaption { margin-top: .5rem; color: #5d655b; font: .8rem system-ui,sans-serif; }
  .editorial-body { font: 1.125rem/1.7 system-ui,sans-serif; color: #252a25; overflow-wrap: anywhere; }
  .editorial-body :global(h2), .editorial-body :global(h3) { margin: 2rem 0 .7rem; font: 600 1.8rem/1.2 Georgia,serif; }
  .editorial-body :global(img) { max-width: 100%; height: auto; }
  .editorial-body :global(figure) { margin: 1.5rem 0; }
  .editorial-body :global(a) { color: #35452e; text-decoration-thickness: .08em; text-underline-offset: .18em; }
  .author-box { margin: 3rem 0 0; padding: 1.5rem; background: #f1eee6; border-radius: .6rem; font: 1rem/1.6 system-ui,sans-serif; }
  .author-box h2 { font: 600 1.5rem Georgia,serif; }
  .listing { min-height: 70vh; padding: 3rem 0 4rem; }
  .listing > p:not(.eyebrow) { font: 1.1rem/1.6 system-ui,sans-serif; color: #5d655b; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: 1.5rem; margin-top: 2rem; }
  .preview { overflow: hidden; color: inherit; background: white; border: 1px solid #dadcd4; border-radius: .65rem; text-decoration: none; }
  .preview img { display: block; width: 100%; aspect-ratio: 4/3; object-fit: cover; }
  .preview > div { padding: 1rem; }
  .preview h2 { margin: 0; font: 600 1.45rem/1.2 Georgia,serif; }
  .preview p:not(.eyebrow) { font: .95rem/1.5 system-ui,sans-serif; color: #5d655b; }
  @media print { .breadcrumbs, .quick-actions, .author-box, figcaption { display: none !important; } .wrap { width: 100%; } .article { padding: 0; } .hero-image { margin: 1rem 0; } }
</style>
