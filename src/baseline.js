import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';

/** Stable identifier of a finding across runs (used for baselines, ignores and SARIF). */
export function fingerprint(kind, key, host) {
  return createHash('sha256').update(`${kind}|${key}|${host}`).digest('hex').slice(0, 16);
}

/**
 * Read ignore entries from .kagicyberignore (one per line, # comments).
 * Entries: check IDs (C-08, SEO-12, GEO-03), fingerprints (16 hex), or `path:<glob>` for `scan`.
 */
export function readIgnoreFile(file = '.kagicyberignore') {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.replace(/#.*/, '').trim())
    .filter(Boolean);
}

export function applyIgnores({ checks = [], seo = [], findings = [] }, entries = []) {
  const set = new Set(entries.map((e) => e.trim()).filter(Boolean));
  const ignored = [];
  const mark = (item) => {
    if (set.has(item.id) || set.has(item.fingerprint) || (item.key && set.has(item.key))) {
      item.ignored = true;
      ignored.push({ id: item.id, title: item.title, fingerprint: item.fingerprint });
    }
  };
  [...checks, ...seo, ...findings].forEach(mark);
  return ignored;
}

const BAD = new Set(['fail', 'partial']);

/** Compare with a previous JSON result: what is new, what was fixed, score deltas. */
export function compareBaseline(prev, cur) {
  const prevBad = new Map();
  for (const c of [...(prev.compliance?.checks || []), ...(prev.compliance?.sets || []).flatMap((s) => s.results), ...(prev.seo?.checks || [])]) if (BAD.has(c.status) && c.fingerprint) prevBad.set(c.fingerprint, c);
  for (const f of prev.security?.findings || []) if (f.fingerprint && f.severity !== 'info') prevBad.set(f.fingerprint, f);
  const curBad = new Map();
  for (const c of [...cur.compliance.checks, ...(cur.compliance.sets || []).flatMap((s) => s.results), ...cur.seo.checks]) if (BAD.has(c.status) && !c.ignored) curBad.set(c.fingerprint, c);
  for (const f of cur.security.findings) if (f.severity !== 'info' && !f.ignored) curBad.set(f.fingerprint, f);
  const isNew = [];
  for (const [fp, item] of curBad) {
    item.baseline = prevBad.has(fp) ? 'existing' : 'new';
    if (!prevBad.has(fp)) isNew.push({ id: item.id, title: item.title });
  }
  const fixed = [...prevBad].filter(([fp]) => !curBad.has(fp)).map(([, i]) => ({ id: i.id, title: i.title }));
  const d = (k) => (prev.scores?.[k] == null || cur.scores[k] == null ? null : cur.scores[k] - prev.scores[k]);
  return {
    previous: prev.startedAt || null,
    scores: { compliance: [prev.scores?.compliance ?? null, cur.scores.compliance], security: [prev.scores?.security ?? null, cur.scores.security], seo: [prev.scores?.seo ?? null, cur.scores.seo] },
    delta: { compliance: d('compliance'), security: d('security'), seo: d('seo') },
    new: isNew,
    fixed,
  };
}
