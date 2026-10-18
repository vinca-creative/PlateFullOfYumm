<svelte:head>
  <title>Page not found · Plate Full of Yum</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main id="main" class="wrap">
  <p class="eyebrow">404 · Not found</p>
  <h1>We couldn’t find that page.</h1>
  <p>The page may have moved, or the address may be incorrect.</p>
  <p><a href="/">Return home</a><span aria-hidden="true"> · </span><a href="/recipes/">Browse recipes</a></p>
</main>

<style>
  .wrap { width: min(100% - 2.5rem, 48rem); min-height: 60vh; margin: 0 auto; padding: 4rem 0; }
  .eyebrow { color: #46543c; font: 700 .75rem system-ui,sans-serif; letter-spacing: .1em; text-transform: uppercase; }
  h1 { font: 600 clamp(2.2rem, 6vw, 3.5rem)/1.1 Georgia,serif; }
  p:not(.eyebrow) { color: #5d655b; font: 1.1rem/1.6 system-ui,sans-serif; }
</style>
