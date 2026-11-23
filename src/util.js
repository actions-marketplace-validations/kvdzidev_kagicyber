import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, isAbsolute } from 'node:path';

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Absolute path of npm's JavaScript entry point next to the running Node.js, or null. */
function npmCli() {
  const bin = dirname(process.execPath);
  const candidates = [
    process.env.npm_execpath,
    join(bin, 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Windows installers, nvm-windows
    join(bin, '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'), // Unix prefix layout
  ];
  return candidates.find((p) => p && isAbsolute(p) && /npm-cli\.js$/.test(p) && existsSync(p)) || null;
}

/**
 * Run npm with fixed arguments, never through a shell. A shell would let `cmd.exe` pick up an
 * `npm.cmd` planted in the working directory (for example inside a repository being scanned), so npm
 * is started as `node <absolute npm-cli.js>`. On Unix, without that file, `npm` is resolved from PATH only.
 */
export function spawnNpm(args, opts = {}) {
  const cli = npmCli();
  if (cli) return spawnSync(process.execPath, [cli, ...args], { ...opts, shell: false });
  if (process.platform === 'win32') return { status: null, stdout: '', stderr: '', error: new Error('npm not found next to node') };
  return spawnSync('npm', args, { ...opts, shell: false });
}

export const uniq = (arr) => [...new Set(arr)];

export function truncate(s, n = 160) {
  if (s == null) return '';
  s = stripControl(s);
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Mask a secret: first 4 + last 4 characters plus length. Never print secrets in full. */
export function maskSecret(v) {
  v = String(v);
  return v.length <= 12 ? `${v.slice(0, 2)}…(len ${v.length})` : `${v.slice(0, 4)}…${v.slice(-4)} (len ${v.length})`;
}

/** Strip "www." to get the domain used for DNS e-mail records. No public-suffix list: good enough for apex domains. */
export function apexOf(host) {
  return host.replace(/^www\./i, '').toLowerCase();
}

/** True when `host` is the target host or one of its subdomains / parent site. */
export function sameSite(host, targetHost) {
  const a = apexOf(host);
  const b = apexOf(targetHost);
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export function isLocalHost(host) {
  return /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i.test(host);
}

export function safeUrl(u, base) {
  try {
    return new URL(u, base);
  } catch {
    return null;
  }
}

/** Decode the most common HTML entities (enough for link text and page text). */
export function decodeEntities(s) {
  return stripControl(s
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d{1,8});/g, (_, d) => codePoint(Number(d)))
    .replace(/&#x([0-9a-f]{1,8});/gi, (_, h) => codePoint(parseInt(h, 16))));
}

/** A character reference to text; invalid code points (which make String.fromCodePoint throw) become U+FFFD. */
function codePoint(n) {
  return Number.isInteger(n) && n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '�';
}

/** Remove `<tag ...>...</tag>` blocks (or `<!-- ... -->` with tag '!--') with indexOf: linear even when a block is unterminated. */
function stripBlocks(html, tag) {
  const lower = html.toLowerCase();
  const openTok = tag === '!--' ? '<!--' : `<${tag}`;
  const closeTok = tag === '!--' ? '-->' : `</${tag}`;
  let out = '';
  let i = 0;
  for (;;) {
    const open = lower.indexOf(openTok, i);
    if (open === -1) return out + html.slice(i);
    out += `${html.slice(i, open)} `;
    const close = lower.indexOf(closeTok, open + openTok.length);
    if (close === -1) return out; // unterminated: drop the rest, as a browser would treat it as script/comment text
    const end = tag === '!--' ? close + 3 : html.indexOf('>', close) + 1 || html.length;
    i = end;
  }
}

/** Control characters from a page (raw or via &#27;) must never reach a terminal: they can retitle windows or write the clipboard. */
// eslint-disable-next-line no-control-regex -- matching control characters is the point
export const stripControl = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, '');

/**
 * Replace every `<...>` (up to 8 KB inside) with a space. Same result as s.replace(/<[^>]{0,8192}>/g, ' '),
 * but the regex rescans up to 8 KB for each `<` that is never closed, so a page of them took seconds.
 */
function stripTags(s) {
  let out = '';
  let i = 0;
  let gt = -1;
  for (let lt = s.indexOf('<'); lt !== -1; lt = s.indexOf('<', lt + 1)) {
    if (gt <= lt) gt = s.indexOf('>', lt + 1);
    if (gt === -1) break;
    if (gt - lt - 1 > 8192) continue;
    out += `${s.slice(i, lt)} `;
    i = gt + 1;
    lt = gt;
  }
  return out + s.slice(i);
}

export function htmlToText(html) {
  let s = String(html);
  for (const tag of ['script', 'style', 'noscript', '!--']) s = stripBlocks(s, tag);
  return stripControl(decodeEntities(stripTags(s)))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Parse the attributes of a single tag's attribute string into a lower-cased map. */
export function parseAttrs(s) {
  const out = {};
  const re = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let m;
  while ((m = re.exec(s))) {
    out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '');
  }
  return out;
}

export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
export const sevRank = (s) => {
  const i = SEVERITY_ORDER.indexOf(s);
  return i === -1 ? SEVERITY_ORDER.length : i;
};

export function sortBySeverity(findings) {
  return [...findings].sort((a, b) => sevRank(a.severity) - sevRank(b.severity));
}

export function todayISO(d = new Date()) {
  return d.toISOString().slice(0, 10);
}
