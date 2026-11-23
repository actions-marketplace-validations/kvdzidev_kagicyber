import { maskSecret } from '../util.js';

/**
 * Secret detectors: [name, severity, regex, keywords]. A detector only runs when one of its
 * keywords occurs in the lower-cased text (keyword prefilter), which keeps scanning large
 * bundles fast. Formats come from the vendors' public token documentation.
 * Severity "review" means: inspect the context before reporting.
 */
export const SECRET_PATTERNS = [
  // Cloud and infrastructure
  ['AWS access key ID', 'high', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, ['akia', 'asia']],
  ['Azure storage connection string', 'critical', /DefaultEndpointsProtocol=https?;AccountName=[^;\s]+;AccountKey=[A-Za-z0-9+/=]{80,}/g, ['accountkey=']],
  ['Google service account key', 'critical', /"private_key_id"\s*:\s*"[a-f0-9]{40}"/g, ['private_key_id']],
  ['DigitalOcean token', 'critical', /\bdo[opr]_v1_[a-f0-9]{64}\b/g, ['_v1_']],
  ['HashiCorp Vault token', 'critical', /\bhvs\.[A-Za-z0-9_-]{90,}/g, ['hvs.']],
  ['Terraform Cloud token', 'critical', /\b[A-Za-z0-9]{14}\.atlasv1\.[A-Za-z0-9_=-]{60,}/g, ['atlasv1']],
  ['Doppler token', 'critical', /\bdp\.(?:pt|st|sa|ct|scim|audit)\.[A-Za-z0-9]{40,}/g, ['dp.']],
  ['Pulumi access token', 'high', /\bpul-[a-f0-9]{40}\b/g, ['pul-']],
  ['Fly.io token', 'high', /\bFlyV1 fm[12]_[A-Za-z0-9+/=_-]{40,}/g, ['flyv1']],
  ['Netlify personal access token', 'high', /\bnfp_[A-Za-z0-9]{36,}\b/g, ['nfp_']],
  ['Supabase personal access token', 'critical', /\bsbp_[a-f0-9]{40}\b/g, ['sbp_']],
  ['Supabase secret API key', 'critical', /\bsb_secret_[A-Za-z0-9_-]{20,}/g, ['sb_secret_']],
  ['Grafana token', 'high', /\b(?:glc_[A-Za-z0-9+/=]{32,}|glsa_[A-Za-z0-9]{32}_[a-f0-9]{8})/g, ['glc_', 'glsa_']],
  ['Sentry auth token', 'high', /\b(?:sntrys_[A-Za-z0-9+/=_-]{60,}|sntryu_[a-f0-9]{64})/g, ['sntry']],
  ['New Relic user API key', 'high', /\bNRAK-[A-Z0-9]{27}\b/g, ['nrak-']],
  // Code hosting and package registries
  ['GitHub token', 'critical', /\b(?:gh[pousr]_[0-9A-Za-z]{36,}|github_pat_[0-9A-Za-z_]{60,})\b/g, ['ghp_', 'gho_', 'ghu_', 'ghs_', 'ghr_', 'github_pat_']],
  ['GitLab token', 'critical', /\bglpat-[0-9A-Za-z_-]{20,}\b/g, ['glpat-']],
  ['npm access token', 'critical', /\bnpm_[A-Za-z0-9]{36}\b/g, ['npm_']],
  ['PyPI API token', 'critical', /\bpypi-AgEIcHlwaS5vcmc[A-Za-z0-9_-]{50,}/g, ['pypi-']],
  ['Docker Hub token', 'high', /\bdckr_pat_[A-Za-z0-9_-]{27,}/g, ['dckr_pat_']],
  ['Atlassian API token', 'high', /\bATATT3[A-Za-z0-9_=-]{100,}/g, ['atatt3']],
  // Payments and commerce
  ['Live secret key (Stripe, Clerk)', 'critical', /\b(?:sk|rk)_live_[0-9A-Za-z]{20,}\b/g, ['_live_']],
  ['Stripe test secret key', 'low', /\bsk_test_[0-9A-Za-z]{20,}\b/g, ['sk_test_']],
  ['Stripe webhook secret', 'high', /\bwhsec_[A-Za-z0-9]{32,}\b/g, ['whsec_']],
  ['Square access token', 'critical', /\b(?:EAAA[A-Za-z0-9_-]{60}|sq0atp-[A-Za-z0-9_-]{22}|sq0csp-[A-Za-z0-9_-]{43})\b/g, ['eaaa', 'sq0atp-', 'sq0csp-']],
  ['Braintree access token', 'critical', /access_token\$production\$[a-z0-9]{16}\$[a-f0-9]{32}/g, ['access_token$production']],
  ['Plaid access token', 'high', /\baccess-(?:production|development)-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/g, ['access-production-', 'access-development-']],
  ['Shopify token', 'critical', /\bshp(?:at|ss|ca|pa)_[0-9a-fA-F]{32}\b/g, ['shpat_', 'shpss_', 'shpca_', 'shppa_']],
  ['Shippo live token', 'high', /\bshippo_live_[a-f0-9]{40}\b/g, ['shippo_live_']],
  // AI providers
  ['OpenAI API key', 'critical', /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,}|\bsk-[A-Za-z0-9]{20}T3BlbkFJ[A-Za-z0-9]{20}\b/g, ['sk-']],
  ['Anthropic API key', 'critical', /\bsk-ant-[A-Za-z0-9_-]{20,}/g, ['sk-ant-']],
  ['Hugging Face token', 'high', /\bhf_[A-Za-z0-9]{34,}\b/g, ['hf_']],
  ['Groq API key', 'high', /\bgsk_[A-Za-z0-9]{48,}\b/g, ['gsk_']],
  ['Perplexity API key', 'high', /\bpplx-[A-Za-z0-9]{40,}\b/g, ['pplx-']],
  ['xAI API key', 'high', /\bxai-[A-Za-z0-9]{60,}\b/g, ['xai-']],
  ['Replicate API token', 'high', /\br8_[A-Za-z0-9]{37}\b/g, ['r8_']],
  // Messaging, e-mail and SaaS
  ['Slack token', 'high', /\bxox[abposr]-[0-9A-Za-z-]{10,}\b/g, ['xox']],
  ['Slack app token', 'high', /\bxapp-\d-[A-Z0-9]+-\d+-[a-f0-9]{64}\b/g, ['xapp-']],
  ['Slack webhook', 'medium', /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/g, ['hooks.slack.com']],
  ['Discord webhook', 'medium', /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+/g, ['/api/webhooks/']],
  ['Microsoft Teams webhook', 'medium', /https:\/\/[a-z0-9-]+\.webhook\.office\.com\/webhookb2\/[A-Za-z0-9@/_-]+/g, ['webhook.office.com']],
  ['Zapier webhook', 'medium', /https:\/\/hooks\.zapier\.com\/hooks\/catch\/\d+\/[a-z0-9]+/g, ['hooks.zapier.com']],
  ['Telegram bot token', 'high', /\b[0-9]{8,10}:AA[0-9A-Za-z_-]{33}\b/g, [':aa']],
  ['SendGrid API key', 'high', /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/g, ['sg.']],
  ['Brevo (Sendinblue) API key', 'high', /\bxkeysib-[a-f0-9]{64}-[A-Za-z0-9]{16}\b/g, ['xkeysib-']],
  ['Mailgun API key', 'high', /\bkey-[0-9a-f]{32}\b/g, ['key-']],
  ['Mailchimp API key', 'high', /\b[0-9a-f]{32}-us[0-9]{1,2}\b/g, ['-us']],
  ['Twilio API key', 'high', /\bSK[0-9a-f]{32}\b/g, ['sk']],
  ['Linear API key', 'high', /\blin_api_[A-Za-z0-9]{40}\b/g, ['lin_api_']],
  ['Notion integration token', 'high', /\b(?:secret_[A-Za-z0-9]{43}|ntn_[A-Za-z0-9]{40,})\b/g, ['secret_', 'ntn_']],
  ['Figma personal access token', 'high', /\bfigd_[A-Za-z0-9_-]{40,}/g, ['figd_']],
  ['Postman API key', 'high', /\bPMAK-[a-f0-9]{24}-[a-f0-9]{34}\b/g, ['pmak-']],
  ['Contentful management token', 'high', /\bCFPAT-[A-Za-z0-9_-]{43}\b/g, ['cfpat-']],
  ['Airtable personal access token', 'high', /\bpat[A-Za-z0-9]{14}\.[a-f0-9]{64}\b/g, ['pat']],
  ['Dropbox access token', 'high', /\bsl\.[A-Za-z0-9_-]{130,}/g, ['sl.']],
  ['Firebase Cloud Messaging server key', 'high', /\bAAAA[A-Za-z0-9_-]{7}:APA91b[A-Za-z0-9_-]{100,}/g, ['apa91b']],
  ['Google API key', 'medium', /\bAIza[0-9A-Za-z_-]{35}\b/g, ['aiza']],
  ['Google OAuth client secret', 'high', /\bGOCSPX-[0-9A-Za-z_-]{20,}/g, ['gocspx-']],
  ['Google OAuth refresh token', 'high', /\b1\/\/0[A-Za-z0-9_-]{40,}/g, ['1//0']],
  ['Mapbox secret token', 'high', /\bsk\.eyJ[A-Za-z0-9_.-]{20,}/g, ['sk.eyj']],
  // Generic
  ['Private key', 'critical', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY(?: BLOCK)?-----/g, ['private key']],
  ['age secret key', 'critical', /\bAGE-SECRET-KEY-1[0-9A-Z]{58}\b/g, ['age-secret-key-']],
  // Bounded repeats keep these linear on hostile multi-megabyte bundles (unbounded versions were quadratic).
  ['Credentials in connection URL', 'critical', /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s:/@'"`]{1,256}:[^\s@'"`]{1,256}@[^\s'"`]{1,256}/g, ['postgres', 'mysql', 'mongodb', 'redis', 'amqp']],
  ['JWT', 'review', /\beyJ[A-Za-z0-9_-]{8,4096}\.eyJ[A-Za-z0-9_-]{8,8192}\.[A-Za-z0-9_-]{8,4096}/g, ['eyj']],
  ['Generic secret assignment', 'review', /\b(?:api[_-]?key|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|password|passwd)\b["']?\s*[:=]\s*["'`]([^"'`\s]{12,})["'`]/gi, ['key', 'secret', 'token', 'passw']],
];

const PLACEHOLDER = /(your|example|sample|dummy|placeholder|changeme|xxxx|\*\*\*\*|<|\$\{|process\.env|import\.meta\.env|todo|test1234|password123|lorem|redacted|insert)/i;

/** Shannon entropy in bits per character. */
export function entropy(s) {
  if (!s) return 0;
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) || 0) + 1);
  let e = 0;
  for (const c of counts.values()) {
    const p = c / s.length;
    e -= p * Math.log2(p);
  }
  return e;
}

