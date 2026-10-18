<script lang="ts">
  import { basePath as base } from '#lib/config.ts';
  import RecipeCard from '#lib/components/RecipeCard.svelte';
  import CommentSnapshot from '#lib/components/CommentSnapshot.svelte';
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
    <section class="page-intro"><p class="eyebrow">From the archives</p><h1>{data.category.name}</h1><p>Recipes and stories in {data.category.name.toLowerCase()}.</p></section>
    <div class="category-grid">{#each data.categoryItems as entry (entry.post_id)}<a class="category-card" href="{base}{entry.path}">
      {#if entry.image}<img src={entry.image.src} alt={entry.image.alt} width={entry.image.width} height={entry.image.height} loading="lazy" />{/if}
      <div><p class="eyebrow">{entry.kind === 'recipe' ? 'Recipe' : 'Story'}</p><h2>{entry.title}</h2>{#if entry.excerpt}<p>{entry.excerpt}</p>{/if}</div>
    </a>{/each}</div>
  </main>
{:else if item}
  <main id="main" class="article wrap">
    <nav class="breadcrumbs crumb" aria-label="Breadcrumb"><a href="{base}/">Home</a>{#if item.categories[0]}<span aria-hidden="true"> / </span><a href="{base}{item.categories[0].path}">{item.categories[0].name}</a>{/if}</nav>
    <article>
      <header class="detail-hero">
        <div>
          {#if item.kind === 'recipe'}<p class="eyebrow">{item.categories[0]?.name ?? 'From Asha’s kitchen'}</p>{/if}
          <h1>{item.title}</h1>
          {#if item.excerpt}<p class="dek lede">{item.excerpt}</p>{/if}
          {#if item.kind !== 'page'}<p class="byline">By {item.author.name} <span aria-hidden="true">·</span> <time datetime={item.date_published}>{new Date(item.date_published).toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></p>{/if}
          {#if item.recipe?.rating}<p class="rating" aria-label="Rating summary">Rated {item.recipe.rating.value} out of 5 from {item.recipe.rating.count} ratings</p>{/if}
          {#if item.recipe}
            <div class="quick-actions actions"><a class="outline" href="#recipe-card">Jump to recipe</a><button class="outline" type="button" onclick={() => window.print()}>Print</button></div>
          {/if}
        </div>
        {#if item.image}<figure class="hero-figure"><img class="hero-image" src={item.image.src} srcset={item.image.variants.map((variant) => `${variant.src} ${variant.width}w`).join(', ')} sizes="(max-width: 760px) 100vw, 68rem" alt={item.image.alt} width={item.image.width} height={item.image.height} fetchpriority="high" /><figcaption>{item.image.alt}</figcaption></figure>{/if}
      </header>
      <div class="article-layout">
        <div class="editorial-body prose">{#each data.segments as segment, index (`${index}-${segment.card}`)}{#if segment.card && item.recipe}<RecipeCard recipe={item.recipe} postId={item.post_id} cardId={item.card_id} canonicalUrl={item.seo.canonical} />{:else if segment.html}{@html segment.html}{/if}{/each}</div>
        {#if item.kind !== 'page'}<aside class="author-box side-note" aria-label="About the author"><p class="eyebrow">A note from the kitchen</p><h2>{item.author.name}</h2><p>Thanks for cooking along. Find more recipes and stories on <a href="{base}/recipes/">Plate Full of Yum</a>.</p></aside>{/if}
      </div>
      {#if item.kind !== 'page' || (item.comments_count ?? 0) > 0 || (item.comments?.length ?? 0) > 0}
        {#key item.post_id}<CommentSnapshot comments={item.comments} count={item.comments_count} postId={item.post_id} />{/key}
      {/if}
    </article>
  </main>
{/if}

<style>
  .wrap { max-width: 1440px; margin: 0 auto; padding: 0 5.5%; }
  .article { padding-bottom: 3rem; }
  article { width: 100%; margin: auto; }
  .crumb { padding: 30px 0; color: var(--muted); font: 11px Arial, Helvetica, sans-serif; }
  .breadcrumbs a { border-bottom: 1px solid var(--sage); }
  .detail-hero { border: 0; }
  .detail-hero h1 { margin: 20px 0; font: normal clamp(38px,5vw,64px)/1.06 Georgia,serif; letter-spacing: -2px; }
  .eyebrow { margin: 0 0 .5rem; color: var(--forest); font: 700 .75rem/1.4 Arial,Helvetica,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  .dek, .byline, .rating, figcaption { color: var(--muted); font-family: Arial,Helvetica,sans-serif; }
  .byline, .rating { font-size: .85rem; line-height: 1.6; }
  .actions { margin-top: 25px; }
  .quick-actions a, .quick-actions button { display: inline-flex; align-items: center; min-height: 2.75rem; padding: 15px 20px; border: 1px solid var(--sage); border-radius: 30px; background: transparent; color: var(--forest); font: 12px Arial,Helvetica,sans-serif; text-decoration: none; cursor: pointer; }
  .hero-figure { margin: 0; }
  .hero-image { width: 100%; height: 480px; object-fit: cover; border-radius: 140px 140px 5px 5px; }
  .article-layout { display: grid; grid-template-columns: minmax(0,760px) 240px; gap: 8%; align-items: start; padding: 20px 0 50px; }
  .prose { min-width: 0; color: var(--ink); font: 16px/1.9 Arial,Helvetica,sans-serif; overflow-wrap: anywhere; }
  .prose :global(p) { margin: 0 0 24px; }
  .prose :global(h2) { margin: 35px 0 20px; font-size: 32px; }
  .prose :global(h3) { margin: 28px 0 15px; font: normal 27px Georgia,serif; }
  .prose :global(img) { max-width: 100%; height: auto; border-radius: 6px; }
  .prose :global(figure) { margin: 25px 0; }
  .prose :global(a) { color: var(--forest); border-bottom: 1px solid var(--sage); }
  .prose :global(ul), .prose :global(ol) { padding-left: 26px; }
  .prose :global(li) { padding: 5px 0; }
  .author-box { font: 13px/1.8 Arial,Helvetica,sans-serif; }
  .author-box h2 { font: normal 25px Georgia,serif; }
  .side-note { background: #e6ebdf; padding: 28px; }
  .side-note a { display: block; border-bottom: 1px solid #bdc9b2; padding: 12px 0; }
  .listing { padding-bottom: 45px; min-height: 70vh; }
  .page-intro { padding: 25px 0 40px; max-width: 850px; }
  .page-intro h1 { font: normal clamp(38px,5vw,64px)/1.06 Georgia,serif; letter-spacing: -2px; margin: 20px 0; }
  .page-intro > p:not(.eyebrow) { color: var(--muted); font: 16px/1.8 Arial,Helvetica,sans-serif; }
  .category-grid { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 24px; row-gap: 35px; padding-bottom: 50px; }
  .category-card { display: block; min-width: 0; color: var(--ink); text-decoration: none; }
  .category-card:hover img { filter: brightness(.92); }
  .category-card img { display: block; width: 100%; height: 285px; border-radius: 4px; object-fit: cover; transition: filter .2s; }
  .category-card > div { padding: 0; }
  .category-card h2 { margin: 0 0 12px; font: normal 23px/1.2 Georgia,serif; letter-spacing: -.4px; }
  .category-card p:not(.eyebrow) { margin: 0 0 12px; color: var(--muted); font: 15px/1.6 Arial,Helvetica,sans-serif; }
  @media(max-width:900px) { .detail-hero { grid-template-columns:1fr; gap: 1.5rem; } .hero-figure { order:-1; } .hero-image { height:360px; border-radius:90px 90px 4px 4px; } .article-layout { grid-template-columns:1fr; gap:30px; } .article-layout aside { display:none; } .category-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:23px 15px; } .category-card img { height:330px; } .detail-hero h1,.page-intro h1 { font-size:43px; } }
  @media(max-width:600px) { .category-card img { height:210px; } }
  @media print { .breadcrumbs, .quick-actions, .author-box, figcaption { display:none !important; } .wrap { width:100%; padding:0; } .article { padding:0; } .hero-image { margin:1rem 0; } .article-layout { display:block !important; } }
</style>
