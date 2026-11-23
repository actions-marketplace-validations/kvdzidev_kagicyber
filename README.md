<div align="center">

# KagiCyber

**Open-source website audit for compliance, security and SEO/GEO.**
One command checks a live site against EU law and 58 national and regional rule sets, finds leaked API keys and other secrets, and tells you how well search engines and AI assistants can read it. The checks are passive: they read what a normal visit loads, plus a short, documented list of public files. Compliance rows show the maximum penalty recorded for the detected country.

[![npm](https://img.shields.io/npm/v/kagicyber?color=cb3837)](https://www.npmjs.com/package/kagicyber)
[![CI](https://github.com/kvdzidev/kagicyber/actions/workflows/ci.yml/badge.svg)](https://github.com/kvdzidev/kagicyber/actions)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
![Node](https://img.shields.io/badge/node-%3E%3D20-339933)
![Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

```bash
npx kagicyber audit your-site.com
```

[Install](#install) · [What it checks](#what-it-checks) · [Report](#the-report) · [Options](#options) · [CI and GitHub](#ci-and-github) · [Claude](#use-it-with-claude) · [Responsible use](#responsible-use)

</div>

> **Not legal advice.** KagiCyber produces automated indicators from public evidence. A PASS means the signal it looks for was found, not that a site is lawful. Maximum penalties are statutory ceilings, not predictions, and rows marked "(verify)" still need confirmation in a primary source. Confirm anything material with a lawyer.

---

## Why KagiCyber

Most websites break the law and leak data in ordinary, fixable ways: an analytics tag that fires before the cookie banner, an API key inside a JavaScript bundle, a privacy policy that never names its form provider, a German shop without an Impressum, a single-page app that shows AI crawlers an empty page. Each of these lives in a different tool today. KagiCyber puts them in one report, ranks them, and shows what each one could cost.

- **Three pillars, three scores.** Compliance, Security and SEO/GEO, each scored 0 to 100, with a coverage figure that shows how much could actually be verified.
- **A rule base you can read.** A 14-check EU baseline, a 30-rule EU checklist, 58 jurisdiction modules (45 with country-specific rules, from Poland and Germany to California, Brazil and Japan) and checklists for online shops, SaaS platforms and fintech: 274 rule definitions on top of the baseline. Rules that restate a baseline check are folded into it.
- **Penalties next to the findings.** Compliance rows show the statutory maximum recorded for the detected country (for example UODO, UKE, TDDDG, CNIL, LSSI-CE, UK GDPR, CCPA). Where no amount is recorded, the row says "set by national law (verify)".
- **Leaked API keys first.** 65 secret formats in HTML, first-party JavaScript and source maps, plus passive security hygiene (TLS, headers, cookies, DNS) and an optional scan of your own repository.
- **Passive.** No logins, no form submissions, no attack payloads, no wordlists or brute force (see [Responsible use](#responsible-use) for the exact request list).
- **Honest about gaps.** A check that could not run (a timeout, the request budget, a page rendered by JavaScript without `--browser`) is reported as MANUAL or "not run", never as PASS.
- **Fast and polite.** Requests run in parallel within per-host limits and a hard request budget. A typical site takes a few seconds.
- **Zero dependencies.** Plain Node.js 20+. Playwright is optional, for the real-browser test.
- **No telemetry.** Apart from the audited site and DNS, the CLI only contacts dns.google (DNSSEC check; skip it with `--no-dns`) and crt.sh (only with `--subdomains`). Secrets are always masked (`AKIA…MPLQ (len 20)`).
- **Built for CI.** SARIF for GitHub code scanning, JUnit XML, JSON, HTML, baselines, ignore rules and exit codes.

## Install

Requires Node.js 20 or newer (Node.js 22 LTS recommended).

```bash
# From npm
npx kagicyber audit example.com

# From a tagged GitHub release, without the npm registry
npx github:kvdzidev/kagicyber#v1.0.0 audit example.com

# From a clone
git clone https://github.com/kvdzidev/kagicyber.git && cd kagicyber
node bin/kagicyber.js audit example.com
```

The npm package is published together with the v1.0.0 GitHub release. If `npx kagicyber` reports `E404`, use the GitHub line.

## Quick start

```bash
# Audit a live site (passive)
npx kagicyber audit example.com

# Add the real-browser test: cookies set by JavaScript, banner buttons,
# client-rendered legal pages and Core Web Vitals
npm i -g playwright && npx playwright install chromium
npx kagicyber audit example.com --browser

# Save the reports (the terminal report is still printed)
npx kagicyber audit example.com --md report.md --html report.html --json report.json

# Write the fix prompt for an AI coding assistant
npx kagicyber audit example.com --prompt fix-prompt.md

# Your own site: add its repository
npx kagicyber audit my-site.com --repo ./my-site

# Scan a project before you push
npx kagicyber scan .
```

Only audit sites you own or are authorised to test.

## What it checks

### 1. Compliance (with maximum penalties)

**EU baseline (14 checks, every EU-facing site):**

| ID | Check |
|---|---|
| C-01 | Operator identity: geographic address, registration or VAT number, e-mail (the legal form is checked by EU-A1a) |
| C-02 | Privacy policy linked from the homepage |
| C-03 | Privacy policy loads and is readable (HTTP status, broken encoding, client-side rendering) |
| C-04 | Privacy policy covers the core GDPR art. 13 information in 8 languages and names the form processors the site actually uses |
| C-05 | Forms explain how data is used, including forms rendered by JavaScript |
| C-06 | Cookie consent with a reject option on the first layer (19 consent platforms plus custom banners; the reject button is verified with `--browser`) |
| C-07 | No trackers load before consent (34 tracker hosts, in the markup or injected by JavaScript) |
| C-08 | No tracking cookies before consent (27 cookie patterns; cookies set by JavaScript need `--browser`) |
| C-09 | Cookie information is available and accurate |
| C-10 | Third-party embeds and Google Fonts wait for consent |
| C-11 | Terms of service published |
| C-12 | Reviews and testimonials are genuine and their verification is stated |
| C-13 | AI chatbots disclose that they are AI (AI Act art. 50) |
| C-14 | Accessibility basics |

**EU extended checklist (30 rules, 16 of them folded into baseline rows):** legal form, international transfers and safeguards, DPO and automated decisions, privacy notice in the site language, a persistent way to withdraw cookie consent, Google Consent Mode used as a substitute for consent, marketing consent, ranking and affiliate disclosures, an EU representative for non-EU operators, an accessibility statement and a security contact.

**Jurisdiction modules (58):** chosen automatically from language, domain, currency, phone prefixes and company identifiers, or with `--include DE,FR,US`. 45 modules carry country-specific rules; 13 smaller EU member states (SE, DK, FI, BG, GR, HR, SI, LT, LV, EE, LU, MT, CY) currently carry the generic language and consent rules only.

| Region | Jurisdictions |
|---|---|
| EU member states | Poland, Germany, Austria, France, Italy, Spain, Netherlands, Belgium, Ireland, Portugal, Czechia, Slovakia, Romania, Hungary, Sweden, Denmark, Finland, Bulgaria, Greece, Croatia, Slovenia, Lithuania, Latvia, Estonia, Luxembourg, Malta, Cyprus |
| Rest of Europe | United Kingdom, Switzerland, Turkey |
| Americas | United States (federal), California, other US state privacy laws, Canada, Mexico, Brazil, Argentina, Peru, Colombia, Chile |
| Asia and Pacific | Japan, South Korea, China, Vietnam, Philippines, Singapore, Indonesia, India, Australia, New Zealand |
| Middle East and Africa | Saudi Arabia, United Arab Emirates, Egypt, Israel, Nigeria, South Africa, Kenya, Morocco |

Examples: the Polish rules check the terms for electronic services (UŚUDE art. 8), KRS, NIP and share capital, and Polish-language consumer information; the German rules check the Impressum (DDG § 5), the "zahlungspflichtig bestellen" button and the cancellation button; the Californian rules check CalOPPA, "Do Not Sell or Share" and Global Privacy Control. `kagicyber rules` lists every module.

**Site-type checklists:** online shops (14 rules: withdrawal right and online withdrawal function, model form, Omnibus lowest-price rule, order button, GPSR product data, delivery costs, guarantees, subscriptions), SaaS and platforms (6 rules: DSA contact points, notice and action, account deletion, minimum age, data export) and fintech (10 rules: licence and register, credit advertising, CFD warnings, MiCA, complaints and ADR). Detected automatically or forced with `--type shop`.

Every row carries its legal basis and a maximum penalty. Many checks are keyword and structure indicators: they find whether a required element appears, not whether its wording is legally sufficient. See [docs/checks.md](docs/checks.md), [docs/penalties.md](docs/penalties.md) and [docs/rules.md](docs/rules.md).

### 2. Security (passive)

| Area | Examples |
|---|---|
| T Transport and TLS | HTTPS, HTTP to HTTPS redirect, HSTS, certificate validity and expiry, TLS 1.0/1.1, mixed content |
| H Browser hardening | Content-Security-Policy and its quality, X-Content-Type-Options, clickjacking, Referrer-Policy, Permissions-Policy |
| K Cookies and sessions | Secure, HttpOnly and SameSite flags, tokens in URLs, tokens in localStorage |
| X Code and secret exposure | 65 secret formats (AWS, Azure, GCP, GitHub, GitLab, npm, Stripe, OpenAI, Anthropic, Hugging Face, Slack, Supabase and more), source maps, staging URLs, stack traces |
| D Components | Version disclosure, end-of-life libraries, compromised CDNs such as polyfill.io, missing Subresource Integrity |
| A Attack surface | robots.txt leaks, security.txt, soft 404; with `--subdomains`, certificate-transparency subdomains and dangling CNAMEs (takeover) |
| M E-mail and DNS | SPF, DMARC, CAA, DKIM, MTA-STS, TLS-RPT, DNSSEC |
| F Forms and abuse | Forms without CAPTCHA or honeypot, disabled spam protection |
| R Repository, CI/CD and infrastructure | With `scan` or `--repo`: secrets in git history, dependency hygiene, code patterns (XSS, SQL injection, SSRF, path traversal, weak hashing), GitHub Actions, Dockerfiles, compose, Terraform and Kubernetes |

Secret detection uses a keyword prefilter before any regular expression runs, so large bundles stay fast, plus an entropy filter for generic matches. Code-pattern findings from `scan` are candidates: confirm that user input reaches them before treating them as vulnerabilities.

### 3. SEO and GEO (28 checks)

**SEO (22):** title and meta description length, single H1 and heading order, image alt text, canonical URL, indexability, lang and hreflang, Open Graph and Twitter cards, viewport, doctype, charset and favicon, schema.org JSON-LD validity, robots.txt, XML sitemap, real 404 status, one canonical host, broken internal links, server response time, compression, page weight, render-blocking scripts, asset caching, image dimensions and formats, and Largest Contentful Paint with `--browser`.

**GEO (6)** (generative engine optimisation, how AI assistants and AI search read your site): access for AI crawlers in robots.txt (OAI-SearchBot, ChatGPT-User, Claude-SearchBot, PerplexityBot, GPTBot, ClaudeBot, Google-Extended and others), content readable without JavaScript, llms.txt, Organization entity data with `sameAs` profiles, FAQ markup and `noai` directives.

### Technology detection

Before the checks run, KagiCyber fingerprints the stack (56 signatures plus client-side rendering detection: CMS, framework, build tool, web server, hosting, CDN, form backend, chat widget) and uses it: a client-rendered site gets its legal pages rendered in the browser, a chat widget triggers the AI disclosure check, and the snippets in the fix prompt are written for your server or framework.

## The report

The Markdown (`--md`) and HTML (`--html`) reports share one layout:

- **Overview:** target, scope, site type and stack, what was examined, tooling, rule sets, what was not run, jurisdictions, the not-legal-advice note and the three scores
1. **Compliance:** the EU baseline, then the EU extended checklist, each detected jurisdiction and each site type; every row shows ID, requirement, status, evidence, legal basis and maximum penalty
2. **Security:** ID, severity, finding, masked evidence, CWE and OWASP category, effort
3. **SEO and GEO:** ID, check, status, evidence, why it matters
4. **Priorities:** the ten most important items across all three pillars
5. **Fix prompt:** one prompt that covers every failed and partial check, ready to paste into an AI coding assistant or to hand to a developer (see below)
6. **Limitations**

Statuses are `PASS`, `PARTIAL`, `FAIL`, `MANUAL` and `N/A`. `MANUAL` means the check needs a person or could not be verified automatically (for example a request failed or the reject button needs `--browser`); MANUAL rows are left out of the score and lower the coverage figure. Severities are `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` and `INFO`. The report is plain text with no emoji, so it pastes cleanly into tickets, e-mails and PDFs, and the HTML report is a single file with no scripts or external requests. A full example is in [docs/sample-report.md](docs/sample-report.md).

### The fix prompt

Instead of a fix next to every row, each report ends with a single prompt. It gives the assistant the context (URL, stack, site language, jurisdictions, scores), working rules (keep features, write user-facing text in the site language, never invent company data or legal wording, never paste secrets), then every task in priority order with its evidence, the change to make, the legal basis and the maximum penalty. It ends with the items that need a person, reference snippets for the detected stack (security headers for nginx, Apache, Next.js, Netlify or CloudFront, consent gating, a privacy notice for forms, DNS records, security.txt) and a definition of done that includes re-running the audit against a baseline.

```bash
npx kagicyber audit example.com --prompt fix-prompt.md     # the prompt alone
npx kagicyber scan . --prompt fix-prompt.md                # the same for a repository scan
```

Evidence quoted in the prompt comes from the audited site. Review the prompt before you hand it to an agent that can change code.

Terminal output (the bundled test site, trimmed):

```
  KagiCyber audit  example-studio.pl
  KagiCyber 1.0.0 | 2026-11-22 | balanced profile | 12 requests | 1.1 s

  Jurisdictions  Poland (high), EU
  Site type      company  (WordPress 6.1.1, jQuery, PHP 7.4.3, nginx 1.18.0)

  1. Compliance  49/100   ##########..........  coverage 100%
  2. Security    33/100   #######.............  grade F
  3. SEO/GEO     65/100   #############.......  coverage 100%

  1. Compliance
   EU baseline 43/100
   PASS     C-01    Operator identity: geographic address, registration/VAT number, e-mail
   PASS     C-02    Privacy policy linked from the homepage
   FAIL     C-03    Privacy policy loads and is readable
            Broken character encoding (8 garbled sequences such as "Ĺ›").
            Max penalty: UODO (GDPR art. 83(5)): up to EUR 20M or 4% of worldwide annual turnover
   ...
   FAIL     C-07    No trackers load before consent
            Loaded directly with no consent banner: Google Tag Manager / gtag.js, Google Analytics, Meta Pixel.
            Max penalty: UKE under the Electronic Communications Law (art. 399 PKE): up to 3% of the previous year's revenue (verify)
   ...
```

Other formats: `--json` (everything, including evidence), `--sarif` (SARIF 2.1.0), `--junit` (JUnit XML) and `--badge` (a shields.io badge for your README).

## Options

| Option | What it does |
|---|---|
| `--browser` | Real-browser test with Playwright: cookies and requests before any click, banner buttons, rendered legal pages, LCP and CLS |
| `--profile quiet\|balanced\|fast` | Request pacing (see below) |
| `--country PL` | Jurisdiction used for maximum penalties (default: detected) |
| `--include DE,FR` | Also apply these jurisdiction modules |
| `--type shop,saas,fintech` | Add site-type checklists (default: detected) |
| `--subdomains` | Certificate-transparency subdomains (sends the domain to crt.sh) and takeover check |
| `--repo <dir>` | Scan the site's repository too and merge the findings |
| `--no-dns` | Skip the deep DNS checks (DKIM, MTA-STS, TLS-RPT, DNSSEC via dns.google) |
| `--allow-private` | When the target is public, its redirects, links and sitemap may not reach loopback or private addresses; this flag lifts that guard. Local targets (`localhost`, your staging IP) always work |
| `--md`, `--html`, `--sarif`, `--junit` `<file>` | Report files |
| `--json [file.json]` | JSON to stdout (replaces the terminal report) or to a file ending in `.json` |
| `--prompt <file>` | The fix prompt alone |
| `--out <dir>` | Markdown, HTML, JSON, SARIF and the fix prompt in one directory |
| `--baseline old.json` | Compare with an earlier run: new and fixed findings, score changes |
| `--ignore C-14,SEO-21` | Ignore check IDs or fingerprints (also read from `.kagicyberignore`) |
| `--fail-on high` | Exit code 1 when a security finding reaches this severity: `critical`, `high`, `medium` or `low` (with a baseline: only new findings) |
| `--fail-under 70` | Exit code 1 when the compliance score is below the number, or when no compliance score could be computed |
| `--max-requests <n>`, `--timeout <ms>` | Request budget and per-request timeout |
| `--verbose`, `--quiet`, `--no-color` | Output |

Unknown options and invalid values are rejected with exit code 2.

Other commands: `kagicyber scan [dir]` (repository scan; `--quick` for the working tree only), `kagicyber rules` (list the rule base) and `kagicyber serve` (self-hosted HTTP API, see [docs/api.md](docs/api.md)).

### Exit codes

| Code | Meaning |
|---|---|
| `0` | The audit or scan finished and no threshold was hit |
| `1` | A `--fail-on` or `--fail-under` threshold was hit (the reports are still written) |
| `2` | Invalid arguments, or the site could not be audited (unreachable, an HTTP error page, or not an HTML page) |

### Speed and politeness

| Profile | In flight per host | Requests per second | Request budget | Use it for |
|---|---|---|---|---|
| `quiet` | 1 | 2 | 90 | Fragile or rate-limited servers |
| `balanced` (default) | 6 | 12 | 100 | Most sites |
| `fast` | 10 | 25 | 120 | Your own sites and CDNs |

Identical requests are merged, a 429 or 503 with a short Retry-After (up to 8 s) pauses the host and is retried once, and every audit has a hard request budget. On the local test site with 34 requests and 150 ms of added latency, an audit takes about 3.5 s with the balanced profile and 2.3 s with the fast profile, against about 6 s for the same requests made one after another.

## CI and GitHub

```yaml
# .github/workflows/kagicyber.yml
name: KagiCyber
on: [push]
permissions:
  contents: read
  security-events: write
jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: kvdzidev/kagicyber@v1
        with:
          url: https://staging.example.com
          fail-on: high
          sarif: true
```

The action runs the code of the tagged release (no npm download), writes the Markdown report to the job summary, saves the HTML, JSON and fix-prompt files in the workspace (upload them with `actions/upload-artifact` if you want to keep them) and, with `sarif: true`, uploads the findings to GitHub code scanning. A monthly workflow with a baseline is in [examples/monthly-audit.yml](examples/monthly-audit.yml). For repositories, `npx kagicyber scan . --sarif kagicyber.sarif --fail-on high` points every finding at its file and line.

### Ignoring findings

- On the command line: `--ignore C-14,SEO-21`
- In a `.kagicyberignore` file: one check ID or fingerprint per line, `path:dist/**` to skip paths in `scan` (see [examples/kagicyberignore](examples/kagicyberignore))
- In code: a `kagicyber-ignore` comment on the same line hides a secret or code-pattern finding on that line from `scan`

Every finding in the JSON output has a stable `fingerprint`, used for baselines, ignores and SARIF.

## Use it with Claude

KagiCyber ships as a Claude Code plugin with the `/kagicyber-audit` skill:

```
/plugin marketplace add kvdzidev/kagicyber
/plugin install kagicyber@kagicyber
```

Then ask: `/kagicyber-audit check example.com`. In Claude Code the skill runs the CLI that ships inside the plugin (Node.js 20+ needed, nothing is downloaded) and writes the report and fix prompt in the layout above. Without a shell it collects the evidence through the browser in a single step and applies the same rule base; checks it cannot run are listed as "not run". For claude.ai, zip the `skills/kagicyber-audit` folder and upload it as a custom skill. Details: [docs/claude.md](docs/claude.md).

## Use it as a library

```js
import { audit, renderMarkdown, renderFixPrompt } from 'kagicyber';

const result = await audit('example.com', { browser: false, profile: 'balanced' });
console.log(result.scores);
// For the bundled test site:
// { compliance: 49, complianceCoverage: 100, complianceCore: 43, security: 33, grade: 'F', seo: 65, seoCoverage: 100, risk: 'critical' }
console.log(result.compliance.sets.map((s) => `${s.name}: ${s.score}`));

const report = renderMarkdown(result);
const prompt = renderFixPrompt(result);
```

More in [examples/](examples) (Markdown, HTML, JSON, SARIF and the fix prompt from a script, a monthly GitHub workflow with a baseline, an ignore file). The self-hosted HTTP API is described in [docs/api.md](docs/api.md); the library exports are listed in [src/index.js](src/index.js).

## Monthly monitoring

Everything above is in this repository and free to use. A hosted service that re-audits your sites every month and reports what changed is planned at [kagicyber.com](https://kagicyber.com). Until then, the [monthly workflow example](examples/monthly-audit.yml) does the same in GitHub Actions.

## Responsible use

Only audit sites you own or are authorised to test. The audit requests:

- the page you name, the legal and contact pages it links to, its first-party JavaScript and the source maps those scripts reference;
- robots.txt, the sitemap, `/.well-known/security.txt` and `/llms.txt`;
- one random path (to check that missing pages return 404), the `http://` version of the homepage (HTTPS redirect) and the `www` or non-`www` twin;
- when the homepage links no privacy policy, up to four common privacy-policy paths such as `/privacy`;
- up to 8 internal links (broken-link check);
- two TLS handshakes (certificate details, and whether TLS 1.0/1.1 is still accepted) and public DNS records, including common DKIM selectors.

It never logs in, submits forms, runs wordlists, sends attack payloads or uses a credential it finds. See [docs/responsible-use.md](docs/responsible-use.md).

## Acknowledgements

KagiCyber borrows ideas, not code, from projects we admire: [Semgrep](https://github.com/semgrep/semgrep) (SARIF and JUnit output, inline ignore comments, stable fingerprints, baselines), [Nuclei](https://github.com/projectdiscovery/nuclei) (technology fingerprinting before targeted checks, SARIF severity mapping), [TruffleHog](https://github.com/trufflesecurity/trufflehog) (keyword prefiltering and the breadth of token formats) and [ARTEX](https://github.com/BaaRai/ARTEX) (per-host rate profiles with backoff, findings bound to evidence). Details and licences: [docs/prior-art.md](docs/prior-art.md).

## Development

```bash
git clone https://github.com/kvdzidev/kagicyber.git && cd kagicyber
npm ci               # dev tools only (ESLint); the CLI itself has no dependencies
npm test             # rebuilds the skill collector, then runs the test suite against local fixtures
npm run lint
node bin/kagicyber.js audit example.com
```

| Path | What lives there |
|---|---|
| `bin/` | CLI entry point |
| `src/` | Audit engine: `checks/` (compliance baseline, security, secrets, DNS, SEO/GEO), `law/` (EU, European and world rule sets, rule engine, penalty areas), `report/` (terminal, Markdown, HTML, SARIF, JUnit, fix prompt), `knowledge.js` (trackers, consent platforms), `tech.js` (technology fingerprints), `netguard.js` (public-address guard for the API) |
| `data/` | `penalties.json`: maximum penalties by jurisdiction and area |
| `skills/kagicyber-audit/` | Claude skill; `collector.js` and `rules.md` are generated by `npm run build:collector` |
| `test/` | Node test runner suites with a local fixture server (no network needed) |
| `docs/` | Checks, scoring, penalties, rules, API, Claude, responsible use, sample reports |

The browser tests run when Playwright and a browser are available and are skipped otherwise: `npm i --no-save playwright-core`, then set `KAGICYBER_CHROME_PATH` to a Chrome or Chromium binary.

## Contributing

False positive? A law that changed, a new country module, tracker, consent platform, secret format or SEO check? Pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
