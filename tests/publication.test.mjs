import assert from 'node:assert/strict';
import test from 'node:test';
import { smokeBaselineRoutes } from '../scripts/publication.ts';

test('smoke baselines contain unique canonical routes', () => {
  assert.deepEqual(smokeBaselineRoutes(['/z/', '/', '/z/']), ['/', '/z/']);
  assert.throws(() => smokeBaselineRoutes(['/bad?query']), /route inventory is invalid/);
});
