import { readdirSync, lstatSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, basename, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { scanText, CLIENT_ENV_SECRET } from './checks/secrets.js';
import { securityScore } from './score.js';
import { sortBySeverity } from './util.js';
import { fingerprint, readIgnoreFile } from './baseline.js';
import { VERSION } from './version.js';
import { deepRepoChecks } from './repo-deep.js';

const SKIP_DIRS = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.venv', 'venv', '__pycache__', 'vendor', '.cache', 'coverage', '.turbo', '.vercel', '.svelte-kit', '.nuxt', '.output', 'target']);
const MAX_FILE = 2_000_000;

/** `*` and `?` within one path segment, two-pointer match (no backtracking blow-up). */
function segMatch(p, s) {
  let i = 0;
  let j = 0;
  let star = -1;
  let mark = 0;
  while (j < s.length) {
    if (i < p.length && (p[i] === '?' || p[i] === s[j])) {
      i++;
      j++;
    } else if (i < p.length && p[i] === '*') {
      star = i++;
      mark = j;
    } else if (star !== -1) {
      i = star + 1;
      j = ++mark;
    } else return false;
  }
  while (i < p.length && p[i] === '*') i++;
  return i === p.length;
}

/**
 * Glob matcher for `path:` ignores: `**` spans path segments, `*` and `?` stay within one.
 * Memoised over (pattern segment, path segment), so a hostile ignore file cannot hang the scan
 * the way a backtracking regular expression can. Returns an object with a RegExp-like test().
 */
export function globToRe(g) {
  const pat = String(g).slice(0, 300).replace(/\\/g, '/').split('/').map((x) => (/^\*\*+$/.test(x) ? '**' : x.replace(/\*\*+/g, '*')));
  return {
    test(path) {
      const segs = String(path).split('/');
      const memo = new Map();
      const m = (pi, si) => {
        const k = pi * 100_000 + si;
        if (memo.has(k)) return memo.get(k);
        let r;
        if (pi === pat.length) r = si === segs.length;
        else if (pat[pi] === '**') r = m(pi + 1, si) || (si < segs.length && m(pi, si + 1));
        else r = si < segs.length && segMatch(pat[pi], segs[si]) && m(pi + 1, si + 1);
        memo.set(k, r);
        return r;
      };
      return m(0, 0);
    },
  };
}

const MAX_ENTRIES = 200_000;

/** Walk the tree without following symlinks or junctions (they can loop or point outside the project). */
function walk(dir, files = [], limit = 20000, root = dir, ignore = [], state = { entries: 0, excluded: 0 }) {
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const d of names) {
    if (files.length >= limit || ++state.entries > MAX_ENTRIES) break;
    const p = join(dir, d.name);
    const rel = relative(root, p).split(sep).join('/');
    if (ignore.some((re) => re.test(rel) || re.test(`${rel}/`))) {
      state.excluded++;
      continue;
    }
    if (d.isSymbolicLink()) continue;
    if (d.isDirectory()) {
      if (!SKIP_DIRS.has(d.name)) walk(p, files, limit, root, ignore, state);
    } else if (d.isFile()) {
      let st;
      try {
        st = lstatSync(p);
      } catch {
        continue;
      }
      if (st.size <= MAX_FILE) files.push(p);
    }
  }
  return files;
}

/** git options that stop a hostile .git/config from running programs (fsmonitor, textconv, gpg). */
export const SAFE_GIT = ['-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false'];

