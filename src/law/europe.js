import { R, link, text, count, signal, lang, hasLang, inventory, browserReject, manual, P } from './dsl.js';

export const PL = [
  R('PL-01', 'Regulamin świadczenia usług drogą elektroniczną published', 3, 'Art. 8 ustawy o świadczeniu usług drogą elektroniczną (UŚUDE)', link('regulamin'),
    'Publish terms of electronic services (regulamin), required for any e-service, including a contact form or newsletter, and link it in the footer.', { verify: true }),
  R('PL-02', 'Regulamin covers the complaint procedure', 2, 'Art. 8 ust. 3 pkt 4 UŚUDE', text('reklamac|tryb(u)? postępowania reklamacyjnego', 'terms'),
    'Describe how complaints about the e-service are filed and handled.', { verify: true }),
  R('PL-03', 'NIP shown', 2, 'Art. 5 UŚUDE; art. 206 KSH', text('NIP[:\\s]*(PL)?\\s?\\d{3}-?\\d{3}-?\\d{2}-?\\d{2}|NIP[:\\s]*\\d{10}'), 'Show the NIP (tax ID) with the company data.'),
  R('PL-04', 'KRS number or CEIDG entry shown', 2, 'Art. 5 UŚUDE; art. 206 KSH', text('KRS[:\\s.]*(nr|numer)?[:\\s.]*\\d{10}|CEIDG|Centraln(ej|a) Ewidencj'),
    'Show the KRS number with the registry court, or the CEIDG entry for sole traders.', { verify: true }),
  R('PL-05', 'Share capital stated (sp. z o.o. / S.A.)', 2, 'Art. 206 § 1 KSH', text('kapita(ł|łem|łu|l) zakładow|kapitał zakładowy'),
    'A sp. z o.o. must state its share capital on the website.', { trigger: '(?c)sp\\.\\s?z\\s?o\\.?\\s?o|[Ss]półka z ograniczon|[Ss]półka akcyjna|(?<![A-Za-z.])S\\.A\\.(?![A-Za-z])', verify: true }),
  R('PL-06', 'Cookies: opt-in before non-essential storage', 3, 'Art. 399 ustawy Prawo komunikacji elektronicznej (od 10.11.2024)', signal('trackers-before-consent'),
    'Collect opt-in consent before storing or reading non-essential cookies.', { verify: true }),
  R('PL-07', 'Privacy notice in Polish', 2, 'Art. 12 RODO', lang('pl', 'privacy'), 'Provide the privacy notice (and consumer information) in Polish.'),
  R('PL-08', 'Complaint to the President of UODO mentioned', 2, 'Art. 13 ust. 2 lit. d RODO', text('UODO|Prezes(a)? Urzędu Ochrony Danych', 'privacy'),
    'Name the President of UODO as the supervisory authority for complaints.'),
  R('PL-09', 'Omnibus: lowest price of the last 30 days next to promotions', 3, 'Art. 4 ust. 2 ustawy o informowaniu o cenach (UOKiK fines in 2026: Zalando PLN 30.9M, Temu PLN 5.9M)',
    text('najniższa cena z (ostatnich )?30 dni|najnizsza cena z (ostatnich )?30 dni|najniższa cena (w ciągu|z) 30'), 'Show "Najniższa cena z 30 dni przed obniżką" next to each promotional price.', { applies: 'shop', trigger: P.discount }),
  R('PL-10', 'Withdrawal function ("Odstąp od umowy")', 1, 'Directive (EU) 2023/2673 - not yet transposed in Poland (Nov 2026); required for sales to other EU states that have transposed it',
    link('odstąp od umowy', 'odstąpienie od umowy', 'formularz odstąpienia'), 'Add an online withdrawal function now; it is required when selling to consumers in states that have transposed the directive.', { applies: 'shop', missing: 'partial' }),
  R('PL-11', 'Accessibility statement (EAA, ustawa o dostępności produktów i usług)', 2, 'Ustawa z 26.04.2024 o zapewnianiu spełniania wymagań dostępności - od 28.06.2025',
    link('dostępność', 'dostepnosc', 'deklaracja dostępności', 'accessibility'), 'Publish accessibility information for the online shop (microenterprises exempt).', { applies: 'shop', missing: 'partial' }),
];