function jwtPayload(token) {
  try {
    const p = token.split('.')[1];
    return JSON.parse(Buffer.from(p.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

/** Lines that carry an inline suppression comment are skipped: `kagicyber-ignore`. */
const IGNORE_MARK = /kagicyber-ignore/;

/**
 * Scan text for secrets. Returns masked matches only.
 * @returns {{type:string, severity:string, value:string, line:number, source:string, note?:string}[]}
 */
export function scanText(text, source = 'input') {
  const out = [];
  const seen = new Set();
  const lower = text.toLowerCase();
  let lineStarts = null;
  const lineOf = (idx) => {
    if (!lineStarts) {
      lineStarts = [0];
      for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
    }
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= idx) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const lineText = (idx) => {
    const start = text.lastIndexOf('\n', idx) + 1;
    const end = text.indexOf('\n', idx);
    return text.slice(start, end === -1 ? Math.min(text.length, idx + 400) : end);
  };
  for (const [name, sev, re, keywords] of SECRET_PATTERNS) {
    if (keywords && !keywords.some((k) => lower.includes(k))) continue;
    re.lastIndex = 0;
    let hits = 0;
    for (const m of text.matchAll(re)) {
      // A hostile bundle can contain thousands of matches; 500 per format is far beyond any real file.
      if (++hits > 500) break;
      const v = m[0];
      let type = name;
      let severity = sev;
      let note;
      if (IGNORE_MARK.test(lineText(m.index))) continue;
      if (name === 'JWT') {
        const p = jwtPayload(v);
        const role = p?.role;
        if (role === 'service_role') [type, severity] = ['Supabase service_role JWT', 'critical'];
        else if (role === 'anon') [type, severity, note] = ['Supabase anon JWT', 'info', 'Public by design; make sure Row Level Security is enabled on every table.'];
        else [type, severity] = ['JWT (review)', 'review'];
      }
      if (name === 'Generic secret assignment') {
        const value = m[1] || '';
        if (entropy(value) < 3.2) continue;
      }
      if (name === 'Twilio API key' && entropy(v.slice(2)) < 3) continue;
      if (severity === 'review') {
        if (PLACEHOLDER.test(v)) continue;
        severity = name === 'Generic secret assignment' ? 'medium' : 'low';
        note = 'Heuristic match: confirm it is a real credential before acting.';
      }
      if (name === 'Google API key') {
        const ctx = text.slice(Math.max(0, m.index - 200), m.index + 200);
        if (/authDomain|firebase/i.test(ctx)) [severity, note] = ['info', 'Firebase web API key: public by design. Check Firebase security rules and API restrictions.'];
        else note = 'Restrict this key by HTTP referrer and API in Google Cloud Console.';
      }
      if (name === 'Stripe test secret key') note = 'Test-mode key; still rotate it and keep it server-side.';
      const key = `${type}|${v}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ type, severity, value: maskSecret(v), line: lineOf(m.index), source, ...(note ? { note } : {}) });
    }
  }
  return out;
}

/**
 * Replace every secret-looking value in `text` with its masked form. Used on evidence strings
 * (page text, headers, links, JSON-LD) before they are written to JSON or returned by the API.
 */
export function maskSecretsIn(text) {
  if (typeof text !== 'string' || text.length < 8) return text;
  const lower = text.toLowerCase();
  let out = text;
  for (const [name, , re, keywords] of SECRET_PATTERNS) {
    if (keywords && !keywords.some((k) => lower.includes(k))) continue;
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    out = out.replace(g, (m, g1) => {
      if (name === 'Generic secret assignment' && typeof g1 === 'string') return m.replace(g1, maskSecret(g1));
      return maskSecret(m);
    });
  }
  return out;
}

/** Values compiled into client bundles by common frameworks. Names suggesting a secret are a red flag. */
export const CLIENT_ENV_SECRET = /\b(NEXT_PUBLIC|VITE|REACT_APP|PUBLIC|NUXT_PUBLIC|EXPO_PUBLIC|GATSBY)_[A-Z0-9_]*(SECRET|PRIVATE|SERVICE_ROLE|PASSWORD|TOKEN|ADMIN)[A-Z0-9_]*\b/g;
