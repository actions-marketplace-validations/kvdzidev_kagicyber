import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { audit } from './audit.js';
import { scanDirectory } from './scan.js';
import { renderTerminal, renderScanTerminal, c } from './report/terminal.js';
import { renderMarkdown } from './report/markdown.js';
import { renderSarif } from './report/sarif.js';
import { renderJunit } from './report/junit.js';
import { badgeMarkdown } from './report/badge.js';
import { readIgnoreFile } from './baseline.js';
import { renderHtml } from './report/html.js';
import { renderFixPrompt, renderScanPrompt } from './report/prompt.js';
import { ruleCatalog } from './law/catalog.js';
import { VERSION, RULES_VERSION, MONITORING_URL } from './version.js';
import { sevRank, todayISO } from './util.js';

const HELP = `
KagiCyber ${VERSION} (rules ${RULES_VERSION}): website compliance, security and SEO/GEO audit

Usage
  kagicyber audit <domain|url> [options]   Audit a live website (passive checks)
  kagicyber scan [dir] [options]           Scan a project: secrets (tree and git history), dependencies,
                                           code patterns, CI/CD, infrastructure as code
  kagicyber rules [--json]                 List jurisdictions and checklists in the rule base
  kagicyber serve [--port 8787]            Self-hosted HTTP API (needs KAGICYBER_API_KEYS)
  kagicyber --version | --help

Audit options
  --browser              Real-browser test: cookies, banner buttons, rendered pages, Web Vitals
                         (needs: npm i -g playwright && npx playwright install chromium)
  --profile <name>       quiet | balanced (default) | fast
  --country <code>       Penalty jurisdiction, e.g. PL, DE, FR, GB (default: detected)
  --include <codes>      Also apply these jurisdictions, e.g. DE,FR,US
  --type <types>         Add site-type checklists: shop, saas, fintech (default: detected)
  --subdomains           Certificate-transparency subdomain discovery and takeover check
  --no-dns               Skip deep DNS checks (DKIM, MTA-STS, TLS-RPT, DNSSEC)
  --allow-private        Let a public site's redirects and links reach private or loopback
                         addresses (blocked by default; local targets are always allowed)
  --repo <dir>           Also scan the site's repository and merge the findings
  --md <file>            Write the Markdown report
  --html <file>          Write a self-contained HTML report
  --prompt <file>        Write the fix prompt alone (paste it into an AI coding assistant)
  --json [file]          Print JSON (or write it to a file)
  --sarif <file>         Write SARIF 2.1.0 (GitHub code scanning)
  --junit <file>         Write JUnit XML (CI dashboards)
  --out <dir>            Write .md, .html, .json, .sarif and the fix prompt into a directory
  --baseline <file>      Compare with an earlier --json result (new / fixed)
  --ignore <ids>         Comma-separated check IDs or fingerprints to ignore
                         (also read from .kagicyberignore)
  --badge                Print a README badge for the security grade
  --fail-on <level>      Exit 1 if a finding is at or above: critical|high|medium|low
                         (with --baseline: only new findings count)
  --fail-under <n>       Exit 1 if the compliance score is below n
  --max-requests <n>     Request budget (default depends on the profile)
  --timeout <ms>         Per-request timeout
  --verbose              Show passing rows and INFO findings in the terminal
  --quiet                No progress output

Scan options
  --quick                Working tree only (skip git history, dependencies, code, CI/CD, IaC)
  --no-repo-ignore       Ignore the scanned project's own .kagicyberignore (use in CI for untrusted PRs)
  --prompt <file>        Write a fix prompt for the findings
  --json, --sarif, --junit, --fail-on   As for audit

Examples
  npx kagicyber audit example.com
  npx kagicyber audit https://shop.example.de --browser --md audit.md --html audit.html
  npx kagicyber audit my-site.com --repo ./my-site
  npx kagicyber audit example.com --json today.json --baseline last-month.json
  npx kagicyber scan . --fail-on high --sarif kagicyber.sarif

Monthly monitoring: ${MONITORING_URL}
`;

const VALUE_FLAGS = ['md', 'html', 'prompt', 'out', 'fail-on', 'fail-under', 'max-requests', 'timeout', 'profile', 'country', 'include', 'type', 'repo', 'port', 'sarif', 'junit', 'baseline', 'ignore'];
const BOOL_FLAGS = ['json', 'browser', 'subdomains', 'no-dns', 'badge', 'verbose', 'quiet', 'quick', 'no-color', 'no-repo-ignore', 'allow-private', 'help', 'version'];
const FAIL_LEVELS = ['critical', 'high', 'medium', 'low'];
const PROFILE_NAMES = ['quiet', 'balanced', 'fast'];
const SITE_TYPE_NAMES = ['shop', 'saas', 'fintech'];
const list = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);

