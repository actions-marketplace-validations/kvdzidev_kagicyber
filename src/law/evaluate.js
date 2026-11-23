import { buildContext, detectLang } from './context.js';
import { selectRules, NAMES } from './rules.js';
import { rowPenalty } from './exposure.js';
import { countryInfo } from '../jurisdiction.js';
import { complianceScore } from '../score.js';

/**
 * Law engine: evaluates the country, EU-extended and site-type rule sets against the evidence of an audit.
 * The 14 core checks (C-01 to C-14) stay the headline EU baseline; rules that only restate a core check
 * are folded into that check (their national legal basis is added to it) instead of being counted twice.
 */

/** EU checklist rules already covered by a core check. */
export const COVERED_BY_CORE = {
  'EU-A1b': 'C-01', 'EU-A1c': 'C-01', 'EU-A1d': 'C-01', 'EU-A1e': 'C-01',
  'EU-A2a': 'C-04', 'EU-A2c': 'C-04', 'EU-A2d': 'C-04',
  'EU-A3a': 'C-07', 'EU-A3b': 'C-08', 'EU-A3c': 'C-06', 'EU-A3d': 'C-06', 'EU-A3f': 'C-09',
  'EU-A4a': 'C-05', 'EU-A6a': 'C-10', 'EU-A6b': 'C-10', 'EU-A7': 'C-13',
};

/** Patterns are case-insensitive unless they start with "(?c)": company forms and IDs ("KG", "S.A.", "Ltd") must match case. */
export const rx = (p) => (p.startsWith('(?c)') ? new RegExp(p.slice(4), 'u') : new RegExp(p, 'iu'));

function snippet(text, re) {
  const m = text.match(re);
  if (!m) return '';
  const i = Math.max(0, m.index - 40);
  return `"${text.slice(i, m.index + m[0].length + 40).replace(/\s+/g, ' ').trim()}"`;
}

