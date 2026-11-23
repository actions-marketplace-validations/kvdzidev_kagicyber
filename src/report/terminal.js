import { truncate } from '../util.js';
import { pct } from '../score.js';

const useColor = () => !process.env.NO_COLOR && process.stdout.isTTY && process.env.TERM !== 'dumb';
const wrap = (code) => (s) => (useColor() ? `\x1b[${code}m${s}\x1b[0m` : String(s));
export const c = {
  bold: wrap('1'), dim: wrap('2'), red: wrap('31'), green: wrap('32'), yellow: wrap('33'), blue: wrap('34'), magenta: wrap('35'), cyan: wrap('36'), grey: wrap('90'),
  orange: (s) => (useColor() ? `\x1b[38;5;208m${s}\x1b[0m` : String(s)),
};

export const SEV = {
  critical: { label: 'CRITICAL', color: c.red },
  high: { label: 'HIGH', color: c.orange },
  medium: { label: 'MEDIUM', color: c.yellow },
  low: { label: 'LOW', color: c.blue },
  info: { label: 'INFO', color: c.grey },
};
export const STATUS = {
  pass: { label: 'PASS', color: c.green },
  partial: { label: 'PARTIAL', color: c.yellow },
  fail: { label: 'FAIL', color: c.red },
  manual: { label: 'MANUAL', color: c.cyan },
  na: { label: 'N/A', color: c.grey },
};

function bar(n, width = 20) {
  if (n == null) return c.grey('-'.repeat(width));
  const full = Math.round((n / 100) * width);
  const col = n >= 85 ? c.green : n >= 70 ? c.yellow : n >= 50 ? c.orange : c.red;
  return col('#'.repeat(full)) + c.grey('.'.repeat(width - full));
}
const scoreCol = (n) => (n == null ? c.grey : n >= 85 ? c.green : n >= 70 ? c.yellow : n >= 50 ? c.orange : c.red);
const pad = (s, n) => String(s).padEnd(n);

