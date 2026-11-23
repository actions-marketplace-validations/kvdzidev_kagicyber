import http from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import { renderMarkdown } from './report/markdown.js';
import { renderHtml } from './report/html.js';
import { renderFixPrompt } from './report/prompt.js';
import { ruleCatalog } from './law/catalog.js';
import { VERSION, RULES_VERSION } from './version.js';

/**
 * Self-hosted HTTP API (`kagicyber serve`).
 *   GET  /healthz          liveness, version and rules version
 *   GET  /v1/rules         rule catalog (jurisdictions, site types, counts)
 *   POST /v1/audit         body {target, browser?, country?} -> audit result; ?format=json|markdown|html|prompt|all
 * Auth: Authorization: Bearer <key>; keys from KAGICYBER_API_KEYS (comma-separated), compared as SHA-256
 * digests in constant time. Simple per-key rate limit.
 */
const MAX_BODY = 100_000;
const RATE = { windowMs: 60_000, audit: 5 };
const MAX_CONCURRENT = Math.max(1, Number(process.env.KAGICYBER_API_CONCURRENCY) || 2);
let active = 0;

function keyDigests() {
  return (process.env.KAGICYBER_API_KEYS || '').split(',').map((k) => k.trim()).filter(Boolean).map((k) => createHash('sha256').update(k).digest());
}

function authorised(req, digests) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const d = createHash('sha256').update(m[1].trim()).digest();
  return digests.some((k) => timingSafeEqual(k, d)) ? d.toString('hex').slice(0, 12) : null;
}

/** Per-key fixed-window limiter. One map per server; keys are API-key digests, so it cannot grow beyond the key list. */
function rateLimiter(max) {
  const buckets = new Map();
  return (id) => {
    const now = Date.now();
    const b = buckets.get(id) || { start: now, n: 0 };
    if (now - b.start > RATE.windowMs) Object.assign(b, { start: now, n: 0 });
    b.n++;
    buckets.set(id, b);
    return b.n > max;
  };
}

function send(res, status, obj) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(obj));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('payload too large'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const AUDIT_TIMEOUT_MS = Math.max(10_000, Number(process.env.KAGICYBER_API_TIMEOUT_MS) || 180_000);

/** Run an audit in a worker thread with a wall-clock limit; the worker is killed when the limit passes. */
export function auditInWorker(target, opts, timeoutMs = AUDIT_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    // execArgv: [] so flags of the embedding process (for example --input-type) do not break the worker.
    const worker = new Worker(new URL('./audit-worker.js', import.meta.url), { workerData: { target, opts }, execArgv: [] });
    const timer = setTimeout(() => {
      worker.terminate();
      reject(Object.assign(new Error(`audit timed out after ${Math.round(timeoutMs / 1000)} s`), { status: 504 }));
    }, timeoutMs);
    worker.once('message', (m) => {
      clearTimeout(timer);
      worker.terminate();
      if (m.ok) resolve(m.result);
      else reject(new Error(m.message));
    });
    worker.once('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

export function createServer({ auditFn = auditInWorker, rateLimit = RATE.audit } = {}) {
  const digests = keyDigests();
  const limited = rateLimiter(rateLimit);
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (req.method === 'GET' && url.pathname === '/healthz') return send(res, 200, { ok: true, version: VERSION, rules: RULES_VERSION });
      if (req.method === 'GET' && url.pathname === '/v1/rules') return send(res, 200, ruleCatalog());
      if (req.method !== 'POST' || url.pathname !== '/v1/audit') return send(res, 404, { error: 'not found' });
      const who = authorised(req, digests);
      if (!who) return send(res, 401, { error: 'invalid or missing API key' });
      if (limited(who)) return send(res, 429, { error: 'rate limit exceeded' });
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        return send(res, e.status || 400, { error: e.status ? e.message : 'invalid JSON' });
      }
      if (!body?.target || typeof body.target !== 'string' || body.target.length > 2048) return send(res, 400, { error: 'body.target is required (domain or URL)' });
      if (body.country != null && !/^[A-Za-z]{2}(-[A-Za-z]{2})?$/.test(String(body.country))) return send(res, 400, { error: 'body.country must be a country code such as PL or DE' });
      if (active >= MAX_CONCURRENT) return send(res, 503, { error: 'busy, retry later' });
      // The target comes from the caller: only public addresses, on every request and redirect (SSRF guard).
      // The real-browser test is not covered by that guard, so it only runs when the operator opts in.
      const browser = !!body.browser && process.env.KAGICYBER_API_ALLOW_BROWSER === '1';
      active++;
      let result;
      try {
        result = await auditFn(body.target, { browser, country: body.country, publicOnly: true });
      } catch (e) {
        if (e?.status === 504) return send(res, 504, { error: e.message });
        if (/could not (reach|audit)|invalid target|missing target/.test(e?.message || '')) return send(res, 422, { error: e.message });
        throw e;
      } finally {
        active--;
      }
      const format = url.searchParams.get('format') || 'json';
      const out = { scores: result.scores, result };
      if (format === 'markdown' || format === 'all') out.markdown = renderMarkdown(result);
      if (format === 'html' || format === 'all') out.html = renderHtml(result);
      if (format === 'prompt' || format === 'all') out.prompt = renderFixPrompt(result);
      return send(res, 200, out);
    } catch (e) {
      console.error(e);
      return send(res, 500, { error: 'internal error' });
    }
  });
}

export function startServer({ port = 8787, host = '127.0.0.1' } = {}) {
  if (!process.env.KAGICYBER_API_KEYS) console.warn('warning: KAGICYBER_API_KEYS is empty, every audit request will be rejected');
  const srv = createServer();
  return new Promise((resolve) => srv.listen(port, host, () => {
    console.log(`KagiCyber API ${VERSION} listening on http://${host}:${port}`);
    resolve(srv);
  }));
}
