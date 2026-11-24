# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/). Legal rule updates also bump the rules version shown in every report (`RULES_VERSION` in `src/version.js`).

## [1.0.0] - 2026-11-25

First public release.

### Compliance
- A 14-check EU baseline (C-01 to C-14) plus 274 rule definitions: a 30-rule EU extended checklist, 58 jurisdiction modules and checklists for online shops (14), SaaS and platforms (6) and fintech (10).
- Jurisdictions detected from language, domain, currency, phone prefixes and company identifiers; `--include` adds more, `--type` forces a site-type checklist, `--country` sets the penalty jurisdiction.
- A maximum penalty on every row, from a national penalty table with area defaults as the fallback ("set by national law (verify)" where no amount is recorded).
- National rules that restate a baseline duty are folded into the baseline row.
- Checks whose input is missing (failed request, request budget, client rendering without `--browser`, a consent platform seen only in the code) are MANUAL, never PASS. An HTTP error page or a non-HTML response is not audited.
- Real-browser consent test with Playwright (`--browser`): requests and cookies before any click, banner buttons, client-rendered legal pages, LCP and CLS.

### Security (passive)
- 65 secret formats in HTML, first-party JavaScript and source maps, with a keyword prefilter and an entropy filter.
- TLS, HSTS and HTTPS redirects, browser hardening headers, cookie flags, components and CDNs, attack-surface signals, SPF, DMARC, CAA, DKIM, MTA-STS, TLS-RPT and DNSSEC.
- Optional certificate-transparency subdomain discovery (`--subdomains`).
- `kagicyber scan`: secrets in the working tree and git history, public environment variables, committed `.env` files, source-map settings, dependencies, code patterns, GitHub Actions, Dockerfiles, compose, Terraform and Kubernetes.

### SEO and GEO
- 22 SEO checks and 6 GEO checks, including AI crawler access, content readable without JavaScript, llms.txt and entity data.
- Technology fingerprinting (57 signatures) that steers the checks and the fix snippets.

### Reports and integrations
- Terminal, Markdown, HTML, JSON, SARIF 2.1.0 and JUnit XML output, plus a README badge.
- One fix prompt per report (`--prompt`) instead of a fix on every row.
- Stable fingerprints, baselines (`--baseline`), ignore rules (`--ignore`, `.kagicyberignore`, `kagicyber-ignore` comments) and CI exit codes (`--fail-on`, `--fail-under`).
- Request profiles `quiet`, `balanced` and `fast` with per-host limits, request merging and 429/503 backoff.
- GitHub Action with SARIF upload, self-hosted HTTP API (`kagicyber serve`) with a Docker image, rule catalog (`kagicyber rules`), library API.
- Claude Code plugin and the `/kagicyber-audit` skill, which runs the CLI bundled in the plugin, with a browser collector for sessions without a shell.

### Safety
- `kagicyber serve` only connects to public addresses (every request and redirect is checked), runs each audit in a worker thread with a time limit, and caps concurrent audits. The CLI applies the same guard automatically when the target is public (`--allow-private` to opt out).
- Secrets are masked in all outputs, including the JSON evidence; terminal output strips control characters.
- `scan` never runs programs from the scanned repository: npm is started without a shell and `npm audit` runs on copies of the manifest and lockfile; git runs with fsmonitor, textconv and signature display turned off; symlinks and junctions are not followed. `--no-repo-ignore` refuses the scanned project's own `.kagicyberignore`.
- Fix prompts mark site evidence as data, not instructions.
- HTML is scanned in linear time: unclosed or unterminated tags cannot stall an audit (a page of `<div id="root"` used to take minutes).
- Exit codes: 0 when the audit ran, 1 only when `--fail-on` or `--fail-under` is hit, 2 for every usage error (including no command) and for targets that cannot be audited. See [docs/json-output.md](docs/json-output.md).

### Distribution
- Installation guide for npx, a global install, the Claude Code project and personal skill and the plugin marketplace ([docs/install.md](docs/install.md)).
- The skill never invents findings, never calls a site secure or compliant, audits only the targets the user names and re-checks only after the user confirms a deploy.
- No telemetry. What the CLI sends to third parties during an audit, the public growth metrics (`npm run metrics`) and the rules for any future opt-in telemetry are in [docs/metrics.md](docs/metrics.md).