/** Plain-text terminal report (colours only, no emoji). */
export function renderTerminal(r, { verbose = false } = {}) {
  const L = [];
  const p = (s = '') => L.push(s);
  p();
  p(`  ${c.bold('KagiCyber audit')}  ${c.bold(r.target.host)}`);
  p(c.grey(`  KagiCyber ${r.tool.version} | ${r.startedAt.slice(0, 10)} | ${r.profile} profile | ${r.requests} requests | ${(r.durationMs / 1000).toFixed(1)} s${r.browser?.ran ? ' | real browser' : ''}`));
  p();
  const jur = r.jurisdictions.list.length ? r.jurisdictions.list.map((j) => `${j.name} (${j.confidence})`).join(', ') : 'no clear signals, EU baseline';
  p(`  ${c.dim('Jurisdictions')}  ${jur}${r.jurisdictions.eu ? ', EU' : ''}`);
  p(`  ${c.dim('Site type')}      ${r.siteTypes.join(', ')}${r.stack ? c.grey(`  (${r.stack})`) : ''}`);
  p();
  const line = (n, label, score, extra) => p(`  ${n}. ${c.bold(pad(label, 11))} ${scoreCol(score)(c.bold(pad(score == null ? '-' : `${score}/100`, 8)))} ${bar(score)}  ${c.grey(extra)}`);
  line(1, 'Compliance', r.scores.compliance, `coverage ${pct(r.scores.complianceCoverage)}`);
  line(2, 'Security', r.scores.security, `grade ${r.scores.grade}`);
  line(3, 'SEO/GEO', r.scores.seo, `coverage ${pct(r.scores.seoCoverage)}`);
  p();

  const section = (title, items, render) => {
    p(`  ${c.bold(title)}`);
    items.forEach(render);
    p();
  };
  const compRow = (ch) => {
    const s = STATUS[ch.status];
    p(`   ${s.color(pad(s.label, 8))} ${c.grey(pad(ch.id, 7))} ${ch.title}`);
    if (ch.status !== 'pass' && ch.status !== 'na') {
      p(`            ${c.grey(truncate(ch.evidence, 150))}`);
      if (ch.maxPenalty) p(`            ${c.grey('Max penalty:')} ${truncate(ch.maxPenalty, 140)}`);
    }
  };
  p(`  ${c.bold('1. Compliance')}`);
  p(c.dim(`   EU baseline ${r.scores.complianceCore ?? '-'}/100`));
  r.compliance.checks.filter((x) => !x.ignored).forEach(compRow);
  for (const set of r.compliance.sets || []) {
    const rows = set.results.filter((x) => !x.ignored && (verbose || x.status === 'fail' || x.status === 'partial'));
    p(c.dim(`   ${set.name} ${set.score ?? '-'}/100${rows.length < set.results.length && !verbose ? `  (${set.results.length - rows.length} passed, manual or not applicable)` : ''}`));
    rows.forEach(compRow);
  }
  p();
  const shown = r.security.findings.filter((f) => !f.ignored && (verbose || f.severity !== 'info'));
  section('2. Security', shown.length ? shown : [null], (f) => {
    if (!f) return p(`   ${c.green('No findings above INFO.')}`);
    const s = SEV[f.severity];
    p(`   ${s.color(pad(s.label, 8))} ${c.grey(pad(f.id, 6))} ${f.title}`);
    p(`            ${c.grey(truncate(f.evidence, 150))}`);
  });
  const hidden = r.security.findings.filter((f) => !f.ignored && f.severity === 'info').length;
  if (hidden && !verbose) {
    L.pop();
    p(c.grey(`   + ${hidden} INFO finding(s): use --verbose or the Markdown report`));
    p();
  }
  section('3. SEO and GEO', r.seo.checks.filter((x) => !x.ignored && (verbose || (x.status !== 'pass' && x.status !== 'na'))), (ch) => {
    const s = STATUS[ch.status];
    p(`   ${s.color(pad(s.label, 8))} ${c.grey(pad(ch.id, 7))} ${ch.title}`);
    if (ch.status === 'fail' || ch.status === 'partial') p(`            ${c.grey(truncate(ch.evidence, 150))}`);
  });

  if (r.fixFirst.length) {
    p(`  ${c.bold('4. Priorities')}`);
    r.fixFirst.slice(0, 5).forEach((f, i) => {
      p(`   ${i + 1}. ${f.title} ${c.grey(`[${f.pillar} ${f.id}]`)}`);
    });
    p(c.grey(`   Fix prompt for all findings: kagicyber audit ${r.target.url} --prompt fix-prompt.md`));
    p();
  }
  if (r.baseline) {
    p(`  ${c.bold('Since baseline')}  ${r.baseline.fixed.length} fixed, ${r.baseline.new.length} new`);
    p();
  }
  p(c.grey(`  Not run: ${r.notRun.join(' ')}`));
  p(c.grey('  Not legal advice. Scores are heuristics to track progress, not a certification.'));
  p(c.grey(`  Monthly monitoring: ${r.links.monitoring}`));
  p();
  return L.join('\n');
}

export function renderScanTerminal(r) {
  const L = [];
  const p = (s = '') => L.push(s);
  p();
  p(`  ${c.bold('KagiCyber scan')}  ${c.bold(r.target.path)}`);
  p(c.grey(`  KagiCyber ${r.tool.version} | ${r.target.files} files${r.target.git ? ' | git repository' : ''} | ${(r.durationMs / 1000).toFixed(1)} s`));
  p();
  p(`  Security ${scoreCol(r.scores.security)(c.bold(`${r.scores.security}/100`))} grade ${r.scores.grade}  ${bar(r.scores.security)}`);
  p();
  if (!r.security.findings.length) p(`   ${c.green('No secrets or risky settings found.')}`);
  for (const f of r.security.findings) {
    const s = SEV[f.severity];
    p(`   ${s.color(pad(s.label, 8))} ${c.grey(pad(f.id || '', 6))} ${f.title}`);
    p(`            ${c.grey(truncate(f.evidence, 150))}`);
  }
  p();
  for (const l of r.limitations) p(c.grey(`  ${l}`));
  p();
  return L.join('\n');
}
