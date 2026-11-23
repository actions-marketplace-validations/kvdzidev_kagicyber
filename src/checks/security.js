import { scanText } from './secrets.js';
import { LIB_BANNERS, COMPROMISED_HOSTS, FORM_PROCESSORS, CAPTCHA_MARKERS } from '../knowledge.js';
import { truncate, safeUrl, uniq } from '../util.js';

export const DOMAINS = {
  T: 'Transport & TLS',
  H: 'Browser hardening',
  K: 'Cookies & sessions',
  X: 'Code & secret exposure',
  D: 'Components & supply chain',
  A: 'Attack surface',
  M: 'E-mail & DNS',
  F: 'Forms & abuse',
  R: 'Repository, CI/CD & infrastructure',
};

const OWASP = {
  crypto: 'Cryptographic Failures',
  misconfig: 'Security Misconfiguration',
  components: 'Vulnerable and Outdated Components',
  integrity: 'Software and Data Integrity Failures',
  auth: 'Identification and Authentication Failures',
  design: 'Insecure Design',
  access: 'Broken Access Control',
};

function finding(domain, severity, title, { evidence = '', fix = '', cwe = null, owasp = null, effort = 'S', key = null } = {}) {
  return { domain, severity, title, evidence, fix, cwe, owasp, effort, key };
}

export function runSecurityChecks(ev) {
  const out = [];
  out.push(...transport(ev), ...hardening(ev), ...cookies(ev), ...exposure(ev), ...components(ev), ...surface(ev), ...email(ev), ...forms(ev));
  return assignIds(out);
}

/** Stable IDs per area in area order: S-T01, S-H01, ... */
export function assignIds(findings) {
  const counters = {};
  const order = Object.keys(DOMAINS);
  findings.sort((a, b) => order.indexOf(a.domain) - order.indexOf(b.domain));
  for (const f of findings) {
    counters[f.domain] = (counters[f.domain] || 0) + 1;
    f.id = `S-${f.domain}${String(counters[f.domain]).padStart(2, '0')}`;
  }
  return findings;
}

