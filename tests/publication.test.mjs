import assert from 'node:assert/strict';
import test from 'node:test';
import { runSmokeChecks } from '../scripts/publication.ts';

test('smoke accepts an arbitrary nonempty homepage response', async () => {
  process.env.PFOY_PUBLIC_SITE_ORIGIN = 'https://example.test';
  let requested;
  await runSmokeChecks(async (url, options) => {
    requested = { url: String(url), options };
    return new Response('anything at all', { status: 200 });
  });
  assert.equal(requested.url, 'https://example.test/');
  assert.equal(requested.options.method, 'GET');
  assert.equal(requested.options.redirect, 'manual');
});

test('smoke rejects non-2xx homepage responses', async () => {
  process.env.PFOY_PUBLIC_SITE_ORIGIN = 'https://example.test';
  await assert.rejects(runSmokeChecks(async () => new Response('', { status: 503 })), /HTTP 503/);
});

test('smoke rejects an empty homepage response', async () => {
  process.env.PFOY_PUBLIC_SITE_ORIGIN = 'https://example.test';
  await assert.rejects(runSmokeChecks(async () => new Response(' \n\t', { status: 200 })), /empty response/);
});
