import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../src/version.js';

// Release invariants: a published package that breaks one of these does not work for someone.
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const pkg = json('package.json');

function jsFiles(dir) {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? jsFiles(p) : p.endsWith('.js') ? [p] : [];
  });
}

test('one version everywhere', () => {
  const plugin = json('.claude-plugin/plugin.json');
  const market = json('.claude-plugin/marketplace.json');
  assert.equal(VERSION, pkg.version, 'src/version.js');
  assert.equal(plugin.version, pkg.version, '.claude-plugin/plugin.json');
  assert.equal(market.plugins[0].version, pkg.version, '.claude-plugin/marketplace.json');
  assert.equal(market.plugins[0].name, plugin.name, 'marketplace entry name must match the plugin name');
  assert.match(read('CHANGELOG.md'), new RegExp(`^## \\[${pkg.version.replace(/\./g, '\\.')}\\]`, 'm'), 'CHANGELOG entry');
});

test('the bin starts with an LF shebang', () => {
  const bin = pkg.bin.kagicyber;
  assert.ok(existsSync(join(ROOT, bin)), bin);
  assert.ok(read(bin).startsWith('#!/usr/bin/env node\n'), 'a CRLF or missing shebang breaks npx on Linux and macOS');
});

test('zero runtime dependencies, only optional peers', () => {
  assert.equal(Object.keys(pkg.dependencies || {}).length, 0);
  for (const name of Object.keys(pkg.peerDependencies || {})) assert.equal(pkg.peerDependenciesMeta?.[name]?.optional, true, `${name} must stay optional`);
});

test('shipped code imports only Node built-ins and its own files', () => {
  const optional = new Set(['playwright', 'playwright-core']);
  for (const file of [...jsFiles('src'), ...jsFiles('bin')]) {
    const code = read(file);
    for (const m of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\(\s*['"]([^'"]+)['"]\s*\)/g)) {
      const spec = m[1] || m[2];
      assert.ok(spec.startsWith('node:') || spec.startsWith('.') || optional.has(spec), `${relative(ROOT, join(ROOT, file))} imports "${spec}"`);
    }
  }
});

test('every entry in "files" exists', () => {
  for (const f of pkg.files) {
    const p = join(ROOT, f);
    assert.ok(existsSync(p), f);
    if (f.endsWith('/')) assert.ok(statSync(p).isDirectory(), f);
  }
});

test('the skill uses portable frontmatter and points at this release', () => {
  const dir = 'skills/kagicyber-audit';
  const md = read(`${dir}/SKILL.md`);
  const fm = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(fm, 'SKILL.md must start with a frontmatter block on line 1');
  const keys = [...fm[1].matchAll(/^([a-z][\w-]*):/gm)].map((m) => m[1]);
  // Keys outside this list make the skill fail to upload to claude.ai or the Skills API.
  for (const k of keys) assert.ok(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'].includes(k), `non-portable key ${k}`);
  const name = fm[1].match(/^name:\s*(.+)$/m)?.[1].trim();
  assert.equal(name, 'kagicyber-audit', 'name must match the folder name');
  const description = fm[1].match(/^description:\s*"?(.+?)"?$/m)?.[1] || '';
  assert.ok(description.length > 0 && description.length <= 1024, `description length ${description.length}`);
  assert.ok(md.split('\n').length < 500, 'keep SKILL.md under 500 lines');
  const major = pkg.version.split('.')[0];
  assert.ok(md.includes(`kagicyber@${major}`), `npm fallback should pin kagicyber@${major}`);
  assert.ok(md.includes(`#v${pkg.version}`), `GitHub fallback should name the v${pkg.version} tag`);
});
