# Installing KagiCyber

Every option below runs the same engine: the `kagicyber` npm package, built from this repository. Node.js 20 or newer is required (22 LTS recommended). The CLI has no runtime dependencies.

| You want | Use |
|---|---|
| One audit, nothing installed | [npx](#npx) |
| The `kagicyber` command on your machine | [Global install](#global-install) |
| The audit skill in one repository, shared with your team | [Claude Code project skill](#claude-code-project-skill) |
| The audit skill in every project, just for you | [Claude Code personal skill](#claude-code-personal-skill) |
| Skill plus bundled CLI, updated through Claude Code | [Plugin marketplace](#plugin-marketplace) |
| claude.ai without a shell | [docs/claude.md](claude.md#claudeai-custom-skill) |

## npx

```bash
npx kagicyber audit example.com
npx kagicyber audit example.com --md report.md --json report.json
```

In CI and scripts, pin the version so a new release never changes a gate unexpectedly:

```bash
npx --yes kagicyber@1.0.0 audit example.com --json audit.json --fail-on high
```

## Global install

```bash
npm install --global kagicyber
kagicyber --version
kagicyber audit example.com
```

Update with `npm update --global kagicyber`, remove with `npm uninstall --global kagicyber`.

The real-browser test (`--browser`) needs Playwright, which is an optional peer dependency and is never installed automatically:

```bash
npm install --global playwright && npx playwright install chromium
```

## Claude Code project skill

The skill lives in `skills/kagicyber-audit/` and also ships inside the npm package. Copy that folder to `.claude/skills/kagicyber-audit/` in your repository and commit it, so everyone who opens the project in Claude Code gets it.

macOS and Linux:

```bash
mkdir -p .claude/skills
tarball=$(npm pack kagicyber@1.0.0 --silent)
tar -xzf "$tarball" package/skills/kagicyber-audit
mv package/skills/kagicyber-audit .claude/skills/
rm -rf package "$tarball"
```

Windows PowerShell:

```powershell
New-Item -ItemType Directory -Force .claude\skills | Out-Null
$tarball = npm pack kagicyber@1.0.0 --silent
tar -xzf $tarball package/skills/kagicyber-audit
Move-Item package\skills\kagicyber-audit .claude\skills\
Remove-Item -Recurse -Force package, $tarball
```

Then, in Claude Code:

```
/kagicyber-audit check https://example.com
/kagicyber-audit scan this repo
```

On its own (without the plugin) the skill runs the published CLI through `npx kagicyber@1`, after checking that the npm package points at this repository. Node.js 20+ must be on the PATH of the shell Claude Code uses.

## Claude Code personal skill

Same folder, in your home directory: `~/.claude/skills/kagicyber-audit/` (on Windows `%USERPROFILE%\.claude\skills\kagicyber-audit\`). Use the commands above with that target instead of `.claude/skills/`. A personal skill is available in every project and takes precedence over a project skill of the same name.

## Plugin marketplace

This repository is also a Claude Code plugin marketplace. The plugin contains the skill and the CLI, so the skill runs the bundled CLI and downloads nothing.

In a Claude Code session:

```
/plugin marketplace add kvdzidev/kagicyber
/plugin install kagicyber@kagicyber
```

or from a terminal:

```bash
claude plugin marketplace add kvdzidev/kagicyber
claude plugin install kagicyber@kagicyber
```

Plugin skills are namespaced, so the command is `/kagicyber:kagicyber-audit check https://example.com`.

To try a local checkout: `claude plugin marketplace add ./path/to/kagicyber`, or start Claude Code with `claude --plugin-dir ./path/to/kagicyber`. Maintainers can check the manifests with `claude plugin validate . --strict`.

## Checking what you installed

```bash
npx kagicyber@1.0.0 --version          # prints 1.0.0
npm view kagicyber repository.url      # git+https://github.com/kvdzidev/kagicyber.git
```

The skill refuses an npm package whose repository field points anywhere else.