export const DE = [
  R('DE-01', 'Impressum linked on every page', 3, '§ 5 DDG (Digitale-Dienste-Gesetz)', link('impressum'), 'Add an "Impressum" link in the footer, reachable in two clicks.'),
  R('DE-02', 'Register court and number', 2, '§ 5 Abs. 1 Nr. 4 DDG', text('Amtsgericht|Registergericht|\\bHR[AB]\\s?\\d+', 'legal'),
    'State the register court and HRB/HRA number.', { trigger: '(?c)\\bGmbH\\b|\\bAG\\b|\\bUG\\b|\\bKG\\b|\\bOHG\\b|\\be\\.K\\.' }),
  R('DE-03', 'USt-IdNr. shown', 2, '§ 5 Abs. 1 Nr. 6 DDG', text('USt-?Id(Nr|\\.-Nr)?|Umsatzsteuer-Identifikationsnummer|\\bDE\\s?\\d{9}\\b'), 'Show the VAT ID (USt-IdNr.) if one has been issued.', { missing: 'partial' }),
  R('DE-04', 'Authorised representatives named', 2, '§ 5 Abs. 1 Nr. 1 DDG', text('(?c)(Geschäftsführ\\w*|[Vv]ertreten durch|Vertretungsberechtigt\\w*|Vorstand|Inhaber\\w*)[:\\s]+(Herr |Frau |Dr\\. )?\\p{Lu}\\p{Ll}+ \\p{Lu}\\p{Ll}+', 'legal'), 'Name the managing directors / authorised representatives.'),
  R('DE-05', 'Cookies: consent per § 25 TDDDG', 3, '§ 25 TDDDG', signal('trackers-before-consent'), 'Obtain consent before storing or accessing non-essential information on the device.'),
  R('DE-06', 'Datenschutzerklärung in German', 2, 'Art. 12 DSGVO', lang('de', 'privacy'), 'Provide the privacy notice in German.'),
  R('DE-07', 'Google Fonts self-hosted', 2, 'LG München I, Urt. v. 20.01.2022 - 3 O 17493/20 (wave of Abmahnungen)', inventory('googleFonts', false), 'Self-host Google Fonts to avoid IP transfer to Google and Abmahnung risk.'),
  R('DE-08', 'Order button "zahlungspflichtig bestellen"', 3, '§ 312j Abs. 3 BGB', manual('Go to the last checkout step: the button must read "zahlungspflichtig bestellen" or an equally clear wording.'),
    'Label the final button "zahlungspflichtig bestellen".', { applies: 'shop' }),
  R('DE-09', 'Cancellation button "Verträge hier kündigen"', 3, '§ 312k BGB', link('verträge hier kündigen', 'vertrag kündigen', 'kündigungsbutton', 'kündigen'),
    'Add a permanently available "Verträge hier kündigen" button leading to a confirmation page with "jetzt kündigen" (no login required per recent case law).', { applies: ['shop', 'saas'], trigger: 'abo|abonnement|mitgliedschaft|laufzeit|monatlich kündbar|vertrag' }),
  R('DE-10', 'Withdrawal button "Vertrag widerrufen"', 3, '§ 356a BGB - from 19 Jun 2026', link('vertrag widerrufen', 'widerruf bestätigen', 'widerruf erklären', 'widerrufsbutton'),
    'Add a "Vertrag widerrufen" function leading to "Widerruf bestätigen".', { applies: 'shop' }),
  R('DE-11', 'Widerrufsbelehrung and Muster-Widerrufsformular', 3, 'Art. 246a EGBGB; Anlage 1 und 2', count({ groups: [['Widerrufsbelehrung', 'widerrufsbelehrung|widerrufsrecht'], ['Muster-Widerrufsformular', 'muster-widerrufsformular|widerrufsformular']] }),
    'Publish the statutory Widerrufsbelehrung and the model withdrawal form.', { applies: 'shop' }),
  R('DE-12', 'Barrierefreiheit (BFSG) information', 2, 'Barrierefreiheitsstärkungsgesetz - from 28 Jun 2025', link('barrierefreiheit', 'erklärung zur barrierefreiheit'),
    'Publish accessibility information for the shop (microenterprises exempt).', { applies: 'shop', missing: 'partial' }),
];