class UsageError extends Error {}

/** Reject unknown flags and malformed values up front, so a typo never silently changes the result or the exit code. */
export function validateArgs(args) {
  for (const k of Object.keys(args)) {
    if (k === '_') continue;
    if (!VALUE_FLAGS.includes(k) && !BOOL_FLAGS.includes(k)) throw new UsageError(`unknown option --${k}`);
    if (VALUE_FLAGS.includes(k) && args[k] === true) throw new UsageError(`--${k} needs a value`);
  }
  if (args['fail-on'] != null && !FAIL_LEVELS.includes(String(args['fail-on']).toLowerCase())) throw new UsageError(`--fail-on must be one of ${FAIL_LEVELS.join(', ')}`);
  if (args.profile != null && !PROFILE_NAMES.includes(String(args.profile))) throw new UsageError(`--profile must be one of ${PROFILE_NAMES.join(', ')}`);
  for (const t of list(args.type)) if (!SITE_TYPE_NAMES.includes(t)) throw new UsageError(`--type accepts ${SITE_TYPE_NAMES.join(', ')} (got "${t}")`);
  const positive = (k, { min = 1, max = Infinity } = {}) => {
    if (args[k] == null) return;
    const n = Number(args[k]);
    if (!Number.isInteger(n) || n < min || n > max) throw new UsageError(`--${k} must be a whole number between ${min} and ${max === Infinity ? 'any' : max}`);
  };
  positive('timeout', { min: 100, max: 600_000 });
  positive('max-requests', { min: 1, max: 10_000 });
  positive('fail-under', { min: 0, max: 100 });
  positive('port', { min: 1, max: 65_535 });
}

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const [k, inline] = a.slice(2).split('=');
    if (inline !== undefined) out[k] = inline;
    else if (k === 'json') out[k] = argv[i + 1]?.endsWith('.json') ? argv[++i] : true;
    else if (VALUE_FLAGS.includes(k) && argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}

