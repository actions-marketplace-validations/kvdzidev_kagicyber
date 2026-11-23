import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FAKE } from './fake-secrets.js';

// fileURLToPath, not URL.pathname: on Windows .pathname gives "/C:/..." and every read fails.
const ROOT = fileURLToPath(new URL('../fixtures/site/', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.map': 'application/json', '.txt': 'text/plain' };

const generated = {
  '/assets/app.js': () => `/*! app bundle */
var config = { apiBase: "https://api.przyklad.pl", staging: "https://staging.przyklad-dev.com/api" };
var awsKey = "${FAKE.aws}";
var mapsKey = "${FAKE.google}";
localStorage.setItem("access_token", "x");
var placeholder = { apiKey: "your_api_key_here_please" };
import("./chunks/extra.js");
//# sourceMappingURL=app.js.map
`,
  '/assets/chunks/extra.js': () => `var supabaseAnon = "${FAKE.supabaseAnon}";\n`,
};

/** Serve the fixture site on a random local port. */
export function startFixtureServer({ latencyMs = 0, chunks = 0 } = {}) {
  const server = http.createServer((req, res) => handle(req, res).catch((e) => {
    if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
    res.end(String(e?.message || e));
  }));
  async function handle(req, res) {
    if (latencyMs) await new Promise((r) => setTimeout(r, latencyMs));
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path === '/') {
      res.writeHead(200, {
        'content-type': TYPES['.html'],
        server: 'nginx/1.18.0',
        'x-powered-by': 'PHP/7.4.3',
        'set-cookie': ['PHPSESSID=abc123; path=/', '_ga=GA1.1.123.456; path=/; max-age=63072000'],
      });
      return res.end(readFileSync(join(ROOT, 'index.html')));
    }
    if (generated[path]) {
      res.writeHead(200, { 'content-type': TYPES['.js'] });
      let body = generated[path]();
      if (path === '/assets/app.js' && chunks) body += Array.from({ length: chunks }, (_, i) => `import("./chunks/c${i + 1}.js");`).join('\n');
      return res.end(body);
    }
    const cm = path.match(/^\/assets\/chunks\/c(\d+)\.js$/);
    if (cm && Number(cm[1]) <= chunks) {
      res.writeHead(200, { 'content-type': TYPES['.js'] });
      return res.end(`export const c${cm[1]} = ${'"x"'.repeat(1)}; /* ${'a'.repeat(20000)} */`);
    }
    const file = join(ROOT, path);
    if (file.startsWith(ROOT) && existsSync(file) && !file.endsWith(sep)) {
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      return res.end(readFileSync(file));
    }
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<h1>Not found</h1>');
  }
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` })));
}
