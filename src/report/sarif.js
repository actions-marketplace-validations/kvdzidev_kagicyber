import { VERSION } from '../version.js';

const LEVEL = { critical: 'error', high: 'error', medium: 'warning', low: 'note', info: 'none' };
const SCORE = { critical: '9.0', high: '7.5', medium: '5.0', low: '2.0', info: '0.0' };
const STATUS_LEVEL = { fail: 'error', partial: 'warning' };

/**
 * SARIF 2.1.0 for GitHub code scanning and other tools. Website audits use the page URL as the
 * location; `scan` results point at file and line. Compliance and SEO/GEO failures are included
 * as rules in their own categories.
 */
export function renderSarif(r) {
  const rules = new Map();
  const results = [];
  const addRule = (id, name, desc, help, tags, severity) => {
    if (!rules.has(id)) {
      rules.set(id, {
        id,
        name,
        shortDescription: { text: name },
        fullDescription: { text: desc || name },
        help: { text: help || desc || name },
        properties: { tags, ...(severity ? { 'security-severity': SCORE[severity] } : {}) },
      });
    }
    return [...rules.keys()].indexOf(id);
  };
  const loc = (uri, line) => [{ physicalLocation: { artifactLocation: { uri }, ...(line ? { region: { startLine: line } } : {}) } }];
  const target = r.target?.finalUrl || r.target?.path || '.';

  for (const f of r.security?.findings || []) {
    if (f.ignored) continue;
    const ruleId = `kagicyber/security/${slug(f.title)}`;
    const idx = addRule(ruleId, f.title, f.evidence, f.fix, ['security', f.cwe, f.owasp].filter(Boolean), f.severity);
    results.push({
      ruleId,
      ruleIndex: idx,
      level: LEVEL[f.severity] || 'note',
      message: { text: `${f.title}. ${f.evidence}${f.fix ? ` Fix: ${f.fix}` : ''}` },
      locations: f.file ? loc(f.file, f.line) : loc(target),
      partialFingerprints: { kagicyber: f.fingerprint || slug(f.title) },
    });
  }
  for (const [pillar, list] of [['compliance', [...(r.compliance?.checks || []), ...(r.compliance?.sets || []).flatMap((s) => s.results)]], ['seo', r.seo?.checks || []]]) {
    for (const c of list) {
      if (c.ignored || !STATUS_LEVEL[c.status]) continue;
      const ruleId = `kagicyber/${pillar}/${c.id}`;
      const idx = addRule(ruleId, c.title, c.basis || c.why, c.fix, [pillar]);
      results.push({
        ruleId,
        ruleIndex: idx,
        level: STATUS_LEVEL[c.status],
        message: { text: `${c.title}: ${c.status.toUpperCase()}. ${c.evidence}${c.maxPenalty ? ` Max penalty: ${c.maxPenalty}.` : ''}` },
        locations: loc(target),
        partialFingerprints: { kagicyber: c.fingerprint || c.id },
      });
    }
  }
  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: { driver: { name: 'KagiCyber', version: VERSION, informationUri: 'https://github.com/kvdzidev/kagicyber', rules: [...rules.values()] } },
        results,
      },
    ],
  };
}

function slug(s) {
  return String(s).toLowerCase().replace(/\d+/g, 'n').replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
}
