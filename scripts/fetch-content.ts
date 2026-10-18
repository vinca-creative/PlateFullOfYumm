import { appendFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchWordPressSnapshot } from '../src/lib/content/wordpress-api.ts';
import { assertCurrentRevision } from './publication.ts';

const apiRoot = process.env.PFOY_WORDPRESS_API_ROOT || 'https://platefullofyum.com/wp-json/';
const publicOrigin = process.env.VITE_PUBLIC_SITE_ORIGIN || 'https://platefullofyum.com';
const cmsOrigin = process.env.VITE_CMS_ORIGIN || new URL(apiRoot).origin;
const enforceSourceRevision = process.env.PFOY_REQUIRE_SOURCE_REVISION === 'true';
const apiUrl = new URL(apiRoot);
const publicationApiRoot = apiUrl.href.endsWith('/') ? apiUrl : new URL(`${apiUrl.href}/`);
const expectedSourceRevision = process.env.EXPECTED_SOURCE_REVISION;
if (enforceSourceRevision && !expectedSourceRevision) throw new Error('EXPECTED_SOURCE_REVISION is required for a production snapshot.');
const sourceBefore = enforceSourceRevision
  ? await assertCurrentRevision(publicationApiRoot, expectedSourceRevision!)
  : null;
const snapshot = await fetchWordPressSnapshot(apiRoot, { publicOrigin, cmsOrigin });
if (sourceBefore) await assertCurrentRevision(publicationApiRoot, sourceBefore.desired_revision);
const sourceRevision = sourceBefore?.desired_revision;
const outputDirectory = resolve('content-snapshot');
const outputFile = resolve(outputDirectory, 'snapshot.json');
const temporaryFile = resolve(outputDirectory, `.snapshot-${process.pid}.tmp`);
const outputSnapshot = sourceRevision ? { ...snapshot, source_revision: sourceRevision } : snapshot;
await mkdir(outputDirectory, { recursive: true });
try {
  await writeFile(temporaryFile, `${JSON.stringify(outputSnapshot)}\n`, { flag: 'wx' });
  await rename(temporaryFile, outputFile);
} catch (error) {
  await rm(temporaryFile, { force: true });
  throw error;
}
if (sourceRevision && process.env.GITHUB_OUTPUT) {
  await appendFile(process.env.GITHUB_OUTPUT, `source_revision=${sourceRevision}\n`);
}
console.info(`Fetched ${snapshot.items.length} public records at content revision ${snapshot.revision}${sourceRevision ? `, WordPress source revision ${sourceRevision}` : ''}`);
