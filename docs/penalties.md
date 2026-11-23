# Maximum penalties

Every compliance row in the report shows the maximum penalty for its area in the jurisdiction KagiCyber selects: the strongest detected country (from language, domain, currency, phone prefixes and company identifiers) or the one you pass with `--country`. If no country is detected, EU ceilings are shown.

These are statutory ceilings, not predictions. Regulators usually start with guidance or small fines. Entries marked (verify) still need confirmation in a primary source. Not legal advice.

| Area | Checks | EU default | National values |
|---|---|---|---|
| Transparency | C-02, C-03, C-04, C-05 | GDPR art. 83(5): up to EUR 20M or 4% of worldwide turnover | PL (UODO), GB (UK GDPR GBP 17.5M or 4%), CH (FADP, CHF 250,000 on individuals), US (FTC, CCPA), CA (PIPEDA offences up to CAD 100,000; Quebec Law 25 administrative penalties), BR (LGPD) |
| Lawfulness | C-10 | GDPR art. 83(5) | PL, DE (plus civil claims and Abmahnung), GB, CH, US, BR |
| Cookies | C-06, C-07, C-08, C-09 | National ePrivacy fines; GDPR ceiling where enforced through consent rules | PL (UKE, up to 3% of revenue, verify), DE (TDDDG, EUR 300,000), AT, FR (CNIL), IT (Garante), ES (LSSI-CE, up to EUR 150,000 for serious breaches, verify), NL (ACM, verify), IE, GB (PECR, GBP 17.5M or 4%), US (CCPA, CIPA), CA, BR |
| Operator identity | C-01 | Set nationally | PL (no dedicated fine; UOKiK route), DE (DDG, EUR 50,000), AT (verify), FR (LCEN, EUR 375,000), ES (verify), GB (verify), US (CAN-SPAM) |
| Consumer law | C-11, C-12 | Omnibus: at least 4% of turnover or EUR 2M for widespread infringements | PL (UOKiK, 10% of turnover), DE (Art. 246e EGBGB), FR (DGCCRF), IT (AGCM, EUR 10M), GB (CMA, 10% of worldwide turnover), US (FTC), CA (Competition Act) |
| Accessibility | C-14 | National EAA penalties (Germany up to EUR 100,000) | PL (verify), DE (BFSG), GB (Equality Act claims), US (ADA, Unruh Act) |
| AI transparency | C-13 | AI Act art. 99(4): up to EUR 15M or 3% | - |

The table lives in [`src/penalties.js`](../src/penalties.js). Rows from the EU checklist, the national modules and the site-type checklists first use the national penalty table in [`data/penalties.json`](../data/penalties.json) (linked to rule IDs), then this table by legal area. Corrections with a source link are very welcome.
