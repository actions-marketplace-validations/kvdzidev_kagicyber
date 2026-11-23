import { DOMAINS } from './checks/security.js';
import { sevRank } from './util.js';

export const PENALTY = { critical: 35, high: 15, medium: 6, low: 2, info: 0 };

export function securityScore(findings) {
  let score = 100;
  for (const f of findings) score -= PENALTY[f.severity] ?? 0;
  score = Math.max(0, score);
  let grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 65 ? 'C' : score >= 50 ? 'D' : 'F';
  if (findings.some((f) => f.severity === 'critical') && 'ABC'.includes(grade)) grade = 'D';
  return { score, grade };
}

export function domainTiles(findings, tested = Object.keys(DOMAINS)) {
  const tiles = {};
  for (const [code, name] of Object.entries(DOMAINS)) {
    const fs = findings.filter((f) => f.domain === code);
    const worst = fs.reduce((w, f) => (sevRank(f.severity) < sevRank(w) ? f.severity : w), 'none');
    const status = !tested.includes(code) ? 'untested' : worst === 'critical' ? 'red' : worst === 'high' ? 'orange' : worst === 'medium' ? 'yellow' : 'green';
    tiles[code] = { name, count: fs.length, worst, status };
  }
  return tiles;
}

const POINTS = { pass: 1, partial: 0.5, fail: 0 };

export function complianceScore(checks) {
  const applicable = checks.filter((c) => c.status !== 'na');
  const verified = applicable.filter((c) => c.status !== 'manual');
  const totalW = verified.reduce((s, c) => s + c.weight, 0);
  const got = verified.reduce((s, c) => s + c.weight * POINTS[c.status], 0);
  return {
    score: totalW ? Math.round((100 * got) / totalW) : null,
    // Nothing applicable means nothing was verified: coverage is unknown, not 100%.
    coverage: applicable.length ? Math.round((100 * verified.length) / applicable.length) : null,
  };
}

/** Coverage for display: "91%" or "n/a". */
export const pct = (n) => (n == null ? 'n/a' : `${n}%`);

export function overallRisk(compliance, security, findings) {
  if (findings.some((f) => f.severity === 'critical') || security.grade === 'F' || (compliance.score ?? 100) < 50) return 'critical';
  if (security.grade === 'D' || (compliance.score ?? 100) < 70) return 'high';
  // An unscored compliance pillar is unknown, never evidence of low risk.
  if (security.grade === 'C' || compliance.score == null || compliance.score < 85) return 'moderate';
  return 'low';
}

export function scoreColor(n) {
  return n == null ? 'grey' : n >= 85 ? 'green' : n >= 70 ? 'yellow' : n >= 50 ? 'orange' : 'red';
}
