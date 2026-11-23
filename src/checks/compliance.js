import { TRACKERS, PRIVACY_FRIENDLY_ANALYTICS, TRACKER_COOKIES, CMPS, EMBEDS, FORM_PROCESSORS } from '../knowledge.js';
import { parseSetCookie } from './security.js';
import { safeUrl, uniq, truncate } from '../util.js';

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const MOJIBAKE = /Ä[…\u0085\u0099\u0087\u008d]|Å[›¼‚ºž›„]|Ã[©¡³¼¶¤±§ª]|â€[™œ“”\u009d\u0093\u0094]|Ĺ[›‚ş]|Ä‡|Ä™/g;
const rx = (s) => new RegExp(s, 'iu');

const ACCEPT = /\b(accept all|accept cookies|allow all|zaakceptuj|akceptuj|akceptuję|zgadzam się|alle akzeptieren|akzeptieren|tout accepter|j'accepte|aceptar|accetta|alles accepteren)/giu;
const REJECT = /(reject|decline|deny|only necessary|necessary only|essential only|odrzuć|odrzucam|tylko niezbędne|tylko wymagane|ablehnen|nur notwendige|refuser|continuer sans accepter|rechazar|rifiuta|weigeren)/iu;
const REVIEWS = /\b(opinie|opinia klient|testimonials?|customer reviews|reviews|recenzje|bewertungen|kundenstimmen|avis clients|témoignages|reseñas|testimonios|recensioni|referenzen)\b/iu;
const PLACEHOLDER_NEAR_REVIEWS = /(poglądow\w*|do podmiany|lorem ipsum|placeholder (reviews?|testimonials?)|(reviews?|testimonials?) placeholder|sample (reviews?|testimonials?)|dummy (reviews?|testimonials?)|przykładow\w* opini\w*|beispielbewertung)/iu;
const REVIEW_VERIFIED = /(weryfik|zweryfik|verified|verifiziert|geprüft|vérifié|verificad|verificat|geverifieerd)/iu;
const AI_DISCLOSURE = /(you are (chatting|talking) (with|to) (an )?(ai|artificial|bot|virtual)|rozmawiasz z (ai|botem|asystentem)|sztuczn\w+ inteligencj|ki-assistent|assistant virtuel|asistente virtual|assistente virtuale|ai assistant)/iu;
const ANON_GA = /(anonimow\w*|anonymous|anonymi\w*|anonyme\w*|anónim\w*|anonim\w*)\s+(statystyk\w*|statistic\w*|statistik\w*|statistiques|estadístic\w*|statistich\w*|dane|data)/iu;

export const ADDRESS = rx(
  [
    // street keyword first: "ul. Przykładowa 1", "Rue de Rivoli 5", "Via Roma 10"
    "(\\b(ul\\.|ulica|al\\.|aleja|plac|os\\.|straße|strasse|str\\.|weg|gasse|platz|rue|avenue|bd|boulevard|via|viale|piazza|calle|avda\\.?|carrer|rua|street|st\\.|road|rd\\.|lane|avenue|ave\\.|drive|laan|straat|plein|vej|gatan|gade)\\s+[\\p{Lu}0-9][\\p{L}.' -]{1,40}?\\s\\d{1,4}[a-zA-Z]?\\b)",
    // compound street names: "Hauptstraße 5", "Kirchgasse 12a", "Dorfstr. 3", "Keizersgracht 123"
    "(\\b\\p{Lu}[\\p{L}-]{2,30}(straße|strasse|str\\.|gasse|weg|platz|allee|ring|damm|straat|gracht|laan|vej|gatan|gade)\\s?\\d{1,4}[a-zA-Z]?\\b)",
    // number first: "5 Rue de Rivoli", "12 Main Street", "1600 Amphitheatre Parkway"
    "(\\b\\d{1,5}[a-zA-Z]?,?\\s+([\\p{Lu}][\\p{L}'.-]+\\s+){0,4}(rue|avenue|boulevard|street|st\\.?|road|rd\\.?|lane|ln\\.?|drive|dr\\.?|way|parkway|place|square|court|ct\\.?)\\b)",
    // postcodes: PL 00-950, DE/FR/IT/ES 5 digits + town, UK, NL, US state + ZIP
    "(\\b\\d{2}-\\d{3}\\s+[\\p{Lu}][\\p{Ll}]{2,})",
    "(\\b\\d{5}\\s+\\p{Lu}\\p{Ll}{2,})",
    "(\\b[A-Z]{1,2}\\d[A-Z\\d]?\\s\\d[A-Z]{2}\\b)",
    "(\\b\\d{4}\\s?[A-Z]{2}\\s+[\\p{Lu}][\\p{Ll}]+)",
    "(\\b[A-Z]{2}\\s\\d{5}(-\\d{4})?\\b)",
  ].join('|')
);
export const REG_ID = rx(
  '\\b(NIP|KRS|REGON|CEIDG|VAT(?:\\s?(?:ID|No\\.?|number|reg\\.?))?|USt-?Id(?:Nr)?|HRB|HRA|SIRE[NT]|RCS|P\\.?\\s?IVA|Partita IVA|CIF|NIF|NIPC|KvK|CVR|IČO|DIČ|UID|ABN|CNPJ|Company (?:No\\.?|number)|Registered (?:in|number)|Handelsregister|Firmenbuch|FN)\\b[\\s:#.]*[A-Z]{0,3}\\s?\\d[\\d\\s.-]{4,}'
);

export const PRIVACY_GROUPS = [
  ['controller identity', 'controller|administrator(em)? (danych|jest)|administratorem|verantwortlich|responsable du traitement|titular del tratamiento|titolare del trattamento|verwerkingsverantwoordelijke|responsável pelo tratamento'],
  ['purposes', 'purpose|cel(u|ach|em|e)? przetwarzania|w celu|cele i podstawy|zweck|finalit|propósito|finalidad|\\bdoel|finalidade'],
  ['legal basis', 'legal basis|lawful basis|podstaw(a|ą|ie|y) (prawn|przetwarzania)|art\\.? ?6|rechtsgrundlage|base (légale|juridique)|base jurídica|base giuridica|rechtsgrond|base legal'],
  ['retention', 'retention|retain|stored for|kept for|przechowyw|przechowuj|okres przechowywania|speicherdauer|aufbewahr|gespeichert|durée de conservation|conserv|plazo de conservación|periodo di conservazione|bewaartermijn|bewaren|prazo de conservação'],
  ['data-subject rights', '(right|prawo) (of |to |do )?(access|dostępu)|auskunft|droit d.accès|derecho de acceso|diritto di accesso|recht op inzage|direito de acesso|right to erasure|prawo do usunięcia'],
  ['complaint to a supervisory authority', 'supervisory authority|\\bUODO\\b|PUODO|Urzęd(u|em) Ochrony Danych|skarg|aufsichtsbehörde|beschwerde|\\bCNIL\\b|réclamation|\\bAEPD\\b|reclamación|\\bGarante\\b|reclamo|Autoriteit Persoonsgegevens|\\bICO\\b|complaint'],
  ['recipients', 'recipient|odbiorc|podmiot(y|om) przetwarzaj|powierz|empfänger|auftragsverarbeit|destinataire|destinatario|ontvanger|destinatários|processor'],
];

/** Inventory of trackers, consent managers, embeds and banners visible in markup and first-party JS. */
export function inventory(ev, bundleText = '') {
  const html = ev.rawHtml || '';
  const h = ev.html;
  const trackers = [];
  const add = (t, where, gated) => {
    if (!trackers.some((x) => x.name === t.name)) trackers.push({ name: t.name, host: t.host, where, gated });
    else if (!gated) trackers.find((x) => x.name === t.name).gated = false;
  };
  for (const s of h.scripts) {
    const t = TRACKERS.find((x) => s.src.includes(x.host));
    if (t) add(t, truncate(s.src, 100), s.gated);
  }
  for (const s of h.inlineScripts) {
    for (const t of TRACKERS) if (s.code.includes(t.host)) add(t, 'inline script', s.gated);
    if (/fbq\(\s*['"]init/.test(s.code)) add({ name: 'Meta Pixel', host: 'connect.facebook.net' }, 'inline script', s.gated);
    if (/gtag\(\s*['"]config['"]\s*,\s*['"](G-|UA-|AW-)/.test(s.code)) add({ name: 'Google Analytics', host: 'google-analytics.com' }, 'inline gtag config', s.gated);
  }
  for (const i of h.iframes) {
    const t = TRACKERS.find((x) => i.src.includes(x.host));
    if (t) add(t, truncate(i.src, 100), i.deferred);
  }
  const rawBundles = (ev.scripts || []).map((s) => s.body || '').join('\n');
  const dynamicTrackers = TRACKERS.filter((t) => rawBundles.includes(t.host) && !trackers.some((x) => x.name === t.name)).map((t) => t.name);
  const privacyFriendly = uniq(h.scripts.map((s) => safeUrl(s.src)?.hostname).filter((x) => x && PRIVACY_FRIENDLY_ANALYTICS.some((p) => x.endsWith(p))));
  // Consent platforms are recognised from markup and code only (tags, attributes, script code),
  // never from visible text: a blog post that mentions "Usercentrics" is not a consent banner.
  const markup = `${html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (s) => s.slice(0, s.indexOf('>') + 1)).replace(/>[^<]*</g, '><')}\n${h.inlineScripts.map((s) => s.code).join('\n')}`.toLowerCase();
  const cmps = CMPS.filter((c) => c.markers.some((m) => markup.includes(m.toLowerCase()) || rawBundles.includes(m)));
  const consentModeDenied = /gtag\(\s*['"`]consent['"`]\s*,\s*['"`]default['"`][\s\S]{0,300}?denied/.test(html + rawBundles.slice(0, 2_000_000));
  const embeds = [];
  for (const i of h.iframes) {
    const e = EMBEDS.find((x) => x.re.test(i.src));
    if (e) embeds.push({ name: e.name, src: truncate(i.src, 100), deferred: i.deferred });
  }
  const googleFonts = h.styles.some((s) => /fonts\.googleapis\.com/.test(s.href)) || /fonts\.googleapis\.com/.test(html);
  const processors = uniq(h.forms.map((f) => FORM_PROCESSORS.find((p) => p.re.test(f.action))?.name).filter(Boolean));
  for (const p of FORM_PROCESSORS) if (p.re.test(rawBundles) && !processors.includes(p.name)) processors.push(p.name);
  const firstResponseCookies = (ev.home.setCookies || []).map(parseSetCookie);
  const trackerCookies = firstResponseCookies.filter((c) => TRACKER_COOKIES.some((re) => re.test(c.name)));
  const customBanner = findBanner(`${ev.html.text}\n${bundleText}`);
  return { trackers, dynamicTrackers, privacyFriendly, cmps, consentModeDenied, embeds, googleFonts, processors, firstResponseCookies, trackerCookies, customBanner };
}

function findBanner(text) {
  for (const m of text.matchAll(ACCEPT)) {
    const win = text.slice(Math.max(0, m.index - 900), m.index + 900);
    if (!/cookie|ciasteczk|zgod|consent|datenschutz/i.test(win)) continue;
    const r = win.match(REJECT);
    return { accept: m[0], reject: r ? r[0] : null };
  }
  return null;
}

/** Human-readable string literals from first-party bundles (for client-rendered sites). */
export function bundleStrings(scripts, cap = 600_000) {
  const out = [];
  let size = 0;
  for (const s of scripts || []) {
    if (!s.body) continue;
    for (const m of s.body.matchAll(/(["'`])((?:\\.|(?!\1)[^\\\n]){12,1500}?)\1/g)) {
      const v = m[2];
      if (!/\s/.test(v) || !/\p{L}{3,}/u.test(v) || /^[\w.-]+\/[\w./-]+$/.test(v) || /[{};]\s*$/.test(v)) continue;
      out.push(v);
      size += v.length;
      if (size > cap) return out.join('\n');
    }
  }
  return out.join('\n');
}

function check(id, key, title, weight, status, evidence, basis, fix) {
  return { id, key, title, weight, status, evidence, basis, fix };
}

/** Site type hints used to pick the site-type checklists. */
export function siteTypes(ev) {
  const text = `${ev.html.text} ${ev.html.links.map((l) => `${l.text} ${l.href}`).join(' ')}`.toLowerCase();
  const markup = (ev.rawHtml || '').slice(0, 400000).toLowerCase();
  const types = [];
  const shop =
    /add[- ]to[- ]cart|do koszyka|dodaj do koszyka|in den warenkorb|ajouter au panier|añadir al carrito|aggiungi al carrello|\/checkout\b|\/cart\b|\/koszyk\b|\/warenkorb\b/.test(text) ||
    /cdn\.shopify\.com|woocommerce|prestashop|mage\/|magento|"@type"\s*:\s*"product"/.test(markup);
  if (shop) types.push('shop');
  if (/sign ?up|log ?in\b|zaloguj|załóż konto|zarejestruj się|registrieren|anmelden|s'inscrire|crear cuenta|free trial|start trial|\/pricing\b|app\.[a-z0-9-]+\.[a-z]{2,}|\/dashboard\b/.test(text)) types.push('saas');
  const fin = ['\\bapr\\b', 'rrso', '\\btaeg\\b', 'loan', 'kredyt', 'pożyczk', 'darlehen', 'préstamo', 'investing', 'crypto', 'kryptowalut', 'brokerage', 'insurance', 'ubezpiecz', 'leasing'].filter((w) => new RegExp(w).test(text));
  if (fin.length >= 2) types.push('fintech');
  return types.length ? types : ['company'];
}

/**
 * Core EU compliance checks (C-01 to C-14). Country rules, the extended EU checklist and
 * site-type checklists run afterwards in src/law and fold their national legal basis into these rows.
 */
export function runComplianceChecks(ev, types, { tech = [] } = {}) {
  const bundleText = ev.bundleText || '';
  const inv = inventory(ev, bundleText);
  const b = ev.browser?.ran ? ev.browser : null;
  const spa = ev.html.clientRendered;
  const out = [];
  const rendered = Object.fromEntries((ev.renderedPages || []).map((p) => [p.url, p.text]));
  const textOfPage = (p) => (p ? rendered[p.url] || p.text || '' : '');
  const pages = Object.fromEntries(ev.pages.map((p) => [p.kind, p]));
  const privacy = pages.privacy;
  let privacyText = textOfPage(privacy);
  let privacySource = rendered[privacy?.url] ? 'rendered page' : 'page HTML';
  if (privacy && privacyText.length < 600 && spa && bundleText) {
    privacyText = bundleText;
    privacySource = 'JavaScript bundles (page is rendered client-side)';
  }
  const legalText = ev.pages.map(textOfPage).join('\n');
  const allText = `${ev.html.text}\n${legalText}\n${spa ? bundleText : ''}`;
  const jsonLd = (ev.html.jsonLd || []).join('\n');

  // C-01 operator identity
  {
    const hasEmail = /[\w.+-]+@[\w-]+\.(?!(png|jpe?g|gif|webp|svg|avif)\b)[a-z][\w.]{1,}/i.test(allText) ||ev.html.links.some((l) => l.mailto) || /"email"\s*:/.test(jsonLd);
    const addr = allText.match(ADDRESS) || jsonLd.match(/"streetAddress"\s*:\s*"([^"]{4,})"/);
    const id = allText.match(REG_ID);
    const imprint = pages.imprint || ev.linksByKind?.imprint?.[0];
    const found = [id && `registration/tax ID ("${truncate(id[0], 28)}")`, addr && `address ("${truncate(addr[0], 40)}")`, hasEmail && 'e-mail'].filter(Boolean);
    const missing = [!addr && 'a geographic address', !id && 'a registration or VAT number', !hasEmail && 'an e-mail address'].filter(Boolean);
    const where = imprint ? ` Legal notice: ${truncate(imprint.url || imprint.href, 60)}.` : '';
    const status = !missing.length ? 'pass' : !addr && !id ? 'fail' : 'partial';
    out.push(check('C-01', 'operator-identity', 'Operator identity: geographic address, registration/VAT number, e-mail', 3, status, `${found.length ? `Found: ${found.join(', ')}.` : 'No operator details found.'}${missing.length ? ` Missing: ${missing.join(', ')}.` : ''}${where}`, 'Directive 2000/31/EC art. 5; national e-commerce law (e.g. art. 5 UŚUDE, § 5 DDG)', 'Publish the full business name as registered, a street address, the registration and VAT numbers and an e-mail address in the footer or on a legal-notice page.'));
  }

  // C-02 privacy policy linked
  out.push(
    privacy && !privacy.guessed
      ? check('C-02', 'privacy-linked', 'Privacy policy linked from the homepage', 3, 'pass', `Link "${truncate(privacy.linkText, 40)}" to ${privacy.url}`, 'GDPR art. 12-13', '')
      : privacy?.guessed
        ? check('C-02', 'privacy-linked', 'Privacy policy linked from the homepage', 3, 'partial', `Found at ${privacy.url} but not linked from the homepage.`, 'GDPR art. 12-13', 'Link the privacy policy in the footer of every page.')
        : check('C-02', 'privacy-linked', 'Privacy policy linked from the homepage', 3, 'fail', 'No privacy policy link found on the homepage.', 'GDPR art. 12-13', 'Publish a privacy policy and link it in the footer of every page.')
  );

  // C-03 privacy policy readable
  {
    const title = 'Privacy policy loads and is readable';
    if (!privacy) out.push(check('C-03', 'privacy-readable', title, 3, 'fail', 'No privacy policy to read.', 'GDPR art. 12(1)', 'Publish the policy as a normal, readable page.'));
    else if (privacy.sameAs) out.push(check('C-03', 'privacy-readable', title, 3, 'manual', 'Shares a URL with another legal page; read it manually.', 'GDPR art. 12(1)', ''));
    else {
      const own = textOfPage(privacy);
      const moj = (own.match(MOJIBAKE) || []).length;
      if (!privacy.status) out.push(check('C-03', 'privacy-readable', title, 3, 'manual', `${privacy.url} could not be fetched (${privacy.error || 'no response'}); check it manually.`, 'GDPR art. 12(1)', ''));
      else if (privacy.status !== 200) out.push(check('C-03', 'privacy-readable', title, 3, 'fail', `${privacy.url} returned HTTP ${privacy.status}.`, 'GDPR art. 12(1)', 'Fix the link or the page.'));
      else if (moj >= 3) out.push(check('C-03', 'privacy-readable', title, 3, 'fail', `Broken character encoding (${moj} garbled sequences such as "${(own.match(MOJIBAKE) || [''])[0]}").`, 'GDPR art. 12(1): clear and plain language', 'Save the file as UTF-8 and send Content-Type: text/html; charset=utf-8.'));
      else if (own.length < 600 && spa) out.push(check('C-03', 'privacy-readable', title, 3, 'partial', 'HTTP 200, but the text is rendered by JavaScript (empty HTML). Visitors see it; crawlers and archive tools may not.', 'GDPR art. 12(1)', 'Pre-render or server-render legal pages so the text is in the HTML.'));
      else if (own.length < 600) out.push(check('C-03', 'privacy-readable', title, 3, 'partial', `Only ${own.length} characters of text.`, 'GDPR art. 12(1)', 'Serve the full policy as HTML text.'));
      else out.push(check('C-03', 'privacy-readable', title, 3, 'pass', `${own.length.toLocaleString('en')} characters, HTTP 200, clean encoding.`, 'GDPR art. 12(1)', ''));
    }
  }

  // C-04 privacy policy content
  {
    const title = 'Privacy policy covers the core GDPR art. 13 information';
    if (!privacy) out.push(check('C-04', 'privacy-content', title, 3, 'fail', 'No privacy policy.', 'GDPR art. 13', 'Publish a privacy policy with the art. 13 information.'));
    else if (!privacy.sameAs && !privacy.status) out.push(check('C-04', 'privacy-content', title, 3, 'manual', `${privacy.url} could not be fetched (${privacy.error || 'no response'}).`, 'GDPR art. 13', ''));
    else if (!privacy.sameAs && privacy.status !== 200 && !rendered[privacy.url]) out.push(check('C-04', 'privacy-content', title, 3, 'fail', `${privacy.url} returned HTTP ${privacy.status}, so the policy cannot be read.`, 'GDPR art. 13', 'Fix the link or the page, then make sure it contains the art. 13 information.'));
    else if (privacyText.length < 300) out.push(check('C-04', 'privacy-content', title, 3, 'manual', 'Policy text could not be read (rendered by JavaScript). Run with --browser.', 'GDPR art. 13', ''));
    else {
      const found = [];
      const missing = [];
      for (const [label, p] of PRIVACY_GROUPS) (rx(p).test(privacyText) ? found : missing).push(label);
      const processorsNotNamed = inv.processors.filter((p) => !privacyText.toLowerCase().includes(p.toLowerCase().split(' ')[0]));
      const status = found.length >= 7 ? 'pass' : found.length >= 4 ? 'partial' : 'fail';
      const note = processorsNotNamed.length ? ` Not named: ${processorsNotNamed.join(', ')}.` : '';
      out.push(check('C-04', 'privacy-content', title, 3, processorsNotNamed.length && status === 'pass' ? 'partial' : status, `${found.length}/${PRIVACY_GROUPS.length} elements found (source: ${privacySource})${missing.length ? `; missing: ${missing.join(', ')}` : ''}.${note}`, 'GDPR art. 13(1)-(2)', 'Name the controller with address, each purpose with its legal basis (and the legitimate interest where used), recipients (incl. hosting, form and analytics providers), transfers outside the EEA with the safeguard, retention, all rights and the right to complain to the supervisory authority.'));
    }
  }

  // C-05 forms
  {
    const title = 'Forms explain how data is used (notice at collection)';
    const dataForms = ev.html.forms.filter((f) => f.hasEmail || /textarea|tel|name/i.test(f.innerHtml || ''));
    const unlisted = inv.processors.filter((p) => privacyText && !privacyText.toLowerCase().includes(p.toLowerCase().split(' ')[0]));
    if (!dataForms.length && !inv.processors.length) out.push(check('C-05', 'form-notice', title, 2, 'na', 'No data-collection forms found.', 'GDPR art. 13', ''));
    else if (!dataForms.length) {
      out.push(
        unlisted.length
          ? check('C-05', 'form-notice', title, 2, 'partial', `Form rendered by JavaScript sends data to ${inv.processors.join(', ')}, which the privacy policy does not name.`, 'GDPR art. 13, art. 28', 'Name the form processor as a recipient in the privacy policy and add a one-line notice with a privacy-policy link under the form.')
          : check('C-05', 'form-notice', title, 2, 'manual', `Form rendered by JavaScript (${inv.processors.join(', ')}); check that a privacy notice sits next to it.`, 'GDPR art. 13', 'Add a one-line notice with a privacy-policy link under the form.')
      );
    } else {
      const noNotice = dataForms.filter((f) => !/(privacy|prywatno|datenschutz|confidentialit|privacidad|privacidade|riservatezza|rodo|gdpr|dsgvo)/i.test(`${f.innerText} ${f.innerHtml || ''}`));
      const issues = [];
      if (noNotice.length) issues.push(`${noNotice.length} form(s) without a privacy notice or link next to them`);
      if (unlisted.length) issues.push(`form processor ${unlisted.join(', ')} not named in the privacy policy`);
      out.push(
        issues.length
          ? check('C-05', 'form-notice', title, 2, 'partial', `${cap(issues.join('; '))}.`, 'GDPR art. 13, art. 28', 'Add a one-line notice with a privacy-policy link under each form; name third-party form processors in the policy.')
          : check('C-05', 'form-notice', title, 2, 'pass', `${dataForms.length} form(s) with a privacy notice.`, 'GDPR art. 13', '')
      );
    }
  }

  const htmlTrackers = inv.trackers;
  const nonEssential = htmlTrackers.length > 0 || inv.dynamicTrackers.length > 0 || inv.trackerCookies.length > 0 || inv.embeds.length > 0;
  const bannerKnown = inv.cmps.length > 0 || inv.customBanner;

  // C-06 consent mechanism
  {
    const title = 'Cookie consent with a reject option on the first layer';
    const basis = 'ePrivacy Directive art. 5(3); GDPR art. 7; EDPB Cookie Banner Taskforce (2023)';
    if (b) {
      if (!nonEssential && !b.trackerRequests.length && !b.trackerCookies.length) out.push(check('C-06', 'consent-mechanism', title, 3, 'na', 'No non-essential trackers or embeds detected.', basis, ''));
      else if (!b.banner.found) out.push(check('C-06', 'consent-mechanism', title, 3, 'fail', 'Trackers/embeds present but no consent banner was visible on load.', basis, 'Add a consent banner that blocks non-essential scripts until opt-in.'));
      else if (!b.banner.reject) out.push(check('C-06', 'consent-mechanism', title, 3, 'partial', `Banner found ("${truncate(b.banner.text, 60)}") but no reject option on the first layer.`, basis, 'Put "Reject all" next to "Accept all" with equal prominence.'));
      else out.push(check('C-06', 'consent-mechanism', title, 3, 'pass', `Real browser: banner offers "${truncate(b.banner.accept || 'accept', 30)}" and "${truncate(b.banner.reject, 30)}".`, basis, 'Check that both buttons have the same visual weight.'));
    } else if (!nonEssential) {
      out.push(check('C-06', 'consent-mechanism', title, 3, 'na', 'No non-essential trackers or embeds detected in the page or its scripts.', basis, ''));
    } else if (inv.cmps.length) {
      // A consent platform in the code does not show that its first layer offers Reject: that needs the browser.
      out.push(check('C-06', 'consent-mechanism', title, 3, 'manual', `${inv.cmps.map((c) => c.name).join(', ')} found in the site code. Whether the first layer offers a reject option was not verified: run with --browser or check the banner manually.`, basis, 'Make sure "Reject all" sits next to "Accept all" with equal prominence.'));
    } else if (inv.customBanner) {
      out.push(
        inv.customBanner.reject
          ? check('C-06', 'consent-mechanism', title, 3, 'pass', `Custom consent banner in the site code with "${inv.customBanner.accept}" and "${inv.customBanner.reject}". Run with --browser to confirm it shows.`, basis, 'Check that both buttons have the same visual weight.')
          : check('C-06', 'consent-mechanism', title, 3, 'partial', `Custom consent banner with "${inv.customBanner.accept}" but no reject wording found.`, basis, 'Add "Reject all" on the first layer.')
      );
    } else {
      out.push(check('C-06', 'consent-mechanism', title, 3, 'fail', `Trackers/embeds present (${[...htmlTrackers.map((t) => t.name), ...inv.dynamicTrackers, ...inv.embeds.map((e) => e.name)].slice(0, 4).join(', ')}) but no consent banner detected.`, basis, 'Add a consent banner that blocks non-essential scripts until opt-in.'));
    }
  }

  // C-07 trackers before consent
  {
    const title = 'No trackers load before consent';
    const basis = 'ePrivacy Directive art. 5(3); CJEU C-673/17 Planet49';
    if (b) {
      if (b.trackerRequests.length || b.trackerCookies.length) {
        const names = uniq([...b.trackerRequests.map((r) => r.name), ...b.trackerCookies.map((c) => c.name)]);
        out.push(check('C-07', 'trackers-before-consent', title, 3, 'fail', `Before any click: ${names.slice(0, 6).join(', ')} (${b.trackerRequests.length} tracker requests, ${b.trackerCookies.length} tracker cookies).`, basis, 'Block these scripts until the visitor opts in.'));
      } else out.push(check('C-07', 'trackers-before-consent', title, 3, 'pass', `Real browser load: ${b.requests} requests, none to trackers, no tracker cookies before interaction.`, basis, ''));
    } else {
      const ungated = htmlTrackers.filter((t) => !t.gated);
      const incomplete = ev.scriptsIncomplete;
      if (!htmlTrackers.length && !inv.dynamicTrackers.length && incomplete) out.push(check('C-07', 'trackers-before-consent', title, 3, 'manual', `No trackers in the page, but ${incomplete}, so trackers injected by JavaScript cannot be ruled out. Run with --browser.`, basis, ''));
      else if (!htmlTrackers.length && !inv.dynamicTrackers.length) out.push(check('C-07', 'trackers-before-consent', title, 3, 'pass', `No tracker scripts in the page or its ${ev.scripts.filter((s) => s.body).length} first-party scripts.`, basis, ''));
      else if (!htmlTrackers.length) out.push(check('C-07', 'trackers-before-consent', title, 3, 'manual', `${inv.dynamicTrackers.join(', ')} is injected by the site's JavaScript${bannerKnown ? ' and a consent banner exists' : ''}${inv.consentModeDenied ? '; Google Consent Mode defaults to denied' : ''}. Confirm with --browser that nothing loads before consent.`, basis, ''));
      else if (!ungated.length) out.push(check('C-07', 'trackers-before-consent', title, 3, 'pass', `${htmlTrackers.length} tracker(s), all consent-gated in the markup.`, basis, ''));
      else if (!bannerKnown) out.push(check('C-07', 'trackers-before-consent', title, 3, 'fail', `Loaded directly with no consent banner: ${ungated.map((t) => t.name).join(', ')}.`, basis, 'Load these only after opt-in.'));
      else out.push(check('C-07', 'trackers-before-consent', title, 3, 'partial', `Not gated in the markup: ${ungated.map((t) => t.name).join(', ')}${inv.consentModeDenied ? ' (Consent Mode default denied found)' : ''}. The banner may block them at runtime: run with --browser.`, basis, 'Gate these scripts until consent (type="text/plain" with a category, or CMP auto-blocking).'));
    }
  }

  // C-08 tracking cookies
  {
    const cookieSource = b ? b.trackerCookies : inv.trackerCookies;
    const title = 'No tracking cookies set before consent';
    if (cookieSource.length) out.push(check('C-08', 'tracking-cookies-first-response', title, 3, 'fail', `Set before consent: ${uniq(cookieSource.map((c) => c.name)).join(', ')}.`, 'ePrivacy Directive art. 5(3)', 'Set analytics/advertising cookies only after opt-in.'));
    // Without a browser only Set-Cookie headers are visible; with trackers or client rendering, JavaScript may still set cookies.
    else if (!b && (nonEssential || spa)) out.push(check('C-08', 'tracking-cookies-first-response', title, 3, 'manual', `${inv.firstResponseCookies.length} cookie(s) in the HTTP response, none used for tracking; the page ${spa ? 'is rendered by JavaScript' : 'loads trackers or embeds'}, which can set cookies from JavaScript. Run with --browser to verify.`, 'ePrivacy Directive art. 5(3)', ''));
    else out.push(check('C-08', 'tracking-cookies-first-response', title, 3, 'pass', b ? `Browser cookie jar after load: ${b.cookies.length} cookie(s), none used for tracking.` : `${inv.firstResponseCookies.length} cookie(s) in the HTTP response, none used for tracking (cookies set by JavaScript need --browser).`, 'ePrivacy Directive art. 5(3)', ''));
  }

  // C-09 cookie information
  {
    const title = 'Cookie information is available and accurate';
    const usesCookies = nonEssential || inv.firstResponseCookies.length || inv.dynamicTrackers.length;
    if (!usesCookies) out.push(check('C-09', 'cookie-info', title, 1, 'na', 'No cookies or trackers detected.', 'ePrivacy Directive art. 5(3)', ''));
    else {
      const hasInfo = pages.cookies || /cookie/i.test(privacyText);
      const anon = (inv.dynamicTrackers.concat(htmlTrackers.map((t) => t.name)).some((n) => /Google/.test(n)) && allText.match(ANON_GA)) || null;
      const issues = [];
      if (!hasInfo) issues.push('no cookie policy or cookie section found');
      if (!/_ga\b|_gid|lifetime|okres ważności|czas przechowywania|gültigkeit|durée de vie|duración/i.test(`${privacyText} ${textOfPage(pages.cookies)}`)) issues.push('no list of cookies with provider, purpose and lifetime');
      if (anon) issues.push(`Google Analytics described as "${truncate(anon[0], 40)}" although GA4 uses pseudonymous identifiers`);
      out.push(issues.length ? check('C-09', 'cookie-info', title, 1, 'partial', `${cap(issues.join('; '))}.`, 'ePrivacy Directive art. 5(3): clear and comprehensive information; GDPR art. 5(1)(a)', 'Add a cookie table (name, provider, purpose, lifetime) and describe analytics accurately.') : check('C-09', 'cookie-info', title, 1, 'pass', 'Cookie information found.', 'ePrivacy Directive art. 5(3)', ''));
    }
  }

  // C-10 embeds and fonts
  {
    const embedIssues = [];
    const liveEmbeds = inv.embeds.filter((e) => !e.deferred);
    if (liveEmbeds.length) embedIssues.push(`${uniq(liveEmbeds.map((e) => e.name)).join(', ')} embedded without click-to-load`);
    if (inv.googleFonts) embedIssues.push('Google Fonts loaded from fonts.googleapis.com (sends visitor IP addresses to Google)');
    out.push(
      embedIssues.length
        ? check('C-10', 'embeds-before-consent', 'Third-party embeds and fonts wait for consent', 2, 'partial', `${embedIssues.join('; ')}.`, 'GDPR art. 6, art. 44; LG München I, 3 O 17493/20 (2022)', 'Use click-to-load placeholders for maps and videos; self-host fonts.')
        : spa && !b
          ? check('C-10', 'embeds-before-consent', 'Third-party embeds and fonts wait for consent', 2, 'manual', 'No eager embeds or Google Fonts in the HTML, but the page is rendered by JavaScript. Run with --browser to verify.', 'GDPR art. 6', '')
          : check('C-10', 'embeds-before-consent', 'Third-party embeds and fonts wait for consent', 2, 'pass', 'No eager third-party embeds or Google Fonts.', 'GDPR art. 6', '')
    );
  }

  // C-11 terms
  {
    const terms = pages.terms || ev.linksByKind?.terms?.[0];
    const isShop = types.includes('shop') || types.includes('saas');
    const termsBroken = pages.terms && !pages.terms.sameAs && pages.terms.status && pages.terms.status !== 200;
    out.push(
      termsBroken
        ? check('C-11', 'terms-linked', 'Terms of service published', 2, 'partial', `Terms link ${truncate(pages.terms.url, 70)} returned HTTP ${pages.terms.status}.`, 'Directive 2011/83/EU art. 6; national e-services law (e.g. art. 8 UŚUDE)', 'Fix the terms link or the page.')
        : terms
        ? check('C-11', 'terms-linked', 'Terms of service published', 2, 'pass', `Terms link found (${truncate(terms.url || terms.href, 70)}).`, 'Directive 2011/83/EU art. 6; national e-services law (e.g. art. 8 UŚUDE)', '')
        : check('C-11', 'terms-linked', 'Terms of service published', 2, isShop ? 'fail' : 'partial', isShop ? 'Shop/app features detected but no terms link.' : 'No terms link found (required in some countries even for a contact form, e.g. Poland).', 'Directive 2011/83/EU art. 6; national e-services law', 'Publish terms and link them in the footer and before ordering or sign-up.')
    );
  }

  // C-12 reviews
  {
    const title = 'Reviews and testimonials: genuine and verification stated';
    const basis = 'Directive 2005/29/EC art. 7(6) and Annex I points 23b-23c (Omnibus)';
    const m = allText.match(REVIEWS) || bundleText.match(REVIEWS);
    if (!m) out.push(check('C-12', 'reviews', title, 2, 'na', 'No reviews or testimonials found.', basis, ''));
    else {
      const hay = `${allText}\n${bundleText}`;
      const idx = hay.search(REVIEWS);
      const near = hay.slice(Math.max(0, idx - 3000), idx + 3000);
      const placeholder = near.match(PLACEHOLDER_NEAR_REVIEWS) || bundleText.match(new RegExp(`(opinie|testimonials?|reviews?)[^\\n]{0,60}(${PLACEHOLDER_NEAR_REVIEWS.source})`, 'iu'));
      const verified = REVIEW_VERIFIED.test(hay);
      if (placeholder) out.push(check('C-12', 'reviews', title, 2, 'partial', `Testimonials are shown and the site code labels review content as placeholder ("${truncate(placeholder[0], 50)}"). Verify every testimonial is genuine: invented reviews presented as real are banned.`, basis, 'Show only testimonials you can document (client consent and source), remove placeholder content and state how reviews are verified.'));
      else if (!verified) out.push(check('C-12', 'reviews', title, 2, 'partial', `Reviews/testimonials section found ("${m[0]}") without a statement on whether and how they are verified.`, basis, 'State next to the reviews whether and how you check that they come from real clients.'));
      else out.push(check('C-12', 'reviews', title, 2, 'pass', 'Reviews shown with a verification statement.', basis, ''));
    }
  }

  // C-13 AI disclosure
  {
    const title = 'AI chatbot tells users they are talking to AI';
    const basis = 'Regulation (EU) 2024/1689 (AI Act) art. 50(1), from 2 Aug 2026';
    const chat = tech.filter((t) => t.category === 'Chat').map((t) => t.name);
    const aiWords = /\b(chatbot|ai assistant|asystent ai|ki-assistent|assistant ia|asistente ia)\b/i.test(allText);
    if (!chat.length && !aiWords) out.push(check('C-13', 'ai-disclosure', title, 2, 'na', 'No chat widget or AI assistant detected.', basis, ''));
    else if (AI_DISCLOSURE.test(allText)) out.push(check('C-13', 'ai-disclosure', title, 2, 'pass', 'AI disclosure wording found.', basis, ''));
    else out.push(check('C-13', 'ai-disclosure', title, 2, 'manual', `${chat.length ? `Chat widget detected (${chat.join(', ')})` : 'AI assistant mentioned'}; if it answers with AI, it must say so.`, basis, 'Show a clear notice in the chat window that the user is talking to an AI system.'));
  }

  // C-14 accessibility basics
  {
    const a11y = [];
    if (!ev.html.lang) a11y.push('no <html lang>');
    if (ev.html.images.missingAlt) a11y.push(`${ev.html.images.missingAlt}/${ev.html.images.total} images without alt`);
    if (ev.html.inputs.unlabeled) a11y.push(`${ev.html.inputs.unlabeled} form field(s) without a label`);
    if (/user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/i.test(ev.html.metas.viewport || '')) a11y.push('zoom disabled in viewport meta');
    out.push(
      a11y.length
        ? check('C-14', 'a11y-basics', 'Accessibility basics', 1, 'partial', `${a11y.join('; ')}.`, 'European Accessibility Act (Directive (EU) 2019/882) / WCAG 2.1 AA', 'Fix the listed items; a full WCAG audit needs manual testing.')
        : spa && !b
          ? check('C-14', 'a11y-basics', 'Accessibility basics', 1, 'manual', 'The HTML shell has lang set and no unlabelled images or fields, but the content is rendered by JavaScript and was not inspected. Run with --browser or test manually.', 'WCAG 2.1 AA', '')
          : check('C-14', 'a11y-basics', 'Accessibility basics', 1, 'pass', 'lang set, images have alt text, fields labelled, zoom allowed.', 'WCAG 2.1 AA', '')
    );
  }

  return { checks: out, inventory: inv };
}