function gitTracked(root) {
  if (!existsSync(join(root, '.git'))) return null;
  try {
    return execFileSync('git', [...SAFE_GIT, '-C', root, 'ls-files'], { encoding: 'utf8', maxBuffer: 50_000_000 }).split('\n').filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Scan a project folder: secrets in the working tree and git history, public env variables, committed .env files,
 * source-map settings, dependencies, code patterns (SAST-lite), CI/CD and infrastructure as code.
 * @param {string} root
 * @param {{ignore?:string[], deep?:boolean}} opts  deep: false limits the scan to the working tree
 */
export function scanDirectory(root, { ignore = [], deep = true, repoIgnore = true } = {}) {
  const started = Date.now();
  // The scanned repository's own .kagicyberignore is honoured by default (it is the project's config),
  // but what it hides is reported, and CI can refuse it with --no-repo-ignore.
  const repoEntries = repoIgnore ? readIgnoreFile(join(root, '.kagicyberignore')) : [];
  const entries = [...repoEntries, ...ignore];
  const pathIgnores = entries.filter((e) => e.startsWith('path:')).map((e) => globToRe(e.slice(5).trim()));
  const idIgnores = new Set(entries.filter((e) => !e.startsWith('path:')));
  const walkState = { entries: 0, excluded: 0 };
  const files = walk(root, [], 20000, root, pathIgnores, walkState);
  const findings = [];
  const add = (severity, title, evidence, fix, cwe = 'CWE-798', file = null) => findings.push({ domain: 'X', severity, title, evidence, fix, cwe, owasp: 'Identification and Authentication Failures', effort: 'M', file });
  const secrets = [];
  for (const f of files) {
    let buf;
    try {
      buf = readFileSync(f);
    } catch {
      continue;
    }
    if (buf.subarray(0, 4096).includes(0)) continue;
    const text = buf.toString('utf8');
    const rel = relative(root, f);
    for (const h of scanText(text, rel)) secrets.push(h);
    if (/\.(js|jsx|ts|tsx|vue|svelte|mjs|cjs)$|^\.env/.test(basename(f))) {
      for (const name of new Set([...text.matchAll(CLIENT_ENV_SECRET)].map((m) => m[0]))) {
        const m = [name];
        add('high', `Secret-looking variable exposed to the browser: ${m[0]}`, `${rel}`, 'Variables with NEXT_PUBLIC_/VITE_/REACT_APP_ prefixes are compiled into public JavaScript. Rename it without the public prefix and use it server-side only.', 'CWE-200', rel);
      }
    }
    if (/^next\.config\./.test(basename(f)) && /productionBrowserSourceMaps\s*:\s*true/.test(text)) add('medium', 'Production source maps enabled (Next.js)', rel, 'Set productionBrowserSourceMaps: false.', 'CWE-540');
    if (/^vite\.config\./.test(basename(f)) && /sourcemap\s*:\s*true/.test(text)) add('medium', 'Production source maps enabled (Vite)', rel, "Set build.sourcemap to false or 'hidden'.", 'CWE-540');
    if (/webpack.*\.config\./.test(basename(f)) && /devtool\s*:\s*['"](source-map|eval-source-map|inline-source-map)['"]/.test(text)) add('low', 'Source maps configured in webpack', rel, 'Use no source maps or hidden-source-map in production.', 'CWE-540');
  }
  const seen = new Set();
  for (const s of secrets) {
    const k = `${s.type}|${s.value}`;
    if (seen.has(k)) continue;
    seen.add(k);
    findings.push({ domain: 'X', severity: s.severity, title: `${s.type} in source`, evidence: `${s.value} at ${s.source}:${s.line}${s.note ? `. ${s.note}` : ''}`, fix: s.severity === 'info' ? 'Public by design: verify restrictions.' : 'Rotate the credential, move it to a secret manager or server environment, and purge it from git history. Mark a false positive with a kagicyber-ignore comment on the line.', cwe: 'CWE-798', owasp: 'Identification and Authentication Failures', effort: 'M', key: 'secret', file: s.source, line: s.line });
  }
  const tracked = gitTracked(root);
  if (tracked) {
    const envs = tracked.filter((p) => /(^|\/)\.env(\.[\w-]+)?$/.test(p) && !/\.(example|sample|template|dist)$/.test(p));
    if (envs.length) findings.push({ domain: 'X', severity: 'high', title: 'Environment files committed to git', evidence: envs.slice(0, 5).join(', '), fix: 'Remove them from the repo (git rm --cached), add .env* to .gitignore, rotate every value inside, and purge history.', cwe: 'CWE-538', owasp: 'Security Misconfiguration', effort: 'M' });
    const gi = existsSync(join(root, '.gitignore')) ? readFileSync(join(root, '.gitignore'), 'utf8') : '';
    if (!/^\s*\.env/m.test(gi)) findings.push({ domain: 'X', severity: 'low', title: '.gitignore does not exclude .env files', evidence: '.gitignore has no .env pattern', fix: 'Add `.env*` and `!.env.example` to .gitignore.', cwe: 'CWE-538', owasp: 'Security Misconfiguration', effort: 'S' });
  }
  const notes = [];
  if (deep) {
    const d = deepRepoChecks(root);
    findings.push(...d.findings);
    notes.push(...d.notes);
  }
  const counters = {};
  for (const f of sortBySeverity(findings)) {
    counters[f.domain] = (counters[f.domain] || 0) + 1;
    f.id = `S-${f.domain}${String(counters[f.domain]).padStart(2, '0')}`;
  }
  for (const f of findings) {
    f.fingerprint = fingerprint('scan', `${f.title}|${f.file || ''}`, 'repo');
    if (idIgnores.has(f.fingerprint)) f.ignored = true;
  }
  const live = findings.filter((f) => !f.ignored);
  const { score, grade } = securityScore(live);
  return {
    tool: { name: 'kagicyber', version: VERSION },
    target: { path: root, files: files.length, git: !!tracked },
    durationMs: Date.now() - started,
    scores: { security: score, grade },
    security: { findings: sortBySeverity(live) },
    ignored: findings.filter((f) => f.ignored).map((f) => ({ title: f.title, fingerprint: f.fingerprint })),
    limitations: [
      ...notes,
      ...(walkState.excluded ? [`${walkState.excluded} path(s) excluded by path: ignore rules${repoEntries.some((e) => e.startsWith('path:')) ? " (including the scanned repository's own .kagicyberignore; use --no-repo-ignore to refuse it)" : ''}.`] : []),
      ...(walkState.entries > MAX_ENTRIES ? [`Stopped after ${MAX_ENTRIES} directory entries.`] : []),
      ...(deep ? [] : ['Working tree only (--quick): git history, dependencies, code patterns, CI/CD and infrastructure as code were not scanned.']),
      'Code patterns are candidate sinks: confirm that user input reaches each one before treating it as a vulnerability.',
    ],
  };
}
