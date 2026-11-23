import { EU, SHOP, SAAS, FINTECH } from './eu.js';
import { EUROPE, EU_MEMBERS, euGeneric } from './europe.js';
import { WORLD } from './world.js';

export const NAMES = {
  'US-CA': 'California (CalOPPA / CCPA / CIPA)',
  'US-STATES': 'Other US state privacy laws',
};

/** All jurisdiction modules: code → rules. EU members without a module get local-language + consent rules. */
export function jurisdictionModules() {
  const mods = { ...EUROPE, ...WORLD };
  for (const code of EU_MEMBERS) {
    const own = mods[code] || [];
    const gen = euGeneric(code).filter((g) => {
      if (g.id.endsWith('-C')) return !own.some((r) => r.check.type === 'signal' && r.check.check === 'trackers-before-consent');
      if (g.id.endsWith('-L')) return !own.some((r) => r.check.type === 'lang');
      return true;
    });
    if (gen.length) mods[code] = [...own, ...gen];
  }
  return mods;
}

export const BASELINE = { EU };
export const SITE_TYPES = { shop: SHOP, saas: SAAS, fintech: FINTECH };
export const SITE_TYPE_NAMES = {
  shop: 'Online shop checklist (withdrawal, Omnibus, GPSR, EAA)',
  saas: 'SaaS and platform checklist (DSA, account deletion, Data Act)',
  fintech: 'Fintech checklist (licence, credit ads, MiCA, ADR)',
};

export function allRules() {
  const out = [...EU, ...SHOP, ...SAAS, ...FINTECH];
  for (const rules of Object.values(jurisdictionModules())) out.push(...rules);
  return out;
}

/** Pick the rule sets that apply to a site. */
export function selectRules({ jurisdictions, siteTypes, include = [] }) {
  const mods = jurisdictionModules();
  const codes = new Set(include);
  for (const j of jurisdictions.list || []) if (j.confidence !== 'low' || include.length === 0) codes.add(j.code);
  const sets = [];
  if (jurisdictions.eu || jurisdictions.global || [...codes].some((c) => EU_MEMBERS.includes(c))) sets.push({ code: 'EU', name: 'European Union', rules: EU });
  for (const code of codes) {
    if (mods[code]) sets.push({ code, name: code, rules: mods[code] });
    if (code === 'US') {
      sets.push({ code: 'US-CA', name: NAMES['US-CA'], rules: mods['US-CA'] });
      sets.push({ code: 'US-STATES', name: NAMES['US-STATES'], rules: mods['US-STATES'] });
    }
  }
  if (jurisdictions.global && !codes.size) {
    for (const code of ['GB', 'US', 'US-CA']) if (!sets.some((s) => s.code === code)) sets.push({ code, name: NAMES[code] || code, rules: mods[code] });
  }
  for (const t of siteTypes) if (SITE_TYPES[t]) sets.push({ code: `type:${t}`, name: SITE_TYPE_NAMES[t], rules: SITE_TYPES[t], type: t });
  return sets;
}
