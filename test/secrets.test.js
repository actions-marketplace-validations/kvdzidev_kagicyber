import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from '../src/checks/secrets.js';
import { FAKE } from './helpers/fake-secrets.js';

test('detects and masks high-value secrets', () => {
  const hits = scanText(`const a="${FAKE.aws}"; const s="${FAKE.stripeLive}"; const g="${FAKE.github}";`, 'x.js');
  const types = hits.map((h) => h.type);
  assert.ok(types.includes('AWS access key ID'));
  assert.ok(types.includes('Live secret key (Stripe, Clerk)'));
  assert.ok(types.includes('GitHub token'));
  for (const h of hits) {
    assert.ok(!h.value.includes(FAKE.aws.slice(4, 16)), 'value must be masked');
    assert.match(h.value, /…/);
  }
  assert.equal(hits.find((h) => h.type === 'GitHub token').severity, 'critical');
});

test('classifies Supabase JWTs by role', () => {
  const anon = scanText(`k="${FAKE.supabaseAnon}"`)[0];
  const svc = scanText(`k="${FAKE.supabaseService}"`)[0];
  assert.equal(anon.type, 'Supabase anon JWT');
  assert.equal(anon.severity, 'info');
  assert.equal(svc.type, 'Supabase service_role JWT');
  assert.equal(svc.severity, 'critical');
});

test('ignores obvious placeholders', () => {
  assert.equal(scanText('apiKey: "your_api_key_here_please"').length, 0);
  assert.equal(scanText('password = "changeme_changeme"').length, 0);
});

test('Firebase web keys are info, other Google keys are medium', () => {
  assert.equal(scanText(`firebase.initializeApp({apiKey:"${FAKE.google}",authDomain:"x.firebaseapp.com"})`)[0].severity, 'info');
  assert.equal(scanText(`maps("${FAKE.google}")`)[0].severity, 'medium');
});

test('reports line numbers', () => {
  const hits = scanText(`line1\nline2\nkey="${FAKE.aws}"`);
  assert.equal(hits[0].line, 3);
});

test('new detectors (built at runtime) and keyword prefilter', () => {
  const j = (...p) => p.join('');
  const samples = {
    'npm access token': j('npm', '_', 'A'.repeat(18), 'b'.repeat(18)),
    'Hugging Face token': j('hf', '_', 'Ab3'.repeat(12)),
    'Supabase personal access token': j('sbp', '_', 'a1'.repeat(20)),
    'DigitalOcean token': j('dop', '_v1_', 'ab'.repeat(32)),
    'Stripe webhook secret': j('whsec', '_', 'Zz9'.repeat(12)),
    'Anthropic API key': j('sk-', 'ant-', 'api03-', 'x'.repeat(30)),
  };
  for (const [type, value] of Object.entries(samples)) {
    const hits = scanText(`const k = "${value}";`);
    assert.ok(hits.some((h) => h.type === type), `${type} not detected`);
  }
  assert.equal(scanText('nothing interesting here, just text').length, 0);
});

test('inline kagicyber-ignore suppresses a line; low-entropy generic values are skipped', () => {
  assert.equal(scanText(`const a = "${FAKE.aws}"; // kagicyber-ignore`).length, 0);
  assert.equal(scanText('password = "aaaaaaaaaaaaaaaa"').length, 0);
});
