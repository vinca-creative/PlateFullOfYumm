import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { validateAdsConfig } from './src/lib/advertising.ts';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const ads = validateAdsConfig({
    enabled: env.VITE_ADS_ENABLED,
    cmpUrl: env.VITE_ADS_CMP_URL,
    publisherId: env.VITE_ADS_PUBLISHER_ID,
    firstSlot: env.VITE_ADS_FIRST_SLOT,
    secondSlot: env.VITE_ADS_SECOND_SLOT,
    privacyUrl: env.VITE_ADS_PRIVACY_URL,
    sellerLine: env.VITE_ADS_SELLER_LINE
  });
  return {
    plugins: [
      sveltekit({
        adapter: adapter({ pages: 'build', assets: 'build' }),
        paths: { base: (process.env.PFOY_GITHUB_PAGES_BASE_PATH ?? '') as `/${string}` | '', relative: false }
      }),
      {
        name: 'pfoy-ads-txt',
        apply: 'build',
        enforce: 'post',
        closeBundle() {
          const adsPath = resolve('build/ads.txt');
          if (ads.enabled) {
            mkdirSync(resolve('build'), { recursive: true });
            writeFileSync(adsPath, `${ads.sellerLine}\n`, 'utf8');
          } else {
            rmSync(adsPath, { force: true });
          }
        }
      }
    ]
  };
});
