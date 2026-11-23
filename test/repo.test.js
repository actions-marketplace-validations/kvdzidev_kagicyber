import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanDirectory } from '../src/scan.js';
import { FAKE } from './helpers/fake-secrets.js';

test('repository scan: history, SAST-lite, CI/CD, IaC', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-'));
  try {
    const git = (...a) => execFileSync('git', ['-C', dir, ...a], { stdio: 'ignore' });
    git('init', '-q');
    git('config', 'user.email', 't@t');
    git('config', 'user.name', 't');
    writeFileSync(join(dir, 'config.js'), `module.exports = { key: "${FAKE.stripeLive}" };`);
    git('add', '.');
    git('commit', '-qm', 'add key');
    writeFileSync(join(dir, 'config.js'), 'module.exports = { key: process.env.STRIPE_KEY };');
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'api.js'), "app.get('/u', (req, res) => db.query(`SELECT * FROM users WHERE id = ${req.query.id}`));\nres.redirect(req.query.next);\n");
    mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
    writeFileSync(join(dir, '.github', 'workflows', 'ci.yml'), 'on: [push]\njobs:\n  t:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: some/action@v1\n');
    writeFileSync(join(dir, 'Dockerfile'), 'FROM node:latest\nENV API_TOKEN=abc123\nCOPY . .\n');
    git('add', '.');
    git('commit', '-qm', 'fix');
    const r = scanDirectory(dir);
    const t = r.security.findings.map((f) => f.title);
    assert.ok(r.security.findings.every((f) => /^S-[A-Z]\d{2}$/.test(f.id)), 'stable IDs');
    const quick = scanDirectory(dir, { deep: false }).security.findings.map((f) => f.title);
    assert.ok(!quick.some((x) => x.includes('in git history')), '--quick skips history');
    assert.ok(t.some((x) => x.includes('in git history')), 'secret in history');
    assert.ok(t.some((x) => x.startsWith('SQL built from string')), 'sql');
    assert.ok(t.some((x) => x.startsWith('Redirect to a user-supplied URL')), 'redirect');
    assert.ok(t.includes('Workflow without a permissions block'));
    assert.ok(t.includes('Third-party actions not pinned to a commit SHA'));
    assert.ok(t.includes('Container runs as root'));
    assert.ok(t.includes('Secret baked into the image (ENV/ARG)'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
