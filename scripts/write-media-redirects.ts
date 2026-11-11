import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function origin(value: string, name: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch (error) {
    throw new Error(`${name} must be an absolute HTTP(S) origin.`, { cause: error });
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${name} must be an HTTP(S) origin without credentials, path, query, or fragment.`);
  }
  return url.origin;
}

export function mediaRedirectRule(publicValue: string, cmsValue: string): string | null {
  const publicOrigin = origin(publicValue, 'PFOY_PUBLIC_SITE_ORIGIN');
  const cmsOrigin = origin(cmsValue, 'PFOY_CMS_ORIGIN');
  return publicOrigin === cmsOrigin ? null : `/wp-content/uploads/* ${cmsOrigin}/wp-content/uploads/:splat 301\n`;
}

async function main(): Promise<void> {
  const publicValue = process.env.PFOY_PUBLIC_SITE_ORIGIN;
  const cmsValue = process.env.PFOY_CMS_ORIGIN;
  if (!publicValue || !cmsValue) throw new Error('PFOY_PUBLIC_SITE_ORIGIN and PFOY_CMS_ORIGIN are required to generate production media redirects.');
  const rule = mediaRedirectRule(publicValue, cmsValue);
  if (rule) await writeFile('build/_redirects', rule, 'utf8');
  else await rm('build/_redirects', { force: true });
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
