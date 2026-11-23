# The rule base

KagiCyber evaluates compliance in four layers. All of them run on the evidence of one audit; nothing is fetched twice.

| Layer | Where | Rules | When it applies |
|---|---|---|---|
| EU baseline | `src/checks/compliance.js` | 14 (C-01 to C-14) | Every audit |
| EU extended checklist | `src/law/eu.js` (`EU`) | 30 (`EU-A...`) | EU-facing sites and sites with no clear country |
| National modules | `src/law/europe.js`, `src/law/world.js` | 58 jurisdictions | Detected countries (high or medium confidence), plus `--include` |
| Site-type checklists | `src/law/eu.js` (`SHOP`, `SAAS`, `FINTECH`) | 14, 6, 10 | Detected site type, plus `--type` |

`kagicyber rules` prints the current list with rule counts.

## No double counting

Many national rules restate a baseline duty (for example "no trackers before consent" under the Polish electronic communications law). Those rules are not shown as separate rows: their legal basis is added to the baseline row ("Poland: Art. 399 PKE"), and the row keeps one status. The EU checklist rules that overlap a baseline check are listed in `COVERED_BY_CORE` in `src/law/evaluate.js`.

## Writing a rule

Rules use the small DSL in `src/law/dsl.js`:

```js
R('PL-03', 'NIP shown', 2, 'Art. 5 UŚUDE; art. 206 KSH',
  text('NIP[:\\s]*\\d{3}-?\\d{3}-?\\d{2}-?\\d{2}'),
  'Show the NIP (tax ID) with the company data.',
  { applies: 'all', trigger: null, missing: 'fail', verify: false })
```

- **ID:** `<JURISDICTION>-<nn>` (EU checklist `EU-A...`, site types `SHOP-`, `SAAS-`, `FIN-`). Never reuse an ID: baselines, ignores and SARIF depend on it.
- **Weight:** 3 core legal duty, 2 important, 1 minor or best practice.
- **Basis:** the article or regulation, with the in-force date when recent.
- **Verification:** `link`, `text`, `count`, `signal` (fold into a baseline check), `lang`, `hasLang`, `absent`, `inventory`, `browserReject`, `noFinding`, `linkParam` or `manual(how)` when a person must check (checkout flows, thresholds, registrations).
- **trigger:** a regular expression; the rule is N/A when the site text does not match, which keeps scores fair.
- **missing:** the status when nothing is found (`fail`, `partial` or `manual`).
- **verify: true:** the requirement still needs confirmation in a primary source; the report marks it "(verify)".

Titles, bases and fixes are plain English with no emoji and no long dashes (a test enforces this).

## Adding a country

1. Add the rule array to `europe.js` or `world.js` and register it in `EUROPE` or `WORLD`.
2. Make sure `src/jurisdiction.js` detects the country (language, ccTLD, currency, phone prefix, company identifiers).
3. Add maximum penalties to `data/penalties.json` (with the rule IDs they relate to) and, for the baseline areas, to `src/penalties.js`.
4. Run `npm test`.

Please link the primary source for every new rule in the pull request.
