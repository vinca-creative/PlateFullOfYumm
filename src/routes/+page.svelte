<script lang="ts">
  import type { PageData } from './$types';
  import { publicConfig } from '#lib/config.ts';
  let { data }: { data: PageData } = $props();
  const socialImage = $derived(data.frontPage?.seo.og_image ?? data.frontPage?.image?.src ?? data.featured?.seo.og_image ?? data.featured?.image?.src ?? null);
</script>

<svelte:head>
  <title>{data.frontPage?.seo.title || 'Plate Full of Yum — Recipes from Asha’s Kitchen'}</title>
  <meta name="description" content={data.frontPage?.seo.description || 'Find thoughtful recipes and stories from Asha’s kitchen.'} />
  <link rel="canonical" href={data.frontPage?.seo.canonical ?? `${publicConfig.siteOrigin}/`} />
  <meta name="robots" content={data.frontPage?.seo.robots ?? 'index,follow'} />
  <meta property="og:title" content={data.frontPage?.seo.og_title || data.frontPage?.seo.title || 'Plate Full of Yum — Recipes from Asha’s Kitchen'} />
  <meta property="og:description" content={data.frontPage?.seo.og_description || data.frontPage?.seo.description || 'Find thoughtful recipes and stories from Asha’s kitchen.'} />
  <meta property="og:url" content={data.frontPage?.seo.canonical ?? `${publicConfig.siteOrigin}/`} />
  {#if socialImage}<meta property="og:image" content={socialImage} />{/if}
  <meta name="twitter:card" content={socialImage ? 'summary_large_image' : 'summary'} />
</svelte:head>

<main id="main">
  <section class="intro">
    <p class="eyebrow">A home for good food</p>
    <h1>Make yourself<br />at home.</h1>
    <p>Thoughtful recipes, real-life cooking, and stories from Asha’s kitchen.</p>
    <a class="button" href="/recipes/">Find something to cook</a>
  </section>
  {#if data.featured}
    <section class="feature wrap" aria-labelledby="featured-title">
      {#if data.featured.image}<a class="feature-image" href={data.featured.path}><img src={data.featured.image.src} alt={data.featured.image.alt} width={data.featured.image.width} height={data.featured.image.height} fetchpriority="high" /></a>{/if}
      <div class="feature-copy"><p class="eyebrow">Fresh from the kitchen</p><h2 id="featured-title"><a href={data.featured.path}>{data.featured.title}</a></h2><p>{data.featured.excerpt || data.featured.recipe?.description}</p><a class="text-link" href={data.featured.path}>See the recipe →</a></div>
    </section>
  {/if}
  {#if data.balancedBitesArticle}
    <section class="balanced-feature wrap" class:balanced-feature-text={!data.balancedBitesArticle.image} aria-labelledby="balanced-bites-title">
      {#if data.balancedBitesArticle.image}<a class="balanced-image" href={data.balancedBitesArticle.path}><img src={data.balancedBitesArticle.image.src} alt={data.balancedBitesArticle.image.alt} width={data.balancedBitesArticle.image.width} height={data.balancedBitesArticle.image.height} loading="lazy" /></a>{/if}
      <div class="balanced-copy"><p class="eyebrow">Balanced Bites</p><h2 id="balanced-bites-title"><a href={data.balancedBitesArticle.path}>{data.balancedBitesArticle.title}</a></h2>{#if data.balancedBitesArticle.excerpt}<p>{data.balancedBitesArticle.excerpt}</p>{/if}<a class="text-link" href={data.balancedBitesArticle.path}>Read the story →</a>{#if data.balancedBitesCategory}<a class="balanced-category-link" href={data.balancedBitesCategory.path}>Explore Balanced Bites</a>{/if}</div>
    </section>
  {/if}
  {#if data.categories.length}
    <section class="category-section wrap"><div class="section-heading"><div><p class="eyebrow">Browse by category</p><h2>What sounds good?</h2></div><a href="/recipes/">All recipes →</a></div><div class="category-list">{#each data.categories as category (category.id)}<a href={category.path}>{category.name}<span aria-hidden="true">↗</span></a>{/each}</div></section>
  {/if}
  {#if data.recipes.length}
    <section class="latest wrap"><div class="section-heading"><div><p class="eyebrow">From Asha’s kitchen</p><h2>Recipes to keep close</h2></div><a href="/recipes/">Browse all →</a></div><div class="cards">{#each data.recipes as recipe (recipe.post_id)}<a href={recipe.path} class="recipe-preview">{#if recipe.image}<img src={recipe.image.src} alt={recipe.image.alt} width={recipe.image.width} height={recipe.image.height} loading="lazy" />{/if}<div><h3>{recipe.title}</h3><p>{recipe.excerpt || recipe.recipe?.description}</p></div></a>{/each}</div></section>
  {/if}
  {#if data.stories.length}
    <section class="stories wrap"><div class="section-heading"><div><p class="eyebrow">Beyond the plate</p><h2>Good things to read</h2></div></div><div class="story-list">{#each data.stories as story (story.post_id)}<a href={story.path}><span>{story.title}</span><span aria-hidden="true">→</span></a>{/each}</div></section>
  {/if}
</main>

<style>
  .wrap { width: min(100% - 2.5rem, 75rem); margin-inline: auto; }
  .intro { min-height: 20rem; padding: 4rem 1.25rem 3.5rem; text-align: center; background: #f1eee6; }
  .eyebrow { margin: 0 0 .6rem; color: #46543c; font: 700 .75rem/1.4 system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { margin: 0; font: 600 clamp(3rem, 9vw, 5.6rem)/.98 Georgia,serif; letter-spacing: -.04em; }
  .intro > p:not(.eyebrow) { max-width: 34rem; margin: 1rem auto 1.4rem; color: #5d655b; font: 1.1rem/1.55 system-ui,sans-serif; }
  .button { display: inline-flex; align-items: center; min-height: 2.9rem; padding: .7rem 1.1rem; border-radius: .35rem; background: #46543c; color: white; text-decoration: none; font: 600 .92rem system-ui,sans-serif; }
  .balanced-feature { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(17rem, .7fr); align-items: center; gap: clamp(1.5rem, 6vw, 5rem); padding-block: 3rem; border-top: 1px solid #dadcd4; }
  .balanced-feature-text { grid-template-columns: 1fr; }
  .balanced-image img { display: block; width: 100%; height: auto; aspect-ratio: 4/3; object-fit: cover; border-radius: .5rem; }
  .balanced-copy h2 { margin: .25rem 0 .75rem; font: 600 clamp(2rem, 4vw, 3rem)/1.1 Georgia,serif; }
  .balanced-copy h2 a { color: #252a25; text-decoration: none; }
  .balanced-copy > p:not(.eyebrow) { color: #5d655b; font: 1.05rem/1.6 system-ui,sans-serif; }
  .balanced-category-link { display: inline-block; margin-left: 1rem; font: 600 .95rem system-ui,sans-serif; text-underline-offset: .2em; }
  .feature { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(17rem, .7fr); align-items: center; gap: clamp(1.5rem, 6vw, 5rem); padding-block: 3rem; }
  .feature-image img { display: block; width: 100%; height: auto; aspect-ratio: 4/3; object-fit: cover; border-radius: .5rem; }
  .feature-copy h2 { margin: .25rem 0 .75rem; font: 600 clamp(2rem, 4vw, 3rem)/1.1 Georgia,serif; }
  .feature-copy h2 a { color: #252a25; text-decoration: none; }
  .feature-copy > p:not(.eyebrow) { color: #5d655b; font: 1.05rem/1.6 system-ui,sans-serif; }
  .text-link { font: 700 .95rem system-ui,sans-serif; text-underline-offset: .2em; }
  .latest, .category-section, .stories { padding-block: 2.5rem; border-top: 1px solid #dadcd4; }
  .section-heading { display: flex; align-items: end; justify-content: space-between; gap: 1rem; margin-bottom: 1.5rem; }
  .section-heading h2 { margin: 0; font: 600 clamp(1.8rem, 4vw, 2.4rem)/1.15 Georgia,serif; }
  .section-heading > a { font: 600 .9rem system-ui,sans-serif; white-space: nowrap; }
  .category-list { display: flex; flex-wrap: wrap; gap: .65rem; }
  .category-list a { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 2.8rem; padding: .65rem 1rem; border: 1px solid #c9cec2; border-radius: .35rem; background: white; color: #252a25; text-decoration: none; font: 600 .9rem system-ui,sans-serif; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: 1.4rem; }
  .recipe-preview { overflow: hidden; background: white; border: 1px solid #dadcd4; border-radius: .5rem; color: inherit; text-decoration: none; }
  .recipe-preview img { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
  .recipe-preview > div { padding: 1rem; }
  .recipe-preview h3 { margin: 0; font: 600 1.4rem/1.2 Georgia,serif; }
  .recipe-preview p { margin-bottom: 0; color: #5d655b; font: .92rem/1.5 system-ui,sans-serif; }
  .story-list { display: grid; grid-template-columns: repeat(auto-fit,minmax(min(100%,20rem),1fr)); gap: .8rem 2rem; }
  .story-list a { display: flex; justify-content: space-between; gap: 1rem; padding: .9rem 0; border-bottom: 1px solid #dadcd4; color: #252a25; text-decoration: none; font: 600 1.1rem Georgia,serif; }
  @media(max-width: 720px) { .intro { padding-block: 3rem; } .feature, .balanced-feature { grid-template-columns: 1fr; } .feature-image:empty { display: none; } .section-heading { align-items: start; flex-direction: column; } }
</style>
