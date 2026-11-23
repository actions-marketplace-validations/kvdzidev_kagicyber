# Checks

Every result has an ID, a status or severity, evidence, a fix and a stable `fingerprint`. Compliance rows also carry the legal basis and the maximum penalty; security rows carry a CWE and an OWASP Top 10 category where one applies, plus an effort estimate (S: up to 1 hour, M: up to 1 day, L: more).

## 1. Compliance

The 14 baseline checks below run on every audit. On top of them come the EU extended checklist, the national modules and the site-type checklists described in [rules.md](rules.md) (274 rules in total, `kagicyber rules` lists them).

### EU baseline

| ID | Check | Weight | How it is verified |
|---|---|---|---|
| C-01 | Operator identity | 3 | Address (street patterns and postcodes for PL, DE, FR, ES, IT, NL, UK, Nordics; schema.org streetAddress), registration or VAT number (NIP, KRS, REGON, VAT, USt-IdNr, HRB, SIRET, P.IVA, CIF, KvK, CVR, ABN, CNPJ and more) and e-mail, searched in the homepage, legal pages and, for client-rendered sites, the JavaScript bundles. PASS with all three, FAIL with neither address nor ID |
| C-02 | Privacy policy linked | 3 | Multilingual link detection; falls back to common paths |
| C-03 | Privacy policy readable | 3 | HTTP 200, enough text, no broken encoding; client-rendered policies are flagged (and rendered with `--browser`) |
| C-04 | Core GDPR art. 13 content | 3 | 7 element groups in EN, PL, DE, FR, ES, IT, NL, PT: controller, purposes, legal basis, retention, rights, supervisory authority, recipients. PASS 7/7, PARTIAL 4+, FAIL below. Form processors used by the site but not named in the policy turn a PASS into PARTIAL |
| C-05 | Notice at collection on forms | 2 | Privacy notice or link next to each form; forms rendered by JavaScript are found through their processor (Web3Forms, Formspree, FormSubmit, EmailJS, Getform, Basin, HubSpot, Typeform, Formcarry, Google Forms) |
| C-06 | Consent with reject on the first layer | 3 | 19 consent platforms by markers in the markup and scripts (MANUAL until `--browser` sees the reject button), custom banners by their accept/reject wording near cookie text; with `--browser`, the visible buttons inside the banner |
| C-07 | No trackers before consent | 3 | 34 tracker hosts in markup, gating attributes (`type="text/plain"`, CMP categories), trackers injected by first-party JavaScript, Google Consent Mode defaults; with `--browser`, the real requests before any click |
| C-08 | No tracking cookies before consent | 3 | 27 tracker cookie patterns in `Set-Cookie` and, with `--browser`, the cookie jar (MANUAL without `--browser` when the page loads trackers or is rendered by JavaScript) |
| C-09 | Cookie information available and accurate | 1 | Cookie policy or section, a cookie list with lifetimes, and wording such as "anonymous statistics" next to Google Analytics |
| C-10 | Embeds and fonts wait for consent | 2 | Maps, YouTube, Vimeo, Spotify, Calendly, Instagram, Facebook and X iframes without click-to-load; Google Fonts |
| C-11 | Terms published | 2 | Multilingual link detection; FAIL for shops and apps, PARTIAL otherwise |
| C-12 | Reviews genuine and verification stated | 2 | Review sections in 6 languages; verification wording; placeholder markers near testimonials ("lorem ipsum", "placeholder testimonial", "opinie poglądowe", "do podmiany") |
| C-13 | AI chatbot disclosure | 2 | Chat widgets (Intercom, Crisp, Tidio, Drift, Zendesk, LiveChat, Chatbase) or AI assistant wording; disclosure wording |
| C-14 | Accessibility basics | 1 | `<html lang>`, image alt text, form labels, zoom not disabled |

Statuses: PASS, PARTIAL, FAIL, MANUAL (needs a person or could not be verified automatically; excluded from the score), N/A.

## 2. Security

| Area | Check | Severity |
|---|---|---|
| T | Site not served over HTTPS | HIGH |
| T | HTTP does not redirect to HTTPS, or redirects elsewhere; temporary redirect | MEDIUM; INFO |
| T | HSTS missing or short; no includeSubDomains | LOW; INFO |
| T | Certificate expired or untrusted; expiring within 14 or 30 days | HIGH; MEDIUM or LOW |
| T | TLS 1.0/1.1 accepted; TLS 1.3 not negotiated | MEDIUM; INFO |
| T | Active mixed content; passive mixed content; form posting over HTTP | MEDIUM; LOW; HIGH |
| H | No security headers at all | MEDIUM |
| H | CSP, X-Content-Type-Options or Referrer-Policy missing | LOW |
| H | Clickjacking protection missing (MEDIUM on pages with a password form) | LOW or MEDIUM |
| H | Permissions-Policy missing; weak CSP | INFO; LOW or INFO |
| K | Session cookie without Secure or HttpOnly; cookie without SameSite | MEDIUM; LOW |
| K | Tokens in link URLs; auth tokens in localStorage | MEDIUM; LOW |
| X | Secret in HTML or first-party JavaScript (65 formats) | INFO to CRITICAL |
| X | Public source maps; staging or internal URLs; stack traces; directory listing | MEDIUM; LOW; MEDIUM; MEDIUM |
| X | Form-service access key in client code (Web3Forms) | INFO |
| D | Server or CMS version disclosed | LOW |
| D | End-of-life library (jQuery below 3.5, AngularJS, Bootstrap 3, Vue 2, lodash below 4.17.21, Moment) | MEDIUM |
| D | Script from a compromised CDN (polyfill.io and similar) | HIGH |
| D | Public CDN files without Subresource Integrity | LOW |
| A | robots.txt points to sensitive paths; no security.txt; soft 404 | INFO |
| M | No SPF (MEDIUM when the domain receives mail); multiple SPF; `+all`; `?all` | MEDIUM; MEDIUM; HIGH; LOW |
| M | No DMARC; `p=none`; no `rua`; no CAA record | MEDIUM; LOW; INFO; INFO |
| F | Forms without CAPTCHA or honeypot; FormSubmit CAPTCHA disabled | LOW |