export async function main(argv) {
  const args = parseArgs(argv);
  const [cmd, ...rest] = args._;
  if (args.version || cmd === 'version') {
    console.log(VERSION);
    return 0;
  }
  if (args.help || !cmd || cmd === 'help') {
    // No command is a usage error (2): exit code 1 is reserved for --fail-on and --fail-under.
    if (!cmd && !args.help) {
      console.error(HELP);
      return 2;
    }
    console.log(HELP);
    return 0;
  }
  try {
    validateArgs(args);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    console.error(`kagicyber: ${e.message}. Run kagicyber --help for the options.`);
    return 2;
  }
  if (args['no-color']) process.env.NO_COLOR = '1';
  const ignore = [...readIgnoreFile(), ...(args.ignore ? String(args.ignore).split(',').map((s) => s.trim()) : [])];

  if (cmd === 'rules') {
    const cat = ruleCatalog();
    if (args.json) return emitJson(cat, args.json), 0;
    console.log(`\n  Rule base ${cat.rulesVersion}: ${cat.coreChecks} core EU checks, ${cat.euChecklist} EU checklist rules, ${cat.totalRules} rules across ${cat.jurisdictionsCovered} jurisdiction modules\n`);
    for (const [code, j] of Object.entries(cat.jurisdictions)) console.log(`  ${code.padEnd(10)} ${j.name.padEnd(42)} ${String(j.rules).padStart(3)} rules${j.penalties ? '  penalties' : ''}`);
    console.log();
    for (const [k, t] of Object.entries(cat.siteTypes)) console.log(`  type:${k.padEnd(5)} ${t.name.padEnd(42)} ${String(t.rules).padStart(3)} rules`);
    console.log();
    return 0;
  }
  if (cmd === 'serve') {
    const { startServer } = await import('./server.js');
    await startServer({ port: Number(args.port || process.env.PORT || 8787), host: process.env.HOST || '127.0.0.1' });
    return new Promise(() => {});
  }

  if (cmd === 'scan') {
    const dir = resolve(rest[0] || '.');
    if (!existsSync(dir)) {
      console.error(`kagicyber: directory not found: ${dir}`);
      return 2;
    }
    const r = scanDirectory(dir, { ignore, deep: !args.quick, repoIgnore: !args['no-repo-ignore'] });
    if (args.json) emitJson(r, args.json);
    if (args.json !== true) console.log(renderScanTerminal(r));
    if (args.sarif) writeOut(args.sarif, JSON.stringify(renderSarif(r), null, 2));
    if (args.junit) writeOut(args.junit, renderJunit(r));
    if (args.prompt) writeOut(args.prompt, renderScanPrompt(r));
    return exitCode(r, args);
  }

  if (cmd !== 'audit') {
    if (/\./.test(cmd)) rest.unshift(cmd);
    else {
      console.error(`Unknown command: ${cmd}\n${HELP}`);
      return 2;
    }
  }
  const target = rest[0];
  if (!target) {
    console.error('Usage: kagicyber audit <domain|url>');
    return 2;
  }
  if (rest.length > 1) {
    console.error(`kagicyber: unexpected argument "${rest[1]}" (one target per run; --json takes a file name ending in .json)`);
    return 2;
  }
  let baseline = null;
  if (args.baseline) {
    if (!existsSync(args.baseline)) throw new Error(`baseline file not found: ${args.baseline}`);
    baseline = JSON.parse(readFileSync(args.baseline, 'utf8'));
    baseline = baseline.result || baseline;
  }
  const quiet = args.quiet || args.json === true;
  const progress = quiet || !process.stderr.isTTY ? () => {} : (s) => process.stderr.write(`\r\x1b[2K  ${c.grey('...')} ${s}`);
  const r = await audit(target, {
    browser: !!args.browser,
    profile: args.profile,
    country: args.country,
    include: list(args.include).map((x) => x.toUpperCase()),
    siteTypes: list(args.type),
    subdomains: !!args.subdomains,
    allowPrivate: !!args['allow-private'],
    dns: !args['no-dns'],
    repo: args.repo ? resolve(String(args.repo)) : undefined,
    ignore,
    baseline,
    maxRequests: args['max-requests'] ? Number(args['max-requests']) : undefined,
    timeoutMs: args.timeout ? Number(args.timeout) : undefined,
    onStep: progress,
  });
  if (!quiet && process.stderr.isTTY) process.stderr.write('\r\x1b[2K');

  // JSON on stdout replaces the terminal report; JSON written to a file does not.
  if (args.json) emitJson(r, args.json);
  if (args.json !== true) console.log(renderTerminal(r, { verbose: !!args.verbose }));

  const base = `kagicyber-${r.target.host}-${todayISO()}`;
  if (args.md) writeOut(args.md, renderMarkdown(r));
  if (args.html) writeOut(args.html, renderHtml(r));
  if (args.prompt) writeOut(args.prompt, renderFixPrompt(r));
  if (args.sarif) writeOut(args.sarif, JSON.stringify(renderSarif(r), null, 2));
  if (args.junit) writeOut(args.junit, renderJunit(r));
  if (args.out) {
    mkdirSync(args.out, { recursive: true });
    writeOut(join(args.out, `${base}.md`), renderMarkdown(r));
    writeOut(join(args.out, `${base}.json`), JSON.stringify(r, null, 2));
    writeOut(join(args.out, `${base}.sarif`), JSON.stringify(renderSarif(r), null, 2));
    writeOut(join(args.out, `${base}.html`), renderHtml(r));
    writeOut(join(args.out, `${base}-fix-prompt.md`), renderFixPrompt(r));
  }
  if (args.badge) console.log(`\n  ${badgeMarkdown(r)}\n`);
  return exitCode(r, args);
}

function emitJson(obj, dest) {
  const s = JSON.stringify(obj, null, 2);
  if (dest === true) console.log(s);
  else writeOut(dest, s);
}

function writeOut(file, content) {
  mkdirSync(dirname(resolve(file)), { recursive: true });
  writeFileSync(file, content);
  console.error(c.grey(`  wrote ${file}`));
}

export function exitCode(r, args) {
  if (args['fail-on']) {
    const lvl = sevRank(String(args['fail-on']).toLowerCase());
    const relevant = r.security.findings.filter((f) => !f.ignored && (!r.baseline || f.baseline === 'new'));
    if (relevant.some((f) => sevRank(f.severity) <= lvl)) return 1;
  }
  if (args['fail-under'] != null) {
    // No compliance score means nothing could be verified: a CI gate must not treat that as a pass.
    if (r.scores.compliance == null) {
      console.error('kagicyber: --fail-under: no compliance score (nothing could be verified)');
      return 1;
    }
    if (r.scores.compliance < Number(args['fail-under'])) return 1;
  }
  return 0;
}
