import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function fail(message) { throw new Error(`GitHub Pages smoke: ${message}`); }
export async function runPagesSmoke({ pageUrl, basePath, fetchImpl = fetch }) {
  let deployment;
  try { deployment = new URL(pageUrl); } catch { fail('deploy-pages did not provide a valid page_url.'); }
  if (!['https:', 'http:'].includes(deployment.protocol) || deployment.username || deployment.password || deployment.search || deployment.hash) fail('page_url must be a plain HTTP(S) deployment origin/path.');
  const base = `/${String(basePath).replace(/^\/+|\/+$/g, '')}`;
  if (base === '/') fail('repository base path is required.');
  if (deployment.pathname.replace(/\/$/, '') !== base) fail(`page_url path must match repository base path ${base}.`);

  const response = await fetchImpl(`${deployment.origin}${base}/`, { redirect: 'manual' });
  if (!response.ok || (response.status >= 300 && response.status < 400)) fail(`Homepage returned HTTP ${response.status}.`);
  if (!(await response.text()).trim()) fail('Homepage response body is empty.');
  return { status: response.status };
}



if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runPagesSmoke({ pageUrl: process.env.PAGES_PAGE_URL, basePath: process.env.PAGES_BASE_PATH }).then(({ status }) => {
    console.info(`Verified GitHub Pages homepage: HTTP ${status}.`);
  }).catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