export const AT = [
  R('AT-01', 'Impressum / Offenlegung', 3, '§ 5 ECG; § 25 MedienG', link('impressum', 'offenlegung'), 'Publish an Impressum including the Offenlegung under § 25 MedienG.', { verify: true }),
  R('AT-02', 'Firmenbuchnummer and Firmenbuchgericht', 2, '§ 14 UGB', text('\\bFN\\s?\\d{5,6}\\s?[a-z]\\b|Firmenbuch'), 'State the company register number (FN) and court.', { trigger: '\\bGmbH\\b|\\bAG\\b|\\bKG\\b|\\bOG\\b|\\be\\.U\\.' }),
  R('AT-03', 'UID-Nummer', 2, '§ 5 ECG', text('\\bATU\\d{8}\\b|\\bUID\\b'), 'Show the UID (VAT) number.', { missing: 'partial' }),
  R('AT-04', 'Cookies consent', 3, '§ 165 Abs. 3 TKG 2021', signal('trackers-before-consent'), 'Collect consent before non-essential cookies.'),
  R('AT-05', 'Chamber / supervisory authority', 1, '§ 5 Abs. 1 Z 4-5 ECG', text('Wirtschaftskammer|\\bWKO\\b|Aufsichtsbehörde|Gewerbebehörde|Bezirkshauptmannschaft|Magistrat'), 'Name the chamber membership and the competent authority.', { missing: 'partial', verify: true }),
];

export const FR = [
  R('FR-01', 'Mentions légales', 3, 'LCEN art. 1-1 (ex-art. 6 III)', link('mentions légales', 'mentions legales', 'mentions-legales'), 'Publish the "Mentions légales" page linked from every page.'),
  R('FR-02', 'RCS / SIREN number', 2, 'LCEN; Code de commerce R123-237', text('\\bRCS\\b|\\bSIREN\\b|\\bSIRET\\b|\\bRM\\b'), 'Show the RCS (or RM) registration and SIREN.'),
  R('FR-03', 'Share capital', 1, 'Code de commerce R123-237', text('capital (social )?de'), 'State the share capital of the company.', { trigger: '\\bSAS\\b|\\bSARL\\b|\\bSA\\b|\\bSASU\\b|\\bEURL\\b' }),
  R('FR-04', 'Directeur de la publication', 2, 'LCEN art. 1-1', text('directeur de (la )?publication|responsable de (la )?publication'), 'Name the publication director.'),
  R('FR-05', 'Hosting provider identified', 2, 'LCEN art. 1-1', text('hébergeur|hébergé par|hebergeur|hébergement'), 'Name the hosting provider with its address and phone number.'),
  R('FR-06', 'Refusing cookies as easy as accepting (CNIL)', 3, 'CNIL délibération 2020-091; Google EUR 325M, Shein EUR 150M (2025)', browserReject(), 'Offer "Tout refuser" on the first layer with the same prominence as "Tout accepter".'),
  R('FR-07', 'Content in French', 2, 'Loi n° 94-665 (Loi Toubon)', lang('fr', 'privacy'), 'Provide legal and consumer information in French.'),
  R('FR-08', 'Order button "Commande avec obligation de paiement"', 3, 'Code de la consommation L221-14', manual('Check the final checkout button wording.'), 'Label the final button "Commande avec obligation de paiement".', { applies: 'shop' }),
  R('FR-09', 'Online termination function ("résilier votre contrat")', 3, 'Code de la consommation L215-1-1', link('résilier', 'résiliation', 'resilier'),
    'Provide a "résilier votre contrat" function for contracts concluded online.', { applies: ['shop', 'saas'], trigger: P.subscription }),
  R('FR-10', 'Consumer mediator named', 2, 'Code de la consommation L612-1, L616-1', text('médiat(eur|ion) de la consommation|médiateur'), 'Name the consumer mediator and its contact details.', { applies: 'shop' }),
];

export const IT = [
  R('IT-01', 'Partita IVA on the homepage', 3, 'Art. 35 DPR 633/1972', text('P\\.?\\s?IVA|Partita IVA', 'home'), 'Show the Partita IVA on the homepage (usually the footer).'),
  R('IT-02', 'Cookie banner: closing with X = refusal; Reject available', 3, 'Garante Linee guida cookie (10.06.2021)', browserReject(), 'Offer a "Rifiuta" option (or an X that means refusal) on the first layer.'),
  R('IT-03', 'Footer link to change cookie choices', 2, 'Garante Linee guida cookie', { type: 'link', keywords: ['cookie', 'preferenze', 'impostazioni'], orCmp: true }, 'Add a footer link that reopens cookie preferences.'),
  R('IT-04', 'Informativa privacy in Italian', 2, 'Art. 12 GDPR', lang('it', 'privacy'), 'Provide the privacy notice in Italian.'),
  R('IT-05', 'REA / Registro delle Imprese', 1, 'Art. 2250 c.c.', text('\\bREA\\b|Registro (delle )?Imprese'), 'State the REA number and register of companies.', { missing: 'partial' }),
];