/* ---------------- T - Transport & TLS ---------------- */
function transport(ev) {
  const out = [];
  if (ev.local) return out;
  if (ev.https === false) {
    out.push(finding('T', 'high', 'Site is not served over HTTPS', {
      evidence: `${ev.home.finalUrl} loaded over plain HTTP.`,
      fix: 'Install a TLS certificate (e.g. Let’s Encrypt) and redirect all HTTP traffic to HTTPS.',
      cwe: 'CWE-319', owasp: OWASP.crypto, effort: 'M',
    }));
    return out;
  }
  const r = ev.httpRedirect;
  if (r) {
    if (r.status === 200) {
      out.push(finding('T', 'medium', 'HTTP version does not redirect to HTTPS', {
        evidence: `http://${ev.host}/ answered 200 without redirecting.`,
        fix: 'Answer every http:// request with a 301/308 redirect to the same https:// URL.',
        cwe: 'CWE-319', owasp: OWASP.crypto,
      }));
    } else if ([301, 302, 303, 307, 308].includes(r.status)) {
      if (!/^https:\/\//i.test(r.location || '')) {
        out.push(finding('T', 'medium', 'HTTP redirects somewhere other than HTTPS', {
          evidence: `http://${ev.host}/ → ${r.status} ${r.location || '(no Location)'}`,
          fix: 'Redirect http:// directly to the https:// version of the same host.',
          cwe: 'CWE-319', owasp: OWASP.crypto,
        }));
      } else if ([302, 303, 307].includes(r.status)) {
        out.push(finding('T', 'info', 'HTTP → HTTPS redirect is temporary', {
          evidence: `http://${ev.host}/ → ${r.status} ${r.location}`,
          fix: 'Use a permanent 301 or 308 redirect so browsers and search engines remember it.',
        }));
      }
    }
  }
  const hsts = ev.home.headers['strict-transport-security'];
  if (!hsts) {
    out.push(finding('T', 'low', 'HSTS header missing', {
      evidence: 'No Strict-Transport-Security header on the homepage.',
      fix: 'Add `Strict-Transport-Security: max-age=31536000; includeSubDomains` once every subdomain serves HTTPS.',
      cwe: 'CWE-319', owasp: OWASP.crypto, key: 'hsts',
    }));
  } else {
    const maxAge = Number((hsts.match(/max-age=(\d+)/i) || [])[1] || 0);
    if (maxAge < 15552000) {
      out.push(finding('T', 'low', 'HSTS max-age is short', {
        evidence: `Strict-Transport-Security: ${hsts}`,
        fix: 'Use max-age of at least 15552000 (180 days); 31536000 (1 year) is common.',
        cwe: 'CWE-319', owasp: OWASP.crypto,
      }));
    } else if (!/includesubdomains/i.test(hsts)) {
      out.push(finding('T', 'info', 'HSTS does not include subdomains', { evidence: `Strict-Transport-Security: ${hsts}`, fix: 'Add includeSubDomains when all subdomains serve HTTPS.' }));
    }
  }
  const t = ev.tls;
  if (t?.ok) {
    if (t.daysLeft != null && t.daysLeft < 0) {
      out.push(finding('T', 'high', 'TLS certificate has expired', { evidence: `Expired on ${t.validTo}.`, fix: 'Renew the certificate and automate renewal.', cwe: 'CWE-298', owasp: OWASP.crypto }));
    } else if (!t.authorized) {
      out.push(finding('T', 'high', 'TLS certificate is not trusted', {
        evidence: `${t.authorizationError} (subject ${t.subject}, issuer ${t.issuer})`,
        fix: 'Serve a certificate from a public CA with the full intermediate chain and a matching hostname.',
        cwe: 'CWE-295', owasp: OWASP.crypto,
      }));
    } else if (t.daysLeft != null && t.daysLeft < 14) {
      out.push(finding('T', 'medium', `TLS certificate expires in ${t.daysLeft} days`, { evidence: `Valid until ${t.validTo} (${t.issuer}).`, fix: 'Renew now and check that auto-renewal works.', cwe: 'CWE-298' }));
    } else if (t.daysLeft != null && t.daysLeft < 30) {
      out.push(finding('T', 'low', `TLS certificate expires in ${t.daysLeft} days`, { evidence: `Valid until ${t.validTo} (${t.issuer}).`, fix: 'Check that auto-renewal is configured.', cwe: 'CWE-298' }));
    }
    if (t.protocol === 'TLSv1.2') {
      out.push(finding('T', 'info', 'TLS 1.3 not negotiated', { evidence: 'Server negotiated TLSv1.2 with a TLS 1.3-capable client.', fix: 'Enable TLS 1.3 on the server or CDN.' }));
    }
  } else if (t && !t.ok) {
    out.push(finding('T', 'info', 'TLS handshake could not be inspected', { evidence: t.error }));
  }
  if (ev.legacyTls) {
    out.push(finding('T', 'medium', `Server still accepts ${ev.legacyTls}`, {
      evidence: `A handshake limited to TLS 1.0/1.1 succeeded (${ev.legacyTls}).`,
      fix: 'Disable TLS 1.0 and 1.1; allow only TLS 1.2 and 1.3.',
      cwe: 'CWE-326', owasp: OWASP.crypto,
    }));
  }
  // Mixed content
  if (ev.https) {
    const h = ev.html;
    const active = [...h.scripts.map((s) => s.src), ...h.iframes.map((i) => i.src), ...h.styles.map((s) => s.href)].filter((u) => /^http:\/\//i.test(u));
    const passive = [...(ev.rawHtml || '').matchAll(/<(?:img|audio|video|source)\b[^>]*\bsrc=["'](http:\/\/[^"']+)/gi)].map((m) => m[1]);
    if (active.length) {
      out.push(finding('T', 'medium', 'Active mixed content (HTTP scripts/styles/frames on an HTTPS page)', {
        evidence: active.slice(0, 3).map((u) => truncate(u, 90)).join(', '),
        fix: 'Load every script, stylesheet and iframe over https://.',
        cwe: 'CWE-319', owasp: OWASP.crypto,
      }));
    }
    if (passive.length) {
      out.push(finding('T', 'low', 'Passive mixed content (HTTP images/media)', { evidence: passive.slice(0, 3).map((u) => truncate(u, 90)).join(', '), fix: 'Serve media over https://.', cwe: 'CWE-319' }));
    }
    const httpForms = h.forms.filter((f) => /^http:\/\//i.test(f.action));
    if (httpForms.length) {
      out.push(finding('T', 'high', 'Form submits data over plain HTTP', {
        evidence: httpForms.map((f) => truncate(f.action, 90)).join(', '),
        fix: 'Point form actions at https:// endpoints.',
        cwe: 'CWE-319', owasp: OWASP.crypto,
      }));
    }
  }
  return out;
}

/* ---------------- H - Browser hardening ---------------- */
function hardening(ev) {
  const out = [];
  const hd = ev.home.headers;
  const csp = hd['content-security-policy'];
  const cspRO = hd['content-security-policy-report-only'];
  const xfo = hd['x-frame-options'];
  const frameAncestors = csp && /frame-ancestors/i.test(csp);
  const have = {
    csp: !!csp,
    xcto: /nosniff/i.test(hd['x-content-type-options'] || ''),
    frame: !!xfo || frameAncestors,
    rp: !!hd['referrer-policy'],
    pp: !!hd['permissions-policy'],
    hsts: !!hd['strict-transport-security'],
  };
  const none = !have.csp && !have.xcto && !have.frame && !have.rp && !have.pp && !have.hsts;
  if (none && !ev.local) {
    out.push(finding('H', 'medium', 'No browser security headers at all', {
      evidence: 'Missing: Content-Security-Policy, X-Content-Type-Options, X-Frame-Options / frame-ancestors, Referrer-Policy, Permissions-Policy, Strict-Transport-Security.',
      fix: 'Add Strict-Transport-Security, Content-Security-Policy, X-Content-Type-Options, frame-ancestors, Referrer-Policy and Permissions-Policy at the web server or CDN.',
      cwe: 'CWE-693', owasp: OWASP.misconfig, key: 'no-headers',
    }));
  } else {
    if (!have.csp)
      out.push(finding('H', 'low', 'Content-Security-Policy missing', {
        evidence: cspRO ? 'Only Content-Security-Policy-Report-Only is set.' : 'No Content-Security-Policy header.',
        fix: "Start with Report-Only: `default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'`, then enforce.",
        cwe: 'CWE-693', owasp: OWASP.misconfig,
      }));
    if (!have.xcto) out.push(finding('H', 'low', 'X-Content-Type-Options: nosniff missing', { evidence: 'Header absent.', fix: 'Add `X-Content-Type-Options: nosniff`.', cwe: 'CWE-693', owasp: OWASP.misconfig }));
    if (!have.frame) {
      const sensitive = ev.html.forms.some((f) => f.hasPassword);
      out.push(finding('H', sensitive ? 'medium' : 'low', 'Clickjacking protection missing', {
        evidence: `No X-Frame-Options and no CSP frame-ancestors${sensitive ? ' on a page with a password form' : ''}.`,
        fix: "Add `Content-Security-Policy: frame-ancestors 'self'` (or `X-Frame-Options: SAMEORIGIN`).",
        cwe: 'CWE-1021', owasp: OWASP.misconfig,
      }));
    }
    if (!have.rp) out.push(finding('H', 'low', 'Referrer-Policy missing', { evidence: 'Header absent (browser default applies).', fix: 'Add `Referrer-Policy: strict-origin-when-cross-origin`.', cwe: 'CWE-200', owasp: OWASP.misconfig }));
    if (!have.pp) out.push(finding('H', 'info', 'Permissions-Policy missing', { evidence: 'Header absent.', fix: 'Add `Permissions-Policy: camera=(), microphone=(), geolocation=()` (adjust to what the site uses).' }));
  }
  if (/unsafe-url/i.test(hd['referrer-policy'] || '')) {
    out.push(finding('H', 'low', 'Referrer-Policy leaks full URLs', { evidence: `Referrer-Policy: ${hd['referrer-policy']}`, fix: 'Use strict-origin-when-cross-origin.', cwe: 'CWE-200' }));
  }
  if (csp) {
    const scriptSrc = (csp.match(/script-src([^;]*)/i) || csp.match(/default-src([^;]*)/i) || [])[1] || '';
    const hasNonce = /'nonce-|'sha(256|384|512)-|'strict-dynamic'/i.test(scriptSrc);
    const issues = [];
    if (/'unsafe-inline'/i.test(scriptSrc) && !hasNonce) issues.push("'unsafe-inline' in script-src");
    if (/'unsafe-eval'/i.test(scriptSrc)) issues.push("'unsafe-eval' in script-src");
    if (/(^|\s)(\*|https:|http:)(\s|$)/i.test(scriptSrc)) issues.push('wildcard source in script-src');
    if (!/object-src\s+'none'/i.test(csp) && !/default-src\s+'none'/i.test(csp)) issues.push("no object-src 'none'");
    if (!/base-uri/i.test(csp)) issues.push('no base-uri');
    if (issues.length) {
      const weak = issues.some((i) => i.includes('script-src'));
      out.push(finding('H', weak ? 'low' : 'info', 'Content-Security-Policy is weak', {
        evidence: issues.join('; '),
        fix: "Use nonces or hashes instead of 'unsafe-inline', drop 'unsafe-eval', and add object-src 'none' and base-uri 'self'.",
        cwe: 'CWE-693', owasp: OWASP.misconfig,
      }));
    }
  }
  return out;
}

/* ---------------- K - Cookies & sessions ---------------- */
export function parseSetCookie(sc) {
  const parts = sc.split(';').map((s) => s.trim());
  const [nv, ...attrs] = parts;
  const eq = nv.indexOf('=');
  const name = eq === -1 ? nv : nv.slice(0, eq);
  const flags = {};
  for (const a of attrs) {
    const i = a.indexOf('=');
    const k = (i === -1 ? a : a.slice(0, i)).toLowerCase();
    flags[k] = i === -1 ? true : a.slice(i + 1);
  }
  return { name, secure: !!flags.secure, httpOnly: !!flags.httponly, sameSite: flags.samesite || null, domain: flags.domain || null, maxAge: flags['max-age'] || null, expires: flags.expires || null };
}

const SESSION_NAME = /(sess|sid\b|^sid|auth|token|jwt|login|remember|laravel_session|phpsessid|jsessionid|asp\.net_sessionid|connect\.sid|wordpress_logged_in|_session)/i;
const CSRF_NAME = /(csrf|xsrf)/i;

function cookies(ev) {
  const out = [];
  const list = (ev.home.setCookies || []).map(parseSetCookie);
  for (const c of list) {
    const session = SESSION_NAME.test(c.name) && !CSRF_NAME.test(c.name);
    const missing = [];
    if (ev.https && !c.secure) missing.push('Secure');
    if (session && !c.httpOnly) missing.push('HttpOnly');
    if (!c.sameSite) missing.push('SameSite');
    if (!missing.length) continue;
    const sev = session && (missing.includes('Secure') || missing.includes('HttpOnly')) ? 'medium' : 'low';
    out.push(finding('K', sev, `Cookie "${c.name}" lacks ${missing.join(', ')}`, {
      evidence: `Set-Cookie on the homepage${session ? ' (looks like a session cookie)' : ''}.`,
      fix: `Set the cookie with ${missing.map((m) => (m === 'SameSite' ? 'SameSite=Lax' : m)).join('; ')}.`,
      cwe: missing.includes('HttpOnly') ? 'CWE-1004' : 'CWE-614', owasp: OWASP.misconfig,
    }));
  }
  const tokenLinks = ev.html.links.filter((l) => /[?&](access_token|token|api[_-]?key|apikey|session|auth)=[^&]{8,}/i.test(l.href || ''));
  if (tokenLinks.length) {
    out.push(finding('K', 'medium', 'Tokens or keys in link URLs', {
      evidence: tokenLinks.slice(0, 3).map((l) => truncate(l.href.replace(/(=)[^&]{4}[^&]*/g, '$1…'), 90)).join(', '),
      fix: 'Never put tokens in URLs: they end up in logs, history and Referer headers. Use headers or POST bodies.',
      cwe: 'CWE-598', owasp: OWASP.misconfig,
    }));
  }
  const storage = ev.scripts.filter((s) => s.body && /localStorage\.setItem\(\s*["'`](access_?token|id_?token|jwt|auth_?token|refresh_?token)["'`]/i.test(s.body));
  if (storage.length) {
    out.push(finding('K', 'low', 'Auth tokens stored in localStorage', {
      evidence: storage.slice(0, 2).map((s) => pathOf(s.url)).join(', '),
      fix: 'Prefer HttpOnly, Secure, SameSite cookies for session tokens so XSS cannot read them.',
      cwe: 'CWE-922', owasp: OWASP.design,
    }));
  }
  return out;
}

/* ---------------- X - Code & secret exposure ---------------- */
function exposure(ev) {
  const out = [];
  const hits = [];
  hits.push(...scanText(ev.rawHtml || '', pathOf(ev.home.finalUrl) || '/'));
  for (const s of ev.scripts) if (s.body) hits.push(...scanText(s.body, pathOf(s.url)));
  const grouped = new Map();
  for (const h of hits) {
    const k = `${h.type}|${h.value}`;
    if (!grouped.has(k)) grouped.set(k, { ...h, sources: [h.source] });
    else grouped.get(k).sources.push(h.source);
  }
  for (const h of grouped.values()) {
    out.push(finding('X', h.severity, `${h.type} exposed in client code`, {
      evidence: `${h.value} in ${uniq(h.sources).slice(0, 3).join(', ')}${h.note ? `. ${h.note}` : ''}`,
      fix: h.severity === 'info' ? 'Public by design: verify restrictions and access rules.' : 'Rotate the credential now, move it server-side, and remove it from the bundle and git history.',
      cwe: 'CWE-798', owasp: OWASP.auth, effort: h.severity === 'info' ? 'S' : 'M', key: 'secret',
    }));
  }
  const allBodies = ev.scripts.map((s) => s.body || '').join('\n');
  if (/api\.web3forms\.com/.test(allBodies + (ev.rawHtml || '')) && /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(allBodies + (ev.rawHtml || ''))) {
    out.push(finding('X', 'info', 'Form-service access key in client code (Web3Forms)', {
      evidence: 'Web3Forms access keys are designed to be public; anyone can reuse the key to send mail through your form.',
      fix: 'Enable domain restriction and spam filtering in the Web3Forms dashboard, or relay submissions through your own server.',
    }));
  }
  const maps = ev.sourceMaps.filter((m) => m.exposed);
  if (maps.length) {
    out.push(finding('X', 'medium', 'Source maps are publicly downloadable', {
      evidence: maps.slice(0, 3).map((m) => pathOf(m.map)).join(', '),
      fix: 'Disable production source maps (or upload them privately to your error tracker) and block *.map at the server.',
      cwe: 'CWE-540', owasp: OWASP.misconfig,
    }));
  }
  const bodies = [ev.rawHtml || '', ...ev.scripts.map((s) => s.body || '')].join('\n');
  const internal = uniq([
    ...[...bodies.matchAll(/https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?[\w/.-]*/g)].map((m) => m[0]),
    ...[...bodies.matchAll(/https?:\/\/(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?/g)].map((m) => m[0]),
    ...[...bodies.matchAll(/https?:\/\/(?:staging|stage|dev|test|uat|preprod)[.-][\w.-]+\.[a-z]{2,}/gi)].map((m) => m[0]),
  ]).filter((u) => u !== 'http://localhost' && u !== 'http://localhost/' && (!u.includes(ev.host) || /localhost|127\.0/.test(u)));
  if (internal.length && !ev.local) {
    out.push(finding('X', 'low', 'Internal or staging URLs in public code', {
      evidence: internal.slice(0, 4).join(', '),
      fix: 'Remove development endpoints from production builds; make sure staging hosts are not publicly reachable.',
      cwe: 'CWE-200', owasp: OWASP.misconfig,
    }));
  }
  const nf = ev.notFound?.bodyRaw || '';
  if (/Traceback \(most recent call last\)|Stack trace:|at [\w.$]+ \(.*:\d+:\d+\)|Whoops, looks like something went wrong|Django Version:|Fatal error:|Exception in thread|\bat Object\.<anonymous>/i.test(nf)) {
    out.push(finding('X', 'medium', 'Error page reveals a stack trace / debug output', {
      evidence: `GET ${ev.notFound.path} → ${ev.notFound.status} with debug details.`,
      fix: 'Turn off debug mode in production and serve a generic error page.',
      cwe: 'CWE-209', owasp: OWASP.misconfig,
    }));
  }
  if (/<title>\s*Index of \//i.test(ev.rawHtml || '')) {
    out.push(finding('X', 'medium', 'Directory listing enabled', { evidence: 'The homepage is an auto-generated "Index of /" page.', fix: 'Disable autoindex / Options -Indexes.', cwe: 'CWE-548', owasp: OWASP.misconfig }));
  }
  return out;
}

/* ---------------- D - Components & supply chain ---------------- */
function components(ev) {
  const out = [];
  const hd = ev.home.headers;
  const versioned = ['server', 'x-powered-by', 'x-aspnet-version', 'x-aspnetmvc-version', 'x-generator'].filter((k) => hd[k] && /\d+\.\d+/.test(hd[k]));
  if (versioned.length) {
    out.push(finding('D', 'low', 'Server software versions disclosed in headers', {
      evidence: versioned.map((k) => `${k}: ${hd[k]}`).join('; '),
      fix: 'Hide version numbers (e.g. `server_tokens off;` in nginx, `expose_php = Off`, remove X-Powered-By).',
      cwe: 'CWE-200', owasp: OWASP.misconfig,
    }));
  }
  const gen = ev.html.metas.generator;
  if (gen && /\d+\.\d+/.test(gen)) {
    out.push(finding('D', 'low', 'CMS version disclosed', { evidence: `<meta name="generator" content="${truncate(gen, 60)}">`, fix: 'Remove the generator meta tag and keep the CMS and plugins updated.', cwe: 'CWE-200', owasp: OWASP.misconfig }));
  }
  const bodies = [{ src: 'inline', body: ev.html.inlineScripts.map((s) => s.code).join('\n') }, ...ev.scripts.filter((s) => s.body).map((s) => ({ src: pathOf(s.url), body: s.body }))];
  const libs = new Map();
  for (const { src, body } of bodies) {
    for (const lib of LIB_BANNERS) {
      const m = body.match(lib.re);
      if (!m) continue;
      const nums = m.slice(1).map(Number);
      const version = m[0].match(/\d+\.\d+(\.\d+)?/)?.[0] || '?';
      if (lib.eol(...nums) && !libs.has(lib.name)) libs.set(lib.name, { version, src, note: lib.note });
    }
  }
  const URL_VERSIONS = [
    [/jquery[.-]?(\d+)\.(\d+)\.(\d+)(?:\.min)?\.js/i, 'jQuery'],
    [/jquery@(\d+)\.(\d+)\.(\d+)/i, 'jQuery'],
    [/bootstrap(?:@|\/)(\d+)\.(\d+)\.(\d+)/i, 'Bootstrap'],
    [/angular(?:js)?[@/]1\.(\d+)\.(\d+)/i, 'AngularJS 1.x'],
    [/vue@2\.(\d+)\.(\d+)/i, 'Vue 2'],
    [/lodash(?:\.js)?[@/](\d+)\.(\d+)\.(\d+)/i, 'lodash'],
  ];
  for (const s of ev.html.scripts) {
    for (const [re, name] of URL_VERSIONS) {
      const m = s.src.match(re);
      const lib = m && LIB_BANNERS.find((l) => l.name === name);
      if (lib && !libs.has(name) && lib.eol(...m.slice(1).map(Number))) libs.set(name, { version: m[0].match(/\d+\.\d+(\.\d+)?/)[0], src: truncate(s.src, 80), note: lib.note });
    }
  }
  for (const [name, l] of libs) {
    out.push(finding('D', 'medium', `Outdated or end-of-life library: ${name} ${l.version}`, {
      evidence: `${l.note} Found in ${l.src}.`,
      fix: `Upgrade ${name} to a supported version and re-test.`,
      cwe: 'CWE-1104', owasp: OWASP.components, effort: 'M',
    }));
  }
  const thirdParty = [...ev.html.scripts.map((s) => ({ src: s.src, integrity: s.integrity })), ...ev.html.styles.map((s) => ({ src: s.href, integrity: s.integrity }))];
  const compromised = thirdParty.filter((s) => COMPROMISED_HOSTS.some((h) => (safeUrl(s.src)?.hostname || '').endsWith(h)));
  if (compromised.length) {
    out.push(finding('D', 'high', 'Script loaded from a known-compromised CDN', {
      evidence: compromised.map((s) => truncate(s.src, 90)).join(', '),
      fix: 'Remove it immediately; self-host the library or use a trusted CDN with Subresource Integrity.',
      cwe: 'CWE-829', owasp: OWASP.integrity,
    }));
  }
  const cdn = /(cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|code\.jquery\.com|stackpath\.bootstrapcdn\.com|maxcdn\.bootstrapcdn\.com|ajax\.googleapis\.com|cdn\.datatables\.net)/i;
  const noSri = thirdParty.filter((s) => cdn.test(s.src) && !s.integrity);
  if (noSri.length) {
    out.push(finding('D', 'low', 'Public CDN files loaded without Subresource Integrity', {
      evidence: `${noSri.length} file(s), e.g. ${truncate(noSri[0].src, 90)}`,
      fix: 'Add integrity="sha384-…" crossorigin="anonymous" to versioned CDN files, or self-host them.',
      cwe: 'CWE-829', owasp: OWASP.integrity,
    }));
  }
  return out;
}

/* ---------------- A - Attack surface (passive) ---------------- */
function surface(ev) {
  const out = [];
  const robots = ev.robots?.body;
  if (robots) {
    const interesting = uniq([...robots.matchAll(/^\s*disallow:\s*(\S+)/gim)].map((m) => m[1]).filter((p) => /(admin|backup|bak|old|staging|stage|dev|test|private|secret|config|db|sql|panel|internal|tmp)/i.test(p) && !/wp-admin\/?$/i.test(p)));
    if (interesting.length) {
      out.push(finding('A', 'info', 'robots.txt points to sensitive-looking paths', {
        evidence: interesting.slice(0, 6).join(', '),
        fix: 'robots.txt is public: protect these paths with authentication instead of hiding them.',
        cwe: 'CWE-200',
      }));
    }
  }
  if (!ev.securityTxt?.body) {
    out.push(finding('A', 'info', 'No security.txt', {
      evidence: '/.well-known/security.txt not found.',
      fix: 'Publish /.well-known/security.txt (RFC 9116) with Contact and Expires so researchers can report issues.',
    }));
  } else {
    const exp = ev.securityTxt.body.match(/^expires:\s*(.+)$/im)?.[1];
    if (!exp) out.push(finding('A', 'info', 'security.txt has no Expires field', { evidence: 'RFC 9116 requires Expires.', fix: 'Add `Expires: <ISO 8601 date>`.' }));
    else if (new Date(exp) < new Date()) out.push(finding('A', 'info', 'security.txt has expired', { evidence: `Expires: ${exp}`, fix: 'Update the Expires date.' }));
  }
  if (ev.notFound?.status === 200) {
    out.push(finding('A', 'info', 'Unknown URLs return 200 (soft 404)', { evidence: `GET ${ev.notFound.path} → 200`, fix: 'Return a real 404 status for missing pages.' }));
  }
  return out;
}

/* ---------------- M - E-mail & DNS ---------------- */
function email(ev) {
  const out = [];
  const d = ev.dns;
  if (!d || !d.resolved) return out;
  const spf = d.spf || [];
  const dmarc = d.dmarc || [];
  const sendsMail = (d.mx || []).length > 0;
  if (!spf.length) {
    out.push(finding('M', sendsMail ? 'medium' : 'low', 'No SPF record', {
      evidence: `No v=spf1 TXT record on ${d.domain}.`,
      fix: sendsMail ? 'Publish an SPF record listing your mail providers, ending in ~all or -all.' : 'If the domain sends no mail, publish `v=spf1 -all`.',
      owasp: 'E-mail security',
    }));
  } else if (spf.length > 1) {
    out.push(finding('M', 'medium', 'Multiple SPF records (SPF is invalid)', { evidence: spf.map((s) => truncate(s, 80)).join(' | '), fix: 'Merge them into a single v=spf1 record.', owasp: 'E-mail security' }));
  } else if (/\+all\b/i.test(spf[0])) {
    out.push(finding('M', 'high', 'SPF allows anyone to send (+all)', { evidence: spf[0], fix: 'Replace +all with ~all or -all.', owasp: 'E-mail security' }));
  } else if (/\?all\b/i.test(spf[0])) {
    out.push(finding('M', 'low', 'SPF is neutral (?all)', { evidence: spf[0], fix: 'Use ~all or -all.', owasp: 'E-mail security' }));
  }
  if (!dmarc.length) {
    out.push(finding('M', 'medium', 'No DMARC record: the domain can be spoofed', {
      evidence: `No TXT record at _dmarc.${d.domain}.`,
      fix: `Publish \`_dmarc.${d.domain} TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${d.domain}"\`.`,
      owasp: 'E-mail security', key: 'dmarc',
    }));
  } else {
    const p = (dmarc[0].match(/\bp=(\w+)/i) || [])[1]?.toLowerCase();
    if (p === 'none') {
      out.push(finding('M', 'low', 'DMARC policy is p=none (monitoring only)', { evidence: truncate(dmarc[0], 120), fix: 'Move to p=quarantine, then p=reject, once reports look clean.', owasp: 'E-mail security', key: 'dmarc' }));
    }
    if (!/\brua=/i.test(dmarc[0])) out.push(finding('M', 'info', 'DMARC has no reporting address (rua)', { evidence: truncate(dmarc[0], 120), fix: 'Add rua=mailto:... to receive aggregate reports.' }));
  }
  if (Array.isArray(d.caa) && d.caa.length === 0) {
    out.push(finding('M', 'info', 'No CAA record', { evidence: `Any certificate authority may issue certificates for ${d.domain}.`, fix: `Add a CAA record naming your CA, e.g. ${d.domain}. CAA 0 issue "letsencrypt.org".` }));
  }
  return out;
}

/* ---------------- F - Forms & abuse ---------------- */
function forms(ev) {
  const out = [];
  const html = (ev.rawHtml || '').toLowerCase();
  const scripts = ev.scripts.map((s) => (s.body || '').toLowerCase()).join(' ');
  const hasCaptcha = CAPTCHA_MARKERS.some((m) => html.includes(m) || scripts.includes(m));
  const contactForms = ev.html.forms.filter((f) => f.hasEmail || /textarea/i.test(f.innerHtml));
  if (contactForms.length && !hasCaptcha) {
    out.push(finding('F', 'low', 'Forms without anti-spam protection', {
      evidence: `${contactForms.length} form(s) with free-text or e-mail fields and no CAPTCHA/honeypot markers.`,
      fix: 'Add a honeypot field or a privacy-friendly CAPTCHA (e.g. Cloudflare Turnstile) and server-side rate limits.',
      cwe: 'CWE-799', owasp: OWASP.design,
    }));
  }
  for (const f of ev.html.forms) {
    const proc = FORM_PROCESSORS.find((p) => p.re.test(f.action));
    if (proc && proc.name === 'FormSubmit' && /^false$/i.test(f.hidden._captcha || '')) {
      out.push(finding('F', 'low', 'FormSubmit CAPTCHA explicitly disabled', { evidence: `${truncate(f.action, 80)} with _captcha=false`, fix: 'Remove _captcha=false or add your own spam protection.', cwe: 'CWE-799', owasp: OWASP.design }));
    }
  }
  return out;
}

function pathOf(u) {
  const x = safeUrl(u);
  return x ? x.pathname + (x.search ? '?…' : '') : String(u);
}
