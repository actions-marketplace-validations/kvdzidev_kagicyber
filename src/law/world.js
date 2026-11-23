import { R, link, text, count, signal, lang, hasLang, manual, P } from './dsl.js';

export const US = [
  R('US-01', 'Privacy policy published and accurate', 3, 'FTC Act §5 (deceptive practices)', signal('privacy-linked'), 'Publish a privacy policy that matches actual data practices.'),
  R('US-02', 'COPPA: verifiable parental consent for under-13 users', 2, 'COPPA Rule 16 CFR 312 (amended, compliance from 22 Apr 2026)', manual('If the site is directed to children or knowingly collects data from under-13s, check notice and verifiable parental consent.'), 'Implement COPPA notice and parental consent.', { trigger: P.kids }),
  R('US-03', 'CAN-SPAM: unsubscribe and postal address in marketing e-mail', 1, '15 U.S.C. 7704', manual('Subscribe with a test address; check the unsubscribe link and physical postal address.'), 'Include an opt-out link and a valid postal address in every marketing e-mail.', { trigger: P.newsletter }),
  R('US-04', 'ROSCA: clear subscription terms and simple cancellation', 2, 'Restore Online Shoppers\' Confidence Act; FTC enforcement', manual('Check disclosure of material terms before billing, express consent and a simple cancellation path.'), 'Disclose terms before billing and allow simple online cancellation.', { trigger: P.subscription }),
  R('US-05', 'Web accessibility (ADA litigation risk)', 2, 'ADA Title III case law; DOJ guidance (target WCAG 2.1/2.2 AA)', signal('a11y-basics'), 'Target WCAG 2.1 AA and publish an accessibility statement with a contact.'),
  R('US-06', 'TCPA: prior express written consent for marketing SMS', 1, '47 U.S.C. 227', manual('Check SMS opt-in wording and records.'), 'Collect prior express written consent for marketing texts.', { trigger: 'sms|text message|wiadomości sms' }),
];

export const US_CA = [
  R('USCA-01', 'CalOPPA: Do Not Track disclosure', 2, 'Cal. Bus. & Prof. Code §22575(b)(5)', text('do not track|\\bDNT\\b', 'privacy'), 'State how the site responds to Do Not Track signals.'),
  R('USCA-02', 'CalOPPA: effective date of the privacy policy', 1, 'Cal. Bus. & Prof. Code §22575(b)(4)', text('effective date|last updated|updated on|last revised', 'privacy'), 'Show the effective/last-updated date.'),
  R('USCA-03', '"Do Not Sell or Share" / "Your Privacy Choices" link', 3, 'CCPA §1798.135 (if thresholds met: >$26.625M revenue, ≥100k consumers, or ≥50% revenue from selling/sharing)',
    link('do not sell', 'your privacy choices', 'do not share', 'opt out of sale', 'privacy choices'), 'Add the "Do Not Sell or Share My Personal Information" (or "Your Privacy Choices") link if CCPA applies.', { note: 'Thresholds cannot be verified automatically.' }),
  R('USCA-04', 'Global Privacy Control honoured', 2, 'CCPA Regs §7025', text('global privacy control|\\bGPC\\b', 'privacy'), 'Honour GPC as an opt-out and say so in the policy.'),
  R('USCA-05', 'Notice at collection with categories of personal information', 2, 'CCPA §1798.100; Regs §7012', text('notice at collection|categories of personal information', 'privacy'), 'Provide a notice at collection listing categories, purposes and retention.'),
  R('USCA-06', 'CIPA wiretap risk from pixels, chat and session replay', 2, 'Cal. Penal Code §631, §638.51 ($5,000 per violation, private suits)', { type: 'inventory-trackers' }, 'Gate pixels/chat/session replay behind consent and disclose them; review vendor contracts.'),
  R('USCA-07', 'Automatic Renewal Law: online cancellation', 2, 'Cal. Bus. & Prof. Code §17602', manual('Check that online sign-ups can be cancelled online.'), 'Offer online cancellation for auto-renewing plans.', { trigger: P.subscription }),
];