export const ES = [
  R('ES-01', 'Aviso legal', 3, 'LSSI-CE art. 10', link('aviso legal', 'aviso-legal', 'información legal'), 'Publish an "Aviso legal" page with the operator data.'),
  R('ES-02', 'NIF / CIF shown', 2, 'LSSI-CE art. 10(1)(d)', text('\\bNIF\\b|\\bCIF\\b|N\\.I\\.F'), 'Show the NIF/CIF.'),
  R('ES-03', 'Registro Mercantil data', 1, 'LSSI-CE art. 10(1)(b)', text('Registro Mercantil|\\bTomo\\b|\\bFolio\\b|\\bHoja\\b'), 'State the Registro Mercantil entry (tomo, folio, hoja).', { missing: 'partial' }),
  R('ES-04', '"Rechazar" on the first layer (AEPD)', 3, 'AEPD Guía sobre el uso de las cookies (2023)', browserReject(), 'Offer "Rechazar todo" on the first layer with equal prominence.'),
  R('ES-05', 'Order button "pedido con obligación de pago"', 2, 'TRLGDCU art. 98.2', manual('Check the final checkout button wording.'), 'Label the final button "pedido con obligación de pago".', { applies: 'shop' }),
  R('ES-06', 'Information in Castilian', 2, 'TRLGDCU art. 60', lang('es', 'privacy'), 'Provide consumer and legal information in Castilian.'),
  R('ES-07', 'Hojas de reclamaciones availability', 1, 'Regional consumer law', text('hojas? de reclamaci'), 'State that complaint forms are available (regional rules apply).', { applies: 'shop', missing: 'partial', verify: true }),
];

export const NL = [
  R('NL-01', 'No cookie wall', 2, 'Telecommunicatiewet art. 11.7a; AP guidance', manual('Check that the site remains usable when cookies are refused.'), 'Do not block access when cookies are refused.'),
  R('NL-02', 'KvK number shown', 2, 'Handelsregisterbesluit 2008 art. 49', text('\\bKvK\\b|Kamer van Koophandel'), 'Show the KvK registration number.', { verify: true }),
  R('NL-03', 'BTW number', 1, 'Directive 2000/31/EC art. 5', text('\\bBTW\\b|\\bNL\\d{9}B\\d{2}\\b'), 'Show the BTW (VAT) number.', { missing: 'partial' }),
  R('NL-04', 'Consent before tracking', 3, 'Telecommunicatiewet art. 11.7a (ACM fines up to EUR 900k per violation)', signal('trackers-before-consent'), 'Obtain consent before tracking cookies.'),
];

export const BE = [
  R('BE-01', 'Consent before non-essential cookies', 3, 'Art. 10/2 Law of 13.06.2005 on electronic communications', signal('trackers-before-consent'), 'Obtain consent before non-essential cookies.'),
  R('BE-02', 'Enterprise number (KBO/BCE)', 2, 'Code of Economic Law art. III.25', text('\\bKBO\\b|\\bBCE\\b|ondernemingsnummer|numéro d\'entreprise|\\bBE\\s?0\\d{3}[.\\s]?\\d{3}[.\\s]?\\d{3}'), 'Show the enterprise number.'),
  R('BE-03', 'Age of digital consent 13 handled', 1, 'Belgian GDPR implementing law art. 7', manual('If children may use the service, check parental-consent flow below 13.'), 'Collect parental consent below 13.', { applies: 'saas' }),
  R('BE-04', 'Language of the region (FR/NL/DE)', 1, 'Language legislation for consumer information', manual('Check the consumer-facing languages match the targeted region.'), 'Provide information in the language of the consumer\'s region.', { applies: 'shop' }),
];

export const IE = [
  R('IE-01', 'Consent before cookies', 3, 'S.I. 336/2011 Reg. 5', signal('trackers-before-consent'), 'Obtain consent before non-essential cookies.'),
  R('IE-02', 'CRO number shown', 2, 'Companies Act 2014 s. 151', text('(\\bCRO\\b|Companies Registration Office|company (no\\.?|number))[\\s:#.]*\\d{5,6}'), 'Show the CRO registration number and registered office.'),
  R('IE-03', 'Marketing e-mail consent (criminal offence)', 2, 'S.I. 336/2011 Reg. 13 - up to EUR 250k per message for companies', manual('Check newsletter sign-up for opt-in consent and unsubscribe.'), 'Use opt-in consent and an unsubscribe link in every message.', { trigger: P.newsletter }),
];

