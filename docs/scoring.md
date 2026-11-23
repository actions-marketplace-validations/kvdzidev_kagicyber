# Scoring

The three scores track progress over time. They are heuristics, not a certification.

## 1. Compliance and 3. SEO/GEO (0 to 100)

Each applicable check has a weight (3 critical, 2 important, 1 nice to have) and earns points: PASS 1, PARTIAL 0.5, FAIL 0. MANUAL and N/A checks are left out, and so are ignored checks.

`score = round(100 x sum(weight x points) / sum(weight))`

**Coverage** is the share of applicable checks that could be verified automatically. Read a score together with its coverage. When nothing in a pillar or rule set applies, the score is shown as "-" and the coverage as "n/a".

A check is MANUAL, never PASS, when its input is missing: a request that timed out or was cut by the request budget, a script that could not be downloaded, a page rendered by JavaScript without `--browser`, or a consent platform whose reject button was not seen in a real browser. The limitations section of the report lists these.

The compliance score covers every applicable row: the 14 EU baseline checks plus the EU extended checklist, the national modules and the site-type checklists. `scores.complianceCore` is the baseline alone, and every rule set in `compliance.sets` has its own score and coverage. Rules that restate a baseline check are folded into it. Some related rules still overlap (for example the privacy notice language is checked by the EU checklist and by several national modules), so one problem can lower more than one row.

## 2. Security (0 to 100) and grade

Start at 100 and subtract per finding: CRITICAL 35, HIGH 15, MEDIUM 6, LOW 2, INFO 0 (minimum 0).

| Grade | Score |
|---|---|
| A | 90 or more |
| B | 80 or more |
| C | 65 or more |
| D | 50 or more |
| F | below 50 |

Any CRITICAL finding caps the grade at D.

## Overall risk (JSON only)

The worse of compliance and security: critical (a CRITICAL finding, grade F or compliance below 50), high (grade D or compliance below 70), moderate (grade C, compliance below 85, or no compliance score at all), otherwise low.

## Priorities

Ranked across pillars: CRITICAL and HIGH security findings first, then weight-3 compliance failures, SEO failures on weight-3 checks, MEDIUM security findings, and partial results, up to 10 items.
