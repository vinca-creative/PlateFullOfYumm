<script lang="ts">
  import { basePath as base } from '#lib/config.ts';
</script>

<svelte:head>
  <title>Page not found · Plate Full of Yum</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main id="main" class="wrap">
  <p class="eyebrow">404 · Not found</p>
  <h1>We couldn’t find that page.</h1>
  <p>The page may have moved, or the address may be incorrect.</p>
  <p><a href="{base}/">Return home</a><span aria-hidden="true"> · </span><a href="{base}/recipes/">Browse recipes</a></p>
</main>

<style>
  .wrap { width: min(100% - 2.5rem, 48rem); min-height: 60vh; margin: 0 auto; padding: 4rem 0; color: var(--ink); font-family: Arial,Helvetica,sans-serif; }
  .eyebrow { color: var(--forest); font: 700 .75rem Arial,Helvetica,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { color: var(--ink); font: normal clamp(2.2rem, 6vw, 3.5rem)/1.1 Georgia,serif; }
  p:not(.eyebrow) { color: var(--muted); font: 1.1rem/1.6 Arial,Helvetica,sans-serif; }
  a { display: inline-block; padding: .7rem 1rem; border: 1px solid var(--sage); border-radius: 30px; color: var(--forest); font-size: .85rem; }
  a:hover { background: var(--forest); border-color: var(--forest); color: white; }
  a:focus-visible { outline: 3px solid #9c6349; outline-offset: 5px; }
</style>
