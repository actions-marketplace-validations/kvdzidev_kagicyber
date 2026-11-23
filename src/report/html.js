import { renderFixPrompt } from './prompt.js';
import { pct } from '../score.js';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const scoreCls = (n) => (n == null ? 'na' : n >= 85 ? 'pass' : n >= 70 ? 'partial' : n >= 50 ? 'high' : 'fail');
const STATUS = { pass: ['pass', 'PASS'], partial: ['partial', 'PARTIAL'], fail: ['fail', 'FAIL'], manual: ['manual', 'MANUAL'], na: ['na', 'N/A'] };
const SEV = { critical: ['crit', 'CRITICAL'], high: ['high', 'HIGH'], medium: ['med', 'MEDIUM'], low: ['low', 'LOW'], info: ['info', 'INFO'] };
const TILE = { green: 'g', yellow: 'y', orange: 'o', red: 'r', untested: 'mut' };

const CSS = `<style>
:root{--bg:#fbfaf7;--txt:#1c1c1a;--mut:#6b6a64;--line:#d9d6cc;--soft:#f1efe8;--g:#2f6b3a;--y:#8a6a00;--o:#a8501a;--r:#a32020}
@media (prefers-color-scheme:dark){:root{--bg:#1b1b19;--txt:#e6e4dc;--mut:#9c9a91;--line:#3a3934;--soft:#24231f;--g:#7fb68a;--y:#d6b45a;--o:#e0905a;--r:#e47a72}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font:15px/1.6 Georgia,"Iowan Old Style","Times New Roman",serif}
.wrap{max-width:960px;margin:0 auto;padding:40px 20px 72px}
h1,h2,th,summary,.sum td,.lbl{font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
h1{margin:0 0 4px;font-size:24px;font-weight:600}h2{margin:40px 0 10px;font-size:17px;font-weight:600;padding-bottom:4px;border-bottom:1px solid var(--txt)}
.mut{color:var(--mut)}.meta{font-size:14px;margin:0 0 20px}
.sum{width:auto;min-width:min(100%,560px);margin:0 0 8px}.sum td{border:0;border-bottom:1px solid var(--line);padding:6px 24px 6px 0;font-size:14px}.sum td.n{font-weight:600;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse;margin-top:6px}
th,td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);text-align:left;vertical-align:top;font-size:13.5px}th{font-size:12px;font-weight:600;color:var(--mut);border-bottom:1px solid var(--txt)}
.lbl{font-size:11px;font-weight:700;letter-spacing:.04em;white-space:nowrap}
.pass{color:var(--g)}.partial{color:var(--y)}.fail,.crit{color:var(--r)}.high{color:var(--o)}.med{color:var(--y)}.manual,.low,.info,.na{color:var(--mut)}
details{border-top:1px solid var(--line);padding:8px 0;margin:0}details:last-of-type{border-bottom:1px solid var(--line)}summary{cursor:pointer;font-size:14px;font-weight:600}details p{margin:6px 0 6px 18px;font-size:14px}
pre{background:var(--soft);border:1px solid var(--line);padding:12px;overflow:auto;font-size:12.5px;white-space:pre-wrap}
code{font:12px ui-monospace,Consolas,monospace;white-space:nowrap}ol{padding-left:22px}ol li{margin:0 0 12px}ol li div{font-size:14px}ul{padding-left:22px}
a{color:inherit}
@media (max-width:640px){table:not(.sum){display:block;overflow-x:auto}td{min-width:90px}td:first-child{min-width:0}}
@media print{:root{--bg:#fff;--txt:#000;--mut:#555;--line:#bbb;--soft:#f4f4f4}details{break-inside:avoid}}
</style>`;

