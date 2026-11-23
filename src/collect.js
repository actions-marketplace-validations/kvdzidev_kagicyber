import { parseHtml } from './html.js';
import { tlsInfo, acceptsLegacyTls, mailDns } from './net.js';
import { LEGAL_KEYWORDS, COMMON_LEGAL_PATHS } from './knowledge.js';
import { apexOf, sameSite, isLocalHost, safeUrl, htmlToText, uniq } from './util.js';
import { assertPublicHost } from './netguard.js';

const TEXT_CAP = 60_000;
const MAX_SCRIPTS = 30;
const LINK_SAMPLE = 8;

export function normalizeTarget(input) {
  let s = String(input || '').trim();
  if (!s) throw new Error('missing target (domain or URL)');
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  const u = safeUrl(s);
  if (!u || !u.hostname) throw new Error(`invalid target: ${input}`);
  return u;
}

export function classifyLink(link) {
  const hay = `${link.text || ''} ${decodeURIComponentSafe(link.href || '')}`.toLowerCase();
  const kinds = [];
  for (const [kind, words] of Object.entries(LEGAL_KEYWORDS)) {
    if (words.some((w) => hay.includes(w.toLowerCase()))) kinds.push(kind);
  }
  return kinds;
}

function decodeURIComponentSafe(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Collect public evidence about a site. Passive: only what a normal visit loads, plus
 * robots.txt, sitemap, security.txt, llms.txt, one random 404 path, the www/non-www twin,
 * a small sample of internal links, same-site source maps, up to four common privacy-policy paths when none
 * is linked, two TLS handshakes (certificate, legacy protocol) and DNS.
 * Independent requests run in parallel within the fetcher's per-host limits.
 */
export async function collect(target, fetcher, { onStep = () => {} } = {}) {
  const url = target instanceof URL ? target : normalizeTarget(target);
  const host = url.hostname;
  const local = isLocalHost(host);
  const ev = {
    input: String(target),
    host,
    apex: apexOf(host),
    local,
    https: null,
    home: null,
    httpRedirect: null,
    html: null,
    pages: [],
    robots: null,
    sitemap: null,
    llms: null,
    securityTxt: null,
    notFound: null,
    twin: null,
    linkCheck: [],
    scripts: [],
    thirdPartyScripts: [],
    sourceMaps: [],
    tls: null,
    legacyTls: null,
    dns: null,
    limitations: [],
  };

  onStep('Fetching homepage');
  let home = await fetcher.get(url.href);
  if (!home.ok && url.protocol === 'https:' && home.status === 0) {
    const httpUrl = new URL(url.href);
    httpUrl.protocol = 'http:';
    const alt = await fetcher.get(httpUrl.href);
    if (alt.status) {
      ev.https = false;
      home = alt;
    }
  }
  if (!home.status) throw new Error(`could not reach ${url.href} (${home.error})`);
  // An error page, a bot block or a file is not the site: scoring it would produce a confident but false report.
  if (home.status >= 400) throw new Error(`could not audit ${home.finalUrl || url.href}: the homepage returned HTTP ${home.status} (an error page, a login wall or a bot/WAF block would give a misleading report)`);
  const ctype = home.headers?.['content-type'] || '';
  if (ctype && !/html|xml/i.test(ctype)) throw new Error(`could not audit ${home.finalUrl || url.href}: the response is ${ctype.split(';')[0]}, not an HTML page`);
  ev.home = { url: home.url, finalUrl: home.finalUrl, status: home.status, headers: home.headers, setCookies: home.setCookies, truncated: home.truncated, ttfb: home.ttfb, bytes: home.bytes ?? (home.body || '').length };
  const finalUrl = new URL(home.finalUrl);
  // Classify first-party links and scripts against the host the site actually lives on after redirects.
  const siteHost = finalUrl.hostname;
  if (!sameSite(siteHost, host)) ev.limitations.push(`${host} redirected to ${siteHost}; the pages and scripts of ${siteHost} were audited.`);
  if (ev.https === null) ev.https = finalUrl.protocol === 'https:';
  const html = home.body || '';
  const parsed = parseHtml(html, finalUrl.href);
  ev.html = { ...parsed, text: parsed.text.slice(0, TEXT_CAP), rawSize: html.length };
  ev.rawHtml = html;
  const origin = finalUrl.origin;

  // Legal-page candidates from homepage links.
  const byKind = {};
  for (const link of parsed.links) {
    if (link.mailto) continue;
    const lu = safeUrl(link.href);
    if (!lu || !sameSite(lu.hostname, siteHost)) continue;
    for (const kind of classifyLink(link)) {
      byKind[kind] ??= [];
      if (!byKind[kind].some((l) => l.href === link.href)) byKind[kind].push(link);
    }
  }
  ev.linksByKind = Object.fromEntries(Object.entries(byKind).map(([k, v]) => [k, v.slice(0, 5)]));

  onStep('Collecting pages, scripts, TLS and DNS in parallel');
  const tasks = [];

  if (ev.https && !local) {
    tasks.push(
      fetcher.get(`http://${host}/`, { redirect: 'manual', maxBytes: 20_000 }).then((r) => {
        ev.httpRedirect = { status: r.status, location: r.headers?.location || null, error: r.error || null };
      })
    );
    const twinHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    tasks.push(
      fetcher.get(`https://${twinHost}/`, { redirect: 'manual', maxBytes: 20_000 }).then((r) => {
        ev.twin = { host: twinHost, status: r.status, location: r.headers?.location || null, error: r.error || null };
      })
    );
  }

  tasks.push(
    (async () => {
      const robots = await fetcher.get(`${origin}/robots.txt`, { maxBytes: 200_000 });
      const ok = robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500));
      ev.robots = { status: robots.status, body: ok ? robots.body.slice(0, 50_000) : null };
      // Only same-site sitemap URLs: robots.txt must not be able to point the audit at another host.
      const fromRobots = ok ? [...robots.body.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).filter((u) => { const x = safeUrl(u); return x && /^https?:$/.test(x.protocol) && sameSite(x.hostname, siteHost); }) : [];
      const smUrl = fromRobots[0] || `${origin}/sitemap.xml`;
      const sm = await fetcher.get(smUrl, { maxBytes: 1_000_000 });
      const isXml = sm.status === 200 && /<(urlset|sitemapindex)\b/i.test(sm.body.slice(0, 5000));
      ev.sitemap = {
        url: smUrl,
        inRobots: fromRobots.length > 0,
        status: sm.status,
        valid: isXml,
        urls: isXml ? (sm.body.match(/<loc>/gi) || []).length : 0,
        lastmod: isXml ? /<lastmod>/i.test(sm.body) : false,
        index: isXml && /<sitemapindex\b/i.test(sm.body),
      };
    })()
  );

  tasks.push(
    fetcher.get(`${origin}/.well-known/security.txt`, { maxBytes: 20_000 }).then((sec) => {
      ev.securityTxt = { status: sec.status, body: sec.status === 200 && /contact:/i.test(sec.body) ? sec.body.slice(0, 5000) : null };
    })
  );
  tasks.push(
    fetcher.get(`${origin}/llms.txt`, { maxBytes: 100_000 }).then((r) => {
      const isText = r.status === 200 && !/<html/i.test(r.body.slice(0, 300)) && r.body.trim().length > 20;
      ev.llms = { status: r.status, present: isText, size: isText ? r.body.length : 0, sample: isText ? r.body.slice(0, 300) : null };
    })
  );
  const rnd = `/__kagicyber_${Math.random().toString(36).slice(2, 10)}`;
  tasks.push(
    fetcher.get(`${origin}${rnd}`, { maxBytes: 200_000 }).then((nf) => {
      ev.notFound = { path: rnd, status: nf.status, sample: htmlToText(nf.body || '').slice(0, 600), bodyRaw: (nf.body || '').slice(0, 20_000), sameAsHome: nf.status === 200 && (nf.body || '').slice(0, 2000) === html.slice(0, 2000) };
    })
  );

  // Legal pages.
  const wanted = ['privacy', 'cookies', 'terms', 'imprint', 'contact', 'accessibility', 'returns'];
  const fetched = new Map();
  for (const kind of wanted) {
    const link = byKind[kind]?.[0];
    if (!link) continue;
    if (fetched.has(link.href)) {
      ev.pages.push({ kind, url: link.href, linkText: link.text, sameAs: true });
      continue;
    }
    const p = fetcher.get(link.href, { maxBytes: 2_000_000 }).then((r) => pageRecord(kind, link, r));
    fetched.set(link.href, p);
    tasks.push(p.then((rec) => ev.pages.push(rec)));
  }
  if (!byKind.privacy) {
    tasks.push(
      (async () => {
        for (const path of COMMON_LEGAL_PATHS.privacy) {
          const p = await fetcher.get(`${origin}${path}`, { maxBytes: 2_000_000 });
          if (p.status === 200 && htmlToText(p.body).length > 500 && (p.body || '').slice(0, 2000) !== html.slice(0, 2000)) {
            ev.pages.push({ ...pageRecord('privacy', { href: `${origin}${path}`, text: '' }, p), guessed: true });
            break;
          }
        }
      })()
    );
  }

  // Sample of internal links (broken-link check).
  const internal = uniq(
    parsed.links
      .filter((l) => !l.mailto)
      .map((l) => safeUrl(l.href))
      .filter((u) => u && sameSite(u.hostname, siteHost) && /^https?:$/.test(u.protocol) && !/\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|docx?)$/i.test(u.pathname))
      .map((u) => `${u.origin}${u.pathname}`)
      .filter((u) => u !== `${origin}/` && u !== finalUrl.href)
  ).slice(0, LINK_SAMPLE);
  for (const link of internal) {
    tasks.push(
      fetcher.get(link, { maxBytes: 16_000 }).then((r) => {
        ev.linkCheck.push({ url: link, status: r.status, error: r.error || null });
      })
    );
  }

  // First-party scripts (breadth-first, parallel).
  tasks.push(collectScripts(ev, parsed, fetcher, siteHost, origin));

  if (ev.https && !local) {
    tasks.push(
      (async () => {
        if (fetcher.publicOnly) {
          try {
            await assertPublicHost(finalUrl.hostname, fetcher.lookup);
          } catch {
            ev.limitations.push('TLS checks skipped: the host does not resolve to a public address.');
            return;
          }
        }
        ev.tls = await tlsInfo(finalUrl.hostname);
        ev.legacyTls = await acceptsLegacyTls(finalUrl.hostname);
        if (ev.legacyTls === null) ev.limitations.push('TLS 1.0/1.1 support could not be tested from this machine (local OpenSSL refuses legacy protocols).');
      })()
    );
  }
  if (!local) {
    tasks.push(
      mailDns(ev.apex).then((d) => {
        ev.dns = d;
        if (!d.resolved) ev.limitations.push('DNS lookups failed from this machine; SPF/DMARC not verified.');
      })
    );
  }

  await Promise.all(tasks);

  onStep('Checking source maps');
  await Promise.all(
    ev.scripts
      .filter((x) => x.sourceMap)
      .slice(0, 5)
      .map(async (s) => {
        const r = await fetcher.get(s.sourceMap, { maxBytes: 300_000 });
        ev.sourceMaps.push({ script: s.url, map: s.sourceMap, status: r.status, exposed: r.status === 200 && /"sources"\s*:/.test(r.body || '') });
      })
  );

  ev.pages.sort((a, b) => wanted.indexOf(a.kind) - wanted.indexOf(b.kind));
  if (fetcher.skipped) ev.limitations.push(`${fetcher.skipped} request(s) were not made because the request budget (${fetcher.maxRequests}) ran out; checks that needed them are marked MANUAL or not run. Raise it with --max-requests.`);
  const failed = fetcher.log.filter((l) => !l.status && l.error && l.error !== 'request budget exhausted').length;
  if (failed) ev.limitations.push(`${failed} request(s) failed (timeout or network error); checks that needed them are marked MANUAL or not run.`);
  ev.requests = fetcher.count;
  ev.requestLog = fetcher.log;
  return ev;
}

