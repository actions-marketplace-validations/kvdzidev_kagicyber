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
 * Start tags with one of `names`, as { name, attrs, start, end }. Matches what /<(names)\b([^>]{0,8192})>/gi
 * finds, but keeps a pointer to the next `>` instead of rescanning up to 8 KB after every unterminated tag.
 */
export function* tags(html, names, { from = 0, maxAttrs = 8192 } = {}) {
  const want = new Set(names);
  const longest = Math.max(...names.map((n) => n.length));
  let gt = -1;
  for (let i = html.indexOf('<', from); i !== -1; i = html.indexOf('<', i + 1)) {
    let j = i + 1;
    while (j < html.length && j - i <= longest + 1 && /\w/.test(html[j])) j++;
    const name = html.slice(i + 1, j).toLowerCase();
    if (!want.has(name)) continue;
    if (gt < j) gt = html.indexOf('>', j);
    if (gt === -1) return;
    if (gt - j > maxAttrs) continue;
    yield { name, attrs: html.slice(j, gt), start: i, end: gt + 1 };
    i = gt;
  }
}

/**
 * `<name ...>inner</name>` with at most `maxInner` characters inside, the shortest match first, like
 * /<name\b([^>]{0,8192})>([\s\S]{0,maxInner}?)<\/name>/gi. The next closing tag per name is cached, so
 * openers without a close cost one search in total rather than one each.
 */
export function* elements(html, names, maxInner) {
  const close = new Map();
  let from = 0;
  for (;;) {
    const t = tags(html, names, { from }).next().value;
    if (!t) return;
    let c = close.get(t.name);
    if (c === undefined || (c !== -1 && c < t.end)) {
      const re = new RegExp(`</${t.name}>`, 'gi');
      re.lastIndex = t.end;
      c = re.exec(html)?.index ?? -1;
      close.set(t.name, c);
    }
    if (c !== -1 && c - t.end <= maxInner) {
      const end = c + t.name.length + 3;
      yield { ...t, inner: html.slice(t.end, c), end };
      from = end;
    } else {
      from = t.start + 1;
    }
  }
}

/** `<name` ... `</name>` within `max` characters, like /<name\b[\s\S]{0,max}?<\/name>/gi, as { start, end }. */
export function* blocks(html, name, max) {
  const open = new RegExp(`<${name}\\b`, 'gi');
  const close = new RegExp(`</${name}>`, 'gi');
  let c = -2;
  for (let m = open.exec(html); m; m = open.exec(html)) {
    const after = m.index + name.length + 1;
    if (c !== -1 && c < after) {
      close.lastIndex = after;
      c = close.exec(html)?.index ?? -1;
    }
    if (c === -1) return;
    if (c - after > max) continue; // open.lastIndex is already past this opener
    const end = c + name.length + 3;
    yield { start: m.index, end };
    open.lastIndex = end;
  }
}

const first = (it) => it.next().value || null;
const FIELDS = ['input', 'textarea', 'select'];

