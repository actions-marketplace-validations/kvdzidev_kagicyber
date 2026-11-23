import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startFixtureServer } from './helpers/server.js';
import { audit } from '../src/audit.js';
import { allRules, jurisdictionModules } from '../src/law/rules.js';
import { ruleCatalog } from '../src/law/catalog.js';
import { COVERED_BY_CORE, rx } from '../src/law/evaluate.js';
import { renderHtml } from '../src/report/html.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { FAKE } from './helpers/fake-secrets.js';

let srv;
let r;
before(async () => {
  srv = await startFixtureServer();
  r = await audit(srv.url, { delayMs: 0 });
});
after(() => srv.server.close());
const rule = (res, id) => res.compliance.sets.flatMap((s) => s.results).find((x) => x.id === id);

test('every rule is well formed', () => {
  const all = allRules();
  const ids = all.map((x) => x.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate rule IDs');
  for (const x of all) {
    assert.ok(x.title && x.basis && x.fix, `${x.id} lacks title, basis or fix`);
    assert.ok([1, 2, 3].includes(x.weight), `${x.id} weight`);
    const pats = [...(x.check.patterns || []), ...(x.check.groups || []).map((g) => g[1]), x.trigger, x.check.pattern].filter(Boolean);
    for (const p of pats) assert.doesNotThrow(() => rx(p), `${x.id}: bad regex ${p}`);
    for (const t of [x.title, x.basis, x.fix]) assert.ok(!/[\u2013\u2014]|\p{Extended_Pictographic}/u.test(t), `${x.id}: long dash or emoji`);
  }
});

test('company forms, IDs and triggers do not match ordinary words', () => {
  const byId = Object.fromEntries(allRules().map((x) => [x.id, x]));
  const matches = (id, s, part = 'pattern') => {
    const x = byId[id];
    const p = part === 'trigger' ? x.trigger : x.check.patterns[0];
    return rx(p).test(s);
  };
  assert.equal(matches('EU-A1a', 'Limited edition prints, but not limited to posters. Reply a.s.a.p.'), false);
  assert.equal(matches('EU-A1a', 'Example Studio GmbH, Berlin'), true);
  assert.equal(matches('EU-A1a', 'Przykład sp. z o.o.'), true);
  assert.equal(matches('EU-A1e', 'No VAT. Opening hours 9 to 5'), false);
  assert.equal(matches('EU-A1e', 'VAT ID: DE123456789'), true);
  assert.equal(matches('DE-02', 'Paket bis 5 kg, versandkostenfrei', 'trigger'), false);
  assert.equal(matches('DE-02', 'Beispiel GmbH & Co. KG', 'trigger'), true);
  assert.equal(matches('PL-05', 'Shipping to the U.S.A. and Canada', 'trigger'), false);
  assert.equal(matches('PL-04', 'numer KRS: w trakcie rejestracji'), false);
  assert.equal(matches('PL-04', 'KRS 0000123456, Sąd Rejonowy'), true);
});

test('rule catalog lists every module', () => {
  const cat = ruleCatalog();
  assert.ok(cat.totalRules > 250);
  assert.ok(cat.jurisdictionsCovered >= 50);
  assert.equal(cat.jurisdictions.PL.rules, jurisdictionModules().PL.length);
});

test('EU extended checklist and Poland are applied, without restating core checks', () => {
  assert.deepEqual(r.compliance.sets.map((s) => s.code), ['EU', 'PL']);
  const ids = r.compliance.sets.flatMap((s) => s.results.map((x) => x.id));
  for (const covered of Object.keys(COVERED_BY_CORE)) assert.ok(!ids.includes(covered), `${covered} duplicates a core check`);
  assert.ok(!r.compliance.sets.flatMap((s) => s.results).some((x) => /^C-\d/.test(x.evidence)), 'no mirrored core rows');
  assert.match(r.compliance.checks.find((c) => c.id === 'C-07').nationalBasis.join(' '), /Poland: .*399/);
});

test('country rules evaluate against the evidence', () => {
  assert.equal(rule(r, 'PL-01').status, 'pass');
  assert.equal(rule(r, 'PL-04').status, 'fail');
  assert.equal(rule(r, 'EU-A1a').status, 'pass');
  for (const x of r.compliance.sets.flatMap((s) => s.results)) assert.ok(x.maxPenalty, `${x.id} has no max penalty`);
  assert.ok(r.scores.compliance !== r.scores.complianceCore, 'overall score includes the extra rule sets');
});

test('forcing a site type and an extra jurisdiction', async () => {
  const r2 = await audit(srv.url, { delayMs: 0, siteTypes: ['shop'], include: ['DE'] });
  const codes = r2.compliance.sets.map((s) => s.code);
  assert.ok(codes.includes('type:shop') && codes.includes('DE'));
  assert.ok(rule(r2, 'SHOP-02'));
  assert.ok(rule(r2, 'PL-09'), 'shop-only Polish rule appears');
});

test('fix pack is tailored to the site', () => {
  const titles = r.fixPack.map((f) => f.title);
  assert.ok(titles.some((t) => t.startsWith('Security headers')));
  assert.ok(titles.includes('Block trackers until consent'));
  assert.match(r.fixPack.find((f) => f.title === 'Privacy notice under forms').code, /Administratorem danych/);
});

test('HTML and Markdown reports render every set and never leak secrets', () => {
  const html = renderHtml(r);
  const md = renderMarkdown(r);
  assert.match(html, /<html lang="en">/);
  assert.ok(!html.includes('<script'), 'HTML report is script-free');
  for (const s of ['### EU baseline', '### European Union (extended checklist)', '### Poland', '## 5. Fix prompt']) assert.ok(md.includes(s), s);
  for (const s of [FAKE.aws, FAKE.google]) assert.ok(!html.includes(s) && !md.includes(s) && !JSON.stringify(r).includes(s));
  const template = html.replace(/"[^"\n]*"/g, '""');
  assert.ok(!/[\u2013\u2014]/.test(template), 'long dash in HTML');
});