export const PT = [
  R('PT-01', 'Livro de Reclamações Eletrónico link', 3, 'Decreto-Lei 156/2005 (as amended)', link('livro de reclamações', 'livro de reclamacoes', 'livroreclamacoes'), 'Show the Livro de Reclamações link/logo on the website.'),
  R('PT-02', 'NIPC / NIF', 1, 'Directive 2000/31/EC art. 5', text('\\bNIPC\\b|\\bNIF\\b|contribuinte'), 'Show the tax number.', { missing: 'partial' }),
];

export const CZ = [
  R('CZ-01', 'IČO shown', 2, 'Zákon o obchodních korporacích / Občanský zákoník §435', text('\\bIČO?\\b|\\bIČ:'), 'Show the company ID (IČO) and register entry.'),
  R('CZ-02', 'Strict opt-in for cookies', 3, 'Zákon o elektronických komunikacích §89(3) (since 2022)', signal('trackers-before-consent'), 'Obtain opt-in before non-essential cookies.'),
];

export const SK = [
  R('SK-01', 'IČO and commercial register entry', 2, 'Obchodný zákonník §3a', text('\\bIČO\\b|Obchodn(ý|ého|om) regist'), 'Show IČO and the Obchodný register entry.'),
  R('SK-02', 'Closing the banner with X treated as refusal', 1, 'Zákon o elektronických komunikáciách §109', manual('Close the banner with X and check that no trackers load.'), 'Treat closing the banner as refusal.', { verify: true }),
];

export const RO = [
  R('RO-01', 'ANPC SAL / SOL pictograms with links', 2, 'Ordinul ANPC 449/2022', text('\\bANPC\\b|soluționarea alternativă|\\bSAL\\b|\\bSOL\\b'), 'Display the ANPC SAL and SOL pictograms linking to the official pages.', { applies: 'shop', verify: true }),
  R('RO-02', 'CUI and Trade Register number', 1, 'Legea 26/1990', text('\\bCUI\\b|\\bJ\\d{2}/\\d+/\\d{4}'), 'Show the CUI and Registrul Comerțului number.'),
];

export const HU = [
  R('HU-01', 'Company registration number (cégjegyzékszám)', 2, 'Ektv. 4. §', text('cégjegyzékszám|Cg\\.\\s?\\d{2}-\\d{2}-\\d+|adószám'), 'Show the company registration and tax numbers.'),
];

/** EU member states without a dedicated module still get local-language and baseline-consent checks. */
const EU_LANG = { AT: 'de', NL: 'nl', IE: 'en', SE: 'sv', DK: 'da', FI: 'fi', GR: 'el', BG: 'bg', HR: 'hr', SI: 'sl', LT: 'lt', LV: 'lv', EE: 'et', LU: 'fr', MT: 'en', CY: 'el', CZ: 'cs', SK: 'sk', RO: 'ro', HU: 'hu', PT: 'pt' };
export function euGeneric(code) {
  const l = EU_LANG[code];
  return [
    l && R(`${code}-L`, 'Consumer and privacy information in the local language', 2, 'GDPR art. 12; national consumer law', lang(l, 'privacy'), 'Provide legal and consumer information in the official language.', { missing: 'partial' }),
    R(`${code}-C`, 'Consent before non-essential cookies (national ePrivacy law)', 3, 'National transposition of Directive 2002/58/EC art. 5(3)', signal('trackers-before-consent'), 'Obtain opt-in consent before non-essential cookies.'),
  ].filter(Boolean);
}

