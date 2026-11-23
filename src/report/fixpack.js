const NOTICE = {
  en: '{controller} processes the data from this form to answer your message (GDPR art. 6(1)(b)/(f)). Details: <a href="{privacy}">Privacy policy</a>.',
  pl: 'Administratorem danych z formularza jest {controller}. Dane przetwarzamy, aby odpowiedzieć na wiadomość (art. 6 ust. 1 lit. b/f RODO). Szczegóły: <a href="{privacy}">Polityka prywatności</a>.',
  de: 'Verantwortlich für die Daten aus diesem Formular ist {controller}. Wir verarbeiten sie zur Beantwortung Ihrer Anfrage (Art. 6 Abs. 1 lit. b/f DSGVO). Details: <a href="{privacy}">Datenschutzerklärung</a>.',
  fr: '{controller} traite les données de ce formulaire pour répondre à votre message (art. 6(1)(b)/(f) RGPD). Détails : <a href="{privacy}">Politique de confidentialité</a>.',
  es: '{controller} trata los datos de este formulario para responder a su mensaje (art. 6.1.b/f RGPD). Más información: <a href="{privacy}">Política de privacidad</a>.',
  it: '{controller} tratta i dati di questo modulo per rispondere al tuo messaggio (art. 6(1)(b)/(f) GDPR). Dettagli: <a href="{privacy}">Informativa privacy</a>.',
};

