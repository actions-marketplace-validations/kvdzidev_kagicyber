import { safeUrl, sameSite } from '../util.js';

const STOPWORDS = {
  pl: [' i ', ' w ', ' się ', ' oraz ', ' nie ', ' jest ', ' na ', ' z ', ' do ', ' danych '],
  de: [' und ', ' der ', ' die ', ' das ', ' nicht ', ' ist ', ' mit ', ' für ', ' von ', ' werden '],
  fr: [' et ', ' les ', ' des ', ' est ', ' pour ', ' vous ', ' une ', ' dans ', ' sur ', ' nous '],
  es: [' y ', ' los ', ' las ', ' para ', ' por ', ' una ', ' con ', ' sus ', ' datos ', ' usted '],
  it: [' e ', ' il ', ' della ', ' per ', ' che ', ' una ', ' sono ', ' dei ', ' con ', ' dati '],
  nl: [' en ', ' de ', ' het ', ' van ', ' een ', ' voor ', ' met ', ' zijn ', ' wij ', ' uw '],
  pt: [' e ', ' os ', ' das ', ' para ', ' com ', ' uma ', ' dos ', ' não ', ' seus ', ' você '],
  en: [' the ', ' and ', ' of ', ' to ', ' you ', ' is ', ' for ', ' with ', ' your ', ' we '],
};

/** Guess the language of a text from stop-word frequency (good enough for legal pages). */
export function detectLang(text) {
  if (!text || text.length < 200) return null;
  const t = ` ${text.slice(0, 20000).toLowerCase().replace(/\s+/g, ' ')} `;
  let best = null;
  let bestScore = 0;
  for (const [lang, words] of Object.entries(STOPWORDS)) {
    const score = words.reduce((s, w) => s + (t.split(w).length - 1), 0);
    if (score > bestScore) [best, bestScore] = [lang, score];
  }
  return bestScore >= 8 ? best : null;
}

/** Build the evaluation context from an audit result (with evidence). */
export function buildContext(result) {
  if (!result?.evidence) throw new Error('audit result has no evidence: use the JSON output of kagicyber audit');
  const ev = result.evidence;
  // Prefer the browser-rendered text of a legal page when the served HTML is a client-rendered shell.
  const rendered = Object.fromEntries((ev.renderedPages || []).map((r) => [r.url, r.text || '']));
  const allPages = (ev.pages || []).map((p) => (rendered[p.url] && rendered[p.url].length > (p.text || '').length ? { ...p, text: rendered[p.url] } : p));
  // An error page is not a legal text: judge only pages that loaded (or were rendered in the browser).
  const pages = allPages.filter((p) => p.sameAs || p.status === 200 || rendered[p.url]);
  const textOf = (kind) => pages.filter((p) => p.kind === kind && p.text).map((p) => p.text).join(' ');
  const home = ev.html?.text || '';
  const legal = pages.map((p) => p.text || '').join(' ');
  const texts = { home, privacy: textOf('privacy'), terms: textOf('terms'), imprint: textOf('imprint'), cookies: textOf('cookies'), legal, any: `${home} ${legal}` };
  const pageOf = (kind) => pages.find((p) => p.kind === kind && !p.sameAs) || null;
  const links = (ev.html?.links || []).map((l) => ({ text: (l.text || '').toLowerCase(), href: safeDecode(l.href || '').toLowerCase(), raw: l }));
  const siteHost = safeUrl(ev.home?.finalUrl)?.hostname || ev.host || '';
  const siteLinks = links.filter((l) => {
    const u = safeUrl(l.raw.href || '');
    return u && /^https?:$/.test(u.protocol) && sameSite(u.hostname, siteHost);
  });
  const pageAt = (href) => allPages.find((p) => p.url === href && !p.sameAs) || null;
  const checks = Object.fromEntries((result.compliance?.checks || []).map((c) => [c.key, c]));
  const siteLang = (ev.html?.lang || '').slice(0, 2).toLowerCase() || detectLang(home);
  return {
    result,
    ev,
    texts,
    pageOf,
    pageAt,
    links,
    siteLinks,
    checks,
    siteLang,
    siteTypes: result.siteTypes || ['company'],
    inventory: result.inventory || {},
    browser: result.browser || ev.browser || null,
    findings: result.security?.findings || [],
    jurisdictions: result.jurisdictions || { list: [], eu: false, global: true },
    triggerText: `${texts.any} ${links.map((l) => `${l.text} ${l.href}`).join(' ')}`,
  };
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
