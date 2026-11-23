import { sleep } from './util.js';
import { VERSION } from './version.js';
import { assertPublicUrl } from './netguard.js';

export const USER_AGENT = `Mozilla/5.0 (compatible; kagicyber/${VERSION}; +https://kagicyber.com/bot)`;

/**
 * Request profiles. Requests run in parallel up to `perHost`, paced to `rps` per host with a
 * little jitter. A 429/503 pauses the host (Retry-After honoured) and the request is retried once.
 */
export const PROFILES = {
  quiet: { perHost: 1, rps: 2, jitter: 0.3, timeoutMs: 15000, maxRequests: 90 },
  balanced: { perHost: 6, rps: 12, jitter: 0.2, timeoutMs: 12000, maxRequests: 100 },
  fast: { perHost: 10, rps: 25, jitter: 0.1, timeoutMs: 10000, maxRequests: 120 },
};

const MAX_BACKOFF_MS = 8000;
const MAX_REDIRECTS = 10;

/**
 * Polite, parallel HTTP client: per-host concurrency cap and pacing, request budget,
 * response size cap, coalescing of identical GETs, and backoff on 429/503.
 */
export class Fetcher {
  constructor({ profile = 'balanced', maxRequests, timeoutMs, maxBytes = 3_000_000, userAgent = USER_AGENT, delayMs, publicOnly = false, lookup } = {}) {
    // publicOnly: refuse non-public addresses on every request and every redirect hop (kagicyber serve).
    this.publicOnly = publicOnly;
    this.lookup = lookup;
    const p = PROFILES[profile] || PROFILES.balanced;
    this.profile = PROFILES[profile] ? profile : 'balanced';
    this.perHost = p.perHost;
    // delayMs: 0 disables pacing entirely (used by the test suite).
    this.gapMs = delayMs === 0 ? 0 : delayMs ?? 1000 / p.rps;
    this.jitter = p.jitter;
    this.timeoutMs = timeoutMs ?? p.timeoutMs;
    this.maxRequests = maxRequests ?? p.maxRequests;
    this.maxBytes = maxBytes;
    this.userAgent = userAgent;
    this.count = 0;
    this.skipped = 0;
    this.log = [];
    this.hosts = new Map();
    this.inflight = new Map();
  }

  get remaining() {
    return this.maxRequests - this.count;
  }

  _host(url) {
    let h;
    try {
      h = new URL(url).host;
    } catch {
      h = 'invalid';
    }
    if (!this.hosts.has(h)) this.hosts.set(h, { active: 0, nextAt: 0, pausedUntil: 0 });
    return this.hosts.get(h);
  }

  async _acquire(state) {
    for (;;) {
      const now = Date.now();
      if (state.active < this.perHost && now >= state.nextAt && now >= state.pausedUntil) {
        state.active++;
        const gap = this.gapMs * (1 + (Math.random() * 2 - 1) * this.jitter);
        state.nextAt = now + Math.max(0, gap);
        return;
      }
      const wait = Math.max(state.nextAt - now, state.pausedUntil - now, 0);
      await sleep(Math.min(Math.max(wait, 10), 250));
    }
  }

  /** GET (or other method). Identical concurrent GETs share one request. */
  get(url, opts = {}) {
    const method = opts.method || 'GET';
    const key = method === 'GET' && !opts.body ? `${url}|${opts.redirect || 'follow'}|${JSON.stringify(opts.headers || {})}` : null;
    if (key && this.inflight.has(key)) return this.inflight.get(key);
    const p = this._run(url, opts);
    if (key) this.inflight.set(key, p);
    return p;
  }

  async _run(url, opts) {
    if (this.count >= this.maxRequests) {
      this.skipped++;
      return { url, status: 0, ok: false, error: 'request budget exhausted', headers: {}, setCookies: [], body: '' };
    }
    this.count++;
    const state = this._host(url);
    for (let attempt = 0; ; attempt++) {
      await this._acquire(state);
      let res;
      try {
        res = await this._fetch(url, opts);
      } finally {
        state.active--;
      }
      if ((res.status === 429 || res.status === 503) && attempt === 0) {
        const wait = retryAfterMs(res.headers['retry-after']);
        if (wait !== null && wait <= MAX_BACKOFF_MS) {
          state.pausedUntil = Date.now() + wait;
          continue;
        }
      }
      return res;
    }
  }

  /** fetch() that, in publicOnly mode, checks the address of the URL and of every redirect target. */
  async _guardedFetch(url, init) {
    if (!this.publicOnly) return fetch(url, init);
    const follow = init.redirect !== 'manual';
    let current = url;
    for (let hop = 0; ; hop++) {
      await assertPublicUrl(current, this.lookup);
      const res = await fetch(current, { ...init, redirect: 'manual' });
      const loc = res.headers.get('location');
      if (!follow || res.status < 300 || res.status > 399 || !loc) {
        if (hop > 0) Object.defineProperties(res, { url: { value: current }, redirected: { value: true } });
        return res;
      }
      if (hop >= MAX_REDIRECTS) throw Object.assign(new Error('too many redirects'), { cause: { code: 'ETOOMANYREDIRECTS' } });
      await res.body?.cancel().catch(() => {});
      current = new URL(loc, current).href;
    }
  }

  async _fetch(url, { redirect = 'follow', maxBytes = this.maxBytes, headers = {}, method = 'GET', body } = {}) {
    const started = Date.now();
    try {
      const res = await this._guardedFetch(url, {
        method,
        body,
        redirect,
        headers: { 'user-agent': this.userAgent, accept: '*/*', 'accept-language': 'en;q=0.8, *;q=0.5', ...headers },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const ttfb = Date.now() - started;
      const h = {};
      res.headers.forEach((v, k) => {
        if (k !== 'set-cookie') h[k] = v;
      });
      const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
      const text = await readText(res, maxBytes);
      const out = {
        url,
        finalUrl: res.url || url,
        status: res.status,
        ok: res.ok,
        redirected: res.redirected,
        headers: h,
        setCookies,
        body: text.body,
        bytes: text.bytes,
        truncated: text.truncated,
        ttfb,
        ms: Date.now() - started,
      };
      this.log.push({ url, status: res.status, ms: out.ms });
      return out;
    } catch (err) {
      const msg = networkErrorCode(err);
      this.log.push({ url, status: 0, error: msg });
      return { url, status: 0, ok: false, error: msg, headers: {}, setCookies: [], body: '' };
    }
  }
}

/**
 * A short, useful reason for a failed fetch. undici wraps the socket error in `cause`, and for
 * dual-stack hosts in an AggregateError (`cause.errors`), so a bare `err.name` would only say "TypeError".
 */
export function networkErrorCode(err) {
  const cause = err?.cause;
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'timeout';
  if (err?.code === 'EBLOCKED') return err.message;
  return cause?.code || cause?.errors?.find((e) => e?.code)?.code || cause?.message || err?.message || err?.name || String(err);
}

/** Retry-After in ms (seconds or HTTP date); null means "do not retry"; missing header = 1 s. */
export function retryAfterMs(v) {
  if (v == null || v === '') return 1000;
  if (/^\d+$/.test(String(v).trim())) return Number(v) * 1000;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : Math.max(0, t - Date.now());
}

async function readText(res, maxBytes) {
  if (!res.body) return { body: '', truncated: false, bytes: 0 };
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      chunks.push(value.subarray(0, value.byteLength - (size - maxBytes)));
      truncated = true;
      try {
        await reader.cancel();
      } catch {}
      break;
    }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { body: new TextDecoder('utf-8', { fatal: false }).decode(buf), truncated, bytes: size };
}
