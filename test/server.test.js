import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureServer } from './helpers/server.js';
import { audit } from '../src/audit.js';
import { createServer } from '../src/server.js';

let site, api, base, guarded, guardedBase;
before(async () => {
  process.env.KAGICYBER_API_KEYS = 'test-key-1,test-key-2';
  site = await startFixtureServer();
  // The fixture lives on 127.0.0.1, so the functional tests turn the SSRF guard off; `guarded` keeps it on.
  api = createServer({ auditFn: (t, o) => audit(t, { ...o, publicOnly: false, delayMs: 0 }) });
  await new Promise((r) => api.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${api.address().port}`;
  guarded = createServer({ auditFn: (t, o) => audit(t, { ...o, delayMs: 0, timeoutMs: 3000 }), rateLimit: 50 });
  await new Promise((r) => guarded.listen(0, '127.0.0.1', r));
  guardedBase = `http://127.0.0.1:${guarded.address().port}`;
});
after(() => {
  site.server.close();
  api.close();
  guarded.close();
});

test('the API refuses loopback, private and metadata targets', async () => {
  for (const target of [site.url, 'http://localhost:1/', 'http://169.254.169.254/latest/meta-data/', 'http://10.0.0.1/', 'http://[::1]/', 'http://[::ffff:127.0.0.1]/']) {
    const res = await fetch(`${guardedBase}/v1/audit`, { method: 'POST', headers: { authorization: 'Bearer test-key-1', 'content-type': 'application/json' }, body: JSON.stringify({ target }) });
    assert.equal(res.status, 422, target);
    assert.match((await res.json()).error, /blocked non-public address/, target);
  }
});

test('rejects requests without a valid key', async () => {
  assert.equal((await fetch(`${base}/v1/audit`, { method: 'POST', body: '{}' })).status, 401);
  assert.equal((await fetch(`${base}/v1/audit`, { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' })).status, 401);
});

test('runs an audit and returns all formats', async () => {
  const res = await fetch(`${base}/v1/audit?format=all`, { method: 'POST', headers: { authorization: 'Bearer test-key-2', 'content-type': 'application/json' }, body: JSON.stringify({ target: site.url }) });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.ok(j.scores.compliance >= 0);
  assert.match(j.html, /KagiCyber audit/);
  assert.match(j.markdown, /## 1\. Compliance/);
});

test('health, rules and input validation', async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  assert.ok((await (await fetch(`${base}/v1/rules`)).json()).jurisdictions.PL.rules > 5);
  assert.equal((await fetch(`${base}/v1/audit`, { method: 'POST', headers: { authorization: 'Bearer test-key-1' }, body: '{"target":5}' })).status, 400);
});