### Secret formats

Cloud and infrastructure (AWS, Azure storage, Google service accounts, DigitalOcean, Vault, Terraform Cloud, Doppler, Pulumi, Fly.io, Netlify, Supabase, Grafana, Sentry, New Relic), code hosting and registries (GitHub, GitLab, npm, PyPI, Docker Hub, Atlassian), payments (Stripe and Clerk live keys, Stripe webhooks, Square, Braintree, Plaid, Shopify, Shippo), AI providers (OpenAI, Anthropic, Hugging Face, Groq, Perplexity, xAI, Replicate), messaging and SaaS (Slack, Discord, Teams and Zapier webhooks, Telegram, SendGrid, Brevo, Mailgun, Mailchimp, Twilio, Linear, Notion, Figma, Postman, Contentful, Airtable, Dropbox, Firebase Cloud Messaging, Google API keys and OAuth secrets, Mapbox) and generic patterns (private keys, age keys, database URLs with passwords, JWTs with Supabase role detection, high-entropy secret assignments).

Public-by-design values (Stripe publishable keys, Firebase web keys, Supabase anon keys) are reported as INFO.

## 3. SEO and GEO

| ID | Check | Weight |
|---|---|---|
| SEO-01 | Title tag (present, 15 to 65 characters) | 3 |
| SEO-02 | Meta description (50 to 170 characters) | 2 |
| SEO-03 | One H1, no skipped heading levels | 2 |
| SEO-04 | Image alt text | 1 |
| SEO-05 | Canonical URL (absolute, same host) | 2 |
| SEO-06 | Homepage indexable (no noindex in meta or X-Robots-Tag) | 3 |
| SEO-07 | lang and hreflang (valid codes, self-reference, x-default) | 2 |
| SEO-08 | Open Graph and Twitter cards | 1 |
| SEO-09 | Viewport, doctype, charset, favicon | 1 |
| SEO-10 | schema.org JSON-LD present and valid | 2 |
| SEO-11 | robots.txt present and not blocking search engines | 2 |
| SEO-12 | XML sitemap (valid, referenced in robots.txt, lastmod) | 2 |
| SEO-13 | Unknown URLs return 404 (no soft 404) | 2 |
| SEO-14 | One canonical host (www and http redirects) | 2 |
| SEO-15 | Internal links work (sample of 8) | 2 |
| SEO-16 | Server response time (time to first byte) | 2 |
| SEO-17 | Compression | 1 |
| SEO-18 | Page weight (HTML and first-party JavaScript) | 2 |
| SEO-19 | No render-blocking scripts in head | 1 |
| SEO-20 | Static assets cached | 1 |
| SEO-21 | Image dimensions and modern formats | 1 |
| SEO-22 | Largest Contentful Paint (with `--browser`) | 2 |
| GEO-01 | AI search crawlers allowed in robots.txt (12 user agents) | 2 |
| GEO-02 | Content readable without JavaScript | 3 |
| GEO-03 | llms.txt | 1 |
| GEO-04 | Organization or LocalBusiness entity with logo, address and sameAs | 2 |
| GEO-05 | FAQ content with FAQPage markup | 1 |
| GEO-06 | No blanket `noai` directive (only reported when present) | 1 |

### Deep e-mail and DNS (on by default, `--no-dns` to skip)

DKIM key among 19 common selectors, MTA-STS, TLS-RPT and DNSSEC (INFO each, only when the domain receives mail where relevant).

### Certificate-transparency subdomains (`--subdomains`)

Subdomains from public certificate logs: sensitive-looking hosts such as staging or admin (INFO) and CNAMEs pointing at unclaimed cloud resources, a possible subdomain takeover (HIGH).

## `kagicyber scan <dir>` (area R)

- Working tree: secrets (65 formats, `node_modules`, `.git` and build output skipped), secret-looking public environment variables (`NEXT_PUBLIC_*SECRET*`, `VITE_*TOKEN*`), committed `.env` files, `.gitignore` without `.env`, production source maps in Next.js, Vite and webpack configs.
- Git history: secrets added in any commit, even if deleted later.
- Dependencies: missing lockfiles, end-of-life Node.js in `engines`, no Dependabot or Renovate, and the right audit command for each ecosystem.
- Code patterns (SAST-lite, candidates to confirm): XSS sinks, eval, shell execution, SQL built from strings, unsafe deserialisation, SSRF, open redirects, path traversal, weak password hashing, Math.random tokens, unverified JWTs, disabled CSRF protection.
- CI/CD: GitHub Actions without a permissions block or with write-all, actions not pinned to a commit SHA, secrets echoed in a step, `pull_request_target` that checks out untrusted code.
- Infrastructure as code: Dockerfiles running as root, unpinned base images, secrets in ENV or ARG, ADD from remote URLs; compose files publishing database ports on all interfaces; privileged Kubernetes containers; Terraform public S3 buckets, open admin or database ports and unencrypted storage.

`--quick` limits the scan to the working tree. Findings point at file and line for SARIF.
