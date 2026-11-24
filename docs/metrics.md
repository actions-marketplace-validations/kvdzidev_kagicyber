# Growth metrics and telemetry

KagiCyber audits other people's websites, so its own data collection has to be stricter than the rules it checks. This document says what the project measures today, where those numbers come from, and how optional CLI telemetry would work if it is ever added.

## What leaves your machine today

The CLI sends nothing to Kagicyber servers. There is no telemetry, update check or crash reporting.

An audit does contact services other than the target site. Each is part of a check and can be avoided:

| Service | What it receives | When | Turn it off |
|---|---|---|---|
| The audited site | Normal page requests, with the user agent `kagicyber/<version>; +https://kagicyber.com/bot` | Every audit | Do not audit |
| Your DNS resolver | The audited domain and its mail records | Every audit (DNS checks) | `--no-dns` skips the deep checks |
| `dns.google` | The audited domain (DNSSEC lookup over HTTPS) | Deep DNS checks | `--no-dns` |
| `crt.sh` | The audited domain (certificate-transparency search) | Only with `--subdomains` | Leave out `--subdomains` |
| `registry.npmjs.org` | A copy of the scanned project's `package.json` and lockfile (`npm audit`) | `kagicyber scan` without `--quick`, and `audit --repo` | `scan --quick`; leave out `--repo` |

Reports link to kagicyber.com and the README badge points at img.shields.io; neither is fetched by the CLI.

## Public growth metrics

Counted from public APIs, with no data about who ran an audit or what they audited. `npm run metrics` prints them (`--json` for machine-readable output); set `GITHUB_TOKEN` only to raise the GitHub rate limit.

| Metric | Source | Notes |
|---|---|---|
| Downloads per day, week, month and year | npm Downloads API: `api.npmjs.org/downloads/point/<period>/kagicyber` and `/downloads/range/last-month/kagicyber` | Includes CI and mirrors, so treat it as a trend, not a user count |
| Stars, forks, watchers | GitHub REST: `GET /repos/kvdzidev/kagicyber` | |
| Release cadence | GitHub REST: `GET /repos/kvdzidev/kagicyber/releases` | Time between releases and between a legal change and the rule update |
| Issues and pull requests, including false-positive and law-update reports | GitHub REST: issues and pulls | The issue templates label these, so they can be counted per label |
| Views, clones, referrers | GitHub REST: `/traffic/*` | Needs a token with push access; GitHub keeps only 14 days, so a scheduled job would have to store them |

To keep a history, run `node scripts/metrics.mjs --json` on a schedule (for example weekly in a GitHub Action) and store the output as an artifact or commit it to a separate branch. The script needs no secrets for the public numbers.

## Optional CLI telemetry (proposal, not implemented)

Download counts cannot say which Node versions, commands or report formats people use, or how often audits fail. Telemetry could, but only under these rules.

### Rules

1. **Off unless the user turns it on.** No prompt on first run, no default-on in any release, no "opt out later". `kagicyber telemetry on` or `KAGICYBER_TELEMETRY=1` turns it on; nothing else does.
2. **Easy to turn off and to check.** `kagicyber telemetry off`, `KAGICYBER_TELEMETRY=0` and `DO_NOT_TRACK=1` each turn it off, and the off switches win over every on switch. `kagicyber telemetry status` shows the setting and where it came from. `kagicyber telemetry show` prints the exact payload of the last event, byte for byte.
3. **Never in CI by default.** When `CI` is set, telemetry stays off even if the config file says on, unless `KAGICYBER_TELEMETRY=1` is set in that environment.
4. **No content.** Never sent, not even hashed: the target URL, host or domain, page content, file paths or file names, repository names, findings, evidence, secrets (masked or not), report files, scores tied to a target, IP addresses, user names, machine names, environment variables. A hash of a domain is not anonymous: domains can be guessed and hashed back.
5. **Never blocks or slows an audit.** One request after the command finishes, a 2-second timeout, no retries, failures ignored silently.
6. **Documented and versioned.** The schema below is part of the documentation; adding a field is a minor release with a CHANGELOG entry.
7. **Independent of the hosted product.** Using kagicyber.com never turns CLI telemetry on, and turning it on gives the hosted product nothing.

### Event schema (version 1)

```json
{
  "schema": 1,
  "installId": "3f1c9a52-6b1e-4d6e-9c55-0b2d7e1c8a40",
  "kagicyber": "1.0.0",
  "rules": "2026.11",
  "node": "22",
  "os": "linux",
  "command": "audit",
  "flags": ["json", "md", "browser"],
  "profile": "balanced",
  "exitCode": 0,
  "durationBucket": "10-30s",
  "result": "completed"
}
```

- `installId`: a random UUID created when telemetry is turned on and deleted when it is turned off. It only links events from one installation, to count active installs; it is not derived from the machine or the user.
- `node`: major version only. `os`: `process.platform`.
- `flags`: names of the options used, never their values (`--md` yes, the file name no; `--country` yes, the country no).
- `durationBucket`: one of `<10s`, `10-30s`, `30-120s`, `>120s`.
- `result`: `completed`, `usage-error`, `unreachable`, `http-error` or `crashed` (the error class, not the message).

### Server side

- One endpoint that accepts only this schema and drops anything else. The client IP is used for rate limiting and discarded; it is never stored or logged.
- Raw events are deleted after 90 days; only daily aggregates (counts per version, Node major, OS, command, flag and result) are kept.
- The aggregates are published, so users can see everything the project learns from them.

### Before shipping it

The CLI's zero-dependency promise and the claim "sends nothing to Kagicyber" in the README and in this document would change, so telemetry needs its own release with a CHANGELOG entry, this document updated to "implemented", a privacy notice on kagicyber.com that names the controller, and a test that runs every command with telemetry off and asserts that no request goes to the telemetry endpoint.