async function collectScripts(ev, parsed, fetcher, host, origin) {
  const queue = [];
  for (const s of uniq([...parsed.scripts.map((x) => x.src), ...parsed.preloads.map((p) => p.href)])) {
    const su = safeUrl(s);
    if (!su) continue;
    if (sameSite(su.hostname, host)) queue.push(su.href);
    else ev.thirdPartyScripts.push(s);
  }
  const seen = new Set();
  while (queue.length && seen.size < MAX_SCRIPTS && fetcher.remaining > 12) {
    const batch = [];
    while (queue.length && batch.length < 8 && seen.size + batch.length < MAX_SCRIPTS) {
      const s = queue.shift();
      if (!seen.has(s) && !batch.includes(s)) batch.push(s);
    }
    batch.forEach((s) => seen.add(s));
    const results = await Promise.all(batch.map((s) => fetcher.get(s, { maxBytes: 4_000_000 }).then((r) => [s, r])));
    for (const [s, r] of results) {
      if (r.status !== 200) {
        ev.scripts.push({ url: s, status: r.status, size: 0 });
        continue;
      }
      const body = r.body || '';
      const rec = { url: s, status: r.status, size: body.length, body, cacheControl: r.headers?.['cache-control'] || null, encoding: r.headers?.['content-encoding'] || null };
      // Source maps are only fetched from the site itself; a malformed URL is skipped, not fatal.
      const sm = body.match(/\/\/[#@] sourceMappingURL=([^\s'"]+)\s*$/m);
      const mapRef = r.headers?.sourcemap || r.headers?.['x-sourcemap'] || (sm && !sm[1].startsWith('data:') ? sm[1] : null);
      const mapUrl = mapRef ? safeUrl(mapRef, s) : null;
      if (mapUrl && /^https?:$/.test(mapUrl.protocol) && sameSite(mapUrl.hostname, host)) rec.sourceMap = mapUrl.href;
      ev.scripts.push(rec);
      for (const m of body.matchAll(/["'`]((?:\.{1,2}\/|\/)?(?:_next\/static|static\/js|assets|js|chunks|dist|_nuxt|_astro|_app)[\w\-/.]*\.m?js)["'`]/g)) {
        const ref = m[1];
        const abs = ref.startsWith('.') ? safeUrl(ref, s) : safeUrl(ref.startsWith('/') ? ref : `/${ref}`, origin);
        if (abs && sameSite(abs.hostname, host) && !seen.has(abs.href) && !queue.includes(abs.href)) queue.push(abs.href);
      }
    }
  }
  if (queue.length) ev.limitations.push(`Scanned ${seen.size} first-party scripts; ${queue.length} more were referenced but not downloaded (request budget).`);
  // Scripts that never arrived (timeout, budget) may hold trackers or secrets: checks that rely on them must not PASS.
  const lost = ev.scripts.filter((x) => !x.status).length;
  const parts = [lost && `${lost} first-party script(s) could not be downloaded`, queue.length && `${queue.length} referenced script(s) were not downloaded`].filter(Boolean);
  ev.scriptsIncomplete = parts.length ? parts.join(' and ') : null;
}

function pageRecord(kind, link, p) {
  const text = htmlToText(p.body || '');
  return {
    kind,
    url: link.href,
    linkText: link.text || '',
    status: p.status,
    error: p.error || null,
    finalUrl: p.finalUrl,
    contentType: p.headers?.['content-type'] || null,
    textLength: text.length,
    text: text.slice(0, TEXT_CAP),
    rawSample: (p.body || '').slice(0, 4000),
    lang: (p.body || '').match(/<html\b[^>]*\blang=["']?([\w-]+)/i)?.[1] || null,
  };
}

export function isSoft404(page, notFound) {
  if (!notFound || notFound.status !== 200) return false;
  const a = htmlToText(page.body || '').slice(0, 600);
  return a === notFound.sample;
}
