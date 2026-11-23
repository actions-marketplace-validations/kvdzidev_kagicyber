import { parseAttrs, htmlToText, decodeEntities, safeUrl } from './util.js';

/** `<!doctype html>` after optional leading whitespace and comments. Linear scan (the regex version was exponential). */
function hasDoctype(html) {
  let i = 0;
  for (;;) {
    while (i < html.length && /\s/.test(html[i])) i++;
    if (!html.startsWith('<!--', i)) break;
    const end = html.indexOf('-->', i + 4);
    if (end === -1) return false;
    i = end + 3;
  }
  return html.slice(i, i + 14).toLowerCase() === '<!doctype html';
}

/**
 * `<script ...>body</script>` blocks as [whole, attrs, body] tuples, found with indexOf so an unterminated
 * `<script` costs one scan instead of one per occurrence.
 */
export function* scriptBlocks(html) {
  const lower = html.toLowerCase();
  let i = 0;
  for (;;) {
    const open = lower.indexOf('<script', i);
    if (open === -1) return;
    const next = lower[open + 7];
    if (next && !/[\s>/]/.test(next)) {
      i = open + 7;
      continue;
    }
    const gt = html.indexOf('>', open);
    if (gt === -1 || gt - open > 8200) return;
    const close = lower.indexOf('</script', gt + 1);
    if (close === -1) return;
    const end = html.indexOf('>', close);
    yield [html.slice(open, end === -1 ? html.length : end + 1), html.slice(open + 7, gt), html.slice(gt + 1, close)];
    i = end === -1 ? html.length : end + 1;
  }
}

/**
 * Dependency-free HTML extraction. Not a full parser: it pulls out exactly what the
 * checks need (links, scripts, iframes, forms, meta, images, inputs) from raw HTML.
 */
