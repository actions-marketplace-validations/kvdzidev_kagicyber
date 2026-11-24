# Releasing

For maintainers. One release publishes the same commit three ways: the npm package, the GitHub release tag (used by `npx github:kvdzidev/kagicyber#vX.Y.Z`, the GitHub Action and the skill's fallback) and the Claude Code plugin (served from the default branch).

## 1. Prepare

1. Set the version in `package.json`, `src/version.js`, `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`, and give it a dated entry in `CHANGELOG.md`. `test/package.test.js` fails until all of them agree and the skill's fallbacks (`kagicyber@<major>`, `#v<version>`) match.
2. If legal rules changed, bump `RULES_VERSION` in `src/version.js`.
3. Run `npm run build:collector` and commit the regenerated `skills/kagicyber-audit/collector.js` and `rules.md`.

## 2. Verify

```bash
npm ci
npm run lint
npm test
npm run build:collector && git diff --exit-code skills/
claude plugin validate . --strict
npm pack --dry-run
```

Then install the packed tarball into an empty project and run it against a site you own:

```bash
npm pack                                   # writes kagicyber-X.Y.Z.tgz
mkdir /tmp/kc-try && cd /tmp/kc-try && npm init -y >/dev/null
npm install /path/to/kagicyber-X.Y.Z.tgz
npx kagicyber --version
npx kagicyber audit https://your-site.example --json out.json; echo "exit $?"
```

CI runs the tests on Node 20, 22 and 24 on Linux and on Windows; the release commit must be green.

## 3. Publish

```bash
npm login                                  # once per machine; use an account with 2FA
npm whoami
npm publish                                # runs lint and tests first (prepublishOnly)
git tag -a vX.Y.Z -m "KagiCyber X.Y.Z"
git push origin vX.Y.Z
```

Create the GitHub release from the tag with the CHANGELOG section as the notes. Check the result:

```bash
npm view kagicyber version repository.url
npx --yes kagicyber@X.Y.Z --version
```

npm versions cannot be reused: an unpublished version number stays taken. If something is wrong, publish a patch release; `npm deprecate kagicyber@X.Y.Z "reason"` warns people off a broken version.

## Provenance (optional, recommended)

`npm publish --provenance` links the package to the commit and workflow that built it, so users can verify where it came from. It only works from a CI provider with OIDC (for example GitHub Actions with `permissions: id-token: write`), not from a laptop. A release workflow triggered by a `v*` tag that runs `npm ci && npm test && npm publish --provenance` with an `NPM_TOKEN` secret (or npm trusted publishing) gives that. Add it only when releases should be published from CI.
