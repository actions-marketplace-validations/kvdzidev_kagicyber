import { readFileSync } from 'node:fs';
import { penaltyForArea } from '../penalties.js';

const DATA = JSON.parse(readFileSync(new URL('../../data/penalties.json', import.meta.url), 'utf8'));

/** Map failing or partial rows to the statutory maximum penalties of each jurisdiction (JSON summary). */
export function penaltyExposure(sets, results) {
  const bad = results.filter((r) => r.status === 'fail' || r.status === 'partial');
  const out = [];
  for (const set of sets) {
    const entries = DATA[set.code];
    if (!entries) continue;
    for (const e of entries) {
      const hits = bad.filter((r) => e.triggers.some((t) => r.id === t || r.id.startsWith(`${t}`)));
      if (hits.length) out.push({ jurisdiction: set.code, name: set.name, law: e.law, max: e.max, triggeredBy: [...new Set(hits.map((h) => h.id))] });
    }
  }
  return out;
}

export const PENALTY_DATA = DATA;

const AREA_RULES = [
  ['financial', /PSD2|MiFID|MiCA|\bCFD\b|\bKNF\b|BaFin|consumer credit|credit ads?\b|2008\/48|2023\/2225|\bAML\b|\bKYC\b|2015\/849|financial ADR|financial supervisor/i],
  ['platform', /\bDSA\b|2022\/2065|Online Safety Act|ECA Digital|likely used by minors|age assurance/i],
  ['data', /Data Act|2023\/2854/i],
  ['marketing', /e-mail marketing|2002\/58\/EC art\. 13|newsletter|unsolicited|CAN-SPAM|CASL|Spam Act|commercial messages|İYS/i],
  ['ai', /\bAI\b|artificial intelligence|chatbot|KI-|deepfake/i],
  ['accessibility', /accessib|dostępn|barrierefrei|WCAG|EAA|BFSG/i],
  ['cookies', /cookie|tracker|pixel|banner|ePrivacy|TDDDG|PECR|\bGPC\b|Global Privacy Control|do not sell|wiretap|CIPA/i],
  ['transparency', /Datenschutz|DSGVO|privacy|privacidad|privacidade|informativa|aviso de privacidad|tratamiento de datos|personal (data|information)|données|Do Not Track|CalOPPA|APPI|PIPEDA|Health|biometric|PAIA|CNDP|PDPC|opt-out|profiling|sensitive|digital consent|parental consent/i],
  ['consumer', /local language|in (Italian|German|French|Spanish|Portuguese|Castilian|Polish)\b|Content in|Information in|French version|Toubon|Charter of the French|language information|consumer|withdraw|order button|ordering|price|pricing|checkout|review|subscription|warranty|guarantee|delivery|refund|cancellation|renewal|regret|arrepentimiento|reclama|complaint|cooling-off|\bODR\b|dark pattern|button|commercial links?|2005\/29|UOKiK|DGCCRF|Omnibus|GPSR|ANPC|PQR|2019\/770|청약철회/i],
  ['operator', /imprint|impressum|operator|identity|trader|mentions légales|aviso legal|regulamin|registration|register|registro|KRS|NIP|VAT|BTW|IVA|IČO|KvK|KBO|BCE|\bCRO\b|\bCUI\b|NIPC|SIREN|RCS|MERS[İI]S|ETB[İI]S|\bUID\b|CNPJ|\bABN\b|cégjegyzék|company (name|number)|registered office|chamber|KSH|share capital|tokushoho|Commercial Transactions|ICP filing|website disclosures|2000\/31|e-commerce|electronic contact|LCEN|DDG|UŚUDE/i],
  ['transparency', /GDPR|controller|retention|DPO|art\. 13|notice|terms/i],
];

/** Maximum penalty for one rule row: the national penalty table first, then the area defaults. */
export function rowPenalty(r, setCode, fallbackJ) {
  const own = setCode.startsWith('type:') ? [...(DATA[fallbackJ] || []), ...(DATA.EU || [])] : DATA[setCode] || (setCode.startsWith('US-') ? DATA.US : null) || [];
  const hits = own.filter((e) => e.triggers.some((t) => r.id === t || r.id.startsWith(t)));
  if (hits.length) return hits.map((e) => `${e.law}: ${e.max}`).join('; ');
  const text = `${r.title} ${r.basis || ''}`;
  const area = (AREA_RULES.find(([, re]) => re.test(text)) || ['lawfulness'])[0];
  const j = setCode.startsWith('type:') || setCode === 'EU' ? fallbackJ : setCode.startsWith('US-') ? 'US' : setCode;
  return penaltyForArea(area, j) || penaltyForArea(area, 'EU') || 'Set nationally (verify)';
}
