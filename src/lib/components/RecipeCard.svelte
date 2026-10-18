<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { PublicRecipe } from '#lib/content/types.ts';
  let { recipe, postId, cardId, canonicalUrl }: { recipe: PublicRecipe; postId: number; cardId: number | null; canonicalUrl: string } = $props();
  let cookingView = $state(false);
  function toggleCookingView() {
    cookingView = !cookingView;
    document.body.classList.toggle('cook-focus', cookingView);
  }
  onDestroy(() => { if (typeof document !== 'undefined') document.body.classList.remove('cook-focus'); });
  function duration(seconds: number | null): string | null {
    if (seconds === null) return null;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
  }
  const times = $derived([
    ['Prep', duration(recipe.prep_seconds)],
    ['Cook', duration(recipe.active_seconds)],
    ['Additional', duration(recipe.additional_seconds)],
    ['Total', duration(recipe.total_seconds)]
  ].filter(([, value]) => value !== null) as Array<[string, string]>);
</script>

<section id="recipe-card" class="recipe-card" aria-labelledby="recipe-title-{postId}">
  {#if cardId}<span class="legacy-anchor" id="mv-creation-{cardId}" aria-hidden="true"></span>{/if}
  <div class="card-heading">
    <p class="eyebrow">The recipe</p>
    <h2 id="recipe-title-{postId}">{recipe.title}</h2>
    {#if recipe.description}<p>{recipe.description}</p>{/if}
    <div class="controls"><a href="#instructions">Jump to instructions</a><button type="button" onclick={() => window.print()} aria-label="Print this recipe">Print recipe</button><button type="button" onclick={toggleCookingView} aria-pressed={cookingView}>{cookingView ? 'Exit cooking view' : 'Cooking view'}</button></div>
  </div>
  {#if times.length || recipe.yield}
    <dl class="facts">{#each times as [label, value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}{#if recipe.yield}<div><dt>Yield</dt><dd>{recipe.yield}</dd></div>{/if}</dl>
  {/if}
  <div class="recipe-columns">
    <section aria-labelledby="ingredients-heading">
      <h3 id="ingredients-heading">Ingredients</h3>
      {#each recipe.ingredients as group, groupIndex (group.name || groupIndex)}
        {#if group.name}<h4>{group.name}</h4>{/if}
        <ul class="ingredients">{#each group.items as ingredient (ingredient.id)}<li><label><input type="checkbox" /><span>{ingredient.text}</span></label></li>{/each}</ul>
      {/each}
    </section>
    <section id="instructions" aria-labelledby="instructions-heading">
      <h3 id="instructions-heading">Instructions</h3>
      <ol class="steps">{#each recipe.instructions as instruction (instruction.id)}<li id={instruction.id}><span>{instruction.text}</span></li>{/each}</ol>
    </section>
  </div>
  {#if recipe.notes.length}<section class="notes" aria-labelledby="notes-heading"><h3 id="notes-heading">Notes</h3><ul>{#each recipe.notes as note}<li>{note}</li>{/each}</ul></section>{/if}
  {#if recipe.nutrition && Object.keys(recipe.nutrition.values).length}
    <section class="nutrition" aria-label="Nutrition information">
      <h3>Nutrition</h3>
      {#if recipe.nutrition.serving_size}<p>Serving size: {recipe.nutrition.serving_size}</p>{/if}
      {#if recipe.nutrition.servings}<p>Servings: {recipe.nutrition.servings}</p>{/if}
      <dl>{#each Object.entries(recipe.nutrition.values) as [name, value]}<div><dt>{name}</dt><dd>{value}</dd></div>{/each}</dl>
      {#if recipe.nutrition.source}<p class="source">Source: {recipe.nutrition.source}</p>{/if}
    </section>
  {/if}
  <p class="print-source">Source: <a href={canonicalUrl}>{canonicalUrl}</a></p>
</section>

<style>
  .recipe-card { margin: 2.5rem 0; padding: clamp(1rem, 4vw, 2.25rem); background: #f1eee6; border: 1px solid #dadcd4; border-radius: .75rem; scroll-margin-top: 1rem; }
  .card-heading { border-bottom: 1px solid #c9cec2; padding-bottom: 1rem; }
  .eyebrow { margin: 0; color: #46543c; font: 700 .75rem system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h2 { margin: .35rem 0; font: 600 clamp(1.7rem, 5vw, 2.5rem)/1.15 Georgia,serif; }
  h3 { font: 600 1.4rem Georgia,serif; }
  h4 { margin-bottom: .25rem; }
  .controls { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
  .controls a, .controls button { min-height: 2.75rem; padding: .65rem .9rem; border: 1px solid #46543c; border-radius: .35rem; background: #46543c; color: white; font: 600 .9rem system-ui,sans-serif; text-decoration: none; cursor: pointer; }
  .controls a { background: transparent; color: #303a2c; }
  .facts { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; margin: 1rem 0; font: .9rem system-ui,sans-serif; }
  .facts div { display: flex; gap: .35rem; } .facts dt { font-weight: 700; } .facts dd { margin: 0; }
  .recipe-columns { display: grid; grid-template-columns: minmax(14rem, .8fr) minmax(0, 1.2fr); gap: clamp(1rem, 4vw, 2.5rem); }
  .ingredients, .steps, .notes ul { padding-left: 1.25rem; }
  .ingredients { list-style: none; padding: 0; }
  .ingredients li { margin: .7rem 0; }
  .ingredients label { display: flex; align-items: flex-start; gap: .7rem; line-height: 1.5; }
  .ingredients input { flex: none; width: 1.15rem; height: 1.15rem; margin: .15rem 0 0; accent-color: #46543c; }
  .steps li { padding: .25rem 0 .75rem .3rem; line-height: 1.65; scroll-margin-top: 1rem; }
  .notes, .nutrition { border-top: 1px solid #c9cec2; margin-top: 1rem; padding-top: .5rem; }
  .nutrition dl { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font: .9rem system-ui,sans-serif; }
  .nutrition dl div { display: flex; gap: .3rem; } .nutrition dt { font-weight: 700; } .nutrition dd { margin: 0; }
  .source { font-size: .85rem; }
  .print-source { display: none; }
  :global(:focus-visible) { outline: 3px solid #995a42; outline-offset: 3px; }
  @media(max-width: 760px) { .recipe-columns { grid-template-columns: 1fr; gap: .5rem; } }
  @media print {
    .recipe-card { margin: 0; padding: 0; background: white; border: 0; border-radius: 0; }
    .controls, .ingredients input { display: none !important; }
    .recipe-columns { display: block; }
    .recipe-columns > section + section { margin-top: 1rem; }
    .recipe-columns h3, .recipe-columns h4, .notes h3, .nutrition h3 { break-after: avoid; }
    .ingredients li, .steps li { break-inside: avoid; }
    .print-source { display: block; }
  }
</style>
