// Builds skills/kagicyber-audit/collector.js from the rule lists the CLI uses, so both stay in sync.
// Only the lists needed inside the page are embedded (secret formats, trackers, consent platforms,
// form processors, CAPTCHA markers); page texts are returned and judged by the skill.
import { readFileSync, writeFileSync } from 'node:fs';
import { SECRET_PATTERNS } from '../src/checks/secrets.js';
import { TRACKERS, TRACKER_COOKIES, CMPS, CAPTCHA_MARKERS, FORM_PROCESSORS, COMPROMISED_HOSTS } from '../src/knowledge.js';
import { VERSION } from '../src/version.js';
import { jurisdictionModules, SITE_TYPES, SITE_TYPE_NAMES, NAMES } from '../src/law/rules.js';
import { EU } from '../src/law/eu.js';
import { COVERED_BY_CORE } from '../src/law/evaluate.js';
import { countryInfo } from '../src/jurisdiction.js';
import { PENALTY_DATA } from '../src/law/exposure.js';
import { RULES_VERSION } from '../src/version.js';

// Emitted as JavaScript (regex literals, one entry per line) so it stays readable and easy to copy exactly.
const q = (v) => JSON.stringify(v);
const re = (r) => r.toString();
const lines = (items) => `[\n${items.map((x) => `    ${x},`).join('\n')}\n  ]`;
const js = {
  v: q(VERSION),
  secrets: lines(SECRET_PATTERNS.map(([name, sev, r, kws]) => `[${q(name)}, ${q(sev)}, ${re(r)}, ${q(kws || [])}]`)),
  trackers: lines(TRACKERS.map((t) => `[${q(t.host)}, ${q(t.name)}]`)),
  tcookies: `[${TRACKER_COOKIES.map(re).join(', ')}]`,
  cmps: lines(CMPS.map((c) => `[${q(c.name)}, ${q(c.markers)}]`)),
  captcha: q(CAPTCHA_MARKERS),
  forms: lines(FORM_PROCESSORS.map((p) => `[${q(p.name)}, ${re(p.re)}]`)),
  bad: q(COMPROMISED_HOSTS),
  legalRe: re(/priva|prywatn|cookie|ciastecz|rodo|gdpr|datenschutz|confidential|regulamin|terms|agb|cgv|cgu|condi|términos|termos|voorwaarden|impressum|imprint|mentions|aviso legal|note legali|colofon|kontakt|contact|about|o nas|accessib|dostępn|barriere|zwrot|returns|widerruf|rétractation|devoluc/iu),
};
const tpl = readFileSync(new URL('./collector.template.js', import.meta.url), 'utf8');
const data = `{\n${Object.entries(js).map(([k, v]) => `  ${k}: ${v},`).join('\n')}\n}`;
const out = tpl.replace('/* @data */ {}', data);
writeFileSync(new URL('../skills/kagicyber-audit/collector.js', import.meta.url), out);
console.log(`collector.js: ${out.length} bytes, ${SECRET_PATTERNS.length} secret formats, ${TRACKERS.length} trackers, ${CMPS.length} consent platforms`);

// rules.md: the compact rule base the skill uses on the browser path (same IDs as the CLI).
const CORE_ID = { 'operator-identity': 'C-01', 'privacy-linked': 'C-02', 'privacy-readable': 'C-03', 'privacy-content': 'C-04', 'form-notice': 'C-05', 'consent-mechanism': 'C-06', 'trackers-before-consent': 'C-07', 'tracking-cookies-first-response': 'C-08', 'cookie-info': 'C-09', 'embeds-before-consent': 'C-10', 'terms-linked': 'C-11', reviews: 'C-12', 'ai-disclosure': 'C-13', 'a11y-basics': 'C-14' };
const _how = (r) => {
  const c = r.check;
  if (c.type === 'manual') return 'MANUAL';
  if (c.type === 'link') return `link: ${c.keywords.slice(0, 4).join(', ')}`;
  if (c.type === 'lang' || c.type === 'has-lang') return `language ${c.code}${c.where ? ` (${c.where})` : ''}`;
  if (c.type === 'count') return `${c.min} of: ${c.groups.map((g) => g[0]).join(', ')}`;
  if (c.type === 'text') return `text in ${c.where}`;
  return c.type;
};
const ruleLine = (r) => {
  const extra = [r.appliesTo.includes('all') ? null : `only ${r.appliesTo.join('/')}`, r.trigger ? 'N/A unless mentioned on the site' : null, r.check.type === 'manual' ? 'MANUAL' : null, r.verify ? 'verify' : null].filter(Boolean);
  return `- ${r.id} [${r.weight}] ${r.title}. ${r.basis}${extra.length ? ` (${extra.join('; ')})` : ''}`;
};
const block = (rules) => {
  const own = rules.filter((r) => !(r.check.type === 'signal' && CORE_ID[r.check.check]));
  const folded = rules.filter((r) => r.check.type === 'signal' && CORE_ID[r.check.check]);
  return own.map(ruleLine).join('\n') + (folded.length ? `\n- Folded into core rows (add to their legal basis): ${folded.map((r) => `${CORE_ID[r.check.check]}: ${r.basis}`).join('; ')}` : '');
};
const pen = (code) => (PENALTY_DATA[code] || []).map((e) => `${e.law}: ${e.max}`).join('; ');
let md = `# KagiCyber rule base ${RULES_VERSION} (generated, do not edit)\n\nSame IDs, weights and legal bases as the CLI. Weight in brackets. Apply the EU checklist to EU-facing sites, each national module for every detected jurisdiction (high or medium confidence) and each site-type checklist that fits. Rules that fold into a core check are not separate rows. Max penalty per row: the national line below, otherwise the area table in SKILL.md.\n\n## EU extended checklist\n\n`;
md += block(EU.filter((r) => !COVERED_BY_CORE[r.id])) + '\n';
for (const [code, rules] of Object.entries(jurisdictionModules())) {
  md += `\n## ${NAMES[code] || countryInfo(code).name} (${code})\n\n`;
  if (pen(code)) md += `Penalties: ${pen(code)}\n\n`;
  md += block(rules) + '\n';
}
for (const [t, rules] of Object.entries(SITE_TYPES)) md += `\n## ${SITE_TYPE_NAMES[t]} (type:${t})\n\n${block(rules)}\n`;
writeFileSync(new URL('../skills/kagicyber-audit/rules.md', import.meta.url), md);
console.log(`rules.md: ${md.length} bytes`);
