import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUEST_TIMEOUT_MS = 15_000;

export function publicOriginFromEnvironment(): URL {
  const value = process.env.PFOY_PUBLIC_SITE_ORIGIN;
  if (!value) throw new Error('PFOY_PUBLIC_SITE_ORIGIN is required.');
  let origin: URL;
  try { origin = new URL(value); } catch { throw new Error('PFOY_PUBLIC_SITE_ORIGIN must be a valid HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('PFOY_PUBLIC_SITE_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment.');
  }
  return origin;
}

export async function runSmokeChecks(fetchImpl: typeof fetch = fetch): Promise<void> {
  const origin = publicOriginFromEnvironment();
  let response: Response;
  try {
    response = await fetchImpl(new URL('/', origin), {
      method: 'GET', cache: 'no-store', redirect: 'manual',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    throw new Error(`Public release check failed for /: ${String(error)}`);
  }
  if (!response.ok) throw new Error(`Public release check for / returned HTTP ${response.status}.`);
  const body = await response.text();
  if (!body.trim()) throw new Error('Public release check for / returned an empty response.');
}

async function main(): Promise<void> {
  const [command] = process.argv.slice(2);
  if (command === 'smoke') {
    await runSmokeChecks();
    return;
  }
  throw new Error('Use smoke.');
}

const invoked = process.argv[1] ? resolve(process.argv[1]) : '';
if (invoked === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
