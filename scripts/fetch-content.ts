import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchWordPressSnapshot } from '../src/lib/content/wordpress-api.ts';
const apiRoot = process.env.PFOY_WORDPRESS_API_ROOT || 'https://platefullofyum.com/wp-json/';
const publicOrigin = process.env.VITE_PUBLIC_SITE_ORIGIN || 'https://platefullofyum.com';
const cmsOrigin = process.env.VITE_CMS_ORIGIN || new URL(apiRoot).origin;
const snapshot = await fetchWordPressSnapshot(apiRoot, { publicOrigin, cmsOrigin });
const outputDirectory = resolve('content-snapshot');
const outputFile = resolve(outputDirectory, 'snapshot.json');
const temporaryFile = resolve(outputDirectory, `.snapshot-${process.pid}.tmp`);
await mkdir(outputDirectory, { recursive: true });
try {
  await writeFile(temporaryFile, `${JSON.stringify(snapshot)}\n`, { flag: 'wx' });
  await rename(temporaryFile, outputFile);
} catch (error) {
  await rm(temporaryFile, { force: true });
  throw error;
}
console.info(`Fetched ${snapshot.items.length} public records at content revision ${snapshot.revision}`);
