import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureServer } from './helpers/server.js';
import { audit } from '../src/audit.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { renderTerminal } from '../src/report/terminal.js';
import { FAKE } from './helpers/fake-secrets.js';

let srv;
let r;
before(async () => {
  srv = await startFixtureServer();
  r = await audit(srv.url, { delayMs: 0 });
});
after(() => srv.server.close());

const check = (id) => r.compliance.checks.find((c) => c.id === id);
const seo = (id) => r.seo.checks.find((c) => c.id === id);
const has = (re) => r.security.findings.some((f) => re.test(f.title));

test('detects Poland and uses Polish penalties', () => {
  assert.equal(r.jurisdictions.list[0].code, 'PL');
  assert.equal(r.jurisdictions.list[0].confidence, 'high');
  assert.equal(r.penaltyJurisdiction, 'PL');
  assert.match(check('C-07').maxPenalty, /UKE/);
  assert.match(check('C-02').maxPenalty, /UODO/);
});

test('every compliance row carries a maximum penalty', () => {
  for (const c of r.compliance.checks) assert.ok(c.maxPenalty, `${c.id} has no penalty`);
});

test('operator identity found across homepage and contact page', () => {
  assert.equal(check('C-01').status, 'pass');
});

test('trackers without a consent banner fail the consent checks', () => {
  assert.equal(check('C-06').status, 'fail');
  assert.equal(check('C-07').status, 'fail');
  assert.equal(check('C-08').status, 'fail');
  assert.ok(r.inventory.trackers.some((t) => t.name === 'Meta Pixel'));
});

test('garbled privacy policy fails readability; content analysis finds gaps', () => {
  assert.equal(check('C-02').status, 'pass');
  assert.equal(check('C-03').status, 'fail');
  assert.match(check('C-03').evidence, /encoding/);
  assert.equal(check('C-04').status, 'partial');
  assert.match(check('C-04').evidence, /FormSubmit/);
});

test('embeds, forms, terms', () => {
  assert.equal(check('C-10').status, 'partial');
  assert.equal(check('C-11').status, 'pass');
  assert.equal(check('C-05').status, 'partial');
});

test('security findings from headers, cookies, bundles and maps', () => {
  assert.ok(has(/AWS access key ID exposed/));
  assert.ok(has(/Source maps are publicly downloadable/));
  assert.ok(has(/PHPSESSID/));
  assert.ok(has(/jQuery 1\.12\.4/));
  assert.ok(has(/FormSubmit CAPTCHA/));
  assert.ok(has(/versions disclosed/));
});

test('SEO and GEO checks', () => {
  assert.equal(seo('SEO-02').status, 'fail', 'no meta description');
  assert.equal(seo('SEO-10').status, 'fail', 'no JSON-LD');
  assert.equal(seo('SEO-12').status, 'fail', 'no sitemap');
  assert.equal(seo('SEO-13').status, 'pass', 'real 404');
  assert.equal(seo('GEO-03').status, 'partial', 'no llms.txt');
  assert.ok(r.scores.seo > 0 && r.scores.seo < 100);
});

test('tech detection', () => {
  const names = r.tech.map((t) => t.name);
  assert.ok(names.includes('WordPress'));
  assert.ok(names.includes('nginx'));
  assert.match(r.stack, /WordPress 6\.1\.1/);
});

test('no secret is ever printed in full', () => {
  const json = JSON.stringify(r);
  const md = renderMarkdown(r);
  for (const s of [FAKE.aws, FAKE.google, FAKE.supabaseAnon]) {
    assert.ok(!json.includes(s), 'JSON leaks a secret');
    assert.ok(!md.includes(s), 'Markdown leaks a secret');
  }
});

test('report layout: overview, three scores, sections in order, no emoji or long dashes', () => {
  const md = renderMarkdown(r);
  const order = ['## Overview', '### Scores', '## 1. Compliance', '## 2. Security', '## 3. SEO and GEO', '## 4. Priorities', '## 5. Fix prompt', '## 6. Limitations'];
  let last = -1;
  for (const h of order) {
    const i = md.indexOf(h);
    assert.ok(i > last, `${h} missing or out of order`);
    last = i;
  }
  assert.match(md, /1\. \*\*Compliance:\*\* \d+\/100/);
  assert.match(md, /2\. \*\*Security:\*\* \d+\/100/);
  assert.match(md, /3\. \*\*SEO\/GEO:\*\* \d+\/100/);
  assert.match(md, /\| Max penalty \|/);
  assert.ok(!/\| Fix \|/.test(md), 'no per-row fix column');
  assert.ok(!/Scorecard/.test(md));
  for (const out of [md, renderTerminal(r)]) {
    const template = out.replace(/"[^"\n]*"/g, '""'); // quoted site content may contain anything
    assert.ok(!/\p{Extended_Pictographic}/u.test(template), 'emoji found');
    assert.ok(!/[\u2013\u2014]/.test(template), 'long dash found');
  }
  assert.match(md, /kagicyber\.com/);
});

test('consent-gated scripts pass C-07; a CMP seen only in the code leaves C-06 unverified', async () => {
  const r2 = await audit(`${srv.url}consent.html`, { delayMs: 0 });
  const c = (id) => r2.compliance.checks.find((x) => x.id === id);
  // Without a browser the reject button on the first layer is not verified, so C-06 must not PASS.
  assert.equal(c('C-06').status, 'manual');
  assert.match(c('C-06').evidence, /--browser/);
  assert.equal(c('C-07').status, 'pass');
});

test('an error page is not audited', async () => {
  await assert.rejects(audit(`${srv.url}no-such-page`, { delayMs: 0 }), /returned HTTP 404/);
});

test('requests lost to the budget are never scored as PASS', async () => {
  // Budget 1: only the homepage is fetched, every other probe is skipped.
  const r3 = await audit(srv.url, { delayMs: 0, maxRequests: 1 });
  const all = [...r3.compliance.checks, ...r3.seo.checks];
  const row = (id) => all.find((x) => x.id === id);
  for (const id of ['SEO-12', 'SEO-13', 'SEO-15', 'GEO-01', 'GEO-03']) assert.notEqual(row(id).status, 'pass', id);
  for (const id of ['SEO-13', 'GEO-01']) assert.equal(row(id).status, 'manual', id);
  assert.notEqual(row('C-07').status, 'pass');
  assert.ok(r3.limitations.some((l) => /request budget/.test(l)));
});