/** Evaluate one rule against the context. Returns { status, evidence }. */
export function evaluateRule(rule, ctx) {
  const c = rule.check;
  const miss = (evidence) => ({ status: rule.missing, evidence });
  switch (c.type) {
    case 'link': {
      const kws = c.keywords.map((k) => k.toLowerCase());
      // Same-site links only: a link to another company's legal notice is not this site's.
      const hit = ctx.siteLinks.find((l) => kws.some((k) => l.text.includes(k) || l.href.includes(k.replace(/\s+/g, '-')) || l.href.includes(k)));
      if (hit) {
        const page = ctx.pageAt(hit.raw.href);
        if (page && page.status && page.status !== 200) return miss(`Link "${(hit.raw.text || '').slice(0, 50)}" to ${hit.raw.href} returned HTTP ${page.status}.`);
        return { status: 'pass', evidence: `Link "${(hit.raw.text || '').slice(0, 50)}" to ${hit.raw.href}` };
      }
      if (c.orCmp && ctx.inventory.consentManagers?.length) return { status: 'manual', evidence: `${ctx.inventory.consentManagers.join(', ')} found in the site code; check that it offers a control to re-open the consent settings that stays visible.` };
      return miss(`No link matching ${c.keywords.slice(0, 4).map((k) => `"${k}"`).join(', ')}${c.keywords.length > 4 ? ' or similar' : ''}.`);
    }
    case 'text': {
      const t = ctx.texts[c.where] ?? ctx.texts.any;
      if (!t && ['privacy', 'terms', 'imprint'].includes(c.where)) return { status: rule.missing === 'partial' ? 'partial' : 'fail', evidence: `No ${c.where} page could be read.` };
      for (const p of c.patterns) {
        const re = rx(p);
        if (re.test(t)) return { status: 'pass', evidence: `Found${c.where === 'any' ? '' : ` (${c.where})`}: ${snippet(t, re).slice(0, 140)}` };
      }
      return miss(`Not found in ${c.where === 'any' ? 'homepage or legal pages' : `${c.where} text`}.`);
    }
    case 'count': {
      const t = ctx.texts[c.where] ?? ctx.texts.any;
      if (!t) return { status: 'fail', evidence: `No ${c.where} page could be read.` };
      const found = [];
      const missing = [];
      for (const [label, p] of c.groups) (rx(p).test(t) ? found : missing).push(label);
      const status = found.length >= c.min ? 'pass' : found.length >= Math.ceil(c.min / 2) && found.length > 0 ? 'partial' : rule.missing === 'partial' ? 'partial' : 'fail';
      return { status, evidence: `${found.length}/${c.groups.length} elements found${found.length ? ` (${found.join(', ')})` : ''}${missing.length ? `; missing: ${missing.join(', ')}` : ''}.` };
    }
    case 'signal': {
      const s = ctx.checks[c.check];
      if (!s) return { status: 'manual', evidence: `Check "${c.check}" not available.` };
      return { status: s.status, evidence: `${s.id}: ${s.evidence}` };
    }
    case 'lang': {
      const page = c.where === 'home' ? null : ctx.pageOf(c.where);
      const text = page ? page.text : ctx.texts.home;
      const pageLang = ((page?.lang || '').slice(0, 2).toLowerCase() || detectLang(text)) ?? null;
      const want = c.code === 'site' ? ctx.siteLang : c.code;
      if (!want) return { status: 'manual', evidence: 'Site language unknown.' };
      if (!page && c.where !== 'home') return miss(`No ${c.where} page found to check the language.`);
      if (!pageLang) return { status: 'manual', evidence: 'Could not determine the page language.' };
      return pageLang === want ? { status: 'pass', evidence: `${c.where} page language: ${pageLang}.` } : miss(`${c.where} page language is "${pageLang}", expected "${want}".`);
    }
    case 'has-lang': {
      const langs = [ctx.ev.html?.lang, ...(ctx.ev.html?.hreflang || []).map((h) => h.lang)].filter(Boolean).map((l) => l.slice(0, 2).toLowerCase());
      return langs.includes(c.code) ? { status: 'pass', evidence: `Language versions: ${[...new Set(langs)].join(', ')}.` } : miss(`No "${c.code}" version found (languages: ${[...new Set(langs)].join(', ') || 'unknown'}).`);
    }
    case 'absent': {
      const t = ctx.texts[c.where] ?? ctx.texts.any;
      const links = ctx.links.map((l) => l.href).join(' ');
      for (const p of c.patterns) {
        const re = rx(p);
        if (re.test(t) || re.test(links)) return miss(`Present: ${snippet(`${t} ${links}`, re).slice(0, 120)}`);
      }
      return { status: 'pass', evidence: 'Not present.' };
    }
    case 'inventory': {
      const v = ctx.inventory[c.key];
      return v === c.expect ? { status: 'pass', evidence: `${c.key} = ${JSON.stringify(v)}.` } : miss(`${c.key} = ${JSON.stringify(v)} (expected ${JSON.stringify(c.expect)}).`);
    }
    case 'inventory-trackers': {
      const names = [...new Set([...(ctx.inventory.trackers || []).map((t) => t.name), ...(ctx.inventory.dynamicTrackers || []), ...((ctx.browser?.trackerRequests || []).map((t) => t.name))])];
      return names.length ? { status: 'partial', evidence: `Third-party pixels/replay present: ${names.slice(0, 5).join(', ')}.` } : { status: 'pass', evidence: 'No pixels or session-replay tools detected.' };
    }
    case 'browser-reject': {
      const b = ctx.browser;
      if (!b?.ran) return { status: 'manual', evidence: 'Needs the real-browser test (run with --browser).' };
      if (b.banner?.found && b.banner.reject) return { status: 'pass', evidence: `First layer offers "${b.banner.reject}" next to "${b.banner.accept || 'accept'}".` };
      if (b.banner?.found) return { status: 'fail', evidence: `Banner offers "${b.banner.accept}" but no reject option on the first layer.` };
      const nonEssential = (ctx.inventory.trackers || []).length || (b.trackerRequests || []).length || (ctx.inventory.embeds || []).length;
      return nonEssential ? { status: 'fail', evidence: 'No consent banner visible although trackers/embeds are present.' } : { status: 'na', evidence: 'No consent needed: no trackers detected.' };
    }
    case 'no-finding': {
      const re = rx(c.title);
      const f = ctx.findings.find((x) => re.test(x.title));
      return f ? miss(`${f.id}: ${f.title}.`) : { status: 'pass', evidence: 'OK.' };
    }
    case 'link-param': {
      const re = rx(c.pattern);
      const bad = ctx.links.filter((l) => re.test(l.raw.href || ''));
      return bad.length ? miss(`${bad.length} link(s), e.g. ${bad[0].raw.href.slice(0, 110)}`) : { status: 'pass', evidence: 'No foreign ad-click parameters in links.' };
    }
    case 'consent-mode': {
      if (!ctx.inventory.consentModeDenied) return { status: 'na', evidence: 'Google Consent Mode not detected.' };
      const ungated = (ctx.inventory.trackers || []).filter((t) => !t.gated && /google/i.test(t.name));
      return ungated.length ? { status: 'partial', evidence: `Consent Mode default=denied, but Google tags load before consent (${ungated.map((t) => t.name).join(', ')}).` } : { status: 'pass', evidence: 'Consent Mode used together with tag blocking.' };
    }
    case 'eu-representative': {
      const top = ctx.jurisdictions.list?.[0];
      if (!ctx.jurisdictions.eu || !top || countryInfo(top.code).eu) return { status: 'na', evidence: 'Operator appears to be in the EU (or the site does not target the EU).' };
      const re = rx('EU representative|representative in the (EU|European Union)|art(icle)?\\.? ?27|EU-Vertreter|représentant (dans l\'UE|européen)');
      return re.test(ctx.texts.privacy || ctx.texts.any) ? { status: 'pass', evidence: 'EU representative named.' } : { status: 'fail', evidence: `Operator signals point to ${countryInfo(top.code).name} while EU users are targeted; no EU representative named.` };
    }
    case 'manual':
      return { status: 'manual', evidence: c.how };
    default:
      return { status: 'manual', evidence: `Unknown check type ${c.type}.` };
  }
}


