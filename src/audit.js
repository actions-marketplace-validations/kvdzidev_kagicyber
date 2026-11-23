import { Fetcher } from './http.js';
import { collect, normalizeTarget } from './collect.js';
import { browserConsentTest } from './browser.js';
import { runSecurityChecks, assignIds } from './checks/security.js';
import { runComplianceChecks, siteTypes, bundleStrings } from './checks/compliance.js';
import { runSeoChecks } from './checks/seo.js';
import { detectJurisdictions } from './jurisdiction.js';
import { detectTech, stackSummary } from './tech.js';
import { maxPenalty, penaltyJurisdiction } from './penalties.js';
import { securityScore, complianceScore, domainTiles, overallRisk } from './score.js';
import { DOMAINS as DOMAIN_CODES } from './checks/security.js';
import { fingerprint, applyIgnores, compareBaseline } from './baseline.js';
import { evaluateLaw } from './law/evaluate.js';
import { buildFixPack } from './report/fixpack.js';
import { dnsDeep } from './checks/dns-deep.js';
import { ctSubdomains } from './checks/subdomains.js';
import { scanDirectory } from './scan.js';
import { VERSION, RULES_VERSION, SITE_URL, MONITORING_URL } from './version.js';
import { sortBySeverity, sevRank } from './util.js';
import { assertPublicHost } from './netguard.js';
import { maskSecretsIn } from './checks/secrets.js';
import { maskSecret } from './util.js';

/**
 * Audit a live site: compliance (EU baseline, EU extended checklist, every detected jurisdiction and site type),
 * security (passive checks only, plus an optional repository scan) and SEO/GEO.
 * @param {string} target domain or URL
 * @param {{browser?:boolean, profile?:'quiet'|'balanced'|'fast', country?:string, include?:string[], siteTypes?:string[],
 *          subdomains?:boolean, dns?:boolean, repo?:string, ignore?:string[], baseline?:object,
 *          maxRequests?:number, timeoutMs?:number, delayMs?:number, onStep?:(s:string)=>void,
 *          publicOnly?:boolean}} opts  publicOnly refuses loopback, private and link-local addresses on every request and redirect
 */
