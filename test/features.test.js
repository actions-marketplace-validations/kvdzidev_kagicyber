import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { startFixtureServer } from './helpers/server.js';
import { audit } from '../src/audit.js';
import { Fetcher, retryAfterMs } from '../src/http.js';
import { renderSarif } from '../src/report/sarif.js';
import { renderJunit } from '../src/report/junit.js';
import { robotsBlocks } from '../src/checks/seo.js';
import { maxPenalty } from '../src/penalties.js';
import { exitCode } from '../src/cli.js';

test('fetcher: identical GETs are coalesced', async () => {
  let hits = 0;
  const srv = http.createServer((req, res) => {
    hits++;
    setTimeout(() => res.end('ok'), 50);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const f = new Fetcher({ delayMs: 0 });
  const u = `http://127.0.0.1:${srv.address().port}/x`;
  const [a, b] = await Promise.all([f.get(u), f.get(u)]);
  assert.equal(a.body, 'ok');
  assert.equal(b.body, 'ok');
  assert.equal(hits, 1);
  srv.close();
});

test('fetcher: 429 with Retry-After is retried once', async () => {
  let n = 0;
  const srv = http.createServer((req, res) => {
    n++;
    if (n === 1) {
      res.writeHead(429, { 'retry-after': '0' });
      return res.end();
    }
    res.end('fine');
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const r = await new Fetcher({ delayMs: 0 }).get(`http://127.0.0.1:${srv.address().port}/`);
  assert.equal(r.status, 200);
  assert.equal(n, 2);
  assert.equal(retryAfterMs('120'), 120000);
  srv.close();
});

test('fetcher: per-host concurrency cap holds', async () => {
  let active = 0;
  let peak = 0;
  const srv = http.createServer((req, res) => {
    active++;
    peak = Math.max(peak, active);
    setTimeout(() => {
      active--;
      res.end('x');
    }, 40);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const f = new Fetcher({ profile: 'balanced', delayMs: 0 });
  const base = `http://127.0.0.1:${srv.address().port}`;
  await Promise.all(Array.from({ length: 20 }, (_, i) => f.get(`${base}/${i}`)));
  assert.ok(peak <= 6, `peak ${peak}`);
  assert.ok(peak > 1, 'requests should overlap');
  srv.close();
});

test('robots.txt evaluation for AI crawlers', () => {
  const txt = 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n';
  assert.equal(robotsBlocks(txt, 'GPTBot'), true);
  assert.equal(robotsBlocks(txt, 'OAI-SearchBot'), false);
  assert.equal(robotsBlocks('User-agent: *\nDisallow: /', 'Googlebot'), true);
});

test('penalties: national override and EU fallback', () => {
  assert.match(maxPenalty('trackers-before-consent', 'DE'), /TDDDG/);
  assert.match(maxPenalty('privacy-content', 'SE'), /GDPR art\. 83\(5\)/);
  assert.match(maxPenalty('operator-identity', 'FR'), /375,000/);
});

test('SARIF, JUnit, baseline, ignores and CI exit codes', async () => {
  const srv = await startFixtureServer();
  const r1 = await audit(srv.url, { delayMs: 0 });
  const sarif = renderSarif(r1);
  assert.equal(sarif.version, '2.1.0');
  assert.ok(sarif.runs[0].results.some((x) => x.ruleId.startsWith('kagicyber/security/') && x.level === 'error'));
  assert.ok(sarif.runs[0].results.some((x) => x.ruleId === 'kagicyber/compliance/C-07'));
  assert.ok(sarif.runs[0].results.every((x) => x.partialFingerprints.kagicyber));
  const junit = renderJunit(r1);
  assert.match(junit, /<testsuite name="Compliance"/);
  assert.match(junit, /<failure/);

  const r2 = await audit(srv.url, { delayMs: 0, baseline: r1, ignore: ['C-14', 'SEO-21'] });
  assert.equal(r2.baseline.new.length, 0, 'same site, nothing new');
  assert.ok(r2.compliance.checks.find((c) => c.id === 'C-14').ignored);
  assert.deepEqual(r2.ignored.map((i) => i.id).sort(), ['C-14', 'SEO-21']);
  assert.equal(exitCode(r2, { 'fail-on': 'high' }), 0, 'no new findings with a baseline');
  assert.equal(exitCode(r1, { 'fail-on': 'high' }), 1);
  srv.server.close();
});