/** Self-contained HTML report (inline CSS, no scripts, no external requests). Same content as the Markdown report. */
export function renderHtml(r, { brand = 'KagiCyber' } = {}) {
  const date = r.startedAt.slice(0, 10);
  const jur = [...r.jurisdictions.list.map((j) => `${j.name} (${j.confidence} confidence)`), ...(r.jurisdictions.eu ? ['EU'] : [])].join(', ');
  const row = (label, value, note = '', col = '') => `<tr><td>${esc(label)}</td><td class="n${col ? ` ${col}` : ''}">${esc(value)}</td><td class="mut">${esc(note)}</td></tr>`;
  const RISKCLS = { low: 'pass', moderate: 'partial', high: 'high', critical: 'fail' };
  const sets = r.compliance.sets || [];
  const rows = [...r.compliance.checks, ...sets.flatMap((x) => x.results)].filter((x) => !x.ignored);
  const n = (st) => rows.filter((x) => x.status === st).length;
  const fs = r.security.findings.filter((f) => !f.ignored);
  const sev = (s) => fs.filter((f) => f.severity === s).length;
  const badge = (status) => `<span class="lbl ${STATUS[status][0]}">${STATUS[status][1]}</span>`;
  const compTable = (list, withNational) => `<table><tr><th>ID</th><th>Requirement</th><th>Status</th><th>Evidence</th><th>Legal basis</th><th>Max penalty</th></tr>${list
    .map((x) => `<tr><td><code>${esc(x.id)}</code></td><td>${esc(x.title)}${x.verify ? ' <span class="mut">(verify)</span>' : ''}</td><td>${badge(x.status)}</td><td>${esc(x.evidence)}</td><td class="mut">${esc([x.basis, ...(withNational ? x.nationalBasis || [] : [])].join('; '))}</td><td>${esc(x.maxPenalty || '-')}</td></tr>`)
    .join('')}</table>`;

  const fixFirst = r.fixFirst
    .map((f) => {
      const cls = SEV[f.level.toLowerCase()]?.[0] || STATUS[f.level.toLowerCase()]?.[0] || 'na';
      return `<li><b>${esc(f.title)}</b> <span class="lbl ${cls}">${esc(f.level)}</span> <span class="mut">${esc(f.pillar)}, <code>${esc(f.id)}</code></span><div>${esc(f.why)}</div>${f.penalty ? `<div class="mut">Max penalty: ${esc(f.penalty)}</div>` : ''}</li>`;
    })
    .join('');
  const TILECLS = { g: 'pass', y: 'partial', o: 'high', r: 'fail', mut: 'na' };
  const tiles = Object.entries(r.security.tiles)
    .map(([code, t]) => `<tr><td><code>${esc(code)}</code></td><td>${esc(t.name)}</td><td class="${TILECLS[TILE[t.status]]}">${t.status === 'untested' ? 'not tested' : t.count ? `${t.count} finding(s), worst ${esc(t.worst)}` : 'no findings'}</td></tr>`)
    .join('');
  const setHtml = sets
    .map((x) => {
      const shown = x.results.filter((y) => !y.ignored && y.status !== 'na');
      return `<details ${shown.some((y) => y.status === 'fail') ? 'open' : ''}><summary>${esc(x.name)} <span class="mut">(${x.score ?? '-'}/100, coverage ${pct(x.coverage)}, ${x.results.length} rules)</span></summary>${shown.length ? compTable(shown, false) : '<p class="mut">No applicable rules.</p>'}</details>`;
    })
    .join('');
  const findings = fs
    .map((f) => `<details><summary>${esc(f.title)} <span class="lbl ${SEV[f.severity][0]}">${SEV[f.severity][1]}</span> <span class="mut">${esc(f.id)}${f.cwe ? `, ${esc(f.cwe)}` : ''}</span></summary><p><b>Evidence:</b> ${esc(f.evidence)}</p>${f.owasp ? `<p><b>Category:</b> ${esc(f.owasp)}</p>` : ''}<p class="mut">Effort: ${esc(f.effort || 'S')}</p></details>`)
    .join('');
  const seo = r.seo.checks
    .filter((x) => !x.ignored && x.status !== 'na')
    .map((x) => `<tr><td><code>${esc(x.id)}</code></td><td>${esc(x.title)}</td><td>${badge(x.status)}</td><td>${esc(x.evidence)}</td><td class="mut">${esc(x.why || '')}</td></tr>`)
    .join('');
  const prompt = renderFixPrompt(r);
  const inv = r.inventory || {};

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(brand)} audit: ${esc(r.target.host)}</title>
${CSS}</head><body><div class="wrap">
<header>
 <h1>${esc(brand)} audit of ${esc(r.target.host)}</h1>
 <p class="mut meta">${esc(r.target.finalUrl || r.target.host)}, scanned ${esc(date)} with KagiCyber ${esc(r.tool.version)} (rules ${esc(r.tool.rules)}).<br>
 Jurisdiction: ${esc(jur || 'not detected')}. Site type: ${esc(r.siteTypes.join(', '))}.${r.stack ? ` Stack: ${esc(r.stack)}.` : ''}</p>
