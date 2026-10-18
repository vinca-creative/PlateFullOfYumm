<script lang="ts">
  import { page } from '$app/state';
  import { basePath as base } from '#lib/config.ts';
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Unable to load page'} · Plate Full of Yum</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <p class="eyebrow">{page.status}</p>
  <h1>{page.status === 404 ? 'We couldn’t find that page.' : 'Something went wrong.'}</h1>
  <p>The page may have moved, or the address may be incorrect.</p>
  <a href="{base}/">Return to Plate Full of Yum</a>
</main>

<style>
  :global(body) { margin: 0; background: var(--paper); color: var(--ink); font-family: Arial,Helvetica,sans-serif; }
  main { max-width: 48rem; min-height: 60vh; margin: 0 auto; padding: 4rem 1.5rem; }
  .eyebrow { color: var(--forest); font: 700 .75rem Arial,Helvetica,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { color: var(--ink); font: normal clamp(2rem, 6vw, 3.5rem)/1.1 Georgia,serif; }
  main > p:not(.eyebrow) { color: var(--muted); font: 1.1rem/1.6 Arial,Helvetica,sans-serif; }
  a { display: inline-block; padding: .7rem 1rem; border: 1px solid var(--sage); border-radius: 30px; color: var(--forest); font-size: .85rem; text-decoration: none; }
  a:hover { background: var(--forest); border-color: var(--forest); color: white; }
  a:focus-visible { outline: 3px solid #9c6349; outline-offset: 5px; }
</style>
