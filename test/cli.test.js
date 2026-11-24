import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, main } from '../src/cli.js';
import { detectJurisdictions } from '../src/jurisdiction.js';

test('exit codes: 0 for help and version, 2 for every usage error (1 is only for gates)', async (t) => {
  t.mock.method(console, 'log', () => {});
  t.mock.method(console, 'error', () => {});
  assert.equal(await main(['--help']), 0);
  assert.equal(await main(['--version']), 0);
  assert.equal(await main([]), 2, 'no command');
  assert.equal(await main(['audit']), 2, 'no target');
  assert.equal(await main(['frobnicate']), 2, 'unknown command');
  assert.equal(await main(['audit', 'example.com', '--nope']), 2, 'unknown option');
  assert.equal(await main(['audit', 'example.com', '--fail-on', 'severe']), 2, 'bad --fail-on');
  assert.equal(await main(['audit', 'a.com', 'b.com']), 2, 'two targets');
});

test('parseArgs', () => {
  const a = parseArgs(['audit', 'example.com', '--md', 'r.md', '--json', '--fail-on', 'high', '--browser']);
  assert.deepEqual(a._, ['audit', 'example.com']);
  assert.equal(a.md, 'r.md');
  assert.equal(a.json, true);
  assert.equal(a['fail-on'], 'high');
  assert.equal(a.browser, true);
  assert.equal(parseArgs(['audit', 'x.de', '--json', 'out.json']).json, 'out.json');
});

const ev = (over) => ({ pages: [], ...over, host: over.host || 'example.com', html: { lang: null, metas: {}, hreflang: [], text: '', ...over.html } });

test('jurisdiction: German site on .de with GmbH', () => {
  const j = detectJurisdictions(ev({ host: 'shop.beispiel.de', html: { lang: 'de-DE', text: 'Beispiel GmbH, Preise in €, USt-IdNr DE123456789' } }));
  assert.equal(j.list[0].code, 'DE');
  assert.equal(j.list[0].confidence, 'high');
});

test('jurisdiction: generic .io English site has no clear signals', () => {
  const j = detectJurisdictions(ev({ host: 'tool.io', html: { lang: 'en', text: 'Hello world' } }));
  assert.equal(j.global, true);
});

test('jurisdiction: hreflang lists several markets', () => {
  const j = detectJurisdictions(ev({ host: 'brand.com', html: { lang: 'en-GB', hreflang: [{ lang: 'fr-FR' }, { lang: 'de-AT' }], text: 'Prices in £' } }));
  assert.equal(j.list[0].code, 'GB');
});