export const GB = [
  R('GB-01', 'Company name, number and registered office', 3, 'Companies (Trading Disclosures) Regulations 2008 (amended 2015)', text('(company (no\\.?|number|registration( number)?)|registered (in England( and Wales)?|in Scotland|number))[\\s:#.]*(SC|NI|OC)?\\d{6,8}'), 'Show the registered name, company number, place of registration and registered office.'),
  R('GB-02', 'Advertising cookies need opt-in', 3, 'PECR reg. 6 as amended by the Data (Use and Access) Act 2025 (analytics exemption from 5 Feb 2026)', signal('trackers-before-consent'),
    'Advertising cookies still need opt-in; analytics/functional cookies may use the new exemption with clear information and an opt-out.', { note: 'Analytics-only sites may qualify for the DUAA exemption: review manually.' }),
  R('GB-03', 'Privacy notice names the ICO for complaints', 2, 'UK GDPR art. 13(2)(d)', text('\\bICO\\b|Information Commissioner', 'privacy'), 'Name the ICO as the supervisory authority.'),
  R('GB-04', '14-day cancellation right explained', 2, 'Consumer Contracts Regulations 2013 reg. 29', count({ groups: [['14 days', '14 days|fourteen days'], ['cancel', 'cancel']] }), 'Explain the 14-day cancellation right and the model form.', { applies: 'shop' }),
  R('GB-05', 'No drip pricing (total price shown upfront)', 2, 'DMCCA 2024 s. 230 & Sch. 20', manual('Check that mandatory fees are included in the first price shown.'), 'Include all mandatory fees in the headline price.', { applies: 'shop' }),
  R('GB-06', 'Review policy (fake-review ban)', 1, 'DMCCA 2024 Sch. 20 para 13', text('verified|genuine reviews|review policy|how we (check|moderate) reviews'), 'Publish how reviews are checked and moderated.', { trigger: P.reviews, missing: 'partial' }),
  R('GB-07', 'Online Safety Act duties (user-to-user services)', 1, 'Online Safety Act 2023', manual('If users can share content, check risk assessments, reporting tools and age assurance.'), 'Assess OSA duties for user-to-user features.', { applies: 'saas', trigger: P.ugc }),
];

export const CH = [
  R('CH-01', 'Privacy notice under the revised FADP', 2, 'FADP (revDSG) art. 19', text('\\bFADP\\b|\\bDSG\\b|revDSG|nDSG|Datenschutzgesetz|\\bEDÖB\\b|\\bFDPIC\\b|Bundesgesetz über den Datenschutz', 'privacy'), 'Reference the Swiss FADP and the FDPIC in the privacy notice.', { missing: 'partial' }),
  R('CH-02', 'Imprint for e-commerce (UWG)', 2, 'UWG art. 3(1)(s)', link('impressum', 'imprint', 'mentions légales', 'note legali'), 'Publish clear identity and contact details.'),
  R('CH-03', 'UID (CHE-) number', 1, 'UIDG', text('CHE-?\\d{3}\\.\\d{3}\\.\\d{3}'), 'Show the UID number.', { missing: 'partial' }),
  R('CH-04', 'Cookie information and opt-out', 1, 'TCA art. 45c', signal('cookie-info'), 'Inform about cookies and offer an opt-out.', { verify: true }),
];

export const TR = [
  R('TR-01', 'KVKK clarification notice (aydınlatma metni)', 3, 'KVKK art. 10', text('aydınlatma metni|\\bKVKK\\b|6698'), 'Publish the KVKK aydınlatma metni.'),
  R('TR-02', 'Explicit consent for non-essential cookies', 2, 'KVKK Cookie Guidelines (2022)', signal('trackers-before-consent'), 'Collect explicit consent before non-essential cookies.', { verify: true }),
  R('TR-03', 'VERBIS registration (above thresholds)', 1, 'KVKK art. 16', manual('Check VERBIS registration if thresholds are met.'), 'Register with VERBIS where required.'),
  R('TR-04', 'Commercial messages registered in İYS', 1, 'Law 6563; İYS', manual('Check that e-mail/SMS consents are recorded in İYS.'), 'Record commercial message consents in İYS.', { trigger: P.newsletter }),
  R('TR-05', 'ETBİS registration (e-commerce)', 2, 'Law 6563 / ETBİS regulation', text('ETB[İI]S|etbis'), 'Register with ETBİS and display the QR/badge.', { applies: 'shop' }),
  R('TR-06', 'MERSİS number', 1, 'Turkish Commercial Code art. 39', text('MERS[İI]S'), 'Show the MERSİS number.', { missing: 'partial' }),
];

export const EUROPE = { PL, DE, AT, FR, IT, ES, NL, BE, IE, PT, CZ, SK, RO, HU, GB, CH, TR };
export const EU_MEMBERS = ['PL', 'DE', 'AT', 'FR', 'IT', 'ES', 'NL', 'BE', 'IE', 'PT', 'SE', 'DK', 'FI', 'CZ', 'SK', 'HU', 'RO', 'BG', 'GR', 'HR', 'SI', 'LT', 'LV', 'EE', 'LU', 'MT', 'CY'];
export { hasLang };
