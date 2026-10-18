import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit({
    adapter: adapter({ pages: 'build', assets: 'build' }),
    paths: { base: (process.env.PFOY_GITHUB_PAGES_BASE_PATH ?? '') as `/${string}` | '', relative: false }
  })]
});