</header>
<table class="sum">
${row('Overall risk', r.scores.risk.toUpperCase(), '', RISKCLS[r.scores.risk])}
${row('Compliance', r.scores.compliance == null ? '-' : `${r.scores.compliance}/100`, `coverage ${pct(r.scores.complianceCoverage)}`, scoreCls(r.scores.compliance))}
${row('Security', `${r.scores.grade} (${r.scores.security}/100)`, '', scoreCls(r.scores.security))}
${row('SEO and GEO', r.scores.seo == null ? '-' : `${r.scores.seo}/100`, `coverage ${pct(r.scores.seoCoverage)}`, scoreCls(r.scores.seo))}
${row('Failed requirements', n('fail'), `${n('partial')} partial, ${n('manual')} need manual review`)}
${row('Critical or high findings', sev('critical') + sev('high'))}
</table>
<h2>Priorities</h2><ol>${fixFirst || '<li class="mut">Nothing urgent.</li>'}</ol>
${r.strengths.length ? `<h2>What already works</h2><ul>${r.strengths.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
<h2>1. Compliance</h2>
<p class="mut">Maximum penalties are statutory ceilings for ${esc(r.penaltyJurisdiction)}, not predictions.</p>
<details open><summary>EU baseline <span class="mut">(${r.scores.complianceCore ?? '-'}/100, ${r.compliance.checks.length} checks)</span></summary>${compTable(r.compliance.checks.filter((x) => !x.ignored), true)}</details>
${setHtml}
<h2>2. Security</h2><table><tr><th>Area</th><th></th><th>Result</th></tr>${tiles}</table>
${findings || '<p class="mut">No security findings.</p>'}
<h2>3. SEO and GEO</h2><table><tr><th>ID</th><th>Check</th><th>Status</th><th>Evidence</th><th>Why it matters</th></tr>${seo}</table>
<h2>Fix prompt</h2><p class="mut">Paste this into an AI coding assistant that has access to the site code, or hand it to a developer. It covers every failed and partial check above.</p><pre class="prompt">${esc(prompt)}</pre>
<h2>What the site loads</h2><ul>
 <li><b>Trackers:</b> ${esc((inv.trackers || []).map((t) => t.name + (t.gated ? ' (gated)' : '')).join(', ') || 'none detected')}</li>
 <li><b>Consent manager:</b> ${esc((inv.consentManagers || []).join(', ') || 'none detected')}</li>
 <li><b>Embeds:</b> ${esc((inv.embeds || []).map((e) => e.name).join(', ') || 'none')}${inv.googleFonts ? ' · Google Fonts' : ''}</li>
 <li><b>Form processors:</b> ${esc((inv.formProcessors || []).join(', ') || 'none detected')}</li>
</ul>
<h2>Limitations</h2><ul>${[...r.limitations, ...r.notRun].map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
<p class="mut">Not legal advice. Scores are heuristics to track progress, not a certification. Monthly monitoring: <a href="${esc(r.links.monitoring)}" style="color:inherit">${esc(r.links.monitoring)}</a></p>
</div></body></html>`;
}
