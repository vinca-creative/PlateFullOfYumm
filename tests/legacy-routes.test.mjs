import assert from 'node:assert/strict';
import test from 'node:test';
import { getLegacyRouteRedirect, getLegacyRouteEntries } from '../src/lib/server/legacy-routes.ts';

test('legacy utility routes and known renamed content paths redirect explicitly', () => {
  const utilityAliases = ['recipe-search', 'recipe-search-results', 'recipe-category', 'recipe-box'];
  assert.deepEqual(getLegacyRouteEntries(), [...utilityAliases, 'easy-instantpot-caramelised-onions', 'ishtu-potato-stew']);
  for (const path of utilityAliases) {
    assert.equal(getLegacyRouteRedirect(`/${path}/`), '/recipes/');
    assert.equal(getLegacyRouteRedirect(`/${path}/`, '/PlateFullOfYum'), '/PlateFullOfYum/recipes/');
  }
  assert.equal(getLegacyRouteRedirect('/easy-instantpot-caramelised-onions/'), '/easy-caramelised-onions/');
  assert.equal(getLegacyRouteRedirect('/easy-instantpot-caramelised-onions/', '/PlateFullOfYum'), '/PlateFullOfYum/easy-caramelised-onions/');
  assert.equal(getLegacyRouteRedirect('/ishtu-potato-stew/'), '/ishtu/');
  assert.equal(getLegacyRouteRedirect('/ishtu-potato-stew/', '/PlateFullOfYum'), '/PlateFullOfYum/ishtu/');
  assert.equal(getLegacyRouteRedirect('/banana-bread/'), undefined);
});
