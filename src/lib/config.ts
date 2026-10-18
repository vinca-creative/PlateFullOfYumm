const env = import.meta.env;

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
const adsRequested = env.VITE_ADS_ENABLED === 'true';
if (adsRequested) {
  throw new Error('Advertising cannot be enabled: a certified consent platform and verified publisher configuration are not installed.');
}

export const publicConfig = {
  siteOrigin: publicOrigin(env.VITE_PUBLIC_SITE_ORIGIN || 'https://platefullofyum.com'),
  cmsOrigin: env.VITE_CMS_ORIGIN || '',
  adsEnabled: false,
  turnstileSiteKey: env.VITE_TURNSTILE_SITE_KEY || ''
} as const;

