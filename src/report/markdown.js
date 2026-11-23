import { DOMAINS } from '../checks/security.js';
import { badgeMarkdown } from './badge.js';
import { countryInfo } from '../jurisdiction.js';
import { renderFixPrompt } from './prompt.js';
import { pct } from '../score.js';

const STATUS = { pass: 'PASS', partial: 'PARTIAL', fail: 'FAIL', manual: 'MANUAL', na: 'N/A' };
const SEV = { critical: 'CRITICAL', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', info: 'INFO' };
// Site text is escaped so a renderer that allows HTML in Markdown cannot run markup from the audited site.
const cell = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\|/g, '\\|').replace(/\n+/g, ' ');
const count = (arr, st) => arr.filter((c) => c.status === st && !c.ignored).length;

/**
 * Markdown report. Layout: Overview (scope, site type, examined, tooling, not run,
 * jurisdictions, scores), then 1 Compliance (EU baseline, EU extended checklist, each jurisdiction,
 * each site type), 2 Security, 3 SEO and GEO, 4 Priorities, 5 Fix prompt, 6 Limitations.
 * The tables show findings only; everything needed to fix them is in the single fix prompt.
 */
export function renderMarkdown(r) {
  const L = [];
  const p = (s = '') => L.push(s);
  const date = r.startedAt.slice(0, 10);
  const checks = r.compliance.checks;
  const sets = r.compliance.sets || [];
  const rows = [...checks, ...sets.flatMap((x) => x.results)];
  const seo = r.seo.checks;
  const fs = r.security.findings.filter((f) => !f.ignored);
  const sevCount = (s) => fs.filter((f) => f.severity === s).length;

  p(`# KagiCyber audit: ${r.target.host} (${date})`);
  p();
  p('## Overview');
  p();
  p(`- **Target:** ${r.target.finalUrl} (HTTP ${r.target.status})`);
  p(`- **Scope:** live site, passive checks only (what a normal visit loads, plus robots.txt, sitemap, security.txt, llms.txt, one 404 probe, TLS and DNS)${r.repo ? `, plus the repository at ${r.repo}` : ''}. No logins, form submissions, wordlists or attack payloads.`);
  p(`- **Site type:** ${r.siteTypes.join(', ')}${r.stack ? `. Stack: ${r.stack}` : ''}`);
  p(`- **Examined:** ${r.examined.join('; ')}`);
  p(`- **Tooling:** KagiCyber ${r.tool.version}, rules ${r.tool.rules} (${r.profile} profile, ${r.requests} requests, ${(r.durationMs / 1000).toFixed(1)} s${r.browser?.ran ? ', real-browser test' : ''})`);
  p(`- **Rule sets:** EU baseline (${checks.length} checks)${sets.map((x) => `, ${x.name} (${x.results.length})`).join('')}`);
  p(`- **Not run:** ${r.notRun.join(' ')}`);
  p('- **Jurisdictions:**');
  p();
  p('| Jurisdiction | Role | Evidence | Confidence |');
  p('|---|---|---|---|');
  if (r.jurisdictions.list.length) {
    r.jurisdictions.list.forEach((j, i) => {
      const op = i === 0 && j.signals.some((s) => /company identifier|phone/.test(s)) ? 'Operator home and target market' : 'Target market';
      p(`| ${j.name} | ${op} | ${cell(j.signals.slice(0, 5).join(', '))} | ${j.confidence} |`);
    });
  } else p('| Global baseline | No clear country signals | - | - |');
  if (r.jurisdictions.eu) p('| European Union | Target market (EU law applies to EU-facing sites) | EU member state detected | high |');
  p();
  p(`> Not legal advice. Automated indicators as of ${date}; maximum penalties are statutory ceilings, not predictions, and items marked (verify) need confirmation in a primary source. Maximum penalties are shown for ${r.penaltyJurisdiction === 'EU' ? 'EU law' : countryInfo(r.penaltyJurisdiction).name} (override with --country).`);
  p();
  p('### Scores');
  p();
  p(`1. **Compliance:** ${r.scores.compliance ?? '-'}/100 (FAIL ${count(rows, 'fail')}, PARTIAL ${count(rows, 'partial')}, PASS ${count(rows, 'pass')}, MANUAL ${count(rows, 'manual')}; coverage ${pct(r.scores.complianceCoverage)}; EU baseline ${r.scores.complianceCore ?? '-'}/100)`);
  p(`2. **Security:** ${r.scores.security}/100, grade ${r.scores.grade} (CRITICAL ${sevCount('critical')}, HIGH ${sevCount('high')}, MEDIUM ${sevCount('medium')}, LOW ${sevCount('low')}, INFO ${sevCount('info')})`);
  p(`3. **SEO/GEO:** ${r.scores.seo ?? '-'}/100 (FAIL ${count(seo, 'fail')}, PARTIAL ${count(seo, 'partial')}, PASS ${count(seo, 'pass')}, MANUAL ${count(seo, 'manual')}; coverage ${pct(r.scores.seoCoverage)})`);
  if (r.baseline) {
    const d = r.baseline.delta;
    const fmt = (x) => (x == null ? 'n/a' : x > 0 ? `+${x}` : `${x}`);
    p();
    p(`Since the baseline of ${r.baseline.previous?.slice(0, 10) || 'the previous run'}: compliance ${fmt(d.compliance)}, security ${fmt(d.security)}, SEO/GEO ${fmt(d.seo)}; ${r.baseline.fixed.length} fixed, ${r.baseline.new.length} new.`);
  }
  p();

  p('## 1. Compliance');
  p();
  p(`### EU baseline: ${r.scores.complianceCore ?? '-'}/100`);
  p();
  p('| ID | Requirement | Status | Evidence | Legal basis | Max penalty |');
  p('|---|---|---|---|---|---|');
  for (const c of checks) {
    if (c.ignored) continue;
    const basis = [c.basis, ...(c.nationalBasis || [])].join('; ');
    p(`| ${c.id} | ${cell(c.title)} | ${STATUS[c.status]}${c.baseline === 'new' ? ' (new)' : ''} | ${cell(c.evidence)} | ${cell(basis)} | ${cell(c.maxPenalty)} |`);
  }
  p();
  for (const set of sets) {
    const shown = set.results.filter((x) => !x.ignored && x.status !== 'na');
    p(`### ${set.name}: ${set.score ?? '-'}/100 (coverage ${pct(set.coverage)})`);
    p();
    if (!shown.length) {
      p('All rules in this set are not applicable to this site.');
      p();
      continue;
    }
    p('| ID | Requirement | Status | Evidence | Legal basis | Max penalty |');
    p('|---|---|---|---|---|---|');
    for (const x of shown) {
      p(`| ${x.id} | ${cell(x.title)}${x.verify ? ' (verify)' : ''} | ${STATUS[x.status]}${x.baseline === 'new' ? ' (new)' : ''} | ${cell(x.evidence)} | ${cell(x.basis)} | ${cell(x.maxPenalty)} |`);
    }
    const na = set.results.length - shown.length;
    if (na) {
      p();
      p(`${na} further rule${na === 1 ? '' : 's'} not applicable to this site (no trigger found).`);
    }
    p();
  }

  p('## 2. Security');
  p();
  if (fs.length) {
    p('| ID | Severity | Finding | Evidence (secrets masked) | CWE / OWASP | Effort |');
    p('|---|---|---|---|---|---|');
    for (const code of Object.keys(DOMAINS)) {
      for (const f of fs.filter((x) => x.domain === code)) {
        p(`| ${f.id} | ${SEV[f.severity]}${f.baseline === 'new' ? ' (new)' : ''} | ${cell(f.title)} | ${cell(f.evidence)}${f.file ? ` (${cell(f.file)}${f.line ? `:${f.line}` : ''})` : ''} | ${cell([f.cwe, f.owasp].filter(Boolean).join(', ') || '-')} | ${f.effort || 'S'} |`);
      }
    }
  } else p('No security findings.');
  p();
  p(`Areas: ${Object.entries(r.security.tiles).map(([code, t]) => `${code} ${t.name}: ${t.status === 'untested' ? 'not tested' : t.count ? `${t.count} (worst ${t.worst})` : 'clean'}`).join('; ')}.`);
  p();
  if (r.strengths.length) {
    p('What already works:');
    p();
    for (const s of r.strengths) p(`- ${s}`);
    p();
  }

  p('## 3. SEO and GEO');
  p();
  p('| ID | Check | Status | Evidence | Why it matters |');
  p('|---|---|---|---|---|');
  for (const c of seo) {
    if (c.ignored || c.status === 'na') continue;
    p(`| ${c.id} | ${cell(c.title)} | ${STATUS[c.status]}${c.baseline === 'new' ? ' (new)' : ''} | ${cell(c.evidence)} | ${cell(c.why || '-')} |`);
  }
  p();
  p('GEO = generative engine optimisation: how well AI assistants and AI search (ChatGPT, Claude, Perplexity, Google AI Overviews) can read, understand and cite the site.');
  p();

  p('## 4. Priorities');
  p();
  if (r.fixFirst.length) {
    r.fixFirst.forEach((f, i) => {
      p(`${i + 1}. **${f.title}** (${f.id}, ${f.level}, ${f.pillar})${f.penalty ? `. Max penalty: ${f.penalty}` : ''}`);
    });
  } else p('Nothing urgent.');
  p();

  p('## 5. Fix prompt');
  p();
  p('Paste this into an AI coding assistant that has access to the site code (or hand it to a developer). It covers every failed and partial check above.');
  p();
  p('````text');
  p(renderFixPrompt(r));
  p('````');
  p();

  p('## 6. Limitations');
  p();
  for (const l of [...r.limitations, ...r.notRun]) p(`- ${l}`);
  if (r.ignored?.length) p(`- Ignored by configuration: ${r.ignored.map((i) => i.id).join(', ')}.`);
  p('- What the site loads: ' + cell(inventoryLine(r)));
  p('- MANUAL rows need a person (checkout flows, size thresholds, registrations); they are excluded from the score and shown as coverage.');
  p('- Not legal advice. Scores are heuristics to track progress, not a certification.');
  p();
  p('---');
  p();
  p(`Monthly monitoring of this site, with change reports and alerts: ${r.links.monitoring}`);
  p();
  p(`README badge: \`${badgeMarkdown(r)}\``);
  p();
  return L.join('\n');
}

function inventoryLine(r) {
  const inv = r.inventory;
  const parts = [
    `trackers in markup: ${inv.trackers.length ? inv.trackers.map((t) => `${t.name}${t.gated ? ' (gated)' : ''}`).join(', ') : 'none'}`,
    `trackers injected by JavaScript: ${inv.dynamicTrackers.length ? inv.dynamicTrackers.join(', ') : 'none'}`,
    `consent manager: ${inv.consentManagers.length ? inv.consentManagers.join(', ') : inv.customBanner ? `custom banner ("${inv.customBanner.accept}"${inv.customBanner.reject ? ` / "${inv.customBanner.reject}"` : ''})` : 'none'}${inv.consentModeDenied ? ', Google Consent Mode default denied' : ''}`,
    `embeds: ${inv.embeds.length ? inv.embeds.map((e) => e.name).join(', ') : 'none'}${inv.googleFonts ? ', Google Fonts' : ''}`,
    `form processors: ${inv.formProcessors.length ? inv.formProcessors.join(', ') : 'none'}`,
  ];
  return `${parts.join('; ')}.`;
}
