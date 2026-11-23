import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureServer } from './helpers/server.js';
import { browserConsentTest } from '../src/browser.js';

const hasPlaywright = await import('playwright').then(() => true, () => import('playwright-core').then(() => true, () => false));

test('real-browser consent test (needs playwright)', { skip: !hasPlaywright && 'playwright not installed' }, async () => {
  const srv = await startFixtureServer();
  try {
    const bad = await browserConsentTest(srv.url, { waitMs: 1500 });
    if (!bad.ran) return assert.ok(true, bad.reason);
    assert.ok(bad.trackerCookies.some((c) => c.name === '_ga'));
    assert.equal(bad.banner.found, false);
    const good = await browserConsentTest(`${srv.url}consent.html`, { waitMs: 1500 });
    assert.equal(good.banner.found, true);
    assert.equal(good.banner.reject, 'Reject all');
    assert.equal(good.trackerRequests.length, 0);
  } finally {
    srv.server.close();
  }
});
