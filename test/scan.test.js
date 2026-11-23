import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanDirectory } from '../src/scan.js';
import { FAKE } from './helpers/fake-secrets.js';

test('scan finds secrets, public env vars and source-map settings', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kc-'));
  try {
    mkdirSync(join(dir, 'src'));
    writeFileSync(join(dir, 'src', 'pay.js'), `const k = "${FAKE.stripeLive}";`);
    const publicSecretVar = ['NEXT', 'PUBLIC', 'SUPABASE', 'SERVICE', 'ROLE', 'KEY'].join('_');
    writeFileSync(join(dir, '.env.local'), `${publicSecretVar}=x\n`);
    writeFileSync(join(dir, 'next.config.js'), 'module.exports = { productionBrowserSourceMaps: true }');
    mkdirSync(join(dir, 'node_modules'));
    writeFileSync(join(dir, 'node_modules', 'ignored.js'), `"${FAKE.github}"`);
    const r = scanDirectory(dir);
    const titles = r.security.findings.map((f) => f.title);
    assert.ok(titles.some((t) => t.startsWith('Live secret key')));
    assert.ok(titles.some((t) => t.includes(publicSecretVar)));
    assert.ok(titles.some((t) => t.includes('source maps')));
    assert.ok(!titles.some((t) => t.startsWith('GitHub token')), 'node_modules must be skipped');
    assert.equal(r.scores.grade, 'F');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
