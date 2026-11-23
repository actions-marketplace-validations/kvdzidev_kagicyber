import { truncate, safeUrl } from '../util.js';

/**
 * Technical SEO and GEO (generative engine optimisation) checks: the on-page, crawlability and
 * performance basics of common SEO checkers, plus the signals AI search engines and assistants
 * rely on: crawler access, content that does not need JavaScript, llms.txt and entity data.
 * Status: pass | partial | fail | na. Weight: 3 critical, 2 important, 1 nice to have.
 */
export const AI_BOTS = [
  { ua: 'GPTBot', owner: 'OpenAI (training)', search: false },
  { ua: 'OAI-SearchBot', owner: 'OpenAI (ChatGPT search)', search: true },
  { ua: 'ChatGPT-User', owner: 'OpenAI (user browsing)', search: true },
  { ua: 'ClaudeBot', owner: 'Anthropic (training)', search: false },
  { ua: 'Claude-SearchBot', owner: 'Anthropic (search)', search: true },
  { ua: 'Claude-User', owner: 'Anthropic (user browsing)', search: true },
  { ua: 'PerplexityBot', owner: 'Perplexity (search)', search: true },
  { ua: 'Google-Extended', owner: 'Google (Gemini training)', search: false },
  { ua: 'Applebot-Extended', owner: 'Apple (AI training)', search: false },
  { ua: 'CCBot', owner: 'Common Crawl', search: false },
  { ua: 'Bytespider', owner: 'ByteDance', search: false },
  { ua: 'meta-externalagent', owner: 'Meta (AI)', search: false },
];

/** Minimal robots.txt evaluation: is "/" disallowed for this user agent? */
export function robotsBlocks(robotsTxt, ua) {
  if (!robotsTxt) return false;
  const groups = [];
  let cur = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (!lastWasAgent || !cur) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (cur && (key === 'disallow' || key === 'allow')) cur.rules.push({ type: key, path: val });
    }
  }
  const lc = ua.toLowerCase();
  const group = groups.find((g) => g.agents.some((a) => a !== '*' && lc.includes(a))) || groups.find((g) => g.agents.includes('*'));
  if (!group) return false;
  const disallowAll = group.rules.some((r) => r.type === 'disallow' && (r.path === '/' || r.path === '/*'));
  const allowAll = group.rules.some((r) => r.type === 'allow' && (r.path === '/' || r.path === ''));
  return disallowAll && !allowAll;
}

function check(id, key, title, weight, status, evidence, why, fix) {
  return { id, key, title, weight, status, evidence, why, fix };
}

