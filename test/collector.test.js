import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { startFixtureServer } from './helpers/server.js';
import { FAKE } from './helpers/fake-secrets.js';

const pw = await import('playwright').catch(() => import('playwright-core')).catch(() => null);
const code = readFileSync(new URL('../skills/kagicyber-audit/collector.js', import.meta.url), 'utf8');

test('skill collector is generated and parses', () => {
  assert.match(code, /^\/\/ KagiCyber browser collector/);
  assert.ok(code.length < 30000, 'collector stays small enough to paste into one tool call');
  new Function(code); // syntax check
});

test('skill collector gathers masked evidence in a real browser (needs playwright)', { skip: !pw && 'playwright not installed' }, async (t) => {
  const srv = await startFixtureServer();
  let browser;
  try {
    const chromium = pw.chromium || pw.default?.chromium;
    browser = await chromium.launch(process.env.KAGICYBER_CHROME_PATH ? { executablePath: process.env.KAGICYBER_CHROME_PATH } : {}).catch((e) => (t.skip(`no browser: ${e.message.split('\n')[0]}`), null));
    if (!browser) return;
    const page = await browser.newPage();
    await page.goto(srv.url, { waitUntil: 'load' });
    const out = await page.evaluate(code);
    for (const s of [FAKE.aws, FAKE.google]) assert.ok(!out.includes(s), 'secret leaked');
    const o = JSON.parse(out);
    assert.equal(o.seo.lang, 'pl');
    assert.ok(o.code.secrets.some(([name]) => name === 'AWS access key ID'));
    assert.deepEqual(o.code.processors, ['FormSubmit']);
    assert.ok(o.before.trackerCookies.includes('_ga'));
    assert.ok(Object.values(o.pages).some((p) => p.garbled > 0), 'broken encoding found on the privacy page');
    assert.equal(o.files.notFound, 404);
  } finally {
    await browser?.close();
    srv.server.close();
  }
});