export const US_STATES = [
  R('USST-01', 'Opt-out of targeted advertising, sale and profiling', 2, '~20 state privacy laws (VA, CO, CT, UT, TX, OR, MT, IA, DE, NJ, NH, MN, MD, TN, IN, KY, RI, NE…)', link('opt out', 'do not sell', 'your privacy choices', 'targeted advertising', 'privacy choices'), 'Provide opt-out mechanisms for targeted ads, sale and profiling.', { missing: 'partial' }),
  R('USST-02', 'Universal opt-out signal (GPC) honoured', 2, 'CO, CT, TX, MT, NJ, MN, MD, OR, DE (NH/NE dates uncertain)', text('global privacy control|\\bGPC\\b|universal opt-out', 'privacy'), 'Honour GPC and state it in the privacy policy.', { missing: 'partial' }),
  R('USST-03', 'Texas sensitive-data sale notice', 1, 'Tex. Bus. & Com. Code §541.102', manual('If sensitive data is sold, show "NOTICE: We may sell your sensitive personal data."'), 'Add the statutory notice if applicable.'),
  R('USST-04', 'New York algorithmic pricing disclosure', 1, 'N.Y. Gen. Bus. Law §349-a', manual('If prices are personalised, show "THIS PRICE WAS SET BY AN ALGORITHM USING YOUR PERSONAL DATA".'), 'Add the disclosure next to personalised prices.', { applies: 'shop' }),
  R('USST-05', 'Washington My Health My Data policy', 2, 'RCW 19.373', link('consumer health data'), 'Publish a separate Consumer Health Data Privacy Policy.', { trigger: 'health|zdrowi|wellness|fitness|pregnan|therapy|clinic' }),
  R('USST-06', 'Illinois BIPA: biometric consent and retention policy', 2, '740 ILCS 14', manual('If face/voice/fingerprint data is processed, check written consent and a public retention policy.'), 'Obtain written consent and publish a biometric retention schedule.', { trigger: 'biometric|face ?id|facial|fingerprint|voiceprint' }),
];

export const CA = [
  R('CAN-01', 'Privacy officer contact', 2, 'PIPEDA Sch. 1 Principle 4.1', text('privacy officer|chief privacy officer|responsable de la protection', 'privacy'), 'Name the privacy officer (title) and contact.'),
  R('CAN-02', 'CASL: express consent and unsubscribe', 2, 'CASL s. 6, 10, 11 (up to C$10M per violation)', manual('Check newsletter consent wording, sender ID and unsubscribe.'), 'Collect express consent, identify the sender and include an unsubscribe.', { trigger: P.newsletter }),
  R('CAN-03', 'Québec: person in charge of personal information published', 2, 'Law 25 - Act respecting the protection of personal information in the private sector s. 3.1', text('person in charge of the protection|responsable de la protection des renseignements personnels'), 'Publish the title and contact details of the person in charge of protecting personal information.', { missing: 'partial' }),
  R('CAN-04', 'Québec: tracking technologies off by default', 2, 'Law 25 s. 8.1', signal('trackers-before-consent'), 'Disable identification/profiling technologies by default.'),
  R('CAN-05', 'French version of the site (Québec)', 2, 'Charter of the French Language s. 52', hasLang('fr'), 'Provide French versions of the site and contracts for Québec consumers.', { missing: 'partial' }),
  R('CAN-06', 'All-in price (no drip pricing)', 1, 'Competition Act s. 74.01(1.1)', manual('Check that mandatory fees are included in displayed prices.'), 'Include mandatory fees in the advertised price.', { applies: 'shop' }),
];

export const MX = [
  R('MX-01', 'Aviso de privacidad', 3, 'LFPDPPP (2025) art. 15', text('aviso de privacidad'), 'Publish an "Aviso de privacidad" (integral) and link it.'),
  R('MX-02', 'Total price including taxes', 1, 'LFPC art. 7 bis', text('IVA incluido|precio total|incluye IVA'), 'Show prices with all taxes and charges.', { applies: 'shop', missing: 'partial' }),
  R('MX-03', 'Information in Spanish', 2, 'LFPC art. 76 bis', lang('es', 'privacy'), 'Provide information in Spanish.'),
  R('MX-04', 'Auto-renewal notice and easy cancellation', 1, 'LFPC (2025 reform)', manual('Check renewal notices and cancellation path.'), 'Notify before renewals and allow easy cancellation.', { trigger: P.subscription }),
];

export const BR = [
  R('BR-01', 'LGPD notice with the encarregado (DPO) contact', 3, 'LGPD art. 9, 41', text('encarregado|\\bDPO\\b', 'privacy'), 'Publish the identity and contact of the encarregado.'),
  R('BR-02', 'CNPJ, address and service channel', 3, 'Decreto 7.962/2013 art. 2', text('\\bCNPJ\\b'), 'Show CNPJ, physical address and a service channel.'),
  R('BR-03', '7-day right of regret', 2, 'CDC art. 49', count({ groups: [['7 days', '7 dias|sete dias'], ['regret', 'arrependimento|desistência|devolução']] }), 'Explain the 7-day right of regret.', { applies: 'shop' }),
  R('BR-04', 'ECA Digital: services likely used by minors', 1, 'Lei 15.211/2025 (ECA Digital) - from 17 Mar 2026', manual('If minors are likely users, check age assurance and no ad profiling of minors.'), 'Implement age assurance and protections for minors.', { trigger: P.kids }),
  R('BR-05', 'Information in Portuguese', 2, 'CDC art. 31', lang('pt', 'privacy'), 'Provide information in Portuguese.'),
];

