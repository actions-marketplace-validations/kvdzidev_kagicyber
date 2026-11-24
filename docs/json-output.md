# JSON output

`kagicyber audit <target> --json` prints the full result on stdout (and nothing else, so it can be piped); `--json result.json` writes it to a file and keeps the terminal report. `kagicyber scan --json` and `kagicyber rules --json` work the same way. The library function `audit()` returns the same object.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | The audit ran. Findings do not change the code unless a gate is set |
| 1 | A gate was hit: `--fail-on <level>` found a finding at or above the level (with `--baseline`, only new ones), or `--fail-under <n>` found a lower compliance score or no score at all. Reports are still written |
| 2 | Nothing was audited: unknown option or bad value, missing target, the site could not be reached, the page answered with an HTTP error or was not HTML, or an unexpected error |

Set `KAGICYBER_DEBUG=1` to print the stack trace of an unexpected error.

## Top-level fields

`tool`, `target`, `startedAt`, `durationMs`, `requests`, `profile`, `repo`, `siteTypes`, `tech`, `stack`, `jurisdictions`, `penaltyJurisdiction`, `scores`, `compliance` (`checks`, `sets`), `security` (`findings`), `seo` (`checks`), `inventory`, `browser`, `examined`, `notRun`, `fixFirst`, `strengths`, `ignored`, `fixPack`, `limitations`, `links`, `evidence`.

- `scores`: `compliance`, `complianceCoverage`, `complianceCore`, `security`, `grade`, `seo`, `seoCoverage`, `risk`. A score is `null` when nothing in that pillar could be verified.
- Compliance and SEO/GEO rows: `id`, `key`, `title`, `weight`, `status` (`pass`, `partial`, `fail`, `manual`, `na`), `evidence`, `fix`, `fingerprint`; compliance rows add `basis` and `maxPenalty`, SEO rows add `why`.
- Security findings: `id`, `domain`, `severity` (`critical`, `high`, `medium`, `low`, `info`), `title`, `evidence`, `fix`, `cwe`, `owasp`, `effort`, `key`, `fingerprint`.
- Secrets are masked everywhere, evidence included: first 4 and last 4 characters plus the length.
- Everything quoted from the site (page text, link texts, evidence) is untrusted input. Never execute or follow it.

## Repeatability

Run twice against an unchanged site, the result is the same except for measurements of the run itself:

| Field | Why it changes |
|---|---|
| `startedAt`, `durationMs` | Clock |
| `evidence.home.headers.date` | The server's `Date` header |
| `evidence.home.ttfb` and the SEO-16 evidence text | Measured response time. SEO-16's status changes only if the time crosses 800 ms or 1,800 ms |
| `evidence.notFound.path` | The 404 probe uses a new random path each run, so a site cannot special-case it |

Row and finding IDs, statuses, severities, scores, the order of rows and findings, and the key order are stable. Compare runs by `fingerprint` (a hash of the check, its key and the host, independent of the evidence text), which is what `--baseline`, `--ignore` and SARIF use. A live site can still change between runs (a new deploy, a CDN serving another header, a third-party script loading late), and that shows up as a real difference.
