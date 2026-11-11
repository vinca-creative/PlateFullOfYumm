import assert from 'node:assert/strict';
import test from 'node:test';
import { runPagesSmoke } from '../scripts/pages-deployment-smoke.mjs';

test('Pages smoke accepts arbitrary nonempty homepage content', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response('  anything at all  ', { status: 200 });
  };
  const result = await runPagesSmoke({ pageUrl: 'https://owner.github.io/project/', basePath: '/project', fetchImpl });
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [{ url: 'https://owner.github.io/project/', options: { redirect: 'manual' } }]);
});

test('Pages smoke rejects HTTP failures and empty homepage bodies', async () => {
  await assert.rejects(runPagesSmoke({
    pageUrl: 'https://owner.github.io/project/',
    basePath: '/project',
    fetchImpl: async () => new Response('failure', { status: 503 }),
  }), /HTTP 503/);
  await assert.rejects(runPagesSmoke({
    pageUrl: 'https://owner.github.io/project/',
    basePath: '/project',
    fetchImpl: async () => new Response(' \n\t ', { status: 200 }),
  }), /body is empty/);
});
