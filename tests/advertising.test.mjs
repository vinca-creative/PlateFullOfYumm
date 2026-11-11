import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAdsConfig, selectAdPlacements, articleWordCount, LONG_ARTICLE_THRESHOLD_WORDS, hasAdConsent, hasCurrentGppAdsPermission, isArticleAdEligible } from '../src/lib/advertising.ts';

const valid = {
  enabled: 'true', cmpUrl: 'https://fundingchoicesmessages.google.com/i/pub-1234567890123456?ers=1',
  publisherId: 'ca-pub-1234567890123456', firstSlot: '1234567890', secondSlot: '8765432109',
  privacyUrl: 'https://platefullofyum.com/privacy/', sellerLine: 'google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0'
};
const para = (count = 30) => `<p>${Array.from({ length: count }, (_, index) => `word${index}`).join(' ')}</p>`;

test('ads disabled is valid without account configuration and yields no public ad config', () => {
  assert.deepEqual(validateAdsConfig({ enabled: 'false' }), {
    enabled: false, cmpUrl: '', publisherId: '', firstSlot: '', secondSlot: null, privacyUrl: '', sellerLine: ''
  });
  assert.deepEqual(validateAdsConfig({}), validateAdsConfig({ enabled: 'false' }));
});

test('enabled ads require real, matching publisher, CMP, slots, privacy URL and seller entry', () => {
  assert.equal(validateAdsConfig(valid).enabled, true);
  for (const override of [
    { cmpUrl: '' }, { cmpUrl: 'https://example.org/cmp.js' },
    { cmpUrl: 'https://fundingchoicesmessages.google.com/i/pub-1111111111111111?ers=1' }, { publisherId: 'ca-pub-placeholder' },
    { firstSlot: 'slot' }, { secondSlot: '1234567890' }, { privacyUrl: 'http://platefullofyum.com/privacy/' },
    { sellerLine: 'google.com, pub-1111111111111111, DIRECT, f08c47fec0942fa0' },
    { sellerLine: 'google.com, pub-1234567890123456, RESELLER, f08c47fec0942fa0' }
  ]) assert.throws(() => validateAdsConfig({ ...valid, ...override }));
  assert.throws(() => validateAdsConfig({ ...valid, enabled: 'yes' }));
});

test('placements are bounded, long-form-only after recipe and separated by substantial prose', () => {
  assert.equal(isArticleAdEligible({ kind: 'article', path: '/story/', title: 'Story' }), true);
  assert.equal(isArticleAdEligible({ kind: 'page', path: '/privacy/', title: 'Privacy' }), false);
  assert.equal(isArticleAdEligible({ kind: 'article', path: '/privacy-policy/', title: 'Privacy' }), false);
  assert.deepEqual(selectAdPlacements([{ html: para(), card: false }], true, false), [{ afterSegment: 0, slot: 'first' }]);
  const eligible = [{ html: para(700), card: false }, { html: '<p>recipe card</p>', card: true }, { html: para(350) + para(350), card: false }];
  assert.deepEqual(selectAdPlacements(eligible, true, true), [
    { afterSegment: 0, slot: 'first' }, { afterSegment: 2, slot: 'second' }
  ]);
  assert.equal(articleWordCount(eligible) >= LONG_ARTICLE_THRESHOLD_WORDS, true);
  assert.deepEqual(selectAdPlacements(eligible, false, true), []);
  assert.deepEqual(selectAdPlacements([{ html: para(), card: false }, { html: '<p>card</p>', card: true }], true, true), [{ afterSegment: 0, slot: 'first' }]);
  assert.deepEqual(selectAdPlacements([{ html: para(), card: false }, { html: '<p>card</p>', card: true }, { html: para(2), card: false }], true, true), [{ afterSegment: 0, slot: 'first' }]);
});

test('TCF permission fails closed on absent, incomplete, denied, or invalid state', () => {
  const permitted = { cmpStatus: 'loaded', eventStatus: 'tcloaded', gdprApplies: true, purpose: { consents: Object.fromEntries([1, 2, 3, 4, 7].map((id) => [id, true])) }, vendor: { consents: { 755: true } } };
  assert.equal(hasAdConsent(permitted), true);
  assert.equal(hasAdConsent(null), false);
  assert.equal(hasAdConsent({ ...permitted, eventStatus: 'cmpuishown' }), false);
  assert.equal(hasAdConsent({ ...permitted, vendor: { consents: { 755: false } } }), false);
  assert.equal(hasAdConsent({ ...permitted, purpose: { consents: { ...permitted.purpose.consents, 1: false } } }), false);
  assert.equal(hasAdConsent({ ...permitted, gdprApplies: false, purpose: undefined, vendor: undefined }), true);
  assert.equal(hasAdConsent({ ...permitted, gdprApplies: undefined }), false);
});

test('GPP gating waits while not ready and evaluates current US opt-out sections after each ready signal', () => {
  const noUsSection = { signalStatus: 'ready', applicableSections: [-1], parsedSections: {} };
  const usnat = (sale = 2, sharing = 2, targeted = 2, gpc = false) => ({
    signalStatus: 'ready',
    applicableSections: [7],
    parsedSections: { usnat: [{ SaleOptOut: sale, SharingOptOut: sharing, TargetedAdvertisingOptOut: targeted }, { Gpc: gpc }] }
  });
  assert.equal(hasCurrentGppAdsPermission(noUsSection), true);
  assert.equal(hasCurrentGppAdsPermission({ ...noUsSection, signalStatus: 'not ready' }), false);
  assert.equal(hasCurrentGppAdsPermission({ ...usnat(), signalStatus: 'not ready' }), false);
  assert.equal(hasCurrentGppAdsPermission(usnat(1)), false);
  assert.equal(hasCurrentGppAdsPermission(usnat(2, 2, 2, true)), false);
  assert.equal(hasCurrentGppAdsPermission(usnat()), true);
  assert.equal(hasCurrentGppAdsPermission({ signalStatus: 'ready', applicableSections: [7], parsedSections: {} }), false);
  assert.equal(hasCurrentGppAdsPermission({ signalStatus: 'ready', applicableSections: [28], parsedSections: {} }), false);
});
