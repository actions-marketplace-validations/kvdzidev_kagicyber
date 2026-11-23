# Self-hosted API

`kagicyber serve` starts a small HTTP API, for example to run audits from your own dashboard or a scheduler.

```bash
export KAGICYBER_API_KEYS="$(openssl rand -hex 24)"
npx kagicyber serve --port 8787          # listens on 127.0.0.1; set HOST=0.0.0.0 in a container
```

Auth: `Authorization: Bearer <key>`. Keys come from `KAGICYBER_API_KEYS` (comma-separated) and are compared as SHA-256 digests in constant time.

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/healthz` | - | `{ ok, version, rules }` |
| GET | `/v1/rules` | - | Rule catalog: jurisdictions, site types, rule counts |
| POST | `/v1/audit?format=json\|markdown\|html\|prompt\|all` | `{ target, browser?, country? }` | Runs a passive audit; 5 requests per minute per key |

Response:

```json
{
  "scores": { "compliance": 58, "complianceCoverage": 91, "complianceCore": 71, "security": 74, "grade": "C", "seo": 62, "seoCoverage": 100, "risk": "high" },
  "result": { "...the same JSON as kagicyber audit --json..." },
  "markdown": "# KagiCyber audit: example.com (2026-11-20) ...",
  "html": "<!DOCTYPE html> ...",
  "prompt": "You are a senior web developer. Fix the problems ..."
}
```

Errors: 400 invalid input, 401 bad key, 404, 413 body too large, 422 the target could not be audited (unreachable, blocked address, an HTTP error page or not HTML), 429 rate limit, 503 busy (concurrency limit), 504 the audit hit the time limit, 500.

`/healthz` and `/v1/rules` need no key. Requests without a valid key get 401 before rate limiting applies.

## Safety

The target comes from the API caller, so the server only connects to public addresses:

- Every request and every redirect hop is resolved and refused when it points at loopback, private (RFC 1918, unique local), link-local (including cloud metadata such as 169.254.169.254), carrier-grade NAT, multicast or reserved ranges, IPv4-mapped and NAT64 forms included. Hosts ending in `.localhost`, `.local`, `.internal` or `.home.arpa` are refused.
- Residual risk: the check runs before each connection, so a DNS answer that changes between the check and the connection (DNS rebinding) is not covered. Run the container without a route to internal networks or metadata endpoints as well (for example an egress firewall or a network policy).
- Each audit runs in a worker thread and is stopped after `KAGICYBER_API_TIMEOUT_MS` (default 180000). At most `KAGICYBER_API_CONCURRENCY` audits (default 2) run at once.
- The real-browser test is not covered by the address guard, so `browser: true` is ignored unless the operator sets `KAGICYBER_API_ALLOW_BROWSER=1`.
- Secrets in the returned evidence are masked, but the result still contains page text from the audited site: treat it as untrusted data.

## Docker

```bash
docker build -t kagicyber .
docker run -p 8787:8787 -e KAGICYBER_API_KEYS="$(openssl rand -hex 24)" kagicyber
```

Put it behind HTTPS (your platform's TLS, Caddy or nginx). Notes:

- Audits make outbound requests to the audited site, to public DNS and to dns.google; allow that egress, and block internal networks.
- The real-browser test needs Playwright and Chromium in the image (`npx playwright install --with-deps chromium`) and `KAGICYBER_API_ALLOW_BROWSER=1`; without them, browser-dependent rows become MANUAL.
- Rate limits are in memory per instance; use a shared store before scaling horizontally.
- Log metadata only (host, scores, duration), never evidence.
