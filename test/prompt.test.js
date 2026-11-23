import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFixtureServer } from './helpers/server.js';
import { FAKE } from './helpers/fake-secrets.js';
import { audit } from '../src/audit.js';
import { scanDirectory } from '../src/scan.js';
import { renderFixPrompt, renderScanPrompt, complianceRows } from '../src/report/prompt.js';

let srv;
let r;
let prompt;
before(async () => {
  srv = await startFixtureServer();
  r = await audit(srv.url, { delayMs: 0 });
  prompt = renderFixPrompt(r);
});
after(() => srv.server.close());

test('fix prompt lists every failed and partial check once, and nothing that passed', () => {
  const rows = complianceRows(r);
  for (const x of rows.filter((y) => y.status === 'fail' || y.status === 'partial')) assert.ok(prompt.includes(`[${x.id}]`), `${x.id} missing`);
  for (const x of rows.filter((y) => y.status === 'pass')) assert.ok(!prompt.includes(`[${x.id}] `), `${x.id} passed but is listed`);
  for (const f of r.security.findings.filter((y) => y.severity !== 'info')) assert.ok(prompt.includes(`[${f.id}]`), `${f.id} missing`);
  const ids = prompt.match(/^\d+\. \[[^\]]+\]/gm);
  assert.equal(new Set(ids.map((x) => x.replace(/^\d+\. /, ''))).size, ids.length, 'each task appears once');
});

test('fix prompt carries context, legal basis, penalties and snippets', () => {
  assert.match(prompt, /^You are a senior web developer/);
  assert.match(prompt, /Site language: Polish \(pl\)/);
  assert.match(prompt, /Legal basis: .*Art\. 399/);
  assert.match(prompt, /Max penalty: UKE/);
  assert.match(prompt, /## Reference snippets/);
  assert.match(prompt, /npx kagicyber audit .* --baseline before\.json/);
});

test('fix prompt never contains a secret, an emoji or a long dash', () => {
  for (const s of [FAKE.aws, FAKE.google, FAKE.supabaseAnon]) assert.ok(!prompt.includes(s));
  const template = prompt.replace(/"[^"\n]*"/g, '""');
  assert.ok(!/\p{Extended_Pictographic}/u.test(template));
  assert.ok(!/[\u2013\u2014]/.test(template));
});

test('scan prompt points at files and lines', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-prompt-'));
  try {
    writeFileSync(join(dir, 'config.js'), `export const key = "${FAKE.aws}";\n`);
    const out = renderScanPrompt(scanDirectory(dir, { deep: false }));
    assert.match(out, /\[S-X\d{2}\] AWS access key ID/);
    assert.match(out, /config\.js:1/);
    assert.ok(!out.includes(FAKE.aws));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