function applies(rule, ctx) {
  return rule.appliesTo.includes('all') || rule.appliesTo.some((t) => ctx.siteTypes.includes(t));
}

function setName(code, fallback) {
  if (code.startsWith('type:')) return fallback;
  if (code === 'EU') return 'European Union (extended checklist)';
  if (code.startsWith('US-')) return NAMES[code];
  return countryInfo(code).name;
}

/**
 * Evaluate all applicable rule sets.
 * @param {object} result  audit result with evidence, compliance.checks, inventory, findings, jurisdictions
 * @param {{include?:string[], siteTypes?:string[], penaltyJurisdiction?:string}} opts
 * @returns {{sets:object[], results:object[], folded:Record<string,string[]>}}
 */
export function evaluateLaw(result, opts = {}) {
  const ctx = buildContext(result);
  if (opts.siteTypes?.length) ctx.siteTypes = [...new Set([...ctx.siteTypes.filter((t) => t !== 'company'), ...opts.siteTypes])];
  const core = Object.fromEntries((result.compliance?.checks || []).map((c) => [c.key, c]));
  const coreById = Object.fromEntries((result.compliance?.checks || []).map((c) => [c.id, c]));
  const pj = opts.penaltyJurisdiction || result.penaltyJurisdiction || 'EU';
  const folded = {};
  const fold = (checkId, label, basis) => {
    if (!checkId || !basis) return;
    (folded[checkId] ||= []);
    const line = `${label}: ${basis}`;
    if (!folded[checkId].includes(line)) folded[checkId].push(line);
  };
  const sets = [];
  const results = [];
  for (const set of selectRules({ jurisdictions: ctx.jurisdictions, siteTypes: ctx.siteTypes, include: opts.include || [] })) {
    const name = setName(set.code, set.name);
    const label = set.code.startsWith('type:') ? name.split(' (')[0] : set.code === 'EU' ? 'EU' : name;
    const rows = [];
    for (const rule of set.rules) {
      if (!applies(rule, ctx)) continue;
      if (COVERED_BY_CORE[rule.id] && coreById[COVERED_BY_CORE[rule.id]]) continue;
      if (rule.check.type === 'signal' && core[rule.check.check]) {
        if (set.code !== 'EU') fold(core[rule.check.check].id, label, rule.basis);
        continue;
      }
      const r = rule.trigger && !rx(rule.trigger).test(ctx.triggerText) ? { status: 'na', evidence: 'Not applicable: no trigger found on the site.' } : evaluateRule(rule, ctx);
      const row = { id: rule.id, set: set.code, title: rule.title, weight: rule.weight, status: r.status, evidence: r.evidence, basis: rule.basis, fix: rule.fix, verify: rule.verify, note: rule.note };
      row.maxPenalty = rowPenalty(row, set.code, pj);
      rows.push(row);
      results.push(row);
    }
    if (rows.length) sets.push({ code: set.code, name, kind: set.code === 'EU' ? 'eu' : set.code.startsWith('type:') ? 'site-type' : 'jurisdiction', results: rows, ...complianceScore(rows) });
  }
  return { sets, results, folded };
}
