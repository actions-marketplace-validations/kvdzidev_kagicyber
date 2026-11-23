/** Reference lists used by the checks (trackers, consent platforms, embeds, form processors, CAPTCHA markers). */

export const TRACKERS = [
  { host: 'googletagmanager.com', name: 'Google Tag Manager / gtag.js' },
  { host: 'google-analytics.com', name: 'Google Analytics' },
  { host: 'analytics.google.com', name: 'Google Analytics' },
  { host: 'doubleclick.net', name: 'Google Ads / DoubleClick' },
  { host: 'googleadservices.com', name: 'Google Ads conversion' },
  { host: 'googlesyndication.com', name: 'Google AdSense' },
  { host: 'connect.facebook.net', name: 'Meta Pixel' },
  { host: 'facebook.com/tr', name: 'Meta Pixel' },
  { host: 'snap.licdn.com', name: 'LinkedIn Insight Tag' },
  { host: 'px.ads.linkedin.com', name: 'LinkedIn Insight Tag' },
  { host: 'analytics.tiktok.com', name: 'TikTok Pixel' },
  { host: 'static.hotjar.com', name: 'Hotjar' },
  { host: 'script.hotjar.com', name: 'Hotjar' },
  { host: 'clarity.ms', name: 'Microsoft Clarity' },
  { host: 'bat.bing.com', name: 'Microsoft Ads (UET)' },
  { host: 'cdn.segment.com', name: 'Segment' },
  { host: 'cdn.mxpnl.com', name: 'Mixpanel' },
  { host: 'api-js.mixpanel.com', name: 'Mixpanel' },
  { host: 'cdn.amplitude.com', name: 'Amplitude' },
  { host: 'posthog.com', name: 'PostHog' },
  { host: 'static.ads-twitter.com', name: 'X (Twitter) Pixel' },
  { host: 'ct.pinterest.com', name: 'Pinterest Tag' },
  { host: 's.pinimg.com', name: 'Pinterest Tag' },
  { host: 'sc-static.net', name: 'Snap Pixel' },
  { host: 'js.hs-scripts.com', name: 'HubSpot tracking' },
  { host: 'js.hs-analytics.net', name: 'HubSpot tracking' },
  { host: 'mc.yandex.ru', name: 'Yandex Metrica' },
  { host: 'cdn.heapanalytics.com', name: 'Heap' },
  { host: 'fullstory.com', name: 'FullStory session replay' },
  { host: 'cdn.logrocket.io', name: 'LogRocket session replay' },
  { host: 'smartlook.com', name: 'Smartlook session replay' },
  { host: 'criteo.com', name: 'Criteo' },
  { host: 'taboola.com', name: 'Taboola' },
  { host: 'outbrain.com', name: 'Outbrain' },
];

/** Cookie-less / privacy-first analytics: reported as info, not as consent problems. */
export const PRIVACY_FRIENDLY_ANALYTICS = ['plausible.io', 'usefathom.com', 'cdn.usefathom.com', 'simpleanalyticscdn.com', 'umami.is', 'cloud.umami.is', 'pirsch.io'];

export const TRACKER_COOKIES = [
  /^_ga($|_)/, /^_gid$/, /^_gat/, /^_gcl_/, /^_fbp$/, /^_fbc$/, /^fr$/, /^_hj/, /^_clck$/, /^_clsk$/, /^MUID$/,
  /^_uet(sid|vid)$/, /^li_sugr$/, /^bcookie$/, /^_tt_enable_cookie$/, /^_ttp$/, /^IDE$/, /^test_cookie$/, /^_pin_unauth$/,
  /^ajs_(anonymous|user)_id$/, /^mp_.*_mixpanel$/, /^ph_.*_posthog$/, /^hubspotutk$/, /^__hs(tc|sc|src)$/, /^_ym_/, /^_scid/, /^_rdt_uuid$/,
];