export async function audit(target, opts = {}) {
  const startedAt = new Date();
  const onStep = opts.onStep || (() => {});
  const url = normalizeTarget(target);
  // A public target must not be able to steer the audit into private networks (redirects, sitemap and
  // source-map URLs, links to 127.0.0.1). Local and private targets (your own staging) keep working.
  let publicOnly = opts.publicOnly;
  if (publicOnly == null) publicOnly = !opts.allowPrivate && (await targetIsPublic(url.hostname, opts.lookup));
  const fetcher = new Fetcher({ profile: opts.profile, maxRequests: opts.maxRequests, timeoutMs: opts.timeoutMs, delayMs: opts.delayMs, publicOnly, lookup: opts.lookup });
  const ev = await collect(url, fetcher, { onStep });
  ev.bundleText = ev.html.clientRendered || ev.html.wordCount < 300 ? bundleStrings(ev.scripts) : '';

  if (opts.browser) {
    onStep('Running the real-browser test');
    const renderUrls = ev.html.clientRendered ? ev.pages.filter((p) => !p.sameAs && (p.textLength || 0) < 600).map((p) => p.url) : [];
    ev.browser = await browserConsentTest(ev.home.finalUrl, { timeoutMs: opts.timeoutMs ?? 30000, renderUrls });
    if (ev.browser.ran) ev.renderedPages = ev.browser.renderedPages;
  }

  const extra = [];
  const extraNotes = [];
  if (!ev.local) {
    const jobs = [];
    if (opts.dns !== false) {
      onStep('Deep e-mail and DNS checks');
      jobs.push(dnsDeep(ev.apex).then((d) => { extra.push(...d.findings); ev.dnsDeep = d.data; }).catch(() => extraNotes.push('Deep DNS checks failed.')));
    }
    if (opts.subdomains) {
      onStep('Certificate-transparency subdomains');
      jobs.push(ctSubdomains(ev.apex).then((x) => { extra.push(...x.findings); ev.subdomains = x.subdomains.slice(0, 200); if (x.error) extraNotes.push(`Subdomain discovery: ${x.error}.`); }));
    }
    await Promise.all(jobs);
  }
  let repoScan = null;
  if (opts.repo) {
    onStep('Repository scan');
    repoScan = scanDirectory(opts.repo, { ignore: opts.ignore || [] });
    extra.push(...repoScan.security.findings.map(({ id: _id, fingerprint: _f, ...f }) => ({ ...f, domain: f.domain === 'X' ? 'R' : f.domain })));
  }

  onStep('Scoring');
  const tech = detectTech(ev);
  const types = siteTypes(ev);
  if (opts.siteTypes?.length) for (const t of opts.siteTypes) if (!types.includes(t)) types.push(t);
  const jurisdictions = detectJurisdictions(ev);
  const pj = penaltyJurisdiction(jurisdictions, opts.country);
  const findings = assignIds([...runSecurityChecks(ev), ...extra]);
  const { checks, inventory } = runComplianceChecks(ev, types, { tech });
  const seo = runSeoChecks(ev, { tech });
  const host = ev.host;
  for (const c of checks) {
    c.maxPenalty = maxPenalty(c.key, pj);
    c.fingerprint = fingerprint('C', c.key, host);
  }
  for (const c of seo) c.fingerprint = fingerprint('SEO', c.key, host);
  for (const f of findings) f.fingerprint = fingerprint('S', `${f.domain}|${f.title.replace(/\d+/g, '#')}`, host);

  const result = {
    tool: { name: 'kagicyber', version: VERSION, rules: RULES_VERSION },
    target: { input: String(target), url: url.href, finalUrl: ev.home.finalUrl, host, status: ev.home.status },
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    requests: ev.requests,
    profile: fetcher.profile,
    repo: opts.repo || null,
    siteTypes: types,
    tech,
    stack: stackSummary(tech),
    jurisdictions,
    penaltyJurisdiction: pj,
    scores: {},
    compliance: { checks, sets: [] },
    security: { findings: sortBySeverity(findings), tiles: {} },
    seo: { checks: seo },
    inventory: {
      trackers: inventory.trackers,
      dynamicTrackers: inventory.dynamicTrackers,
      consentManagers: inventory.cmps.map((c) => c.name),
      customBanner: inventory.customBanner,
      consentModeDenied: inventory.consentModeDenied,
      embeds: inventory.embeds,
      googleFonts: inventory.googleFonts,
      formProcessors: inventory.processors,
      privacyFriendlyAnalytics: inventory.privacyFriendly,
      thirdPartyScripts: ev.thirdPartyScripts.slice(0, 40),
    },
    browser: ev.browser ? { ...ev.browser, renderedPages: (ev.browser.renderedPages || []).map((p) => ({ url: p.url, chars: p.text.length })) } : null,
    examined: examined(ev),
    notRun: notRun(ev, opts),
    fixFirst: [],
    strengths: [],
    ignored: [],
    fixPack: [],
    limitations: [...ev.limitations, ...extraNotes, ...(repoScan?.limitations || [])],
    links: { monitoring: MONITORING_URL, site: SITE_URL },
    evidence: maskEvidence(slimEvidence(ev)),
  };

  // Country, EU-extended and site-type rules; restated core checks are folded into the core rows.
  const law = evaluateLaw(result, { include: opts.include, siteTypes: opts.siteTypes, penaltyJurisdiction: pj });
  for (const c of checks) if (law.folded[c.id]) c.nationalBasis = law.folded[c.id];
  for (const r of law.results) r.fingerprint = fingerprint('L', r.id, host);
  result.compliance.sets = law.sets;

  result.ignored = applyIgnores({ checks: [...checks, ...law.results], seo, findings }, opts.ignore || []);
  const live = {
    checks: checks.filter((c) => !c.ignored),
    rules: law.results.filter((r) => !r.ignored),
    seo: seo.filter((c) => !c.ignored),
    findings: findings.filter((f) => !f.ignored),
  };
  // A tile is only "tested" when its checks ran: TLS (T) and DNS (M) are skipped for local targets or failed lookups.
  const tested = Object.keys(DOMAIN_CODES).filter((d) => (d !== 'R' || opts.repo) && !(d === 'T' && ev.local) && !(d === 'M' && (ev.local || !ev.dns?.resolved)));
  const sec = { ...securityScore(live.findings), tiles: domainTiles(live.findings, tested) };
  const comp = complianceScore([...live.checks, ...live.rules]);
  const core = complianceScore(live.checks);
  const seoScore = complianceScore(live.seo);
  result.scores = {
    compliance: comp.score,
    complianceCoverage: comp.coverage,
    complianceCore: core.score,
    security: sec.score,
    grade: sec.grade,
    seo: seoScore.score,
    seoCoverage: seoScore.coverage,
    risk: overallRisk(comp, sec, live.findings),
  };
  result.security.tiles = sec.tiles;
  result.strengths = buildStrengths(live.findings, live.checks, live.seo, ev);
  result.fixFirst = buildFixFirst(live.findings, [...live.checks, ...live.rules], live.seo);
  result.fixPack = buildFixPack(result, live.rules, live.findings);
  if (opts.baseline) result.baseline = compareBaseline(opts.baseline, result);
  // Every renderer (terminal, Markdown, HTML, JSON, SARIF, JUnit, fix prompt, API) works from this object,
  // and rows quote site text (titles, link URLs, headers): mask secrets in all of it, not only the findings.
  return maskDeep(result);
}

