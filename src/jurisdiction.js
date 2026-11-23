/** Detect target jurisdictions from language, ccTLD, currency, phone prefixes and company identifiers. */

export const COUNTRIES = {
  PL: ['Poland', true], DE: ['Germany', true], AT: ['Austria', true], FR: ['France', true],
  IT: ['Italy', true], ES: ['Spain', true], NL: ['Netherlands', true], BE: ['Belgium', true],
  IE: ['Ireland', true], PT: ['Portugal', true], SE: ['Sweden', true], DK: ['Denmark', true],
  FI: ['Finland', true], CZ: ['Czechia', true], SK: ['Slovakia', true], HU: ['Hungary', true],
  RO: ['Romania', true], BG: ['Bulgaria', true], GR: ['Greece', true], HR: ['Croatia', true],
  SI: ['Slovenia', true], LT: ['Lithuania', true], LV: ['Latvia', true], EE: ['Estonia', true],
  LU: ['Luxembourg', true], MT: ['Malta', true], CY: ['Cyprus', true],
  GB: ['United Kingdom', false], CH: ['Switzerland', false], NO: ['Norway', false], TR: ['Turkey', false],
  UA: ['Ukraine', false], US: ['United States', false], CA: ['Canada', false], MX: ['Mexico', false],
  BR: ['Brazil', false], AR: ['Argentina', false], CL: ['Chile', false], CO: ['Colombia', false],
  PE: ['Peru', false], JP: ['Japan', false], KR: ['South Korea', false], CN: ['China', false],
  TW: ['Taiwan', false], HK: ['Hong Kong', false], IN: ['India', false], AU: ['Australia', false],
  NZ: ['New Zealand', false], SG: ['Singapore', false], PH: ['Philippines', false], ID: ['Indonesia', false],
  VN: ['Vietnam', false], IL: ['Israel', false], SA: ['Saudi Arabia', false], AE: ['United Arab Emirates', false],
  EG: ['Egypt', false], ZA: ['South Africa', false], NG: ['Nigeria', false], KE: ['Kenya', false], MA: ['Morocco', false],
};

const TLD = {
  pl: 'PL', de: 'DE', at: 'AT', fr: 'FR', it: 'IT', es: 'ES', nl: 'NL', be: 'BE', ie: 'IE', pt: 'PT', se: 'SE', dk: 'DK', fi: 'FI',
  cz: 'CZ', sk: 'SK', hu: 'HU', ro: 'RO', bg: 'BG', gr: 'GR', hr: 'HR', si: 'SI', lt: 'LT', lv: 'LV', ee: 'EE', lu: 'LU', mt: 'MT', cy: 'CY',
  uk: 'GB', ch: 'CH', no: 'NO', tr: 'TR', ua: 'UA', us: 'US', ca: 'CA', mx: 'MX', br: 'BR', ar: 'AR', cl: 'CL', pe: 'PE', jp: 'JP',
  kr: 'KR', cn: 'CN', tw: 'TW', hk: 'HK', in: 'IN', au: 'AU', nz: 'NZ', sg: 'SG', ph: 'PH', id: 'ID', vn: 'VN', il: 'IL', sa: 'SA',
  ae: 'AE', eg: 'EG', za: 'ZA', ng: 'NG', ke: 'KE', ma: 'MA',
};
/** ccTLDs widely used as generic domains: ignored. */
const GENERIC_TLD = new Set(['io', 'co', 'ai', 'me', 'tv', 'ly', 'fm', 'gg', 'app', 'dev', 'to', 'cc', 'ws', 'sh', 'so', 'is', 'it.com']);

const LANG = {
  pl: 'PL', de: 'DE', fr: 'FR', it: 'IT', es: 'ES', nl: 'NL', cs: 'CZ', sk: 'SK', hu: 'HU', ro: 'RO', sv: 'SE', da: 'DK', fi: 'FI',
  nb: 'NO', nn: 'NO', no: 'NO', el: 'GR', bg: 'BG', hr: 'HR', sl: 'SI', lt: 'LT', lv: 'LV', et: 'EE', ja: 'JP', ko: 'KR', zh: 'CN',
  tr: 'TR', he: 'IL', vi: 'VN', uk: 'UA', pt: 'PT', id: 'ID', th: null, ar: null, en: null,
};

const CURRENCY = [
  [/\bzł\b|\bPLN\b/, 'PL', 2], [/£|\bGBP\b/, 'GB', 2], [/\bCHF\b/, 'CH', 2], [/R\$|\bBRL\b/, 'BR', 2], [/MX\$|\bMXN\b/, 'MX', 2],
  [/C\$|\bCAD\b/, 'CA', 2], [/A\$|\bAUD\b/, 'AU', 2], [/₹|\bINR\b/, 'IN', 2], [/₩|\bKRW\b/, 'KR', 2], [/₺|\bTRY\b/, 'TR', 2],
  [/\bUSD\b|US\$/, 'US', 1], [/\bSEK\b/, 'SE', 2], [/\bDKK\b/, 'DK', 2], [/\bNOK\b/, 'NO', 2], [/\bCZK\b|\bKč\b/, 'CZ', 2],
  [/\bHUF\b|\bFt\b/, 'HU', 1], [/\bRON\b|\blei\b/, 'RO', 1], [/\bAED\b/, 'AE', 2], [/\bSAR\b/, 'SA', 2], [/\bZAR\b/, 'ZA', 2], [/₦|\bNGN\b/, 'NG', 2],
];