export const AR = [
  R('AR-01', '"Botón de arrepentimiento" on the homepage', 3, 'Resolución SCI 424/2020', link('botón de arrepentimiento', 'boton de arrepentimiento', 'arrepentimiento'), 'Add the "Botón de arrepentimiento" on the homepage.', { applies: 'shop' }),
  R('AR-02', '"Botón de baja" for subscriptions', 2, 'Resolución 316/2018 / 2021 updates', link('botón de baja', 'boton de baja', 'darse de baja'), 'Add a cancellation ("baja") button.', { trigger: P.subscription }),
  R('AR-03', 'Data protection notice (Ley 25.326)', 1, 'Ley 25.326 art. 6', text('25\\.326|\\bAAIP\\b', 'privacy'), 'Reference Ley 25.326 and the AAIP.', { missing: 'partial', verify: true }),
];

export const PE = [R('PE-01', 'Virtual Libro de Reclamaciones', 3, 'Código de Protección y Defensa del Consumidor art. 150; D.S. 011-2011-PCM', link('libro de reclamaciones'), 'Provide a virtual complaints book.', { verify: true })];
export const CO = [
  R('CO-01', 'Política de tratamiento de datos (Ley 1581)', 2, 'Ley 1581/2012; Decreto 1377/2013', text('1581|política de tratamiento', 'privacy'), 'Publish the data-processing policy under Ley 1581.'),
  R('CO-02', 'SIC link and PQR complaints channel', 2, 'Ley 1480/2011 (Estatuto del Consumidor)', text('\\bPQRS?\\b|Superintendencia de Industria'), 'Provide a PQR channel and a link to the SIC.', { applies: 'shop', verify: true }),
];
export const CL = [
  R('CL-01', 'Ley 21.719 readiness (personal data)', 1, 'Ley 21.719 - in force 1 Dec 2026 (postponement to 15 Oct 2027 pending)', manual('Check the privacy notice against Ley 21.719 duties.'), 'Update the privacy notice for Ley 21.719.', { verify: true }),
  R('CL-02', 'SERNAC consumer information', 1, 'Ley 19.496', text('\\bSERNAC\\b'), 'Reference SERNAC complaint channels.', { applies: 'shop', missing: 'partial', verify: true }),
];