export function runSeoChecks(ev, { tech = [] } = {}) {
  const out = [];
  const h = ev.html;
  const m = h.metas || {};
  const headers = ev.home.headers || {};

  // On-page basics
  {
    const t = (h.title || '').trim();
    const len = [...t].length;
    out.push(
      !t
        ? check('SEO-01', 'title', 'Title tag', 3, 'fail', 'No <title>.', 'The title is the main headline in search results and AI answers.', 'Add a unique title of 30 to 60 characters with the main keyword and brand.')
        : len < 15 || len > 65
          ? check('SEO-01', 'title', 'Title tag', 3, 'partial', `${len} characters: "${truncate(t, 80)}".`, 'Titles outside roughly 15 to 65 characters get rewritten or truncated in results.', 'Aim for 30 to 60 characters.')
          : check('SEO-01', 'title', 'Title tag', 3, 'pass', `${len} characters: "${truncate(t, 80)}".`, '', '')
    );
  }
  {
    const d = (m.description || '').trim();
    const len = [...d].length;
    out.push(
      !d
        ? check('SEO-02', 'meta-description', 'Meta description', 2, 'fail', 'No meta description.', 'Search engines and link previews use it as the snippet.', 'Write a 120 to 160 character description of the page.')
        : len < 50 || len > 170
          ? check('SEO-02', 'meta-description', 'Meta description', 2, 'partial', `${len} characters.`, 'Descriptions outside roughly 50 to 160 characters are cut or replaced.', 'Aim for 120 to 160 characters.')
          : check('SEO-02', 'meta-description', 'Meta description', 2, 'pass', `${len} characters.`, '', '')
    );
  }
  {
    const h1 = h.headings.filter((x) => x.level === 1);
    const levels = h.headings.map((x) => x.level);
    const skipped = levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
    if (!h1.length) out.push(check('SEO-03', 'h1', 'One H1 heading', 2, 'fail', h.clientRendered ? 'No H1 in the HTML (headings are rendered by JavaScript).' : 'No H1 heading.', 'The H1 tells crawlers what the page is about.', 'Add exactly one H1 with the page topic.'));
    else if (h1.length > 1) out.push(check('SEO-03', 'h1', 'One H1 heading', 2, 'partial', `${h1.length} H1 headings.`, 'Several H1s dilute the main topic.', 'Keep one H1; use H2/H3 below it.'));
    else out.push(check('SEO-03', 'h1', 'One H1 heading', 2, skipped ? 'partial' : 'pass', `"${truncate(h1[0].text, 70)}"${skipped ? '; heading levels skip (e.g. H1 to H3)' : ''}.`, skipped ? 'A logical heading outline helps crawlers and screen readers.' : '', skipped ? 'Do not skip heading levels.' : ''));
  }
  {
    const total = h.images.total;
    out.push(
      !total
        ? check('SEO-04', 'img-alt', 'Image alt text', 1, 'na', 'No <img> elements in the HTML.', '', '')
        : h.images.missingAlt
          ? check('SEO-04', 'img-alt', 'Image alt text', 1, 'partial', `${h.images.missingAlt}/${total} images without alt.`, 'Alt text is how image content gets indexed and read aloud.', 'Describe each meaningful image in its alt attribute; use alt="" for decoration.')
          : check('SEO-04', 'img-alt', 'Image alt text', 1, 'pass', `${total}/${total} images have alt.`, '', '')
    );
  }
  {
    const c = h.canonical;
    const final = safeUrl(ev.home.finalUrl);
    if (!c) out.push(check('SEO-05', 'canonical', 'Canonical URL', 2, 'partial', 'No rel="canonical".', 'Without a canonical, duplicates (http/https, www, parameters) compete with each other.', 'Add <link rel="canonical" href="https://your-domain/page"> on every page.'));
    else {
      const cu = safeUrl(c.href);
      const okHost = cu && final && cu.hostname === final.hostname;
      const absolute = /^https?:\/\//i.test(c.raw || '');
      out.push(okHost && absolute ? check('SEO-05', 'canonical', 'Canonical URL', 2, 'pass', c.href, '', '') : check('SEO-05', 'canonical', 'Canonical URL', 2, 'partial', `${c.raw}${!absolute ? ' (relative)' : ''}${!okHost ? ` (host differs from ${final?.hostname})` : ''}.`, 'Canonicals should be absolute and point to the preferred host.', 'Use an absolute canonical URL on the preferred host.'));
    }
  }
  {
    const robotsMeta = `${m.robots || ''} ${m.googlebot || ''} ${headers['x-robots-tag'] || ''}`.toLowerCase();
    out.push(/noindex|\bnone\b/.test(robotsMeta) ? check('SEO-06', 'indexable', 'Homepage is indexable', 3, 'fail', `noindex found (${robotsMeta.trim()}).`, 'noindex removes the page from search and AI results.', 'Remove noindex from pages that should rank.') : check('SEO-06', 'indexable', 'Homepage is indexable', 3, 'pass', 'No noindex in meta robots or X-Robots-Tag.', '', ''));
  }
  {
    const langs = h.hreflang || [];
    if (!h.lang) out.push(check('SEO-07', 'lang', 'Language declared (lang, hreflang)', 2, 'fail', 'No <html lang>.', 'Search engines use it to serve the right language version.', 'Set <html lang="..."> on every page.'));
    else if (!langs.length) out.push(check('SEO-07', 'lang', 'Language declared (lang, hreflang)', 2, 'pass', `lang="${h.lang}", single language version.`, '', ''));
    else {
      const bad = langs.filter((x) => !/^(x-default|[a-z]{2,3}(-[A-Za-z]{2}|-[A-Za-z]{4})?)$/i.test(x.lang));
      const self = langs.some((x) => x.href.replace(/\/$/, '') === ev.home.finalUrl.replace(/\/$/, ''));
      const xdef = langs.some((x) => /x-default/i.test(x.lang));
      const issues = [bad.length && `invalid codes: ${bad.map((x) => x.lang).join(', ')}`, !self && 'no self-reference', langs.length > 1 && !xdef && 'no x-default'].filter(Boolean);
      out.push(check('SEO-07', 'lang', 'Language declared (lang, hreflang)', 2, issues.length ? 'partial' : 'pass', `lang="${h.lang}"; hreflang: ${langs.map((x) => x.lang).join(', ')}${issues.length ? `; ${issues.join('; ')}` : ''}.`, issues.length ? 'Broken hreflang sets are ignored by search engines.' : '', issues.length ? 'Each language version must list all versions including itself, plus x-default.' : ''));
    }
  }
  {
    const og = ['og:title', 'og:description', 'og:image'].filter((k) => !m[k]);
    const tw = m['twitter:card'];
    out.push(og.length ? check('SEO-08', 'social', 'Open Graph and Twitter cards', 1, og.length === 3 ? 'fail' : 'partial', `Missing: ${og.join(', ')}${tw ? '' : ', twitter:card'}.`, 'Controls how links look when shared and how some assistants preview pages.', 'Add og:title, og:description, og:image (1200x630) and twitter:card.') : check('SEO-08', 'social', 'Open Graph and Twitter cards', 1, tw ? 'pass' : 'partial', `og:title, og:description, og:image present${tw ? `, twitter:card=${tw}` : '; no twitter:card'}.`, '', tw ? '' : 'Add <meta name="twitter:card" content="summary_large_image">.'));
  }
  {
    const issues = [];
    if (!/width=device-width/i.test(m.viewport || '')) issues.push('no responsive viewport meta');
    if (!h.doctype) issues.push('no <!doctype html>');
    if (!/charset/i.test(ev.rawHtml.slice(0, 2000)) && !/charset/i.test(headers['content-type'] || '')) issues.push('no charset declaration');
    if (!h.icons.length) issues.push('no favicon link');
    out.push(issues.length ? check('SEO-09', 'technical-basics', 'Mobile viewport, doctype, charset, favicon', 1, 'partial', `${issues.join('; ')}.`, 'Basic hygiene that search engines and browsers expect.', 'Add the missing tags.') : check('SEO-09', 'technical-basics', 'Mobile viewport, doctype, charset, favicon', 1, 'pass', 'Viewport, doctype, charset and favicon present.', '', ''));
  }
  {
    const blocks = [];
    const types = new Set();
    let invalid = 0;
    for (const raw of h.jsonLd || []) {
      try {
        const j = JSON.parse(raw);
        const items = Array.isArray(j) ? j : j['@graph'] || [j];
        for (const it of items) [].concat(it['@type'] || []).forEach((t) => types.add(t));
        blocks.push(j);
      } catch {
        invalid++;
      }
    }
    if (!blocks.length && !invalid) out.push(check('SEO-10', 'structured-data', 'Structured data (schema.org JSON-LD)', 2, 'fail', 'No JSON-LD structured data.', 'Structured data feeds rich results and helps AI systems identify the business.', 'Add Organization (or LocalBusiness) and WebSite JSON-LD; add FAQPage/Product/Article where relevant.'));
    else out.push(check('SEO-10', 'structured-data', 'Structured data (schema.org JSON-LD)', 2, invalid ? 'partial' : 'pass', `${blocks.length} block(s), types: ${[...types].join(', ') || 'none'}${invalid ? `; ${invalid} block(s) are not valid JSON` : ''}.`, invalid ? 'Invalid JSON-LD is ignored.' : '', invalid ? 'Fix the JSON syntax (validate with the Schema Markup Validator).' : ''));
    ev._schemaTypes = [...types];
    ev._schemaBlocks = blocks;
  }

  // Crawlability
  {
    const r = ev.robots;
    if (r && !r.status) out.push(check('SEO-11', 'robots-txt', 'robots.txt', 2, 'manual', 'robots.txt could not be fetched (timeout, network error or request budget); not verified.', '', ''));
    else if (!r || r.status !== 200 || !r.body) out.push(check('SEO-11', 'robots-txt', 'robots.txt', 2, 'partial', `robots.txt ${r ? `returned HTTP ${r.status}${r.status === 200 ? ' with HTML (SPA fallback)' : ''}` : 'not fetched'}.`, 'Crawlers look for it first; a missing file is fine but you lose control and the sitemap hint.', 'Serve a plain-text robots.txt with a Sitemap: line.'));
    else if (robotsBlocks(r.body, 'Googlebot')) out.push(check('SEO-11', 'robots-txt', 'robots.txt', 2, 'fail', 'Disallows the whole site for Googlebot.', 'The site cannot be crawled.', 'Remove "Disallow: /" for search engines.'));
    else out.push(check('SEO-11', 'robots-txt', 'robots.txt', 2, 'pass', `Present, allows search engines${ev.sitemap?.inRobots ? ', references the sitemap' : ''}.`, '', ''));
  }
  {
    const s = ev.sitemap;
    if (s && !s.status) out.push(check('SEO-12', 'sitemap', 'XML sitemap', 2, 'manual', `${s.url} could not be fetched (timeout, network error or request budget); not verified.`, '', ''));
    else if (!s || !s.valid) out.push(check('SEO-12', 'sitemap', 'XML sitemap', 2, 'fail', `No valid sitemap at ${s?.url || '/sitemap.xml'}${s ? ` (HTTP ${s.status})` : ''}.`, 'Sitemaps help search engines and AI crawlers find every page.', 'Publish sitemap.xml and reference it in robots.txt.'));
    else {
      const issues = [!s.inRobots && 'not referenced in robots.txt', !s.lastmod && 'no <lastmod> dates'].filter(Boolean);
      out.push(check('SEO-12', 'sitemap', 'XML sitemap', 2, issues.length ? 'partial' : 'pass', `${s.index ? 'Sitemap index' : `${s.urls} URL(s)`} at ${s.url}${issues.length ? `; ${issues.join('; ')}` : ''}.`, issues.length ? 'lastmod tells crawlers what changed; the robots.txt line helps discovery.' : '', issues.length ? 'Add lastmod to each URL and a Sitemap: line to robots.txt.' : ''));
    }
  }
  {
    const nf = ev.notFound;
    // PASS only on a real 404 or 410; no answer is not verified, any other status is not a proper "not found".
    if (!nf || !nf.status) out.push(check('SEO-13', 'soft-404', 'Missing pages return HTTP 404', 2, 'manual', `The 404 probe ${nf?.path || ''} got no response; not verified.`, '', ''));
    else if (![200, 404, 410].includes(nf.status)) out.push(check('SEO-13', 'soft-404', 'Missing pages return HTTP 404', 2, 'partial', `GET ${nf.path} returned ${nf.status} instead of 404.`, 'Crawlers treat 5xx as a temporary error and keep retrying; 403 hides that the page does not exist.', 'Return 404 (or 410) for unknown URLs.'));
    else out.push(nf.status === 200 ? check('SEO-13', 'soft-404', 'Missing pages return HTTP 404', 2, 'fail', `GET ${nf.path} returned 200${nf.sameAsHome ? ' with the homepage HTML' : ''}.`, 'Soft 404s waste crawl budget and can get thin pages indexed.', 'Return a real 404 status for unknown URLs (prerender a 404 page or configure the server fallback).') : check('SEO-13', 'soft-404', 'Missing pages return HTTP 404', 2, 'pass', `Unknown URL returned ${nf?.status}.`, '', ''));
  }
  {
    const t = ev.twin;
    if (!t || ev.local) out.push(check('SEO-14', 'canonical-host', 'One canonical host (www vs non-www, http vs https)', 2, 'na', 'Not tested (local target).', '', ''));
    else {
      const main = safeUrl(ev.home.finalUrl).hostname;
      const toMain = [301, 308].includes(t.status) && (t.location || '').includes(main);
      const temp = [302, 303, 307].includes(t.status) && (t.location || '').includes(main);
      const httpOk = !ev.httpRedirect || [301, 308].includes(ev.httpRedirect.status);
      if (t.status === 0 && t.error && !/ENOTFOUND|EAI_AGAIN|ENODATA/.test(t.error)) out.push(check('SEO-14', 'canonical-host', 'One canonical host (www vs non-www, http vs https)', 2, 'manual', `${t.host} could not be checked (${t.error}).`, '', ''));
      else if (t.status === 0) out.push(check('SEO-14', 'canonical-host', 'One canonical host (www vs non-www, http vs https)', 2, httpOk ? 'pass' : 'partial', `${t.host} does not resolve${httpOk ? '' : `; http:// answers ${ev.httpRedirect.status}`}.`, '', httpOk ? '' : 'Redirect http:// to https:// with 301.'));
      else if (toMain && httpOk) out.push(check('SEO-14', 'canonical-host', 'One canonical host (www vs non-www, http vs https)', 2, 'pass', `${t.host} redirects (${t.status}) to ${main}.`, '', ''));
      else out.push(check('SEO-14', 'canonical-host', 'One canonical host (www vs non-www, http vs https)', 2, 'partial', `${t.host} answers ${t.status}${t.location ? ` to ${t.location}` : ' without redirecting'}${temp ? ' (temporary redirect)' : ''}${!httpOk ? `; http:// answers ${ev.httpRedirect.status}` : ''}.`, 'Two hosts serving the same content split ranking signals.', `Redirect ${t.host} to ${main} with a 301.`));
    }
  }
  {
    // Links that got no answer (timeout, budget) are unchecked, not broken.
    const lc = (ev.linkCheck || []).filter((l) => l.status > 0);
    const unchecked = (ev.linkCheck || []).length - lc.length;
    const broken = lc.filter((l) => l.status >= 400);
    if (!lc.length && unchecked) out.push(check('SEO-15', 'broken-links', 'Internal links work', 2, 'manual', `${unchecked} sampled link(s) got no response (timeout, network error or request budget); not verified.`, '', ''));
    else out.push(!lc.length ? check('SEO-15', 'broken-links', 'Internal links work', 2, 'na', 'No internal links found in the HTML.', '', '') : broken.length ? check('SEO-15', 'broken-links', 'Internal links work', 2, 'fail', `${broken.length}/${lc.length} sampled links broken: ${broken.slice(0, 3).map((b) => `${new URL(b.url).pathname} (${b.status || b.error})`).join(', ')}.`, 'Broken links waste crawl budget and frustrate users.', 'Fix or remove the broken links.') : check('SEO-15', 'broken-links', 'Internal links work', 2, 'pass', `${lc.length}/${lc.length} sampled internal links return 2xx/3xx.`, '', ''));
  }

  // Performance
  {
    const ttfb = ev.home.ttfb;
    out.push(ttfb == null ? check('SEO-16', 'ttfb', 'Server response time', 2, 'na', 'Not measured.', '', '') : check('SEO-16', 'ttfb', 'Server response time', 2, ttfb <= 800 ? 'pass' : ttfb <= 1800 ? 'partial' : 'fail', `Time to first byte ${ttfb} ms (measured from the scanner).`, ttfb <= 800 ? '' : 'Slow responses hurt Core Web Vitals and crawl rate.', ttfb <= 800 ? '' : 'Add caching or a CDN; check server load.'));
  }
  {
    const enc = headers['content-encoding'];
    out.push(enc && /gzip|br|zstd|deflate/i.test(enc) ? check('SEO-17', 'compression', 'Compression', 1, 'pass', `HTML served with ${enc}.`, '', '') : check('SEO-17', 'compression', 'Compression', 1, ev.local ? 'na' : 'partial', 'HTML served without gzip/brotli.', 'Compression cuts transfer size by 60 to 80%.', 'Enable gzip or brotli on the server.'));
  }
  {
    const js = (ev.scripts || []).reduce((s, x) => s + (x.size || 0), 0);
    const kb = Math.round(js / 1024);
    const htmlKb = Math.round((ev.html.rawSize || 0) / 1024);
    const weight = js <= 600_000 && htmlKb <= 200 ? 'pass' : js <= 1_500_000 ? 'partial' : 'fail';
    // A light total is not proof when scripts were not downloaded.
    out.push(check('SEO-18', 'page-weight', 'Page weight (HTML and first-party JavaScript)', 2, weight === 'pass' && ev.scriptsIncomplete ? 'manual' : weight, `HTML ${htmlKb} KB, first-party JavaScript ${kb} KB uncompressed in ${(ev.scripts || []).filter((s) => s.size).length} files.`, js > 600_000 ? 'Heavy JavaScript delays rendering and interaction (LCP, INP).' : '', js > 600_000 ? 'Split code per route, remove unused libraries, defer non-critical scripts.' : ''));
  }
  {
    const n = h.headBlockingScripts;
    out.push(n ? check('SEO-19', 'render-blocking', 'No render-blocking scripts', 1, 'partial', `${n} script(s) in <head> without async/defer.`, 'Blocking scripts delay the first paint.', 'Add defer (or async) to scripts in <head>.') : check('SEO-19', 'render-blocking', 'No render-blocking scripts', 1, 'pass', 'Scripts in <head> are async, deferred or modules.', '', ''));
  }
  {
    const first = (ev.scripts || []).find((s) => s.status === 200);
    const cc = first?.cacheControl || '';
    const maxAge = Number((cc.match(/max-age=(\d+)/) || [])[1] || 0);
    out.push(!first ? check('SEO-20', 'caching', 'Static assets are cached', 1, 'na', 'No first-party scripts to test.', '', '') : maxAge >= 86400 || /immutable/.test(cc) ? check('SEO-20', 'caching', 'Static assets are cached', 1, 'pass', `${new URL(first.url).pathname}: Cache-Control ${cc}.`, '', '') : check('SEO-20', 'caching', 'Static assets are cached', 1, 'partial', `${new URL(first.url).pathname}: Cache-Control ${cc || 'missing'}.`, 'Repeat visits re-download assets.', 'Serve hashed assets with Cache-Control: public, max-age=31536000, immutable.'));
  }
  {
    const i = h.images;
    out.push(!i.total ? check('SEO-21', 'images', 'Images: dimensions and modern formats', 1, 'na', 'No <img> elements in the HTML.', '', '') : check('SEO-21', 'images', 'Images: dimensions and modern formats', 1, i.noDimensions === 0 ? 'pass' : 'partial', `${i.total} images: ${i.noDimensions} without width/height, ${i.modern} WebP/AVIF/SVG, ${i.lazy} lazy-loaded.`, i.noDimensions ? 'Missing dimensions cause layout shift (CLS).' : '', i.noDimensions ? 'Add width and height to every image; serve WebP/AVIF.' : ''));
  }
  if (ev.browser?.vitals) {
    const v = ev.browser.vitals;
    const lcp = v.lcp;
    out.push(check('SEO-22', 'lcp', 'Largest Contentful Paint (lab, scanner location)', 2, lcp == null ? 'na' : lcp <= 2500 ? 'pass' : lcp <= 4000 ? 'partial' : 'fail', `LCP ${lcp ?? 'n/a'} ms, CLS ${v.cls ?? 'n/a'} (single headless load).`, lcp > 2500 ? 'LCP is a Core Web Vitals ranking signal.' : '', lcp > 2500 ? 'Optimise the hero image/text, server response and blocking resources.' : ''));
  }

  // GEO: generative engine optimisation
  {
    const r = ev.robots?.body || '';
    const blocked = AI_BOTS.filter((b) => robotsBlocks(r, b.ua));
    const searchBlocked = blocked.filter((b) => b.search);
    // Only a robots.txt that was read (200) or is absent (404/410) tells us who is allowed.
    const robotsKnown = ev.robots && [200, 404, 410].includes(ev.robots.status);
    out.push(
      !robotsKnown
        ? check('GEO-01', 'ai-crawlers', 'AI search crawlers may access the site', 2, 'manual', `robots.txt ${ev.robots?.status ? `returned HTTP ${ev.robots.status}` : 'could not be fetched'}; AI crawler access not verified.`, '', '')
        : searchBlocked.length
        ? check('GEO-01', 'ai-crawlers', 'AI search crawlers may access the site', 2, 'partial', `Blocked in robots.txt: ${blocked.map((b) => b.ua).join(', ')}.`, 'Blocked AI search bots cannot cite the site in ChatGPT, Claude or Perplexity answers.', 'Allow the search/user agents (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, Claude-User, PerplexityBot); you can still block training bots.')
        : check('GEO-01', 'ai-crawlers', 'AI search crawlers may access the site', 2, 'pass', blocked.length ? `Search bots allowed; training bots blocked: ${blocked.map((b) => b.ua).join(', ')}.` : 'No AI crawler is blocked in robots.txt.', '', '')
    );
  }
  {
    const words = h.wordCount;
    const rendered = ev.browser?.renderedWords;
    const ratio = rendered ? words / Math.max(rendered, 1) : null;
    if (h.clientRendered || (ratio !== null && ratio < 0.3)) out.push(check('GEO-02', 'no-js-content', 'Content readable without JavaScript', 3, 'fail', `The HTML contains ${words} words${rendered ? ` versus ${rendered} after rendering` : ''}; the page is built in the browser${tech.some((t) => t.category === 'Framework' || t.category === 'JS library') ? ` (${tech.filter((t) => ['Framework', 'JS library', 'Build tool'].includes(t.category)).map((t) => t.name).join(', ')})` : ''}.`, 'Most AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and link previews do not run JavaScript, so they see an empty page.', 'Pre-render or server-render pages (e.g. vite-plugin-ssr/vike, react-snap, Astro, Next.js SSG) so the main text is in the HTML.'));
    else out.push(check('GEO-02', 'no-js-content', 'Content readable without JavaScript', 3, words >= 150 ? 'pass' : 'partial', `${words} words in the HTML${rendered ? ` (${rendered} after rendering)` : ''}.`, words >= 150 ? '' : 'Thin HTML content gives crawlers little to understand.', words >= 150 ? '' : 'Put the main text in the HTML.'));
  }
  {
    const l = ev.llms;
    if (l && !l.status) out.push(check('GEO-03', 'llms-txt', 'llms.txt for AI assistants', 1, 'manual', '/llms.txt could not be fetched; not verified.', '', ''));
    else out.push(l?.present ? check('GEO-03', 'llms-txt', 'llms.txt for AI assistants', 1, 'pass', `/llms.txt present (${l.size} bytes).`, '', '') : check('GEO-03', 'llms-txt', 'llms.txt for AI assistants', 1, 'partial', `/llms.txt not found (HTTP ${l?.status ?? 'n/a'}${l?.status === 200 ? ', HTML fallback' : ''}).`, 'llms.txt is an emerging convention that gives assistants a clean summary and link list of the site.', 'Publish /llms.txt with a one-paragraph summary and links to key pages (services, pricing, contact, FAQ).'));
  }
  {
    const types = ev._schemaTypes || [];
    const ent = (ev._schemaBlocks || []).flatMap((j) => (Array.isArray(j) ? j : j['@graph'] || [j])).find((it) => [].concat(it['@type'] || []).some((t) => /Organization|LocalBusiness|Person|Corporation|ProfessionalService|Store/.test(t)));
    if (!ent) out.push(check('GEO-04', 'entity', 'Entity data (Organization with contact and sameAs)', 2, 'fail', `No Organization/LocalBusiness schema${types.length ? ` (types found: ${types.join(', ')})` : ''}.`, 'Assistants identify a business from structured entity data.', 'Add Organization or LocalBusiness JSON-LD with name, url, logo, address, contactPoint and sameAs links to your social profiles.'));
    else {
      const missing = ['name', 'url', 'logo'].filter((k) => !ent[k]);
      const social = (ev.html.links || []).filter((l) => /(facebook|instagram|linkedin|youtube|tiktok|x\.com|twitter)\.com/i.test(l.href)).length;
      const sameAs = [].concat(ent.sameAs || []).filter(Boolean);
      if (!sameAs.length) missing.push(`sameAs${social ? ` (the page links ${social} social profiles)` : ''}`);
      if (!ent.address?.streetAddress && !ent.address?.addressLocality) missing.push('address');
      out.push(check('GEO-04', 'entity', 'Entity data (Organization with contact and sameAs)', 2, missing.length ? 'partial' : 'pass', `${[].concat(ent['@type']).join('/')} "${ent.name || ''}"${missing.length ? `; missing: ${missing.join(', ')}` : ''}.`, missing.length ? 'Complete entity data lets assistants connect the site to its profiles and location.' : '', missing.length ? 'Fill the missing properties (sameAs = list of your official profile URLs).' : ''));
    }
  }
  {
    const types = ev._schemaTypes || [];
    const faqLink = (ev.html.links || []).some((l) => /\bfaq\b|czeste-pytania|pytania|haeufige-fragen|questions/i.test(`${l.href} ${l.text}`));
    out.push(types.includes('FAQPage') ? check('GEO-05', 'faq', 'Question-and-answer content marked up', 1, 'pass', 'FAQPage schema present.', '', '') : faqLink ? check('GEO-05', 'faq', 'Question-and-answer content marked up', 1, 'partial', 'FAQ page linked but no FAQPage schema on the homepage.', 'Q&A content is what assistants quote most often.', 'Add FAQPage JSON-LD to the FAQ page and keep answers in the HTML.') : check('GEO-05', 'faq', 'Question-and-answer content marked up', 1, 'na', 'No FAQ content found.', '', ''));
  }
  {
    const tags = `${m.robots || ''} ${headers['x-robots-tag'] || ''}`.toLowerCase();
    if (/noai|noimageai/.test(tags)) out.push(check('GEO-06', 'noai', 'No blanket "noai" directive', 1, 'partial', `Found: ${tags.trim()}.`, 'noai asks AI systems not to use the page.', 'Remove noai if you want to appear in AI answers.'));
  }
  return out;
}
