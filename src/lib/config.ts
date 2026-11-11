import { validateAdsConfig } from './advertising.ts';
const env = import.meta.env;

export const basePath = env.BASE_URL === '/' ? '' : env.BASE_URL.replace(/\/$/, '');

function publicOrigin(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error('VITE_PUBLIC_SITE_ORIGIN must be an absolute HTTP(S) origin.', { cause: error });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('VITE_PUBLIC_SITE_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

/** Public configuration only; every VITE_ value can be exposed to browsers. */
const ads = validateAdsConfig({
  enabled: env.VITE_ADS_ENABLED,
  cmpUrl: env.VITE_ADS_CMP_URL,
  publisherId: env.VITE_ADS_PUBLISHER_ID,
  firstSlot: env.VITE_ADS_FIRST_SLOT,
  secondSlot: env.VITE_ADS_SECOND_SLOT,
  privacyUrl: env.VITE_ADS_PRIVACY_URL,
  sellerLine: env.VITE_ADS_SELLER_LINE
});

export const publicConfig = {
  siteOrigin: publicOrigin(env.VITE_PUBLIC_SITE_ORIGIN || 'https://platefullofyum.com'),
  cmsOrigin: env.VITE_CMS_ORIGIN || '',
  adsEnabled: ads.enabled,
  ads,
  turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || ''
} as const;