function detectStack(result) {
  const h = result.evidence?.home?.headers || {};
  const gen = result.evidence?.html?.metas?.generator || '';
  const s = new Set();
  if (/nginx/i.test(h.server || '')) s.add('nginx');
  if (/apache|litespeed/i.test(h.server || '')) s.add('apache');
  if (/next\.js/i.test(h['x-powered-by'] || '') || result.evidence?.scripts?.some((x) => /\/_next\//.test(x.url))) s.add('next');
  if (h['x-vercel-id'] || /vercel/i.test(h.server || '')) s.add('vercel');
  if (h['x-nf-request-id'] || /netlify/i.test(h.server || '')) s.add('netlify');
  if (h['cf-ray'] || /cloudflare/i.test(h.server || '')) s.add('cloudflare');
  if (h['x-amz-cf-id'] || /cloudfront/i.test(h.via || '')) s.add('cloudfront');
  if (h['x-github-request-id'] || /github\.com/i.test(h.server || '')) s.add('github-pages');
  if (/wordpress/i.test(gen)) s.add('wordpress');
  return s;
}

const HEADERS = [
  ['Strict-Transport-Security', 'max-age=31536000; includeSubDomains'],
  ['X-Content-Type-Options', 'nosniff'],
  ['Referrer-Policy', 'strict-origin-when-cross-origin'],
  ['Permissions-Policy', 'camera=(), microphone=(), geolocation=()'],
  ['Content-Security-Policy-Report-Only', "default-src 'self'; frame-ancestors 'self'; object-src 'none'; base-uri 'self'"],
];

/** Reference snippets for the problems that were actually found, tailored to the detected stack (used in the fix prompt). */
export function buildFixPack(result, results, findings) {
  const stack = detectStack(result);
  const host = result.target?.host || 'example.com';
  const apex = result.evidence?.apex || host.replace(/^www\./, '');
  const bad = (id) => results.find((r) => r.id === id && (r.status === 'fail' || r.status === 'partial'));
  const badKey = (key) => (result.compliance?.checks || []).find((c) => c.key === key && (c.status === 'fail' || c.status === 'partial'));
  const hasFinding = (re) => findings.some((f) => re.test(f.title));
  const pack = [];

  if (findings.some((f) => f.domain === 'H' || /HSTS/.test(f.title))) {
    const all = stack.size === 0 || ![...stack].some((s) => ['nginx', 'apache', 'next', 'netlify', 'vercel', 'cloudflare', 'cloudfront', 'github-pages'].includes(s));
    if (stack.has('nginx') || all) pack.push({ title: 'Security headers - nginx', lang: 'nginx', code: `# server { … }\nserver_tokens off;\ncharset utf-8;\n${HEADERS.map(([k, v]) => `add_header ${k} "${v}" always;`).join('\n')}` });
    if (stack.has('apache') || stack.has('wordpress') || all) pack.push({ title: 'Security headers - Apache / .htaccess', lang: 'apache', code: `<IfModule mod_headers.c>\n${HEADERS.map(([k, v]) => `  Header always set ${k} "${v}"`).join('\n')}\n  Header unset X-Powered-By\n</IfModule>\nAddDefaultCharset UTF-8\nServerSignature Off` });
    if (stack.has('next') || stack.has('vercel')) pack.push({ title: 'Security headers - Next.js (next.config.js)', lang: 'js', code: `module.exports = {\n  poweredByHeader: false,\n  async headers() {\n    return [{ source: '/(.*)', headers: [\n${HEADERS.map(([k, v]) => `      { key: '${k}', value: "${v}" },`).join('\n')}\n    ] }];\n  },\n};` });
    if (stack.has('netlify') || stack.has('cloudflare')) pack.push({ title: 'Security headers - Netlify / Cloudflare Pages (_headers)', lang: 'text', code: `/*\n${HEADERS.map(([k, v]) => `  ${k}: ${v}`).join('\n')}` });
    if (stack.has('cloudfront')) pack.push({ title: 'Security headers - Amazon CloudFront (response headers policy)', lang: 'text', code: `Create a response headers policy (CloudFront console: Policies, Response headers) and attach it to the distribution's behaviours:\n${HEADERS.map(([k, v]) => `  ${k}: ${v}`).join('\n')}` });
    if (stack.has('github-pages')) pack.push({ title: 'GitHub Pages cannot set headers', lang: 'text', code: 'Put Cloudflare (free plan) in front of the site and add the headers with a Transform Rule, or move to Netlify/Cloudflare Pages.', note: 'A <meta http-equiv="Content-Security-Policy"> tag works for CSP only (no frame-ancestors).' });
    pack.push({ title: 'Roll-out note', lang: 'text', code: 'Start CSP in Report-Only mode, watch the browser console/report endpoint for a week, then switch to Content-Security-Policy. Add HSTS "preload" only when every subdomain serves HTTPS.' });
  }
  if (badKey('privacy-readable') && /encoding/i.test(badKey('privacy-readable').evidence)) {
    pack.push({ title: 'Fix broken characters in legal pages', lang: 'text', code: '1. Re-save the HTML files as UTF-8 (without BOM).\n2. Keep <meta charset="utf-8"> as the first element in <head>.\n3. Send the header: Content-Type: text/html; charset=utf-8 (nginx: charset utf-8; Apache: AddDefaultCharset UTF-8).' });
  }
  if (badKey('trackers-before-consent') || badKey('consent-mechanism')) {
    pack.push({ title: 'Block trackers until consent', lang: 'html', code: '<!-- 1. Load a consent manager first (Cookiebot, Usercentrics, CookieYes, Klaro, CookieConsent…) -->\n<!-- 2. Mark every non-essential tag so it only runs after opt-in: -->\n<script type="text/plain" data-category="analytics" async src="https://www.googletagmanager.com/gtag/js?id=G-XXXX"></script>\n<script type="text/plain" data-category="marketing">/* Meta Pixel init */</script>\n<!-- 3. Google Consent Mode v2 defaults (keep tags blocked for EU visitors until consent): -->\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}\ngtag(\'consent\',\'default\',{ad_storage:\'denied\',analytics_storage:\'denied\',ad_user_data:\'denied\',ad_personalization:\'denied\'});</script>', note: 'Put "Reject all" next to "Accept all" on the first layer with the same style.' });
  }
  if (badKey('embeds-before-consent')) {
    pack.push({ title: 'Click-to-load map / video', lang: 'html', code: '<div class="embed-placeholder" data-src="https://www.google.com/maps/embed?pb=…">\n  <p>This map is provided by Google. Loading it sends your IP address to Google.</p>\n  <button type="button" onclick="const d=this.parentElement;d.outerHTML=`<iframe src=\\"${d.dataset.src}\\" width=\\"600\\" height=\\"450\\" loading=\\"lazy\\" referrerpolicy=\\"no-referrer-when-downgrade\\"></iframe>`">Show map</button>\n</div>' });
    if (result.inventory?.googleFonts) pack.push({ title: 'Self-host Google Fonts', lang: 'css', code: '/* Download the font files (e.g. via google-webfonts-helper) into /fonts and remove the fonts.googleapis.com <link> */\n@font-face {\n  font-family: "Inter";\n  src: url("/fonts/inter-v12-latin-regular.woff2") format("woff2");\n  font-weight: 400;\n  font-display: swap;\n}' });
  }
  const formBad = badKey('form-notice');
  if (formBad) {
    const siteLang = (result.evidence?.html?.lang || 'en').slice(0, 2).toLowerCase();
    const privacy = (result.evidence?.pages || []).find((p) => p.kind === 'privacy')?.url || '/privacy';
    const fill = (t) => t.replace('{controller}', '[Company name]').replace('{privacy}', privacy);
    let code = `<p class="form-notice">${fill(NOTICE.en)}</p>`;
    if (NOTICE[siteLang] && siteLang !== 'en') code += `\n\n<!-- ${siteLang.toUpperCase()} - the notice on the site must be in the site language: -->\n<p class="form-notice">${fill(NOTICE[siteLang])}</p>`;
    pack.push({ title: 'Privacy notice under forms', lang: 'html', code, note: /FormSubmit|Formspree|EmailJS|processor/i.test(formBad.evidence) ? 'Also name the form processor (e.g. FormSubmit) as a recipient in the privacy policy and sign its data processing terms.' : null });
  }
  if (hasFinding(/DMARC/)) pack.push({ title: 'DMARC record', lang: 'dns', code: `_dmarc.${apex}.  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@${apex}; adkim=s; aspf=s"`, note: 'Start with p=none for 2-4 weeks if unsure, read the reports, then move to quarantine and reject.' });
  if (hasFinding(/No SPF/)) pack.push({ title: 'SPF record', lang: 'dns', code: `${apex}.  TXT  "v=spf1 include:<your-mail-provider> ~all"\n# Domain that sends no e-mail:\n${apex}.  TXT  "v=spf1 -all"` });
  if (hasFinding(/No security\.txt/)) {
    const exp = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    pack.push({ title: '/.well-known/security.txt', lang: 'text', code: `Contact: mailto:security@${apex}\nExpires: ${exp}T00:00:00.000Z\nPreferred-Languages: en\nCanonical: https://${host}/.well-known/security.txt` });
  }
  if (hasFinding(/Source maps/)) pack.push({ title: 'Disable public source maps', lang: 'text', code: "Next.js: productionBrowserSourceMaps: false\nVite: build: { sourcemap: 'hidden' }  // upload maps to your error tracker only\nwebpack: devtool: false (or 'hidden-source-map')\nnginx: location ~* \\.map$ { return 404; }" });
  if (findings.some((f) => f.domain === 'K' && /lacks/.test(f.title))) pack.push({ title: 'Secure cookie flags', lang: 'http', code: 'Set-Cookie: __Host-session=…; Path=/; Secure; HttpOnly; SameSite=Lax\n# PHP: session.cookie_secure=1, session.cookie_httponly=1, session.cookie_samesite=Lax' });
  if (findings.some((f) => f.key === 'secret' && f.severity !== 'info')) pack.push({ title: 'Exposed credentials - incident steps', lang: 'text', code: '1. Revoke/rotate the key in the provider console now (assume it is compromised).\n2. Move the call server-side (API route / serverless function) and keep the key in an environment variable.\n3. Remove it from the bundle and from git history (git filter-repo or BFG).\n4. Enable secret scanning + push protection (GitHub) or a gitleaks pre-commit hook.' });
  if (bad('SHOP-05') || bad('PL-09')) pack.push({ title: 'Omnibus price label', lang: 'html', code: '<span class="price-now">79,00 zł</span> <s class="price-before">99,00 zł</s>\n<small class="price-lowest">Najniższa cena z 30 dni przed obniżką: 89,00 zł</small>\n<!-- EN: "Lowest price in the 30 days before the reduction: €89.00" -->' });
  if (bad('FIN-03')) pack.push({ title: 'Representative example for credit ads', lang: 'text', code: 'Representative example (as of <date>): APR [x]%, total loan amount [amount], term [n] months, fixed interest rate [y]%, total amount payable [amount], total cost [amount] (fees [amount], interest [amount]). Data from <lender>.', note: 'Use the lender\'s own representative example and keep the date of the data.' });
  return pack;
}
