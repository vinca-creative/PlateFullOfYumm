<script lang="ts">
  import type { PageData } from './$types';
  import { basePath as base, publicConfig } from '#lib/config.ts';
  let { data }: { data: PageData } = $props();
  const socialImage = $derived(data.frontPage?.seo.og_image ?? data.frontPage?.image?.src ?? data.featured?.image?.src ?? null);
  const frontCanonical = $derived.by(() => {
    const canonical = data.frontPage?.seo.canonical;
    if (!canonical) return `${publicConfig.siteOrigin}${base}/`;
    const url = new URL(canonical);
    if (!base || url.origin !== publicConfig.siteOrigin) return canonical;
    return `${url.origin}${base}${url.pathname}${url.search}${url.hash}`;
  });
</script>

<svelte:head>
  <title>{data.frontPage?.seo.title || 'Plate Full of Yum — Recipes from Asha’s Kitchen'}</title>
  <meta name="description" content={data.frontPage?.seo.description || 'Find thoughtful recipes and stories from Asha’s kitchen.'} />
  <link rel="canonical" href={frontCanonical} />
  <meta name="robots" content={data.frontPage?.seo.robots ?? 'index,follow'} />
  <meta property="og:title" content={data.frontPage?.seo.og_title || data.frontPage?.seo.title || 'Plate Full of Yum — Recipes from Asha’s Kitchen'} />
  <meta property="og:description" content={data.frontPage?.seo.og_description || data.frontPage?.seo.description || 'Find thoughtful recipes and stories from Asha’s kitchen.'} />
  <meta property="og:url" content={frontCanonical} />
  {#if socialImage}<meta property="og:image" content={socialImage} />{/if}
  <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

<main id="main">
  <section class="hero wrap" class:hero-without-image={!data.featured?.image}>
    <div class="hero-copy">
      <p class="eyebrow">A home for good food</p>
      <h1>Make yourself<br />at home.</h1>
      <p>Thoughtful recipes, real-life cooking, and stories from Asha’s kitchen.</p>
      <a class="primary" href="{base}/recipes/">Find something to cook <span aria-hidden="true">↗</span></a>
    </div>
    {#if data.featured?.image}
      <div class="hero-visual">
        <a class="hero-image" href="{base}{data.featured.path}" aria-label={`Read ${data.featured.title}`}>
          <img src={data.featured.image.src} alt={data.featured.image.alt} width={data.featured.image.width} height={data.featured.image.height} fetchpriority="high" />
        </a>
        <div class="scribble" aria-hidden="true">made for<br />real life</div>
        <a class="photo-note" href="{base}{data.featured.path}">
          <span>FRESH FROM THE KITCHEN</span>
          <h2>{data.featured.title}<b aria-hidden="true">↗</b></h2>
        </a>
      </div>
    {/if}
  </section>
  {#if data.categories.length}
    <nav class="browse wrap" aria-label="Browse recipe categories">
      <p>What are you craving?</p>
      <div class="chips">{#each data.categories as category (category.id)}<a class="chip" href="{base}{category.path}">{category.name}<span aria-hidden="true">↗</span></a>{/each}</div>
    </nav>
  {/if}
  {#if data.recipes.length}
    <section class="recipe-section wrap" aria-labelledby="recipes-title">
      <div class="section-head">
        <div><p class="eyebrow">FROM THE RECIPE COLLECTION</p><h2 id="recipes-title">Good things to cook.</h2><a class="text-link" href="{base}/recipes/">Explore all recipes &amp; articles <span aria-hidden="true">↗</span></a></div>
        <a class="all-link" href="{base}/recipes/">Browse all recipes <span aria-hidden="true">↗</span></a>
      </div>
      <div class="grid">{#each data.recipes as recipe (recipe.post_id)}
        <article class="card">
          <a href="{base}{recipe.path}" class="card-link">
            {#if recipe.image}<img class="card-image" src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}
            <p class="meta">FROM ASHA’S KITCHEN</p>
            <h3>{recipe.title}</h3>
            {#if recipe.excerpt}<p class="card-description">{recipe.excerpt}</p>{/if}
            <span class="read">Read more <span aria-hidden="true">↗</span></span>
          </a>
        </article>
      {/each}</div>
    </section>
  {/if}
  {#if data.balancedBitesArticle}
    <section class="feature wrap" aria-labelledby="balanced-bites-title">
      {#if data.balancedBitesArticle.image}<a class="feature-image" href="{base}{data.balancedBitesArticle.path}" aria-label={`Read ${data.balancedBitesArticle.title}`}><img src={data.balancedBitesArticle.image.src} alt={data.balancedBitesArticle.image.alt} width={data.balancedBitesArticle.image.width} height={data.balancedBitesArticle.image.height} loading="lazy" /></a>{/if}
      <div class="feature-copy">
        <p class="eyebrow">BALANCED BITES</p>
        <h2 id="balanced-bites-title"><a href="{base}{data.balancedBitesArticle.path}">{data.balancedBitesArticle.title}</a></h2>
        {#if data.balancedBitesArticle.excerpt}<p>{data.balancedBitesArticle.excerpt}</p>{/if}
        <a class="text-link" href="{base}{data.balancedBitesArticle.path}">Read the story <span aria-hidden="true">↗</span></a>
        {#if data.balancedBitesCategory}<a class="category-link" href="{base}{data.balancedBitesCategory.path}">Explore Balanced Bites <span aria-hidden="true">↗</span></a>{/if}
      </div>
    </section>
  {/if}
  {#if data.stories.length}
    <section class="stories wrap" aria-labelledby="stories-title">
      <div class="section-head"><div><p class="eyebrow">BEYOND THE PLATE</p><h2 id="stories-title">Good things to read.</h2></div></div>
      <div class="story-grid">{#each data.stories as story (story.post_id)}<a class="story-card" href="{base}{story.path}"><h3>{story.title}</h3><span aria-hidden="true">↗</span></a>{/each}</div>
    </section>
  {/if}
</main>

<style>
  .wrap { max-width: 1440px; margin-inline: auto; padding-inline: 5.5%; }
  .hero { display: grid; grid-template-columns: 1fr 1fr; gap: 7%; padding-block: 64px 55px; align-items: center; }
  .hero-copy { min-width: 0; }
  .eyebrow { margin: 0; color: var(--muted); font-size: 10px; letter-spacing: 2px; text-transform: uppercase; font-weight: bold; }
  .hero h1 { margin: 25px 0; font: normal clamp(55px, 6.1vw, 88px)/1.03 Georgia, serif; letter-spacing: -4px; }
  .hero h1 em { color: #75866b; font-weight: normal; }
  .hero-copy > p:not(.eyebrow) { max-width: 340px; color: var(--muted); font-size: 15px; line-height: 1.8; }
  .primary { display: inline-flex; align-items: center; gap: 34px; margin-top: 20px; padding: 17px 24px; border-radius: 30px; background: var(--forest); color: white; font-size: 12px; }
  .hero-visual { position: relative; padding-bottom: 22px; }
  .hero-image { display: block; }
  .hero-image img { display: block; width: 100%; height: 490px; object-fit: cover; border-radius: 170px 170px 5px 5px; }
  .photo-note { position: absolute; bottom: 0; left: -24px; min-width: 240px; padding: 20px 25px; background: #e6ebdf; box-shadow: 0 6px 20px #25392e09; }
  .photo-note > span { font-size: 9px; letter-spacing: 1.5px; }
  .photo-note h2 { margin: 9px 0 0; font: normal 22px Georgia, serif; }
  .photo-note b { float: right; margin-left: 28px; font-size: 20px; }
  .hero-without-image { grid-template-columns: 1fr; }
  .browse { display: flex; align-items: center; gap: 35px; padding-block: 30px 35px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
  .browse > p { margin: 0; font: italic 19px Georgia, serif; white-space: nowrap; }
  .chips { display: flex; flex-wrap: wrap; gap: 10px; }
  .chip { display: inline-flex; align-items: center; gap: 14px; padding: 12px 19px; border: 1px solid #ccd4c4; border-radius: 25px; color: var(--forest); font-size: 12px; }
  .chip:hover { border-color: var(--forest); background: var(--forest); color: white; }
  .recipe-section, .stories { padding-block: 65px; }
  .section-head { display: flex; align-items: end; justify-content: space-between; gap: 25px; margin-bottom: 30px; }
  .section-head h2, .stories h2 { margin: 12px 0 0; font: normal 42px/1.15 Georgia, serif; letter-spacing: -1.3px; }
  .text-link { display: inline-block; margin-top: 15px; padding-bottom: 7px; border-bottom: 1px solid; font-size: 12px; }
  .all-link { padding-bottom: 7px; font-size: 12px; white-space: nowrap; }
  .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 24px; }
  .card { position: relative; min-width: 0; }
  .card-link { display: block; }
  .card-image { display: block; width: 100%; height: 285px; object-fit: cover; border-radius: 4px; transition: filter .2s; }
  .card-link:hover .card-image { filter: brightness(.92); }
  .meta { margin: 19px 0 10px; color: var(--muted); font-size: 9px; letter-spacing: 1.3px; text-transform: uppercase; }
  .card h3 { margin: 0 0 12px; font: normal 23px/1.2 Georgia, serif; letter-spacing: -.4px; }
  .card-description { margin: 0 0 12px; color: var(--muted); font-size: 13px; line-height: 1.7; }
  .read { color: var(--muted); font-size: 11px; }
  .feature { display: grid; grid-template-columns: 1fr 1fr; align-items: center; margin-block: 10px 65px; overflow: hidden; border-radius: 5px; background: #e6ebdf; }
  .feature-image img { display: block; width: 100%; height: 390px; object-fit: cover; }
  .feature-copy { padding: 45px 14%; }
  .feature-copy h2 { margin: 12px 0 0; font: normal 44px/1.15 Georgia, serif; letter-spacing: -1.3px; }
  .feature-copy > p:not(.eyebrow) { color: var(--muted); font-size: 14px; line-height: 1.8; }
  .category-link { display: inline-block; margin: 15px 0 0 18px; padding-bottom: 7px; border-bottom: 1px solid; font-size: 12px; }
  .stories { border-top: 1px solid var(--line); }
  .story-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 15px; }
  .story-card { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 110px; padding: 22px; border: 1px solid var(--line); background: white; }
  .story-card h3 { margin: 0; font: normal 22px/1.25 Georgia, serif; }
  @media (min-width: 1500px) { .hero-image img { height: 540px; } }
  @media (max-width: 900px) { .hero { gap: 5%; } .hero-image img { height: 420px; } .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .card-image { height: 330px; } .browse { display: block; } .feature-copy { padding: 30px 10%; } .feature-copy h2 { font-size: 35px; } }
  @media (max-width: 600px) { .wrap { padding-inline: 6%; } .hero { grid-template-columns: 1fr; padding-block: 35px; } .hero h1 { font-size: 65px; letter-spacing: -3px; } .hero-copy > p:not(.eyebrow) { max-width: 100%; } .hero-visual { margin: 20px 10px 0 12px; } .hero-image img { height: 390px; } .photo-note { left: -12px; } .browse { padding-block: 20px; } .chips { gap: 8px; } .chip { padding: 10px 15px; } .section-head { align-items: start; flex-direction: column; } .section-head h2, .stories h2 { font-size: 35px; } .grid { gap: 23px 15px; } .card-image { height: 210px; } .card h3 { font-size: 20px; } .meta { font-size: 8px; line-height: 1.7; } .feature { grid-template-columns: 1fr; margin-bottom: 45px; } .feature-image img { height: 300px; } .feature-copy { padding: 32px; } .story-grid { grid-template-columns: 1fr; } .recipe-section, .stories { padding-block: 40px; } }
</style>

