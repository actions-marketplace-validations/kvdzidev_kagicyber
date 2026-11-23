/**
 * Indicative MAXIMUM penalties per compliance area and jurisdiction, shown on every
 * compliance row. They are statutory ceilings, not predictions, as of November 2026.
 * Entries marked (verify) still need confirmation in a primary source.
 *
 * Areas
 *   transparency  privacy notice duties (GDPR art. 12-14)
 *   lawfulness    processing/transfer without a legal basis (GDPR art. 6, 44)
 *   cookies       storage/access on the device without consent (ePrivacy art. 5(3))
 *   operator      provider identification (E-Commerce Directive art. 5)
 *   consumer      consumer-information and unfair-practice rules (CRD, UCPD, Omnibus)
 *   accessibility European Accessibility Act and national equivalents
 *   ai            AI Act art. 50 transparency
 *   marketing     unsolicited electronic marketing (ePrivacy art. 13 and national law)
 *   financial     financial-services supervision (PSD2, MiFID II, consumer credit, MiCA)
 *   data          Data Act switching and export duties
 *   platform      online platform duties (DSA, UK Online Safety Act)
 */
const EU_EEA = new Set(['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'NO', 'IS', 'LI']);

const EU = {
  transparency: 'GDPR art. 83(5): up to EUR 20M or 4% of worldwide annual turnover, whichever is higher',
  lawfulness: 'GDPR art. 83(5): up to EUR 20M or 4% of worldwide annual turnover, whichever is higher',
  cookies: 'National ePrivacy fines; where enforced through GDPR consent rules, up to EUR 20M or 4% of worldwide turnover',
  operator: 'Set by national law (e.g. Germany up to EUR 50,000, France up to EUR 375,000 for companies)',
  consumer: 'Omnibus Directive: for widespread infringements at least 4% of annual turnover, or EUR 2M where turnover is unknown',
  accessibility: 'National EAA penalties (e.g. Germany up to EUR 100,000); brochure sites without consumer e-commerce are usually out of scope',
  ai: 'AI Act art. 99(4): up to EUR 15M or 3% of worldwide annual turnover, whichever is higher',
  marketing: 'National ePrivacy penalties for unsolicited electronic marketing (set nationally, verify)',
  financial: 'Sanctions of the national financial supervisor under PSD2, MiFID II, the Consumer Credit Directive or MiCA (set nationally, verify)',
  data: 'Data Act art. 40: penalties set by each member state (verify)',
  platform: 'Digital Services Act art. 52: up to 6% of worldwide annual turnover',
};

const NATIONAL = {
  PL: {
    transparency: 'UODO (GDPR art. 83(5)): up to EUR 20M or 4% of worldwide annual turnover',
    lawfulness: 'UODO (GDPR art. 83(5)): up to EUR 20M or 4% of worldwide annual turnover',
    cookies: 'UKE under the Electronic Communications Law (art. 399 PKE): up to 3% of the previous year\'s revenue (verify)',
    operator: 'No dedicated fine for art. 5 UŚUDE; misleading consumers can trigger UOKiK fines up to 10% of the previous year\'s turnover',
    consumer: 'UOKiK (collective consumer interests): up to 10% of the previous year\'s turnover',
    accessibility: 'Fines under the 2024 Polish accessibility act for consumer e-commerce (amount to verify); brochure B2B sites usually out of scope',
    marketing: 'UKE under the Electronic Communications Law (art. 398 PKE): up to 3% of the previous year\'s revenue (verify)',
    financial: 'KNF sanctions under the Polish financial-market acts (amount depends on the act, verify)',
  },
  DE: {
    cookies: 'TDDDG § 28: up to EUR 300,000 per breach',
    lawfulness: 'GDPR: up to EUR 20M or 4%; plus civil claims (LG München I, 3 O 17493/20, awarded one visitor EUR 100 for Google Fonts) and cease-and-desist letters (Abmahnung)',
    operator: 'DDG § 33: up to EUR 50,000, plus cease-and-desist letters (Abmahnung) from competitors',
    consumer: 'Art. 246e EGBGB: up to 4% of annual turnover for widespread infringements, plus Abmahnung',
    accessibility: 'BFSG: up to EUR 100,000',
  },
  AT: {
    operator: 'ECG § 26: up to EUR 3,000 per breach (verify)',
    cookies: 'TKG 2021: administrative fines (verify); GDPR route up to EUR 20M or 4%',
  },
  FR: {
    cookies: 'CNIL (art. 82 Loi Informatique et Libertés): fines scale with worldwide turnover; 2025 cookie fines: Google EUR 325M, Shein EUR 150M (verify cap)',
    operator: 'LCEN: up to EUR 375,000 for legal entities (EUR 75,000 and 1 year for individuals)',
    consumer: 'DGCCRF: up to EUR 75,000 per breach for companies; Omnibus up to 4% of turnover',
  },
  IT: {
    cookies: 'Garante: up to EUR 20M or 4% of worldwide turnover',
    consumer: 'AGCM: up to EUR 10M per unfair commercial practice',
  },
  ES: {
    cookies: 'LSSI-CE: up to EUR 30,000 (minor) or EUR 150,000 (serious) (verify)',
    operator: 'LSSI-CE: up to EUR 150,000 for serious breaches (verify)',
  },
  NL: {
    cookies: 'ACM / AP: up to EUR 900,000 per breach or 10% of turnover (verify)',
  },
  IE: {
    cookies: 'ePrivacy Regulations 2011: criminal fines; unsolicited marketing up to EUR 250,000 per offence for companies',
  },
  GB: {
    transparency: 'UK GDPR: up to GBP 17.5M or 4% of worldwide annual turnover',
    lawfulness: 'UK GDPR: up to GBP 17.5M or 4% of worldwide annual turnover',
    cookies: 'PECR as amended by the Data (Use and Access) Act 2025: up to GBP 17.5M or 4% of worldwide turnover',
    operator: 'Companies Act trading-disclosure offences: criminal fine plus daily default fines (verify)',
    consumer: 'CMA under the DMCCA 2024: up to 10% of worldwide turnover',
    accessibility: 'Equality Act 2010: civil claims; no fixed cap',
    platform: 'Online Safety Act 2023: up to GBP 18M or 10% of qualifying worldwide revenue',
  },
  CH: {
    transparency: 'FADP art. 60: fines up to CHF 250,000 on the responsible individuals',
    lawfulness: 'FADP art. 60-61: fines up to CHF 250,000 on the responsible individuals',
  },
  US: {
    transparency: 'FTC Act § 5: civil penalties about USD 53,088 per violation; California CCPA USD 2,663 / 7,988 per violation',
    lawfulness: 'FTC Act § 5 and state privacy laws (typically USD 7,500 per violation)',
    cookies: 'CCPA USD 2,663 / 7,988 per violation; CIPA wiretap claims USD 5,000 per violation (private suits)',
    consumer: 'FTC civil penalties about USD 53,088 per violation',
    accessibility: 'ADA Title III lawsuits; California Unruh Act USD 4,000 minimum damages per violation',
    operator: 'No general imprint duty; CAN-SPAM requires a postal address in marketing e-mail (USD 53,088 per e-mail)',
  },
  CA: {
    transparency: 'PIPEDA: no administrative fines, offences up to CAD 100,000; Québec Law 25: administrative penalties up to CAD 10M or 2% of worldwide turnover',
    cookies: 'Québec Law 25: up to CAD 10M or 2% (administrative), CAD 25M or 4% (penal)',
    consumer: 'Competition Act: the greater of CAD 10M (CAD 15M for repeat orders), 3 times the benefit, or 3% of worldwide gross revenue',
  },
  BR: {
    transparency: 'LGPD: up to 2% of Brazilian revenue, capped at BRL 50M per infraction',
    lawfulness: 'LGPD: up to 2% of Brazilian revenue, capped at BRL 50M per infraction',
    cookies: 'LGPD: up to 2% of Brazilian revenue, capped at BRL 50M per infraction',
  },
};

export const CHECK_AREA = {
  'operator-identity': 'operator',
  'privacy-linked': 'transparency',
  'privacy-readable': 'transparency',
  'privacy-content': 'transparency',
  'form-notice': 'transparency',
  'consent-mechanism': 'cookies',
  'trackers-before-consent': 'cookies',
  'tracking-cookies-first-response': 'cookies',
  'cookie-info': 'cookies',
  'embeds-before-consent': 'lawfulness',
  'terms-linked': 'consumer',
  reviews: 'consumer',
  'ai-disclosure': 'ai',
  'a11y-basics': 'accessibility',
};

/** Pick the jurisdiction whose penalties apply: forced country, else the strongest detected one. */
export function penaltyJurisdiction(jurisdictions, forced) {
  if (forced) return forced.toUpperCase();
  const top = (jurisdictions?.list || []).find((j) => j.confidence !== 'low');
  return top ? top.code : 'EU';
}

export function maxPenalty(checkKey, jurisdiction) {
  return penaltyForArea(CHECK_AREA[checkKey], jurisdiction);
}

/** Maximum penalty for a legal area in a jurisdiction; outside the EU/EEA without a national value: "Set by national law (verify)". */
export function penaltyForArea(area, jurisdiction) {
  if (!area) return null;
  const nat = NATIONAL[jurisdiction] || {};
  if (nat[area]) return nat[area];
  if (!jurisdiction || jurisdiction === 'EU' || EU_EEA.has(jurisdiction)) return EU[area] || null;
  return 'Set by national law (verify)';
}

export const PENALTY_AREAS = { EU, NATIONAL };
