import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseHtml } from '../src/html.js';
import { htmlToText, decodeEntities, truncate } from '../src/util.js';
import { scanText, maskSecretsIn } from '../src/checks/secrets.js';
import { globToRe, scanDirectory } from '../src/scan.js';
import { renderJunit } from '../src/report/junit.js';
import http from 'node:http';
import { audit } from '../src/audit.js';
import { renderMarkdown } from '../src/report/markdown.js';
import { renderHtml } from '../src/report/html.js';
import { renderFixPrompt } from '../src/report/prompt.js';
import { renderTerminal } from '../src/report/terminal.js';
import { renderSarif } from '../src/report/sarif.js';
import { FAKE } from './helpers/fake-secrets.js';

const fast = (label, fn, ms = 1500) => {
  const t = Date.now();
  fn();
  assert.ok(Date.now() - t < ms, `${label} took ${Date.now() - t} ms`);
};

test('hostile HTML stays linear (no ReDoS)', () => {
  fast('doctype comments', () => parseHtml(`${'<!---->'.repeat(40)}x`, 'https://a.example/'));
  fast('unterminated meta', () => parseHtml('<meta'.repeat(40_000), 'https://a.example/'));
  fast('unterminated script', () => htmlToText('<script'.repeat(40_000)));
  fast('unterminated script in parse', () => parseHtml('<script>'.repeat(40_000), 'https://a.example/'));
  // Every tag the parser extracts, unterminated or unclosed. `<div id="root"` used to run for minutes.
  for (const t of ['<link', '<img', '<a', '<a>', '<form>', '<h2>', '<label>', '<input', '<title>', '<body>', '<svg', '<head', '<div id="root"', '<div id="root">']) {
    fast(`unterminated ${t}`, () => parseHtml(t.repeat(40_000), 'https://a.example/'));
  }
  fast('unterminated tags in text', () => htmlToText('<x'.repeat(40_000)));
  fast('connection URL', () => scanText('postgres://a:'.repeat(50_000), 'x.js'));
  fast('JWT', () => scanText('eyJaaaaaaaaa.'.repeat(50_000), 'x.js'));
  fast('glob', () => globToRe(`${'*a'.repeat(14)}*b`).test('a'.repeat(40)));
});

test('the doctype is still recognised after comments', () => {
  assert.equal(parseHtml('<!-- a --> <!-- b -->\n<!DOCTYPE html><title>x</title>', 'https://a.example/').doctype, true);
  assert.equal(parseHtml('<html><title>x</title>', 'https://a.example/').doctype, false);
});

test('control characters and invalid character references are neutralised', () => {
  assert.equal(decodeEntities('a&#27;]0;PWNED&#7;b'), 'a]0;PWNEDb');
  assert.equal(decodeEntities('x&#99999999;y&#xD800;z'), 'x�y�z');
  assert.ok(!truncate('\u001b[2Jhello').includes('\u001b'));
  const xml = renderJunit({ security: { findings: [{ id: 'S-X01', title: 'a\u001bb', severity: 'high', evidence: '\u0007' }] } });
  assert.ok(!xml.includes('\u001b') && !xml.includes('\u0007'));
});

test('maskSecretsIn masks every recognised secret in free text', () => {
  const s = `key=${FAKE.aws} and ${FAKE.stripeLive}`;
  const out = maskSecretsIn(s);
  assert.ok(!out.includes(FAKE.aws) && !out.includes(FAKE.stripeLive), out);
  assert.match(out, /len 20/);
});

test('no output format contains a raw secret from the page, its headers or its links', async (t) => {
  const page = `<!doctype html><html lang="en"><head><title>Shop ${FAKE.aws}</title><meta name="description" content="key ${FAKE.stripeLive}"></head>
<body><p>Our key is ${FAKE.aws}.</p><a href="/privacy?access_token=${FAKE.github}">Privacy policy</a><script src="/app.js"></script></body></html>`;
  const srv = http.createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html', 'x-api-key': FAKE.aws, 'set-cookie': [`session=${FAKE.stripeLive}; HttpOnly`] });
      return res.end(page);
    }
    if (req.url === '/app.js') return res.end(`var k="${FAKE.aws}";`);
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end(`not found ${FAKE.github}`);
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  t.after(() => srv.close());
  const r = await audit(`http://127.0.0.1:${srv.address().port}/`, { delayMs: 0 });
  const outputs = { json: JSON.stringify(r), md: renderMarkdown(r), html: renderHtml(r), prompt: renderFixPrompt(r), terminal: renderTerminal(r, { verbose: true }), sarif: JSON.stringify(renderSarif(r)), junit: renderJunit(r) };
  for (const [name, text] of Object.entries(outputs)) {
    for (const v of [FAKE.aws, FAKE.stripeLive, FAKE.github]) assert.ok(!text.includes(v), `${name} contains a raw secret`);
  }
});

test('glob ignores keep their meaning', () => {
  assert.equal(globToRe('dist/**').test('dist/a/b.js'), true);
  assert.equal(globToRe('dist/**').test('dist/'), true);
  assert.equal(globToRe('dist/**').test('src/dist.js'), false);
  assert.equal(globToRe('**/*.min.js').test('a/b/c.min.js'), true);
  assert.equal(globToRe('*.md').test('docs/a.md'), false);
});

test('scan does not follow symlinks out of the tree', (t) => {
  const base = mkdtempSync(join(tmpdir(), 'kc-link-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const outside = join(base, 'outside');
  const repo = join(base, 'repo');
  mkdirSync(outside);
  mkdirSync(repo);
  writeFileSync(join(outside, 'creds.js'), `const k = "${FAKE.stripeLive}";`);
  writeFileSync(join(repo, 'app.js'), 'console.log(1);');
  try {
    symlinkSync(outside, join(repo, 'link'), 'junction');
    symlinkSync(repo, join(repo, 'loop'), 'junction');
  } catch (e) {
    t.skip(`cannot create links here: ${e.code}`);
    return;
  }
  const r = scanDirectory(repo, { deep: false });
  assert.equal(r.security.findings.filter((f) => /Stripe|secret/i.test(f.title)).length, 0);
  assert.equal(r.target.files, 1);
});