/** True when the target host resolves only to public addresses (DNS errors count as public: the fetch reports them). */
async function targetIsPublic(hostname, lookup) {
  try {
    await assertPublicHost(hostname, lookup);
    return true;
  } catch (e) {
    return e?.code !== 'EBLOCKED';
  }
}

function examined(ev) {
  const kinds = ev.pages.filter((p) => !p.sameAs).map((p) => `${p.kind} (${p.status})`);
  const parts = [
    `homepage (HTTP ${ev.home.status}, ${Math.round((ev.html.rawSize || 0) / 1024)} KB)`,
    kinds.length ? `${kinds.length} legal/contact pages: ${kinds.join(', ')}` : 'no legal pages linked',
    `${ev.scripts.filter((s) => s.body).length} first-party JavaScript files`,
    `robots.txt (${ev.robots?.status ?? 'n/a'})`,
    `sitemap (${ev.sitemap?.valid ? `${ev.sitemap.urls} URLs` : ev.sitemap?.status ?? 'n/a'})`,
    `security.txt (${ev.securityTxt?.body ? 'present' : 'absent'})`,
    `llms.txt (${ev.llms?.present ? 'present' : 'absent'})`,
    'one random 404 path',
    `${(ev.linkCheck || []).length} internal links`,
  ];
  if (ev.twin) parts.push(`${ev.twin.host} (${ev.twin.status || 'no DNS'})`);
  if (ev.tls?.ok) parts.push(`TLS (${ev.tls.protocol}, certificate valid to ${ev.tls.validTo})`);
  if (ev.dns?.resolved) parts.push('DNS (MX, SPF, DMARC, CAA)');
  if (ev.browser?.ran) parts.push(`real-browser load (${ev.browser.requests} requests${ev.browser.renderedPages?.length ? `, ${ev.browser.renderedPages.length} pages rendered` : ''})`);
  return parts;
}

function notRun(ev, opts) {
  const out = [];
  if (!opts.browser) out.push('Real-browser test (cookies set by JavaScript, banner buttons, Core Web Vitals): run with --browser.');
  else if (!ev.browser?.ran) out.push(`Real-browser test: ${ev.browser?.reason}`);
  if (ev.local) out.push('TLS, HTTPS redirect, www twin and DNS: skipped for a local target.');
  if (!opts.subdomains) out.push('Certificate-transparency subdomain discovery: run with --subdomains.');
  if (!opts.repo) out.push('Repository scan (secrets in git history, dependencies, code patterns, CI/CD, IaC): run kagicyber scan <dir> or add --repo <dir>.');
  return out;
}

const PILLAR = { compliance: 'Compliance', security: 'Security', seo: 'SEO/GEO' };

function buildFixFirst(findings, checks, seo) {
  const items = [
    ...findings.filter((f) => ['critical', 'high', 'medium'].includes(f.severity)).map((f) => ({ pillar: PILLAR.security, id: f.id, rank: { critical: 0, high: 1, medium: 3 }[f.severity], level: f.severity.toUpperCase(), title: f.title, why: f.evidence, fix: f.fix, effort: f.effort })),
    ...checks.filter((c) => c.status === 'fail' || c.status === 'partial').map((c) => ({ pillar: PILLAR.compliance, id: c.id, rank: (c.status === 'fail' ? 1 : 2.5) + (3 - c.weight), level: c.status.toUpperCase(), title: c.title, why: c.evidence, fix: c.fix, penalty: c.maxPenalty })),
    ...seo.filter((c) => c.status === 'fail' || (c.status === 'partial' && c.weight >= 2)).map((c) => ({ pillar: PILLAR.seo, id: c.id, rank: (c.status === 'fail' ? 2 : 3.5) + (3 - c.weight), level: c.status.toUpperCase(), title: c.title, why: c.evidence, fix: c.fix })),
  ];
  return items.sort((a, b) => a.rank - b.rank || sevRank(a.level.toLowerCase()) - sevRank(b.level.toLowerCase())).slice(0, 10);
}

