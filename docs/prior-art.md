# Prior art and acknowledgements

KagiCyber was shaped by studying four open-source security projects. We took ideas, not code: our implementation is written from scratch, and token formats come from the vendors' public documentation.

| Project | Licence | What we learned | Where it shows up |
|---|---|---|---|
| [Semgrep](https://github.com/semgrep/semgrep) | LGPL-2.1 | Output formats that plug into developer tools (SARIF, JUnit), inline `nosemgrep` suppression, stable match fingerprints, diff-aware scans against a baseline, a findings exit code | `--sarif`, `--junit`, `kagicyber-ignore` comments, `.kagicyberignore`, `fingerprint` on every finding, `--baseline`, `--fail-on` counting only new findings |
| [Nuclei](https://github.com/projectdiscovery/nuclei) | MIT | Detect the technology first and run the checks that matter for it; data-driven signatures; SARIF severity mapping for code scanning | `src/tech.js` fingerprints (57 signatures) that steer later checks; `security-severity` values in SARIF |
| [TruffleHog](https://github.com/trufflesecurity/trufflehog) | AGPL-3.0 | Run a cheap keyword prefilter before each detector's regular expression; cover hundreds of token formats; drop low-entropy and placeholder matches | Keyword prefilter and entropy filter in `src/checks/secrets.js`; 65 formats written from vendor documentation |
| [ARTEX](https://github.com/BaaRai/ARTEX) | AGPL-3.0 | Named rate profiles with per-host concurrency, pacing and jitter; back off on 429 and 503 with Retry-After; merge identical requests; bind every finding to its evidence and print honest gaps | `--profile quiet\|balanced\|fast`, request coalescing and backoff in `src/http.js`; evidence and "Not run" lines in every report |

No code from AGPL or LGPL projects is included in this MIT-licensed repository.
