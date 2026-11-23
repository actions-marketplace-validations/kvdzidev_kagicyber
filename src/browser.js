/* global window, document, getComputedStyle -- these run inside the page via Playwright */
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { TRACKERS, TRACKER_COOKIES } from './knowledge.js';
import { uniq, sameSite, safeUrl, spawnNpm } from './util.js';

const CHROME_PATHS = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function globalModules() {
  const r = spawnNpm(['root', '-g'], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
  return r.status === 0 && r.stdout ? r.stdout.trim() : null;
}

/** Find Playwright next to kagicyber, in the current project, or in the global npm folder. */
async function loadPlaywright() {
  const names = ['playwright', 'playwright-core'];
  for (const name of names) {
    try {
      const mod = await import(name);
      return { name, chromium: mod.chromium || mod.default?.chromium };
    } catch {}
  }
  const roots = [join(process.cwd(), 'node_modules'), globalModules()].filter(Boolean);
  for (const root of roots) {
    for (const name of names) {
      try {
        const file = createRequire(join(root, 'noop.js')).resolve(name);
        const mod = await import(pathToFileURL(file).href);
        return { name, chromium: mod.chromium || mod.default?.chromium };
      } catch {}
    }
  }
  return null;
}

/**
 * Real-browser consent test: load the page in a fresh profile, never click anything,
 * and record which tracker requests and cookies appear before the visitor decides.
 * Requires the optional peer dependency `playwright` (or `playwright-core` + a local Chrome).
 */
export async function browserConsentTest(url, { timeoutMs = 30000, waitMs = 3000, renderUrls = [] } = {}) {
  const pw = await loadPlaywright();
  if (!pw?.chromium) {
    return { ran: false, reason: 'Playwright is not installed. Install it with `npm i -g playwright && npx playwright install chromium`, then re-run with --browser.' };
  }
  const executablePath = process.env.KAGICYBER_CHROME_PATH || (pw.name === 'playwright-core' ? CHROME_PATHS.find((p) => existsSync(p)) : undefined);
  let browser;
  try {
    browser = await pw.chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}), args: ['--no-first-run', '--disable-extensions'] });
    const context = await browser.newContext({ locale: 'en-US', viewport: { width: 1366, height: 900 } });
    const page = await context.newPage();
    const requests = [];
    page.on('request', (r) => requests.push(r.url()));
    await page.addInitScript(() => {
      window.__kcVitals = { lcp: null, cls: 0 };
      try {
        new PerformanceObserver((l) => {
          const e = l.getEntries().at(-1);
          if (e) window.__kcVitals.lcp = Math.round(e.startTime);
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((l) => {
          for (const e of l.getEntries()) if (!e.hadRecentInput) window.__kcVitals.cls += e.value;
        }).observe({ type: 'layout-shift', buffered: true });
      } catch {}
    });
    await page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: waitMs }).catch(() => {});
    const cookies = await context.cookies();
    const banner = await detectBanner(page);
    const vitals = await page.evaluate(() => ({ lcp: window.__kcVitals?.lcp ?? null, cls: window.__kcVitals ? Math.round(window.__kcVitals.cls * 1000) / 1000 : null })).catch(() => null);
    const renderedWords = await page.evaluate(() => (document.body?.innerText || '').split(/\s+/).filter((w) => /\p{L}/u.test(w)).length).catch(() => null);
    const renderedPages = [];
    for (const u of renderUrls.slice(0, 4)) {
      try {
        const p2 = await context.newPage();
        await p2.goto(u, { waitUntil: 'load', timeout: timeoutMs });
        await p2.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
        renderedPages.push({ url: u, text: (await p2.evaluate(() => document.body?.innerText || '')).replace(/\s+/g, ' ').slice(0, 60000) });
        await p2.close();
      } catch {}
    }
    const host = safeUrl(url).hostname;
    const trackerRequests = [];
    for (const r of requests) {
      const t = TRACKERS.find((x) => r.includes(x.host));
      if (t && !trackerRequests.some((x) => x.name === t.name)) trackerRequests.push({ name: t.name, url: r.slice(0, 160) });
    }
    const trackerCookies = cookies.filter((c) => TRACKER_COOKIES.some((re) => re.test(c.name))).map((c) => ({ name: c.name, domain: c.domain }));
    const thirdPartyHosts = uniq(requests.map((r) => safeUrl(r)?.hostname).filter((h) => h && !sameSite(h, host)));
    return {
      ran: true,
      engine: pw.name,
      requests: requests.length,
      thirdPartyHosts,
      cookies: cookies.map((c) => ({ name: c.name, domain: c.domain, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite })),
      trackerRequests,
      trackerCookies,
      banner,
      vitals,
      renderedWords,
      renderedPages,
    };
  } catch (err) {
    return { ran: false, reason: `Browser test failed: ${err.message.split('\n')[0]}` };
  } finally {
    await browser?.close().catch(() => {});
  }
}

async function detectBanner(page) {
  const probe = () => {
    const acceptRe = /^(accept|accept all|accept cookies|allow all|allow cookies|agree|i agree|i accept|ok|got it|akceptuj|akceptuję|zaakceptuj|zaakceptuj wszystkie|akceptuj wszystkie|zgadzam się|alle akzeptieren|akzeptieren|zustimmen|tout accepter|accepter|j'accepte|aceptar|aceptar todo|accetta|accetta tutto|alles accepteren|accepteren|godkänn|acceptér|hyväksy)/i;
    const rejectRe = /(reject|decline|deny|refuse|only necessary|necessary only|essential only|use necessary|odrzuć|odrzucam|tylko niezbędne|tylko wymagane|ablehnen|nur notwendige|nur essenzielle|refuser|tout refuser|continuer sans accepter|rechazar|rifiuta|weigeren|avvisa|afvis|hylkää)/i;
    const cookieRe = /(cookie|ciasteczk|consent|zgod|datenschutz|privacy|prywatno|confidentialit|privacidad)/i;
    const all = [];
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        all.push(el);
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05;
    };
    const label = (el) => (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
    const buttons = all.filter((el) => el.matches('button, a, [role=button], input[type=button], input[type=submit]') && visible(el));
    const isAccept = (b) => label(b).length < 40 && acceptRe.test(label(b));
    const isReject = (b) => label(b).length < 50 && rejectRe.test(label(b));
    const up = (el) => el.parentElement || el.getRootNode()?.host || null;
    // A banner is the nearest ancestor of a consent button whose text is about cookies or consent.
    // Accept and reject must sit in that same container: a newsletter "OK" and a "Decline" elsewhere are not a banner.
    for (const b of buttons.filter((x) => isAccept(x) || isReject(x))) {
      let box = null;
      for (let el = up(b), depth = 0; el && el !== document.body && el !== document.documentElement && depth < 10; el = up(el), depth++) {
        const t = label(el);
        if (t.length > 40 && cookieRe.test(t)) {
          box = el;
          break;
        }
      }
      if (!box) continue;
      const inside = buttons.filter((x) => box.contains(x) || (x.getRootNode()?.host && box.contains(x.getRootNode().host)));
      const accept = inside.find(isAccept);
      const reject = inside.find(isReject);
      return { found: true, accept: accept ? label(accept) : null, reject: reject ? label(reject) : null, text: label(box).slice(0, 200) };
    }
    return { found: false, accept: null, reject: null, text: '' };
  };
  for (const frame of page.frames()) {
    try {
      const r = await frame.evaluate(probe);
      if (r.found) return { ...r, inFrame: frame !== page.mainFrame() };
    } catch {}
  }
  return { found: false, accept: null, reject: null, text: '' };
}
