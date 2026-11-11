import assert from 'node:assert/strict';
import test from 'node:test';
import { mediaRedirectRule } from '../scripts/write-media-redirects.ts';

test('legacy uploads redirect to the configured CMS while preserving their path', () => {
  assert.equal(
    mediaRedirectRule('https://example.test', 'https://cms.example.test'),
    '/wp-content/uploads/* https://cms.example.test/wp-content/uploads/:splat 301\n'
  );
});

test('same-origin media does not emit a redirect loop', () => {
  assert.equal(mediaRedirectRule('https://example.test/', 'https://example.test'), null);
});

test('media redirect origins reject paths, credentials, and non-HTTP schemes', () => {
  for (const cmsOrigin of ['https://user:secret@cms.example.test', 'https://cms.example.test/path', 'javascript:alert(1)']) {
    assert.throws(() => mediaRedirectRule('https://example.test', cmsOrigin), /HTTP\(S\) origin/);
  }
});