export const CMPS = [
  { id: 'cookiebot', name: 'Cookiebot', markers: ['consent.cookiebot.com', 'cookiebot.com/uc.js', 'CookieConsent.'] },
  { id: 'onetrust', name: 'OneTrust', markers: ['cdn.cookielaw.org', 'otSDKStub', 'optanon'] },
  { id: 'usercentrics', name: 'Usercentrics', markers: ['usercentrics.eu', 'usercentrics'] },
  { id: 'didomi', name: 'Didomi', markers: ['sdk.privacy-center.org', 'didomi'] },
  { id: 'cookieyes', name: 'CookieYes', markers: ['cdn-cookieyes.com', 'cookie-law-info', 'cookieyes'] },
  { id: 'iubenda', name: 'iubenda', markers: ['cdn.iubenda.com', 'iubenda'] },
  { id: 'complianz', name: 'Complianz', markers: ['cmplz', 'complianz'] },
  { id: 'klaro', name: 'Klaro', markers: ['klaro.js', 'klaro.min.js', 'klaroConfig'] },
  { id: 'osano', name: 'Osano', markers: ['cmp.osano.com'] },
  { id: 'trustarc', name: 'TrustArc', markers: ['consent.trustarc.com', 'truste.com'] },
  { id: 'cookiefirst', name: 'CookieFirst', markers: ['consent.cookiefirst.com', 'cookiefirst'] },
  { id: 'termly', name: 'Termly', markers: ['app.termly.io'] },
  { id: 'quantcast', name: 'Quantcast Choice', markers: ['quantcast.mgr.consensu.org', 'cmp.quantcast.com'] },
  { id: 'borlabs', name: 'Borlabs Cookie', markers: ['borlabs-cookie', 'BorlabsCookie'] },
  { id: 'cookieconsent', name: 'CookieConsent (open source)', markers: ['cookieconsent.min.js', 'cookieconsent.umd', 'CookieConsent.run', 'cc_cookie'] },
  { id: 'tarteaucitron', name: 'tarteaucitron', markers: ['tarteaucitron'] },
  { id: 'axeptio', name: 'Axeptio', markers: ['axept.io', 'axeptio'] },
  { id: 'cookie-notice', name: 'Cookie Notice (WP)', markers: ['cookie-notice-front', 'cn-cookie-notice'] },
  { id: 'consentmanager', name: 'consentmanager', markers: ['consentmanager.net'] },
];

export const EMBEDS = [
  { re: /google\.[a-z.]+\/maps|maps\.google\./i, name: 'Google Maps' },
  { re: /youtube(-nocookie)?\.com\/embed|youtube\.com\/watch/i, name: 'YouTube' },
  { re: /player\.vimeo\.com/i, name: 'Vimeo' },
  { re: /open\.spotify\.com\/embed/i, name: 'Spotify' },
  { re: /calendly\.com/i, name: 'Calendly' },
  { re: /instagram\.com\/p\/|instagram\.com\/embed/i, name: 'Instagram' },
  { re: /facebook\.com\/plugins/i, name: 'Facebook plugin' },
  { re: /twitter\.com\/|platform\.twitter\.com/i, name: 'X (Twitter) embed' },
];

export const FORM_PROCESSORS = [
  { re: /formsubmit\.co/i, name: 'FormSubmit' },
  { re: /formspree\.io/i, name: 'Formspree' },
  { re: /api\.emailjs\.com|emailjs/i, name: 'EmailJS' },
  { re: /getform\.io/i, name: 'Getform' },
  { re: /usebasin\.com/i, name: 'Basin' },
  { re: /web3forms\.com/i, name: 'Web3Forms' },
  { re: /hsforms\.(com|net)|forms\.hubspot\.com/i, name: 'HubSpot Forms' },
  { re: /typeform\.com/i, name: 'Typeform' },
  { re: /formcarry\.com/i, name: 'Formcarry' },
  { re: /docs\.google\.com\/forms/i, name: 'Google Forms' },
];

export const CAPTCHA_MARKERS = ['g-recaptcha', 'recaptcha/api.js', 'grecaptcha', 'hcaptcha', 'h-captcha', 'turnstile', 'cf-turnstile', 'friendlycaptcha', 'frc-captcha', 'altcha', 'honeypot', '_gotcha', 'bot-field', 'botcheck', 'nie wypełniaj tego pola', 'leave this field empty', 'do not fill this field', 'bitte leer lassen', 'ne pas remplir'];

