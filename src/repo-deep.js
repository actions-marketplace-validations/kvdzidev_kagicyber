import { readdirSync, lstatSync, readFileSync, existsSync, mkdtempSync, copyFileSync, rmSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { scanText } from './checks/secrets.js';
import { spawnNpm } from './util.js';

const SKIP = new Set(['.git', 'node_modules', '.next', 'dist', 'build', 'out', '.venv', 'venv', '__pycache__', 'vendor', '.cache', 'coverage', '.turbo', '.nuxt', '.output', 'target']);
const CODE = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.vue', '.svelte', '.py', '.php', '.rb', '.go', '.java', '.kt', '.cs']);

/** Walk without following symlinks or junctions, with an entry cap. */
function walk(dir, out = [], state = { n: 0 }) {
  let names;
  try {
    names = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const d of names) {
    if (++state.n > 200_000 || out.length >= 20_000) break;
    if (d.isSymbolicLink()) continue;
    const p = join(dir, d.name);
    if (d.isDirectory()) {
      if (!SKIP.has(d.name)) walk(p, out, state);
    } else if (d.isFile()) {
      try {
        if (lstatSync(p).size < 1_500_000) out.push(p);
      } catch {}
    }
  }
  return out;
}

const f = (severity, title, evidence, fix, cwe, owasp, effort = 'M') => ({ domain: 'R', severity, title, evidence, fix, cwe, owasp, effort });

/**
 * SAST-lite: candidate sinks; each needs a human to confirm that user input reaches it.
 * The pattern lines below match themselves, so they carry kagicyber-ignore comments for `kagicyber scan .` on this repository.
 */
const SAST = [
  [/dangerouslySetInnerHTML|v-html=|\.innerHTML\s*=|document\.write\(|\$sce\.trustAsHtml/, 'medium', 'Potential XSS sink', 'CWE-79', 'Injection', 'Render user content as text or sanitise it (DOMPurify).'], // kagicyber-ignore
  [/\beval\(|new Function\(/, 'medium', 'Dynamic code execution (eval / new Function)', 'CWE-94', 'Injection', 'Remove eval/new Function; parse data with JSON.parse.'],
  [/child_process\.(exec|execSync)\(|subprocess\.\w+\([^)]*shell\s*=\s*True|os\.system\(|shell_exec\(|passthru\(/, 'high', 'Shell command execution', 'CWE-78', 'Injection', 'Use execFile/spawn with an argument array and validate input.'],
  [/(query|execute|raw)\(\s*[`'"][^`'"]*\b(SELECT|INSERT|UPDATE|DELETE)\b[^`'"]*(\$\{|['"]\s*\+)/i, 'high', 'SQL built from string concatenation', 'CWE-89', 'Injection', 'Use parameterised queries / prepared statements.'],
  [/\$where\s*:/, 'medium', 'MongoDB $where operator', 'CWE-943', 'Injection', 'Avoid $where; use query operators.'],
  [/pickle\.loads?\(|yaml\.load\((?![^)]*SafeLoader)|\bunserialize\(\s*\$_(GET|POST|REQUEST|COOKIE)/, 'high', 'Unsafe deserialisation', 'CWE-502', 'Software and Data Integrity Failures', 'Use safe loaders (yaml.safe_load, JSON).'],
  [/(fetch|axios\.get|requests\.get|http\.get)\(\s*(req\.(query|body|params)|request\.(args|form|GET|POST))/, 'high', 'Server-side request to a user-supplied URL (SSRF)', 'CWE-918', 'Server-Side Request Forgery', 'Validate the URL against an allow-list and block private IP ranges.'],
  [/res\.redirect\(\s*req\.(query|body|params)/, 'medium', 'Redirect to a user-supplied URL', 'CWE-601', 'Broken Access Control', 'Redirect only to relative paths or an allow-list.'],
  [/(readFile|createReadStream|sendFile|open)\(\s*[^)]*req\.(query|params|body)/, 'high', 'File path from request parameters (path traversal)', 'CWE-22', 'Broken Access Control', 'Resolve against a base directory and reject "..".'],
  [/createHash\(\s*['"](md5|sha1)['"]\)[\s\S]{0,80}password|hashlib\.(md5|sha1)\([^)]*password|md5\(\s*\$_?password/i, 'high', 'Weak password hashing (MD5/SHA-1)', 'CWE-916', 'Cryptographic Failures', 'Use bcrypt, scrypt or Argon2.'],
  [/Math\.random\(\)[\s\S]{0,60}(token|secret|password|otp|code)/i, 'medium', 'Math.random() used for security tokens', 'CWE-330', 'Cryptographic Failures', 'Use crypto.randomBytes / crypto.randomUUID.'], // kagicyber-ignore
  [/jwt\.decode\(|algorithms\s*[:=]\s*\[?\s*['"]none['"]/, 'medium', 'JWT decoded without verification / alg none', 'CWE-347', 'Identification and Authentication Failures', 'Use jwt.verify with an explicit algorithm list.'],
  [/verify\s*=\s*False|rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['"]?0|InsecureSkipVerify:\s*true/, 'high', 'TLS certificate verification disabled', 'CWE-295', 'Cryptographic Failures', 'Keep certificate verification on; trust a private CA explicitly if needed.'], // kagicyber-ignore
  [/csrf_exempt|csrf\s*:\s*false|->withoutMiddleware\(.*VerifyCsrfToken/, 'medium', 'CSRF protection disabled', 'CWE-352', 'Broken Access Control', 'Keep CSRF protection on for state-changing routes.'], // kagicyber-ignore
  [/DEBUG\s*=\s*True|APP_DEBUG\s*=\s*true/, 'medium', 'Debug mode enabled in configuration', 'CWE-489', 'Security Misconfiguration', 'Disable debug in production.'],
];

export function sastLite(root, files) {
  const out = [];
  const seen = new Map();
  for (const p of files.filter((x) => CODE.has(extname(x)) || /\.env|settings\.py$/.test(x))) {
    const rel = relative(root, p);
    if (/(^|\/)(test|tests|__tests__|spec|fixtures?)\//i.test(rel) || /\.(test|spec)\./.test(rel)) continue;
    const text = readFileSync(p, 'utf8');
    const lines = text.split('\n');
    for (const [re, sev, title, cwe, owasp, fix] of SAST) {
      // First match whose line does not carry a `kagicyber-ignore` comment.
      const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
      let line = 0;
      for (const m of text.matchAll(global)) {
        const n = text.slice(0, m.index).split('\n').length;
        if (!/kagicyber-ignore/.test(lines[n - 1] || '')) {
          line = n;
          break;
        }
      }
      if (!line) continue;
      const list = seen.get(title) || [];
      list.push(`${rel}:${line}`);
      seen.set(title, list);
      if (list.length === 1) out.push(f(sev, `${title} (candidate)`, '', `${fix} Confirm whether user input reaches this code.`, cwe, owasp));
    }
  }
  for (const item of out) {
    const locs = seen.get(item.title.replace(' (candidate)', ''));
    item.evidence = `${locs.slice(0, 4).join(', ')}${locs.length > 4 ? ` (+${locs.length - 4} more)` : ''}`;
  }
  return out;
}

export function cicd(root) {
  const out = [];
  const dir = join(root, '.github', 'workflows');
  if (!existsSync(dir)) return out;
  for (const n of readdirSync(dir).filter((x) => /\.ya?ml$/.test(x))) {
    const t = readFileSync(join(dir, n), 'utf8');
    const rel = `.github/workflows/${n}`;
    if (/pull_request_target/.test(t) && /ref:\s*\$\{\{\s*github\.event\.pull_request\.head/.test(t)) out.push(f('high', 'pull_request_target checks out untrusted PR code', rel, 'Never check out the PR head in pull_request_target workflows with secrets.', 'CWE-829', 'Software and Data Integrity Failures'));
    if (!/^\s*permissions:/m.test(t)) out.push(f('medium', 'Workflow without a permissions block', rel, 'Add `permissions: contents: read` (least privilege) at the top level.', 'CWE-250', 'Security Misconfiguration', 'S'));
    if (/permissions:\s*write-all/.test(t)) out.push(f('medium', 'Workflow grants write-all permissions', rel, 'Grant only the scopes the job needs.', 'CWE-250', 'Security Misconfiguration', 'S'));
    const unpinned = [...t.matchAll(/uses:\s*([\w.-]+\/[\w./-]+)@([\w.-]+)/g)].filter((m) => !/^actions\//.test(m[1]) && !/^[0-9a-f]{40}$/.test(m[2]));
    if (unpinned.length) out.push(f('low', 'Third-party actions not pinned to a commit SHA', `${rel}: ${unpinned.slice(0, 3).map((m) => `${m[1]}@${m[2]}`).join(', ')}`, 'Pin third-party actions to a full commit SHA.', 'CWE-829', 'Software and Data Integrity Failures', 'S'));
    if (/echo\s+.*\$\{\{\s*secrets\./.test(t)) out.push(f('high', 'Secret echoed in a workflow step', rel, 'Never print secrets; pass them via env and mask them.', 'CWE-532', 'Security Misconfiguration', 'S'));
  }
  return out;
}

export function iac(root, files) {
  const out = [];
  for (const p of files) {
    const n = basename(p);
    const rel = relative(root, p);
    if (/^Dockerfile/.test(n)) {
      const t = readFileSync(p, 'utf8');
      if (!/^\s*USER\s+(?!root)/m.test(t)) out.push(f('medium', 'Container runs as root', rel, 'Add a non-root USER.', 'CWE-250', 'Security Misconfiguration', 'S'));
      if (/^\s*FROM\s+\S+:latest|^\s*FROM\s+[^:\s]+\s*$/m.test(t)) out.push(f('low', 'Base image not pinned (latest)', rel, 'Pin the base image to a version or digest.', 'CWE-1104', 'Vulnerable and Outdated Components', 'S'));
      if (/^\s*(ENV|ARG)\s+\w*(SECRET|PASSWORD|TOKEN|API_KEY)\w*\s*=?\s*\S+/im.test(t)) out.push(f('high', 'Secret baked into the image (ENV/ARG)', rel, 'Use build secrets or runtime env vars.', 'CWE-798', 'Security Misconfiguration', 'S'));
      if (/^\s*ADD\s+https?:\/\//m.test(t)) out.push(f('low', 'ADD from a remote URL', rel, 'Download with checksum verification instead.', 'CWE-494', 'Software and Data Integrity Failures', 'S'));
    }
    if (/^(docker-)?compose.*\.ya?ml$/.test(n)) {
      const t = readFileSync(p, 'utf8');
      if (/["']?(0\.0\.0\.0:)?(5432|3306|27017|6379|9200):\d+["']?/.test(t)) out.push(f('medium', 'Database port published on all interfaces', rel, 'Bind to 127.0.0.1 or keep the database on an internal network.', 'CWE-668', 'Security Misconfiguration', 'S'));
    }
    if (/\.tf$/.test(n)) {
      const t = readFileSync(p, 'utf8');
      if (/acl\s*=\s*"public-read/.test(t) || /block_public_acls\s*=\s*false/.test(t)) out.push(f('high', 'Public S3 bucket configuration', rel, 'Enable S3 Block Public Access.', 'CWE-732', 'Broken Access Control', 'S'));
      if (/cidr_blocks\s*=\s*\[\s*"0\.0\.0\.0\/0"\s*\][\s\S]{0,200}(from_port\s*=\s*(22|3389|3306|5432|27017))/.test(t)) out.push(f('high', 'Security group open to the internet on an admin/database port', rel, 'Restrict the source CIDR.', 'CWE-284', 'Broken Access Control', 'S'));
      if (/storage_encrypted\s*=\s*false|encrypted\s*=\s*false/.test(t)) out.push(f('medium', 'Unencrypted storage', rel, 'Enable encryption at rest.', 'CWE-311', 'Cryptographic Failures', 'S'));
    }
    if (/\.ya?ml$/.test(n) && /kind:\s*(Pod|Deployment|StatefulSet|DaemonSet)/.test(readFileSync(p, 'utf8').slice(0, 20000))) {
      const t = readFileSync(p, 'utf8');
      if (/privileged:\s*true/.test(t)) out.push(f('high', 'Privileged Kubernetes container', rel, 'Remove privileged: true.', 'CWE-250', 'Security Misconfiguration', 'S'));
    }
  }
  return out;
}

export function gitHistory(root, { maxBytes = 200_000_000 } = {}) {
  if (!existsSync(join(root, '.git'))) return { findings: [], scanned: false };
  // --no-textconv and the -c overrides stop a hostile .git/config from running programs (textconv, fsmonitor, gpg).
  const r = spawnSync('git', ['-c', 'core.fsmonitor=false', '-c', 'log.showSignature=false', '-C', root, 'log', '-p', '--all', '--no-color', '--no-ext-diff', '--no-textconv'], { encoding: 'utf8', maxBuffer: maxBytes });
  if (r.status !== 0 && !r.stdout) return { findings: [], scanned: false };
  const added = r.stdout.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n');
  const hits = scanText(added, 'git history').filter((h) => h.severity !== 'info');
  const seen = new Set();
  const findings = [];
  for (const h of hits) {
    if (seen.has(h.type + h.value)) continue;
    seen.add(h.type + h.value);
    findings.push({ domain: 'X', severity: h.severity === 'review' ? 'medium' : h.severity, title: `${h.type} in git history`, evidence: `${h.value}${h.note ? `. ${h.note}` : ''}`, fix: 'Rotate it, then purge history with git filter-repo or BFG and force-push; enable push protection.', cwe: 'CWE-798', owasp: 'Identification and Authentication Failures', effort: 'M', key: 'secret' });
  }
  return { findings, scanned: true };
}

export function dependencies(root) {
  const findings = [];
  const notes = [];
  if (existsSync(join(root, 'package.json'))) {
    if (!['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].some((l) => existsSync(join(root, l)))) findings.push(f('low', 'No lockfile committed', 'package.json without a lockfile', 'Commit the lockfile for reproducible, auditable builds.', 'CWE-1104', 'Vulnerable and Outdated Components', 'S'));
    if (existsSync(join(root, 'package-lock.json'))) {
      // Run in a scratch directory with copies of the manifest and lockfile only: the scanned repo's own
      // .npmrc (registry, proxy, strict-ssl) and any files planted in it must not affect the audit.
      const tmp = mkdtempSync(join(tmpdir(), 'kagicyber-audit-'));
      let r;
      try {
        copyFileSync(join(root, 'package.json'), join(tmp, 'package.json'));
        copyFileSync(join(root, 'package-lock.json'), join(tmp, 'package-lock.json'));
        r = spawnNpm(['audit', '--omit=dev', '--json', '--registry=https://registry.npmjs.org/'], { cwd: tmp, encoding: 'utf8', maxBuffer: 50_000_000, timeout: 120000 });
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
      try {
        const j = JSON.parse(r.stdout);
        for (const [name, v] of Object.entries(j.vulnerabilities || {})) {
          if (!['high', 'critical'].includes(v.severity)) continue;
          const fixAvail = v.fixAvailable === true ? 'npm audit fix' : v.fixAvailable?.name ? `upgrade ${v.fixAvailable.name} to ${v.fixAvailable.version}` : 'no fix available yet';
          findings.push(f(v.severity, `Vulnerable dependency: ${name}`, `range ${v.range}; via ${[].concat(v.via).map((x) => (typeof x === 'string' ? x : x.title)).slice(0, 2).join('; ')}`, `Fix: ${fixAvail}.`, 'CWE-1395', 'Vulnerable and Outdated Components'));
        }
      } catch {
        notes.push('npm audit could not run (offline or registry unavailable).');
      }
    }
    try {
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.angular) findings.push(f('medium', 'AngularJS 1.x dependency (end of life)', `angular@${deps.angular}`, 'Migrate to a supported framework.', 'CWE-1104', 'Vulnerable and Outdated Components', 'L'));
      if (/^[\^~]?2\./.test(deps.vue || '')) findings.push(f('medium', 'Vue 2 dependency (end of life)', `vue@${deps.vue}`, 'Upgrade to Vue 3.', 'CWE-1104', 'Vulnerable and Outdated Components', 'L'));
      const node = pkg.engines?.node;
      if (node && /(^|[^\d])(1[0-7]|[89])(\.|$|\s)/.test(node)) findings.push(f('medium', 'End-of-life Node.js version in engines', `engines.node: ${node}`, 'Target an active LTS Node.js release.', 'CWE-1104', 'Vulnerable and Outdated Components', 'S'));
    } catch {}
  }
  for (const [file, tool] of [['requirements.txt', 'pip-audit'], ['composer.lock', 'composer audit'], ['Gemfile.lock', 'bundle audit'], ['go.sum', 'govulncheck ./...']]) {
    if (existsSync(join(root, file))) notes.push(`${file} found: run \`${tool}\` for dependency advisories.`);
  }
  if (!existsSync(join(root, '.github', 'dependabot.yml')) && !existsSync(join(root, 'renovate.json'))) findings.push(f('info', 'No automated dependency updates', 'No Dependabot or Renovate config', 'Enable Dependabot or Renovate.', null, 'Vulnerable and Outdated Components', 'S'));
  return { findings, notes };
}

/** Deep repository checks on top of the working-tree scan: git history, dependencies, SAST-lite, CI/CD, IaC. */
export function deepRepoChecks(root) {
  const files = walk(root);
  const hist = gitHistory(root);
  const deps = dependencies(root);
  const findings = [...hist.findings, ...deps.findings, ...sastLite(root, files), ...cicd(root), ...iac(root, files)];
  if (!existsSync(join(root, 'SECURITY.md')) && !existsSync(join(root, '.github', 'SECURITY.md'))) findings.push(f('info', 'No SECURITY.md', 'Repository has no security policy.', 'Add SECURITY.md with a reporting contact.', null, null, 'S'));
  return { findings, notes: [...deps.notes, hist.scanned ? null : 'Git history not scanned (not a git repository).'].filter(Boolean) };
}
