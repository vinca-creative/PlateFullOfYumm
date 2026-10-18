import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acknowledgementSignature,
  assertCurrentRevision,
  assertReleaseMarker,
  parsePublicationStatus,
  smokeBaselineRoutes
} from '../scripts/publication.ts';
const status = (overrides = {}) => ({
  contract_version: 1,
  enabled: true,
  desired_revision: '42',
  deployed_revision: '41',
  outcome: 'pending',
  ...overrides
});

function response(value, responseStatus = 200) {
  return new Response(JSON.stringify(value), {
    status: responseStatus,
    headers: { 'content-type': 'application/json' }
  });
}

test('publication status accepts only enabled monotonic revision metadata', () => {
  assert.deepEqual(parsePublicationStatus(status()), {
    contract_version: 1,
    enabled: true,
    desired_revision: '42',
    deployed_revision: '41',
    outcome: 'pending'
  });
  assert.throws(() => parsePublicationStatus(status({ desired_revision: '41', deployed_revision: '42', outcome: 'pending' })), /ahead of the desired revision/);
  assert.throws(() => parsePublicationStatus(status({ enabled: false })), /disabled or misconfigured/);
  assert.throws(() => parsePublicationStatus(status({ desired_revision: 42 })), /desired_revision is invalid/);
  assert.throws(() => parsePublicationStatus(status({ desired_revision: '042' })), /desired_revision is invalid/);
  assert.throws(() => parsePublicationStatus(status({ desired_revision: '9'.repeat(21) })), /desired_revision is invalid/);
  assert.throws(() => parsePublicationStatus(status({ outcome: 'success' })), /outcome is invalid/);
  assert.throws(() => parsePublicationStatus(status({ desired_revision: '42', deployed_revision: '41', outcome: 'deployed' })), /unmatched deployment/);
});

test('revision checks reject changed or unavailable source state', async () => {
  const apiRoot = new URL('https://cms.example.test/wp-json/');
  let requested;
  const current = await assertCurrentRevision(apiRoot, '42', async (url, options) => {
    requested = { url: url.href, options };
    return response(status());
  });
  assert.equal(current.desired_revision, '42');
  assert.equal(requested.url, 'https://cms.example.test/wp-json/pfoy/v1/publication/status');
  assert.equal(requested.options.cache, 'no-store');
  await assert.rejects(assertCurrentRevision(apiRoot, '41', async () => response(status())), /source revision changed/);
  await assert.rejects(assertCurrentRevision(apiRoot, '42', async () => response(status({ enabled: false }))), /disabled or misconfigured/);
  await assert.rejects(assertCurrentRevision(apiRoot, '42', async () => response({ message: 'unavailable' }, 503)), /HTTP 503/);
});

test('acknowledgement HMAC binds timestamp and exact body', () => {
  const secret = 'server-only-test-secret';
  const body = '{"contract_version":1,"revision":"42"}';
  const signature = acknowledgementSignature(secret, '1790000000', body);
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.equal(signature, '672419e976404819096154e8552fe3342f0e5988fa2d8bea7a587ccacb4dfc1d');
  assert.equal(acknowledgementSignature(secret, '1790000000', body), signature);
  assert.notEqual(acknowledgementSignature(secret, '1790000001', body), signature);
  assert.notEqual(acknowledgementSignature(secret, '1790000000', `${body} `), signature);
  assert.notEqual(acknowledgementSignature('different-secret', '1790000000', body), signature);
});

test('release markers fail closed unless both release identities match', () => {
  const expected = { source_revision: '42', release_sha: 'a'.repeat(40) };
  assert.doesNotThrow(() => assertReleaseMarker(expected, expected.source_revision, expected.release_sha));
  assert.throws(() => assertReleaseMarker(undefined, expected.source_revision, expected.release_sha), /missing or invalid/);
  assert.throws(() => assertReleaseMarker({ ...expected, source_revision: '41' }, expected.source_revision, expected.release_sha), /does not match/);
  assert.throws(() => assertReleaseMarker({ ...expected, release_sha: 'b'.repeat(40) }, expected.source_revision, expected.release_sha), /does not match/);
});
test('release markers validate route inventories and smoke baselines include non-sitemap routes', () => {
  const expected = { source_revision: '42', release_sha: 'a'.repeat(40), routes: ['/', '/noindex/', '/old/'] };
  assert.doesNotThrow(() => assertReleaseMarker(expected, expected.source_revision, expected.release_sha));
  assert.throws(() => assertReleaseMarker({ ...expected, routes: ['/valid/', 'https://evil.test/'] }, expected.source_revision, expected.release_sha), /route inventory is invalid/);
  assert.throws(() => assertReleaseMarker({ ...expected, routes: '/invalid/' }, expected.source_revision, expected.release_sha), /route inventory is invalid/);
  const priorRoutes = smokeBaselineRoutes(['/'], expected);
  assert.deepEqual(priorRoutes, ['/', '/noindex/', '/old/']);
  assert.deepEqual(priorRoutes.filter((path) => !new Set(['/']).has(path)), ['/noindex/', '/old/']);
  assert.deepEqual(smokeBaselineRoutes(['/z/', '/', '/z/'], { source_revision: '41', release_sha: 'b'.repeat(40) }), ['/', '/z/']);
});