/** Is there a `<div id="root">` style mount point (attributes before the id unbounded, up to 8 KB after) left empty? */
function hasEmptyMount(body) {
  const id = /\bid=["'](?:root|app|__next|__nuxt|svelte|main-app)["']/gi;
  const empty = /\s*<\/div>/iy;
  for (const t of tags(body, ['div'], { maxAttrs: Infinity })) {
    let last = -1;
    for (const m of t.attrs.matchAll(id)) last = m.index + m[0].length;
    if (last === -1 || t.attrs.length - last > 8192) continue;
    empty.lastIndex = t.end;
    if (empty.test(body)) return true;
  }
  return false;
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
  const baseTag = first(tags(html, ['base']));
  if (baseTag) {
    const href = parseAttrs(baseTag.attrs).href;
    const u = href && safeUrl(href, baseUrl);
    if (u) base = u.href;
  }
  const abs = (u) => {
    if (!u) return null;
    const x = safeUrl(u.trim(), base);
    return x ? x.href : null;
  };

  const htmlTag = first(tags(html, ['html']));
  if (htmlTag) out.lang = parseAttrs(htmlTag.attrs).lang || null;

  // The document title, not an inline <svg><title>: drop SVG blocks before looking.
  let noSvg = '';
  let at = 0;
  for (const s of blocks(html, 'svg', 200000)) {
    noSvg += html.slice(at, s.start);
    at = s.end;
  }
  noSvg += html.slice(at);
  const title = first(elements(noSvg, ['title'], 4000));
  if (title) out.title = decodeEntities(title.inner).replace(/\s+/g, ' ').trim();

  for (const m of tags(html, ['meta'])) {
    const a = parseAttrs(m.attrs);
    const key = (a.name || a.property || a['http-equiv'] || '').toLowerCase();
    if (key && a.content != null) out.metas[key] = a.content;
  }

  for (const m of tags(html, ['link'])) {
    const a = parseAttrs(m.attrs);
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

  for (const m of tags(html, ['iframe'])) {
    const a = parseAttrs(m.attrs);
    const src = abs(a.src || a['data-src']);
    if (src) out.iframes.push({ src, deferred: !a.src && !!a['data-src'] });
  }

  for (const m of elements(html, ['a'], 20000)) {
    const a = parseAttrs(m.attrs);
    const href = abs(a.href);
    if (!href || /^(javascript|mailto|tel):/i.test(a.href || '')) {
      if (a.href && /^mailto:/i.test(a.href)) out.links.push({ href: a.href, text: htmlToText(m.inner), mailto: true });
      continue;
    }
    const text = htmlToText(m.inner) || a['aria-label'] || a.title || '';
    out.links.push({ href, text });
  }

  for (const m of elements(html, ['form'], 200000)) {
    const a = parseAttrs(m.attrs);
    const inner = m.inner;
    const fields = [...tags(inner, FIELDS)].map((f) => parseAttrs(f.attrs));
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

  for (const m of tags(html, ['img'])) {
    const a = parseAttrs(m.attrs);
    out.images.total++;
    if (!('alt' in a) && a.role !== 'presentation' && a['aria-hidden'] !== 'true') out.images.missingAlt++;
    if (!a.width || !a.height) out.images.noDimensions++;
    if (/\.(webp|avif|svg)(\?|$)/i.test(a.src || '') || /webp|avif/i.test(a.srcset || '')) out.images.modern++;
    if ((a.loading || '').toLowerCase() === 'lazy') out.images.lazy++;
  }
  for (const m of elements(html, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'], 5000)) {
    out.headings.push({ level: Number(m.name[1]), text: htmlToText(m.inner).slice(0, 120) });
  }
  const headEl = first(blocks(html, 'head', 500000));
  const head = headEl ? html.slice(headEl.start, headEl.end) : '';
  for (const m of tags(head, ['script'])) {
    const a = parseAttrs(m.attrs);
    // Only classic scripts block rendering; consent-gated (type="text/plain") and JSON or module scripts do not.
    const type = (a.type || '').toLowerCase();
    const classic = !type || /^(text|application)\/(javascript|ecmascript)$/.test(type);
    if (a.src && classic && !('async' in a) && !('defer' in a)) out.headBlockingScripts++;
  }

  const labelFor = new Set([...tags(html, ['label'])].map((m) => parseAttrs(m.attrs).for).filter(Boolean));
  for (const m of tags(html, FIELDS)) {
    const a = parseAttrs(m.attrs);
    const type = (a.type || '').toLowerCase();
    if (['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    out.inputs.total++;
    const labelled = (a.id && labelFor.has(a.id)) || a['aria-label'] || a['aria-labelledby'] || a.title;
    if (!labelled) out.inputs.unlabeled++;
  }
  // Inputs wrapped in <label>…</label> count as labelled.
  const wrapped = [...elements(html, ['label'], 5000)].reduce(
    (n, m) => n + [...m.inner.matchAll(/<(input|textarea|select)\b/gi)].length,
    0
  );
  out.inputs.unlabeled = Math.max(0, out.inputs.unlabeled - wrapped);

  out.text = htmlToText(html);
  // Greedy like /<body\b[^>]{0,8192}>([\s\S]*)<\/body>/i: from the first body tag to the last </body>.
  const bodyTag = first(tags(html, ['body']));
  let bodyClose = -1;
  for (const m of html.matchAll(/<\/body>/gi)) bodyClose = m.index;
  const body = bodyTag && bodyClose >= bodyTag.end ? html.slice(bodyTag.end, bodyClose) : html;
  const bodyText = htmlToText(body || '');
  out.wordCount = bodyText ? bodyText.split(/\s+/).filter((w) => /\p{L}/u.test(w)).length : 0;
  out.clientRendered = hasEmptyMount(body || '') && out.wordCount < 150;
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