/** Multilingual link keywords for legal pages (link text or URL). */
export const LEGAL_KEYWORDS = {
  privacy: [
    'privacy', 'privacidad', 'privacidade', 'prywatno', 'prywatnosc', 'datenschutz', 'confidentialit', 'riservatezza', 'privacybeleid',
    'integritet', 'ochrana-osobnich', 'ochrana osobních', 'adatvédelm', 'adatvedelm', 'gdpr', 'rodo', 'données personnelles', 'tietosuoja',
    'privatliv', 'personvern', 'konfidencialit', 'kvkk', 'aydınlatma', 'プライバシー', '개인정보', '隐私', '隱私', 'политика конфиденциальности',
  ],
  cookies: ['cookie', 'ciasteczk', 'galletas', 'témoins'],
  terms: [
    'terms', 'regulamin', 'agb', 'cgv', 'cgu', 'conditions générales', 'términos', 'termos', 'condizioni', 'voorwaarden', 'nutzungsbedingungen',
    'obchodní podmínky', 'villkor', 'vilkår', 'ehdot', 'şartlar', '利用規約', '이용약관', '条款',
  ],
  imprint: [
    'impressum', 'imprint', 'legal notice', 'mentions légales', 'mentions legales', 'aviso legal', 'note legali', 'colofon', 'colophon',
    'dane firmy', 'informacje prawne', 'nota legal', 'tirage', '特定商取引', 'aviso-legal', 'mentions-legales',
  ],
  contact: ['contact', 'kontakt', 'contacto', 'contatti', 'contato', 'お問い合わせ', '연락', '联系'],
  accessibility: ['accessibility', 'dostępność', 'dostepnosc', 'barrierefreiheit', 'accessibilité', 'accesibilidad', 'accessibilità', 'toegankelijkheid'],
  returns: ['returns', 'zwrot', 'odstąpienie', 'widerruf', 'rétractation', 'devoluciones', 'recesso', 'herroeping', 'refund'],
};

export const COMMON_LEGAL_PATHS = {
  privacy: ['/privacy', '/privacy-policy', '/polityka-prywatnosci', '/datenschutz'],
};

export const LIB_BANNERS = [
  { re: /jQuery v?(\d+)\.(\d+)\.(\d+)/, name: 'jQuery', eol: (a, b) => a < 3 || (a === 3 && b < 5), note: 'jQuery < 3.5 has known XSS issues (CVE-2020-11022/11023).' },
  { re: /AngularJS v1\.(\d+)\.(\d+)/, name: 'AngularJS 1.x', eol: () => true, note: 'AngularJS reached end of life on 31 Dec 2021.' },
  { re: /Bootstrap v(\d+)\.(\d+)\.(\d+)/, name: 'Bootstrap', eol: (a) => a < 4, note: 'Bootstrap 3 is end of life.' },
  { re: /Vue\.js v2\.(\d+)\.(\d+)/, name: 'Vue 2', eol: () => true, note: 'Vue 2 reached end of life on 31 Dec 2023.' },
  { re: /Lodash <https:\/\/lodash\.com\/>[\s\S]{0,80}?(\d+)\.(\d+)\.(\d+)/, name: 'lodash', eol: (a, b, c) => a < 4 || (a === 4 && (b < 17 || (b === 17 && c < 21))), note: 'lodash < 4.17.21 has known prototype-pollution issues.' },
  { re: /moment\.js[\s\S]{0,40}?version\s*:\s*(\d+)\.(\d+)\.(\d+)/i, name: 'Moment.js', eol: () => true, note: 'Moment.js is in maintenance mode; prefer a maintained library.' },
];

/** Hosts known to have been compromised; any script from them is High. */
export const COMPROMISED_HOSTS = ['polyfill.io', 'cdn.polyfill.io', 'bootcdn.net', 'bootcss.com', 'staticfile.net', 'polyfillcdn.com'];
