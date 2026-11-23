# Responsible use

## What `kagicyber audit` requests

- the page you name (following redirects) and `http://<host>/` once without following redirects;
- the www or non-www twin of the host, once, without following redirects;
- `/robots.txt`, the sitemap it names (or `/sitemap.xml`), `/.well-known/security.txt`, `/llms.txt` and one random non-existent path;
- up to 7 legal and contact pages linked from the homepage (privacy, cookies, terms, imprint, contact, accessibility, returns), or up to 4 common privacy-policy paths if none is linked;
- up to 8 internal links from the homepage (broken-link check, first 16 KB only);
- first-party JavaScript referenced by the page (up to 30 files) and the source maps those files reference (up to 5);
- one TLS handshake, one handshake limited to TLS 1.0/1.1, and public DNS records (MX, SPF, DMARC, CAA and, unless `--no-dns`, common DKIM selectors, MTA-STS, TLS-RPT and DNSSEC).

Limits: a request budget per audit (90 to 120 depending on the profile), a per-host concurrency cap and pacing (see the profiles in the README), a timeout per request and 3 MB per response (4 MB for scripts). A 429 or 503 with a short Retry-After pauses the host. The user agent is `kagicyber/<version>` with a link to this project.

Apart from the four privacy-policy fallbacks above, it requests no path the site does not reference. It never runs wordlists, brute-forces, submits forms, logs in, sends attack payloads or uses a credential it finds.

## `kagicyber serve`

The HTTP API audits targets chosen by its callers, so it only connects to public addresses: loopback, private, link-local (including cloud metadata such as 169.254.169.254) and reserved ranges are refused on every request and every redirect. See [api.md](api.md) for the remaining limits.

## Subdomains

`--subdomains` queries public certificate-transparency logs (crt.sh) and DNS; it sends no request to the subdomains themselves.

## What leaves your machine

Nothing except the audit requests above, DNS lookups through your system resolver, the DNSSEC check (which sends the domain name to dns.google; skip it with `--no-dns`) and, with `--subdomains`, a query to crt.sh. With `--browser` the page loads in a real browser, so every third party the page embeds is contacted, as on a normal visit. There is no telemetry.

## Secrets

Secrets are masked everywhere (`AKIA…MPLQ (len 20)`). If you find a credential on someone else's site, tell the owner privately (see their security.txt) and do not use it.

## Auditing sites you do not own

Passive checks only touch public resources, like a browser visit. Publishing audit results about a named company can still have legal consequences in some countries, so share findings privately with the owner.