export function parseHtml(html, baseUrl) {
  const out = {
    lang: null,
    title: null,
    metas: {},
    hreflang: [],
    links: [],
    scripts: [],
    inlineScripts: [],
    styles: [],
    preloads: [],
    iframes: [],
    forms: [],
    images: { total: 0, missingAlt: 0, noDimensions: 0, modern: 0, lazy: 0 },
    inputs: { total: 0, unlabeled: 0 },
    headings: [],
    canonical: null,
    icons: [],
    jsonLd: [],
    headBlockingScripts: 0,
    doctype: hasDoctype(html),
    text: '',
    wordCount: 0,
    clientRendered: false,
  };
  let base = baseUrl;
  const baseTag = html.match(/<base\b([^>]{0,8192})>/i);
  if (baseTag) {
    const href = parseAttrs(baseTag[1]).href;
    const u = href && safeUrl(href, baseUrl);
    if (u) base = u.href;
  }
  const abs = (u) => {
    if (!u) return null;
    const x = safeUrl(u.trim(), base);
    return x ? x.href : null;
  };

  const htmlTag = html.match(/<html\b([^>]{0,8192})>/i);
  if (htmlTag) out.lang = parseAttrs(htmlTag[1]).lang || null;

  // The document title, not an inline <svg><title>: drop SVG blocks before looking.
  const title = html.replace(/<svg\b[\s\S]{0,200000}?<\/svg>/gi, '').match(/<title\b[^>]{0,8192}>([\s\S]{0,4000}?)<\/title>/i);
  if (title) out.title = decodeEntities(title[1]).replace(/\s+/g, ' ').trim();

  for (const m of html.matchAll(/<meta\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[1]);
    const key = (a.name || a.property || a['http-equiv'] || '').toLowerCase();
    if (key && a.content != null) out.metas[key] = a.content;
  }

  for (const m of html.matchAll(/<link\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[1]);
    const rel = (a.rel || '').toLowerCase();
    const href = abs(a.href);
    if (!href) continue;
    if (rel.includes('alternate') && a.hreflang) out.hreflang.push({ lang: a.hreflang, href });
    else if (rel.split(/\s+/).includes('canonical')) out.canonical = { href, raw: a.href };
    else if (/(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/.test(rel)) out.icons.push({ rel, href });
    else if (rel.includes('stylesheet')) out.styles.push({ href, integrity: a.integrity || null });
    else if (rel.includes('modulepreload') || (rel.includes('preload') && (a.as || '') === 'script'))
      out.preloads.push({ href, integrity: a.integrity || null });
  }

  for (const m of scriptBlocks(html)) {
    const a = parseAttrs(m[1]);
    const src = abs(a.src);
    const gated = isGated(a);
    if ((a.type || '').toLowerCase() === 'application/ld+json') {
      out.jsonLd.push(m[2]);
      continue;
    }
    if (src) out.scripts.push({ src, type: a.type || null, integrity: a.integrity || null, async: 'async' in a, defer: 'defer' in a, gated, attrs: a });
    else if (m[2].trim()) out.inlineScripts.push({ code: m[2], type: a.type || null, gated, attrs: a });
  }

  for (const m of html.matchAll(/<iframe\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[1]);
    const src = abs(a.src || a['data-src']);
    if (src) out.iframes.push({ src, deferred: !a.src && !!a['data-src'] });
  }

  for (const m of html.matchAll(/<a\b([^>]{0,8192})>([\s\S]{0,20000}?)<\/a>/gi)) {
    const a = parseAttrs(m[1]);
    const href = abs(a.href);
    if (!href || /^(javascript|mailto|tel):/i.test(a.href || '')) {
      if (a.href && /^mailto:/i.test(a.href)) out.links.push({ href: a.href, text: htmlToText(m[2]), mailto: true });
      continue;
    }
    const text = htmlToText(m[2]) || a['aria-label'] || a.title || '';
    out.links.push({ href, text });
  }

  for (const m of html.matchAll(/<form\b([^>]{0,8192})>([\s\S]{0,200000}?)<\/form>/gi)) {
    const a = parseAttrs(m[1]);
    const inner = m[2];
    const fields = [...inner.matchAll(/<(input|textarea|select)\b([^>]{0,8192})>/gi)].map((f) => parseAttrs(f[2]));
    const visible = fields.filter((f) => !['hidden', 'submit', 'button'].includes((f.type || '').toLowerCase()));
    const hidden = Object.fromEntries(fields.filter((f) => (f.type || '').toLowerCase() === 'hidden' && f.name).map((f) => [f.name, f.value || '']));
    out.forms.push({
      action: abs(a.action) || base,
      method: (a.method || 'get').toLowerCase(),
      fields: visible.map((f) => f.name || f.id || f.type || 'field'),
      hasEmail: visible.some((f) => (f.type || '').toLowerCase() === 'email' || /mail/i.test(f.name || '')),
      hasPassword: visible.some((f) => (f.type || '').toLowerCase() === 'password'),
      hidden,
      innerText: htmlToText(inner).slice(0, 2000),
      innerHtml: inner.slice(0, 6000),
    });
  }

  for (const m of html.matchAll(/<img\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[1]);
    out.images.total++;
    if (!('alt' in a) && a.role !== 'presentation' && a['aria-hidden'] !== 'true') out.images.missingAlt++;
    if (!a.width || !a.height) out.images.noDimensions++;
    if (/\.(webp|avif|svg)(\?|$)/i.test(a.src || '') || /webp|avif/i.test(a.srcset || '')) out.images.modern++;
    if ((a.loading || '').toLowerCase() === 'lazy') out.images.lazy++;
  }
  for (const m of html.matchAll(/<h([1-6])\b[^>]{0,8192}>([\s\S]{0,5000}?)<\/h\1>/gi)) {
    out.headings.push({ level: Number(m[1]), text: htmlToText(m[2]).slice(0, 120) });
  }
  const head = (html.match(/<head\b[\s\S]{0,500000}?<\/head>/i) || [''])[0];
  for (const m of head.matchAll(/<script\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[1]);
    // Only classic scripts block rendering; consent-gated (type="text/plain") and JSON or module scripts do not.
    const type = (a.type || '').toLowerCase();
    const classic = !type || /^(text|application)\/(javascript|ecmascript)$/.test(type);
    if (a.src && classic && !('async' in a) && !('defer' in a)) out.headBlockingScripts++;
  }

  const labelFor = new Set([...html.matchAll(/<label\b([^>]{0,8192})>/gi)].map((m) => parseAttrs(m[1]).for).filter(Boolean));
  for (const m of html.matchAll(/<(input|textarea|select)\b([^>]{0,8192})>/gi)) {
    const a = parseAttrs(m[2]);
    const type = (a.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    out.inputs.total++;
    const labelled = (a.id && labelFor.has(a.id)) || a['aria-label'] || a['aria-labelledby'] || a.title;
    if (!labelled) out.inputs.unlabeled++;
  }
  // Inputs wrapped in <label>…</label> count as labelled.
  const wrapped = [...html.matchAll(/<label\b[^>]{0,8192}>([\s\S]{0,5000}?)<\/label>/gi)].reduce(
    (n, m) => n + [...m[1].matchAll(/<(input|textarea|select)\b/gi)].length,
    0
  );
  out.inputs.unlabeled = Math.max(0, out.inputs.unlabeled - wrapped);

  out.text = htmlToText(html);
  const body = (html.match(/<body\b[^>]{0,8192}>([\s\S]*)<\/body>/i) || [null, html])[1];
  const bodyText = htmlToText(body || '');
  out.wordCount = bodyText ? bodyText.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length : 0;
  out.clientRendered = /<div\b[^>]*\bid=["'](root|app|__next|__nuxt|svelte|main-app)["'][^>]{0,8192}>\s*<\/div>/i.test(body || '') && out.wordCount < 150;
  return out;
}

/** A script is "gated" when a consent manager is expected to activate it later. */
function isGated(a) {
  const type = (a.type || '').toLowerCase();
  if (type === 'text/plain' || type === 'text/x-consent' || type === 'opt-in') return true;
  const keys = Object.keys(a);
  if (keys.some((k) => /^data-(cookieconsent|cookiecategory|category|consent|cookie-consent|cmp|usercentrics|ot-|cookiefirst|cookieyes)/.test(k)))
    return true;
  if (/(^|\s)(cmplz-script|_iub_cs_activate|optanon-category-)/.test(a.class || '')) return true;
  return false;
}