export const JP = [
  R('JP-01', 'Specified Commercial Transactions Act page (tokushoho)', 3, '特定商取引法 art. 11', link('特定商取引', 'tokushoho', 'specified commercial', 'commercial transactions'), 'Publish the 特定商取引法に基づく表記 page.', { applies: 'shop' }),
  R('JP-02', 'APPI privacy policy', 2, 'APPI art. 21, 32', text('個人情報|privacy', 'privacy'), 'Publish a privacy policy under the APPI.'),
  R('JP-03', 'Japanese-language information', 1, 'Consumer law practice', lang('ja', 'privacy'), 'Provide Japanese versions of legal pages.', { missing: 'partial' }),
];
export const KR = [
  R('KR-01', '개인정보 처리방침 with the CPO', 3, 'PIPA art. 30, 31', text('개인정보 ?보호 ?책임자|개인정보보호책임자', 'privacy'), 'Name the Chief Privacy Officer in the privacy policy.'),
  R('KR-02', 'Business registration and mail-order numbers in the footer', 3, 'E-Commerce Act art. 10', count({ groups: [['사업자등록번호', '사업자 ?등록 ?번호'], ['통신판매업', '통신판매업']] }), 'Show business registration and mail-order sales registration numbers.', { applies: 'shop' }),
  R('KR-03', '7-day withdrawal (청약철회)', 2, 'E-Commerce Act art. 17', text('청약 ?철회|7일'), 'Explain the 7-day withdrawal right.', { applies: 'shop' }),
];
export const CN = [
  R('CN-01', 'ICP filing number in the footer (if hosted in mainland China)', 2, 'Measures for the Administration of Internet Information Services', text('ICP备|ICP证'), 'Show the ICP number if hosted in mainland China.', { missing: 'manual' }),
  R('CN-02', 'PIPL privacy policy', 2, 'PIPL art. 17', text('个人信息|隐私', 'privacy'), 'Publish a PIPL-compliant privacy policy.'),
  R('CN-03', 'Separate consent for sensitive data and cross-border transfer', 2, 'PIPL art. 29, 39', manual('Check separate consent flows.'), 'Collect separate consent where PIPL requires it.'),
];
export const VN = [
  R('VN-01', 'Opt-in for cookies (PDPL)', 3, 'Personal Data Protection Law 2025 - from 1 Jan 2026', signal('trackers-before-consent'), 'Obtain opt-in before tracking.'),
  R('VN-02', 'E-commerce notification for Vietnamese-language sites', 2, 'E-commerce Law - from 1 Jul 2026', manual('Check registration/notification duties for foreign sites with a Vietnamese version.'), 'Complete the e-commerce notification where required.', { verify: true }),
];
export const PH = [
  R('PH-01', 'Seller details on the homepage', 2, 'Internet Transactions Act 2023 (RA 11967)', signal('operator-identity'), 'Show seller identity and contact details.', { applies: 'shop' }),
  R('PH-02', 'NPC registration (above thresholds)', 1, 'Data Privacy Act 2012; NPC Circular 2022-04', manual('Check NPC registration.'), 'Register with the NPC where required.'),
];
export const SG = [R('SG-01', 'PDPA notice and DPO contact', 2, 'PDPA s. 11(5), s. 20', text('data protection officer|\\bPDPA\\b', 'privacy'), 'Publish the business contact of the DPO.')];
export const ID = [
  R('ID-01', 'PDP Law privacy notice', 1, 'UU 27/2022 (PDP Law)', manual('Check the privacy notice for PDP Law elements.'), 'Align the privacy notice with the PDP Law.'),
  R('ID-02', 'PSE registration (electronic system operator)', 2, 'MR 5/2020', manual('Check registration as a private PSE.'), 'Register as a PSE with Kominfo/Komdigi.'),
];
export const IN = [
  R('IN-01', 'Grievance officer name and contact', 3, 'IT (SPDI) Rules 2011 r. 5(9); Consumer Protection (E-Commerce) Rules 2020 r. 4', text('grievance officer'), 'Publish the grievance officer\'s name and contact.'),
  R('IN-02', 'E-commerce seller details and country of origin', 2, 'Consumer Protection (E-Commerce) Rules 2020 r. 5-6', manual('Check product pages for seller details and country of origin.'), 'Show seller details and country of origin.', { applies: 'shop' }),
  R('IN-03', 'No dark patterns', 1, 'Guidelines for Prevention and Regulation of Dark Patterns 2023', manual('Review checkout and consent flows for the 13 listed dark patterns.'), 'Remove dark patterns.'),
  R('IN-04', 'DPDP Act readiness', 1, 'DPDP Act 2023 and Rules 2025 - from 13 May 2027', manual('Plan DPDP notice and consent manager integration.'), 'Prepare DPDP-compliant notice and consent.'),
];
export const AU = [
  R('AU-01', 'APP 1 privacy policy contents', 2, 'Privacy Act 1988 APP 1.4', text('Australian Privacy Principles|\\bAPPs?\\b|\\bOAIC\\b|overseas recipients', 'privacy'), 'Cover complaints, overseas disclosure and access/correction in the policy.'),
  R('AU-02', 'ABN shown', 1, 'A New Tax System (ABN) Act 1999', text('\\bABN\\b'), 'Show the ABN.', { missing: 'partial' }),
  R('AU-03', 'Automated decisions disclosed in the privacy policy', 1, 'Privacy and Other Legislation Amendment Act 2024 - from 10 Dec 2026', text('automated decision', 'privacy'), 'Disclose substantially automated decisions.', { missing: 'partial' }),
  R('AU-04', 'Spam Act: consent and unsubscribe', 1, 'Spam Act 2003', manual('Check consent and unsubscribe.'), 'Use consent and a functional unsubscribe.', { trigger: P.newsletter }),
  R('AU-05', 'No drip pricing', 1, 'Australian Consumer Law s. 48', manual('Check total price display.'), 'Show the single total price.', { applies: 'shop' }),
];
export const NZ = [R('NZ-01', 'Privacy statement and privacy officer', 2, 'Privacy Act 2020 IPP 3; s. 201', text('privacy officer|Privacy Act 2020', 'privacy'), 'Publish a privacy statement naming the privacy officer.')];
export const SA = [
  R('SA-01', 'CR number and VAT number on the homepage', 3, 'E-Commerce Law art. 6', text('السجل التجاري|\\bCR\\b ?(No|Number)|Commercial Registration|الرقم الضريبي|\\bVAT\\b', 'home'), 'Show the CR and VAT numbers on the homepage.'),
  R('SA-02', 'Saudi Business Center verification', 1, 'E-Commerce Law implementing regs', manual('Check the Saudi Business Center (Maroof) verification.'), 'Verify the store with the Saudi Business Center.', { applies: 'shop' }),
  R('SA-03', 'Arabic-language information', 2, 'E-Commerce Law art. 6', hasLang('ar'), 'Provide Arabic versions of legal and consumer information.', { missing: 'partial' }),
];
export const AE = [
  R('AE-01', 'Arabic consumer information and contracts', 1, 'Federal Law 15/2020 (Consumer Protection)', hasLang('ar'), 'Provide consumer information in Arabic.', { missing: 'partial' }),
  R('AE-02', 'PDPL privacy notice', 1, 'Federal Decree-Law 45/2021', text('\\bPDPL\\b|Decree-Law (No\\. )?45', 'privacy'), 'Reference the UAE PDPL.', { missing: 'partial', verify: true }),
];
export const EG = [
  R('EG-01', 'Arabic privacy notice', 1, 'Law 151/2020', hasLang('ar'), 'Provide an Arabic privacy notice.', { missing: 'partial' }),
  R('EG-02', 'PDPC licence and DPO', 1, 'Law 151/2020 art. 8, 26', manual('Check PDPC licence and DPO appointment.'), 'Obtain the PDPC licence and appoint a DPO.'),
];
export const IL = [
  R('IL-01', 'Accessibility statement (IS 5568)', 3, 'Equal Rights for Persons with Disabilities Regulations 2013 reg. 35', link('הצהרת נגישות', 'accessibility statement', 'נגישות', 'accessibility'), 'Publish an accessibility statement with a contact.'),
  R('IL-02', 'Accessibility basics (≈WCAG 2.0 AA)', 2, 'IS 5568', signal('a11y-basics'), 'Meet IS 5568 (≈WCAG 2.0 AA).'),
];
export const NG = [
  R('NG-01', 'Privacy and cookie notices on the homepage', 2, 'NDPA 2023; GAID 2025 art. 29', signal('privacy-linked'), 'Link the privacy and cookie notices on the homepage.'),
  R('NG-02', 'Banner prominence (centre/side, not a bottom strip)', 2, 'GAID 2025 - from 19 Sep 2025', manual('Check that the consent banner substantially covers the centre or side of the screen.'), 'Use a prominent banner with accept/reject.'),
];
export const ZA = [
  R('ZA-01', 'ECT Act s43 website disclosures', 3, 'ECT Act 2002 s. 43(1)', count({ min: 4, groups: [
    ['legal status / registration number', 'registration number|reg\\.? no|\\(Pty\\) Ltd|CIPC'],
    ['physical address', 'physical address|street|road|avenue'],
    ['privacy policy', 'privacy'],
    ['returns / refunds', 'return|refund'],
    ['security procedures', 'security|SSL|encrypt'],
    ['complaints / ADR', 'complaint|dispute'],
  ] }), 'Publish the ECT Act s43 information (legal status, address, registration, policies, security procedures).', { applies: 'shop' }),
  R('ZA-02', 'PAIA manual', 2, 'PAIA s. 51', link('PAIA', 'promotion of access to information'), 'Publish the PAIA manual.'),
  R('ZA-03', 'Information Officer named', 2, 'POPIA s. 55', text('information officer', 'privacy'), 'Name the registered Information Officer.'),
  R('ZA-04', '7-day cooling-off', 1, 'ECT Act s. 44', text('cooling[- ]off|7 days|seven days'), 'Explain the 7-day cooling-off right.', { applies: 'shop' }),
];
export const KE = [
  R('KE-01', 'ODPC registration (above thresholds)', 1, 'Data Protection (Registration) Regulations 2021', manual('Check ODPC registration.'), 'Register with the ODPC where required.'),
  R('KE-02', 'Data Protection Act notice', 1, 'Data Protection Act 2019 s. 29', text('Data Protection Act|\\bODPC\\b', 'privacy'), 'Reference the Kenyan DPA and the ODPC.', { missing: 'partial' }),
];
export const MA = [R('MA-01', 'CNDP declaration / authorisation number', 2, 'Loi 09-08', text('\\bCNDP\\b|09-08'), 'Show the CNDP receipt/authorisation number.')];

export const WORLD = { US, 'US-CA': US_CA, 'US-STATES': US_STATES, CA, MX, BR, AR, PE, CO, CL, JP, KR, CN, VN, PH, SG, ID, IN, AU, NZ, SA, AE, EG, IL, NG, ZA, KE, MA };