const PHONE = { 48: 'PL', 49: 'DE', 43: 'AT', 33: 'FR', 39: 'IT', 34: 'ES', 31: 'NL', 32: 'BE', 353: 'IE', 351: 'PT', 46: 'SE', 45: 'DK', 358: 'FI', 420: 'CZ', 421: 'SK', 36: 'HU', 40: 'RO', 359: 'BG', 30: 'GR', 385: 'HR', 386: 'SI', 44: 'GB', 41: 'CH', 47: 'NO', 90: 'TR', 55: 'BR', 52: 'MX', 81: 'JP', 82: 'KR', 86: 'CN', 91: 'IN', 61: 'AU', 64: 'NZ', 65: 'SG', 972: 'IL', 971: 'AE', 966: 'SA', 27: 'ZA', 234: 'NG', 254: 'KE' };

const COMPANY = [
  [/\bsp\.\s?z\s?o\.?\s?o\.?|\bNIP[:\s]*\d{3}-?\d{3}-?\d{2}-?\d{2}|\bKRS[:\s]*\d{10}|\bREGON\b/i, 'PL', 3],
  [/\bGmbH\b|\bUSt-?IdNr|\bHRB\s?\d+|Amtsgericht/i, 'DE', 3],
  [/\bSIRET\b|\bSIREN\b|\bRCS\s+[A-Z][a-z]+|\bSARL\b|\bSAS\b au capital/i, 'FR', 3],
  [/\bP\.?\s?IVA\b|Partita IVA|\bS\.r\.l\.|\bS\.p\.A\./i, 'IT', 3],
  [/\bCIF[:\s]*[A-Z]\d{7}|\bNIF[:\s]*[A-Z0-9]\d{7}|\bS\.L\.U?\b/i, 'ES', 3],
  [/\bKvK\b|\bB\.V\.\b/i, 'NL', 3],
  [/Companies House|Registered in England|company number \d{8}/i, 'GB', 3],
  [/\bABN[:\s]*\d{2}\s?\d{3}\s?\d{3}\s?\d{3}|\bPty\.? Ltd\b/i, 'AU', 3],
  [/\bCNPJ\b|\bLtda\.?\b/i, 'BR', 3],
  [/\bGSTIN\b|Pvt\.? Ltd/i, 'IN', 3],
  [/\bUID[:\s]*CHE-|\bCHE-\d{3}\.\d{3}\.\d{3}/i, 'CH', 3],
  [/\bATU\d{8}\b|\bFN\s?\d{5,6}[a-z]\b/i, 'AT', 3],
];

export function countryInfo(code) {
  const c = COUNTRIES[code];
  return c ? { code, name: c[0], eu: c[1] } : { code, name: code, eu: false };
}

export function detectJurisdictions(ev) {
  const score = {};
  const signals = {};
  const add = (code, pts, why) => {
    if (!code) return;
    score[code] = (score[code] || 0) + pts;
    (signals[code] ??= []).push(why);
  };
  const host = ev.host.toLowerCase();
  const labels = host.split('.');
  const tld = labels.at(-1);
  if (!GENERIC_TLD.has(tld) && TLD[tld]) add(TLD[tld], 3, `ccTLD .${tld}`);

  const langs = [ev.html.lang, ev.html.metas['og:locale'], ev.html.metas['content-language']].filter(Boolean);
  for (const l of langs) {
    const [lang, region] = l.replace('_', '-').split('-');
    const lc = lang.toLowerCase();
    if (region && COUNTRIES[region.toUpperCase()]) add(region.toUpperCase(), 3, `language tag ${l}`);
    else if (LANG[lc]) add(LANG[lc], 2, `page language "${lc}"`);
  }
  for (const h of ev.html.hreflang) {
    const [lang, region] = h.lang.split('-');
    if (/x-default/i.test(h.lang)) continue;
    const code = region && COUNTRIES[region.toUpperCase()] ? region.toUpperCase() : LANG[lang.toLowerCase()];
    add(code, 1, `hreflang ${h.lang}`);
  }
  const text = ev.html.text.slice(0, 40000);
  for (const [re, code, pts] of CURRENCY) if (re.test(text)) add(code, pts, `currency ${text.match(re)[0]}`);
  for (const m of text.matchAll(/\+(\d{2,3})[\s(-]?\d/g)) {
    const code = PHONE[m[1]] || PHONE[m[1].slice(0, 2)];
    if (code && !(signals[code] || []).some((s) => s.startsWith('phone'))) add(code, 1, `phone prefix +${m[1]}`);
  }
  const legalText = `${text} ${ev.pages.map((p) => (p.text || '').slice(0, 20000)).join(' ')}`;
  for (const [re, code, pts] of COMPANY) if (re.test(legalText)) add(code, pts, `company identifier "${legalText.match(re)[0].trim().slice(0, 30)}"`);
  if (/€|\bEUR\b/.test(text) && !Object.keys(score).some((c) => COUNTRIES[c]?.[2])) add('EU', 1, 'prices in EUR');

  const list = Object.entries(score)
    .filter(([code]) => code !== 'EU')
    .sort((a, b) => b[1] - a[1])
    .map(([code, pts]) => {
      const info = countryInfo(code);
      return { ...info, points: pts, confidence: pts >= 5 ? 'high' : pts >= 3 ? 'medium' : 'low', signals: signals[code] };
    })
    .filter((j, i) => j.confidence !== 'low' || i < 3);
  const eu = list.some((j) => j.eu) || score.EU > 0;
  return {
    list,
    eu,
    global: list.length === 0,
    note: list.length === 0 ? 'No clear country signals: audited against the global baseline (EU/GDPR level).' : null,
  };
}
