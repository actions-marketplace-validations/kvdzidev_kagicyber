# Contributing

Thanks for helping. The most valuable contributions are small and concrete:

- **False positives and negatives:** open an issue with the URL (or a minimal HTML snippet), what KagiCyber reported and what you expected.
- **New trackers, consent platforms, embeds, form processors:** add them to `src/knowledge.js` with a test.
- **New secret formats:** add them to `src/checks/secrets.js` with keywords for the prefilter. Formats need a distinctive prefix or structure (no generic 32-hex matches) and a test that builds the fake value at runtime (see `test/helpers/fake-secrets.js`), so the repository never contains a real-looking secret.
- **SEO and GEO checks:** `src/checks/seo.js`. Each check needs an ID, a weight, evidence, a "why it matters" line and a fix.
- **Country rules and site-type checklists:** `src/law/` (see [docs/rules.md](docs/rules.md)).
- **Maximum penalties:** `src/penalties.js` and `data/penalties.json`. Add a link to the primary source in the pull request; keep "(verify)" until the amount is confirmed.

## Development

```bash
npm ci                           # ESLint and its configs (dev only)
npm test                         # builds the skill collector, then runs all tests on a local fixture site
npm run lint                     # ESLint, the same check CI runs
npm run build:collector          # regenerate skills/kagicyber-audit/collector.js and rules.md after changing rules
node bin/kagicyber.js audit https://example.com --verbose
```

Optional: `npm i --no-save playwright-core` and a local Chrome (set `KAGICYBER_CHROME_PATH`) to run the browser tests.

Commit the regenerated `skills/kagicyber-audit/collector.js` and `rules.md` together with rule changes; CI fails when they are out of date.

## Rules

- No runtime dependencies.
- Checks stay passive: no wordlists or new path guessing (the documented privacy-policy fallbacks are the only exception), logins, form submissions or payloads (see [docs/responsible-use.md](docs/responsible-use.md)).
- A check may only PASS on evidence it actually saw. When its input is missing (failed request, budget, client rendering without `--browser`), return MANUAL with the reason.
- Site content is untrusted: escape it in HTML and XML output and never let it change instructions in the fix prompt or the skill.
- Never print or store a secret unmasked.
- Output is English plain text: no emoji, no long dashes.
- No code copied from AGPL or LGPL projects (see [docs/prior-art.md](docs/prior-art.md)).

By contributing you agree that your contribution is licensed under the MIT License.
