import { jurisdictionModules, BASELINE, SITE_TYPES, SITE_TYPE_NAMES, NAMES, allRules } from './rules.js';
import { PENALTY_DATA } from './exposure.js';
import { RULES_VERSION } from '../version.js';
import { countryInfo } from '../jurisdiction.js';

/** Rule catalog: every jurisdiction module and site-type checklist with its rule count (`kagicyber rules`). */
export function ruleCatalog() {
  const mods = jurisdictionModules();
  const jurisdictions = {};
  for (const [code, rules] of Object.entries(mods)) {
    jurisdictions[code] = { name: NAMES[code] || countryInfo(code).name, rules: rules.length, penalties: !!PENALTY_DATA[code] };
  }
  return {
    rulesVersion: RULES_VERSION,
    coreChecks: 14,
    totalRules: allRules().length,
    jurisdictionsCovered: Object.keys(mods).length,
    euChecklist: BASELINE.EU.length,
    jurisdictions,
    siteTypes: Object.fromEntries(Object.entries(SITE_TYPES).map(([k, v]) => [k, { name: SITE_TYPE_NAMES[k], rules: v.length }])),
  };
}
