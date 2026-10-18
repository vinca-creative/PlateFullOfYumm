<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status === 404 ? 'Page not found' : 'Unable to load page'} · Plate Full of Yum</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main>
  <p class="eyebrow">{page.status}</p>
  <h1>{page.status === 404 ? 'We couldn’t find that page.' : 'Something went wrong.'}</h1>
  <p>The page may have moved, or the address may be incorrect.</p>
  <a href="/">Return to Plate Full of Yum</a>
</main>

<style>
  :global(body) { margin: 0; background: #faf8f3; color: #252a25; font-family: system-ui, sans-serif; }
  main { max-width: 48rem; margin: 0 auto; padding: 4rem 1.5rem; }
  .eyebrow { color: #46543c; font-weight: 700; }
  h1 { font-family: Georgia, 'Times New Roman', serif; font-size: clamp(2rem, 6vw, 3.5rem); }
  a { color: #46543c; }
</style>
