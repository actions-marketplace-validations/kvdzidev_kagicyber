/**
 * Small DSL for compliance rules. A rule = what the law requires + how to verify it
 * from the evidence collected by the audit.
 *
 * Verification types
 *   link(...kw)            a same-site link whose text or URL contains a keyword
 *   text(re, where)        a regex found in page text (where: home|privacy|terms|imprint|legal|any)
 *   count({...})           N of M element groups present (content analysis)
 *   signal(key)            fold into a core check (privacy-linked, consent-mechanism, ...)
 *   lang(code, where)      page language equals code
 *   hasLang(code)          site offers a version in this language (lang/hreflang)
 *   absent(re, where)      regex must NOT be present
 *   inventory(key, value)  inventory field must equal value
 *   browserReject()        real-browser test found "Reject" on the first layer
 *   noFinding(re)          no security finding title matches re
 *   linkParam(re)          no outbound link carries these query parameters
 *   manual(how)            needs a human (checkout flow, thresholds, registrations)
 *
 * Options
 *   applies   'all' | 'shop' | 'saas' | 'fintech' (or an array)
 *   trigger   regex: the rule is N/A unless it matches site text
 *   missing   status when not found: 'fail' (default) | 'partial' | 'manual'
 *   verify    true when the requirement still needs confirmation in a primary source
 */
export const link = (...keywords) => ({ type: 'link', keywords });
export const text = (pattern, where = 'any') => ({ type: 'text', patterns: [].concat(pattern), where });
export const count = ({ where = 'any', min, groups }) => ({ type: 'count', where, min: min ?? groups.length, groups });
export const signal = (check) => ({ type: 'signal', check });
export const lang = (code, where = 'privacy') => ({ type: 'lang', code, where });
export const hasLang = (code) => ({ type: 'has-lang', code });
export const absent = (pattern, where = 'any') => ({ type: 'absent', patterns: [].concat(pattern), where });
export const inventory = (key, expect) => ({ type: 'inventory', key, expect });
export const browserReject = () => ({ type: 'browser-reject' });
export const noFinding = (title) => ({ type: 'no-finding', title });
export const linkParam = (pattern) => ({ type: 'link-param', pattern });
export const manual = (how) => ({ type: 'manual', how });

export function R(id, title, weight, basis, check, fix, opt = {}) {
  return {
    id,
    title,
    weight,
    basis,
    check,
    fix,
    appliesTo: opt.applies ? [].concat(opt.applies) : ['all'],
    trigger: opt.trigger || null,
    missing: opt.missing || 'fail',
    verify: !!opt.verify,
    note: opt.note || null,
  };
}

/** Shared multilingual patterns. */
export const P = {
  discount: '-\\s?\\d{1,2}\\s?%|promocj|wyprzeda|\\bsale\\b|rabat|soldes|rebajas|saldi|korting|black friday|przecena|stara cena|was \\d',
  reviews: 'opini[ae]|recenzj|\\breviews?\\b|bewertung|\\bavis\\b|reseñ|recension|beoordeling|★',
  subscription: 'subskrypc|abonament|subscription|\\babo\\b|abonnement|mitgliedschaft|suscripci|abbonamento|membership|plan miesięczny|monthly plan',
  newsletter: 'newsletter|subscribe|zapisz się|zapisz sie|anmelden zum|s\'inscrire|suscríbete|iscriviti|mailing list',
  credit: 'rrso|\\bapr\\b|\\btaeg\\b|\\btae\\b|effektiver jahreszins|kredyt|pożyczk|pozyczk|\\bloan|darlehen|\\bprêt|préstamo|prestito|lening|chwilówk',
  kids: 'for kids|for children|dla dzieci|für kinder|pour enfants|para niños|per bambini|age 13|under 13',
  ugc: 'upload|comment|forum|community|marketplace|post your|komentarz|prześlij|społeczno|hochladen|kommentar|commentaire|comentario',
  chat: 'intercom|drift\\.com|tidio|crisp\\.chat|chatbase|livechatinc|zopim|zendesk|botpress|voiceflow|landbot|chatbot|ai assistant|asystent ai|ki-assistent',
};
