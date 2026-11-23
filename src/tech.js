/**
 * Lightweight technology fingerprinting (headers, cookies, HTML, script URLs and bundle
 * contents). Detection runs first so later checks can focus on what the site uses.
 * Each signature: { name, cat, header?, cookie?, html?, script?, bundle?, meta?, version? }.
 */
const SIGS = [
  // CMS and site builders
  { name: 'WordPress', cat: 'CMS', html: /\/wp-(content|includes)\//i, meta: /WordPress\s*([\d.]+)?/i },
  { name: 'WooCommerce', cat: 'E-commerce', html: /woocommerce/i },
  { name: 'Shopify', cat: 'E-commerce', html: /cdn\.shopify\.com|Shopify\.theme/i, header: { 'x-shopify-stage': /./ } },
  { name: 'PrestaShop', cat: 'E-commerce', html: /prestashop/i, meta: /PrestaShop/i },
  { name: 'Magento', cat: 'E-commerce', html: /Mage\.Cookies|\/static\/version\d+\/frontend\//i },
  { name: 'Wix', cat: 'Site builder', html: /static\.wixstatic\.com|wix-code/i, header: { 'x-wix-request-id': /./ } },
  { name: 'Squarespace', cat: 'Site builder', html: /static1\.squarespace\.com/i },
  { name: 'Webflow', cat: 'Site builder', html: /data-wf-page|webflow\.js/i },
  { name: 'Framer', cat: 'Site builder', html: /framerusercontent\.com|data-framer-/i },
  { name: 'Joomla', cat: 'CMS', meta: /Joomla/i, html: /\/media\/jui\//i },
  { name: 'Drupal', cat: 'CMS', meta: /Drupal\s*([\d.]+)?/i, header: { 'x-generator': /Drupal/i } },
  { name: 'Ghost', cat: 'CMS', meta: /Ghost\s*([\d.]+)?/i },
  { name: 'HubSpot', cat: 'Marketing', html: /js\.hs-scripts\.com|js\.hsforms\.net|js\.hs-analytics\.net/i },
  // Frameworks
  { name: 'Next.js', cat: 'Framework', html: /\/_next\/static\//, header: { 'x-powered-by': /Next\.js/i } },
  { name: 'Nuxt', cat: 'Framework', html: /\/_nuxt\/|window\.__NUXT__/ },
  { name: 'Gatsby', cat: 'Framework', html: /___gatsby/ },
  { name: 'Astro', cat: 'Framework', html: /astro-island|\/_astro\//, meta: /Astro\s*v?([\d.]+)?/i },
  { name: 'SvelteKit', cat: 'Framework', html: /\/_app\/immutable\// },
  { name: 'Remix', cat: 'Framework', html: /__remixContext/ },
  { name: 'Angular', cat: 'Framework', html: /\bng-version="([\d.]+)"/ },
  { name: 'Vite', cat: 'Build tool', html: /<script type="module" crossorigin src="\/assets\/index-[\w-]+\.js"/ },
  { name: 'React', cat: 'JS library', bundle: /react-dom\.production|__SECRET_INTERNALS_DO_NOT_USE|reactjs\.org\/docs\/error-decoder|react\.dev\/errors/ },
  { name: 'Vue', cat: 'JS library', bundle: /__VUE__|Vue\.js v([\d.]+)/ },
  { name: 'jQuery', cat: 'JS library', script: /jquery[.-]?(\d+\.\d+\.\d+)?/i, bundle: /jQuery v(\d+\.\d+\.\d+)/ },
  { name: 'Laravel', cat: 'Backend', cookie: /^(laravel_session|XSRF-TOKEN)$/ },
  { name: 'Django', cat: 'Backend', cookie: /^csrftoken$/ },
  { name: 'Ruby on Rails', cat: 'Backend', html: /name="csrf-param" content="authenticity_token"/ },
  { name: 'ASP.NET', cat: 'Backend', header: { 'x-aspnet-version': /./, 'x-powered-by': /ASP\.NET/i }, html: /__VIEWSTATE/ },
  { name: 'PHP', cat: 'Backend', header: { 'x-powered-by': /PHP\/?([\d.]+)?/i }, cookie: /^PHPSESSID$/ },
  { name: 'Express', cat: 'Backend', header: { 'x-powered-by': /Express/i } },
  // Servers, hosting, CDN
  { name: 'nginx', cat: 'Web server', header: { server: /nginx\/?([\d.]+)?/i } },
  { name: 'Apache', cat: 'Web server', header: { server: /Apache\/?([\d.]+)?/i } },
  { name: 'LiteSpeed', cat: 'Web server', header: { server: /LiteSpeed/i } },
  { name: 'Microsoft IIS', cat: 'Web server', header: { server: /Microsoft-IIS\/?([\d.]+)?/i } },
  { name: 'Cloudflare', cat: 'CDN', header: { 'cf-ray': /./, server: /cloudflare/i } },
  { name: 'Vercel', cat: 'Hosting', header: { 'x-vercel-id': /./, server: /Vercel/i } },
  { name: 'Netlify', cat: 'Hosting', header: { 'x-nf-request-id': /./, server: /Netlify/i } },
  { name: 'GitHub Pages', cat: 'Hosting', header: { server: /GitHub\.com/i } },
  { name: 'Amazon CloudFront', cat: 'CDN', header: { 'x-amz-cf-id': /./ } },
  { name: 'Fastly', cat: 'CDN', header: { 'x-served-by': /cache-/i } },
  { name: 'Hostinger', cat: 'Hosting', header: { platform: /hostinger/i, server: /hcdn/i } },
  // Third parties of interest
  { name: 'Google Tag Manager / gtag.js', cat: 'Analytics', html: /googletagmanager\.com/, bundle: /googletagmanager\.com\/gtag\/js/ },
  { name: 'Google reCAPTCHA', cat: 'Security', html: /recaptcha\/api\.js|g-recaptcha/ },
  { name: 'Cloudflare Turnstile', cat: 'Security', html: /challenges\.cloudflare\.com\/turnstile/ },
  { name: 'Stripe.js', cat: 'Payments', html: /js\.stripe\.com/ },
  { name: 'Web3Forms', cat: 'Form backend', bundle: /api\.web3forms\.com/, html: /api\.web3forms\.com/ },
  { name: 'Formspree', cat: 'Form backend', bundle: /formspree\.io/, html: /formspree\.io/ },
  { name: 'FormSubmit', cat: 'Form backend', bundle: /formsubmit\.co/, html: /formsubmit\.co/ },
  { name: 'EmailJS', cat: 'Form backend', bundle: /api\.emailjs\.com/, html: /emailjs/ },
  { name: 'Intercom', cat: 'Chat', html: /widget\.intercom\.io|intercomSettings/, bundle: /widget\.intercom\.io/ },
  { name: 'Crisp', cat: 'Chat', html: /client\.crisp\.chat/, bundle: /client\.crisp\.chat/ },
  { name: 'Tidio', cat: 'Chat', html: /code\.tidio\.co/, bundle: /code\.tidio\.co/ },
  { name: 'Drift', cat: 'Chat', html: /js\.driftt\.com/ },
  { name: 'Zendesk Chat', cat: 'Chat', html: /static\.zdassets\.com|zopim/ },
  { name: 'LiveChat', cat: 'Chat', html: /cdn\.livechatinc\.com/ },
  { name: 'Chatbase', cat: 'Chat', html: /chatbase\.co/, bundle: /chatbase\.co/ },
];

const VERSIONED = (m) => (m && m[1] ? m[1] : null);

export function detectTech(ev) {
  const found = new Map();
  const add = (sig, evidence, version = null) => {
    const cur = found.get(sig.name);
    if (cur) {
      if (!cur.version && version) cur.version = version;
      return;
    }
    found.set(sig.name, { name: sig.name, category: sig.cat, version, evidence });
  };
  const headers = ev.home?.headers || {};
  const html = (ev.rawHtml || '').slice(0, 600_000);
  const generator = ev.html?.metas?.generator || '';
  const cookieNames = (ev.home?.setCookies || []).map((c) => c.split('=')[0].trim());
  const scriptSrcs = (ev.html?.scripts || []).map((s) => s.src).join(' ');
  const bundles = (ev.scripts || []).map((s) => s.body || '').join('\n').slice(0, 6_000_000);
  for (const sig of SIGS) {
    if (sig.header) {
      for (const [h, re] of Object.entries(sig.header)) {
        const v = headers[h];
        if (v && re.test(v)) add(sig, `header ${h}: ${v.slice(0, 60)}`, VERSIONED(v.match(re)));
      }
    }
    if (sig.meta && generator && sig.meta.test(generator)) add(sig, `generator: ${generator.slice(0, 60)}`, VERSIONED(generator.match(sig.meta)));
    if (sig.cookie && cookieNames.some((c) => sig.cookie.test(c))) add(sig, `cookie ${cookieNames.find((c) => sig.cookie.test(c))}`);
    if (sig.html && sig.html.test(html)) add(sig, 'page markup', VERSIONED(html.match(sig.html)));
    if (sig.script && sig.script.test(scriptSrcs)) add(sig, 'script URL', VERSIONED(scriptSrcs.match(sig.script)));
    if (sig.bundle && bundles && sig.bundle.test(bundles)) add(sig, 'first-party JavaScript', VERSIONED(bundles.match(sig.bundle)));
  }
  if (ev.html?.clientRendered) found.set('Client-side rendering', { name: 'Client-side rendering', category: 'Rendering', version: null, evidence: `HTML body has ${ev.html.wordCount} words and an empty app root` });
  return [...found.values()];
}

export function stackSummary(tech) {
  const order = ['CMS', 'E-commerce', 'Site builder', 'Framework', 'JS library', 'Build tool', 'Rendering', 'Backend', 'Web server', 'Hosting', 'CDN'];
  return tech
    .filter((t) => order.includes(t.category))
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
    .map((t) => (t.version ? `${t.name} ${t.version}` : t.name))
    .join(', ');
}