function buildStrengths(findings, checks, seo, ev) {
  const s = [];
  if (ev.https && ev.tls?.authorized) s.push(`Valid HTTPS certificate (${ev.tls.issuer || 'trusted CA'}${ev.tls.protocol ? `, ${ev.tls.protocol}` : ''})`);
  const scanned = ev.scripts.filter((x) => x.body).length;
  if (scanned && !ev.scriptsIncomplete && !findings.some((f) => f.key === 'secret' && f.severity !== 'info')) s.push(`No exposed secrets in ${scanned} first-party JavaScript files`);
  if (!ev.sourceMaps.some((m) => m.exposed)) s.push('No public source maps');
  const hd = ev.home.headers;
  const present = ['strict-transport-security', 'content-security-policy', 'x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy'].filter((k) => hd[k]);
  if (present.length >= 3) s.push(`Security headers present: ${present.join(', ')}`);
  for (const c of checks.filter((c) => c.status === 'pass' && c.weight >= 3)) s.push(c.title);
  if (ev.dns?.spf?.length === 1 && !/\+all/.test(ev.dns.spf[0])) s.push('Valid SPF record');
  if (ev.dns?.dmarc?.length && /p=(quarantine|reject)/i.test(ev.dns.dmarc[0])) s.push('DMARC enforced');
  for (const c of seo.filter((c) => c.status === 'pass' && c.weight >= 3)) s.push(c.title);
  return s.slice(0, 8);
}

/**
 * Evidence leaves the process (--json, the API), so secrets in it are masked: every string goes through
 * the secret patterns, cookie values are dropped (names and flags stay) and credential-like hidden form
 * fields are masked.
 */
/** Mask every secret-looking value in every string of an object tree (rows quote titles, URLs and page text). */
export function maskDeep(v) {
  if (typeof v === 'string') return maskSecretsIn(v);
  if (Array.isArray(v)) return v.map(maskDeep);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, maskDeep(x)]));
  return v;
}

function maskEvidence(e) {
  const out = maskDeep(e);
  if (out.home?.setCookies) out.home.setCookies = out.home.setCookies.map((c) => String(c).replace(/^([^=;]+)=([^;]*)/, (_, n, val) => `${n}=${val ? '…' : ''}`));
  for (const f of out.html?.forms || []) {
    if (f.hidden) f.hidden = Object.fromEntries(Object.entries(f.hidden).map(([k, val]) => [k, /key|token|secret|pass|auth|sig/i.test(k) && String(val).length > 4 ? maskSecret(String(val)) : val]));
  }
  return out;
}

/** Evidence used by the law engine and saved with --json. No raw script bodies. */
function slimEvidence(ev) {
  return {
    host: ev.host,
    apex: ev.apex,
    https: ev.https,
    home: { finalUrl: ev.home.finalUrl, status: ev.home.status, headers: ev.home.headers, setCookies: ev.home.setCookies, ttfb: ev.home.ttfb },
    httpRedirect: ev.httpRedirect,
    twin: ev.twin,
    html: {
      lang: ev.html.lang,
      title: ev.html.title,
      metas: ev.html.metas,
      hreflang: ev.html.hreflang,
      canonical: ev.html.canonical,
      headings: ev.html.headings.slice(0, 60),
      links: ev.html.links.slice(0, 400),
      scripts: ev.html.scripts.map((s) => ({ src: s.src, gated: s.gated, integrity: !!s.integrity })),
      iframes: ev.html.iframes,
      forms: ev.html.forms.map(({ innerHtml: _html, ...f }) => f),
      images: ev.html.images,
      inputs: ev.html.inputs,
      jsonLd: ev.html.jsonLd,
      wordCount: ev.html.wordCount,
      clientRendered: ev.html.clientRendered,
      text: ev.html.text,
    },
    pages: ev.pages.map(({ rawSample: _raw, ...p }) => p),
    renderedPages: ev.renderedPages || [],
    linksByKind: ev.linksByKind,
    robots: ev.robots,
    sitemap: ev.sitemap,
    llms: ev.llms,
    securityTxt: ev.securityTxt,
    notFound: { path: ev.notFound?.path, status: ev.notFound?.status, sample: ev.notFound?.sample },
    linkCheck: ev.linkCheck,
    scripts: ev.scripts.map((s) => ({ url: s.url, status: s.status, size: s.size, sourceMap: s.sourceMap || null, cacheControl: s.cacheControl || null })),
    thirdPartyScripts: ev.thirdPartyScripts,
    sourceMaps: ev.sourceMaps,
    tls: ev.tls,
    legacyTls: ev.legacyTls,
    dns: ev.dns,
    dnsDeep: ev.dnsDeep || null,
    subdomains: ev.subdomains || null,
    browser: ev.browser ? { ...ev.browser, renderedPages: undefined } : null,
  };
}
