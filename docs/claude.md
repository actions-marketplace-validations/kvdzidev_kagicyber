# Using KagiCyber with Claude

## Claude Code (plugin)

```
/plugin marketplace add kvdzidev/kagicyber
/plugin install kagicyber@kagicyber
```

Then ask `/kagicyber-audit check example.com` or `/kagicyber-audit scan this repo`.

The marketplace command needs the repository on GitHub to contain this plugin (`.claude-plugin/marketplace.json` at its root). To try a local checkout instead, run `/plugin marketplace add /path/to/kagicyber`, or start Claude Code with `claude --plugin-dir /path/to/kagicyber`.

In Claude Code the skill runs the CLI that ships inside the plugin (`node <plugin>/bin/kagicyber.js`, Node.js 20+), so nothing is downloaded. If that file is missing it falls back to the npm package (after checking that it points at this repository) or a tagged GitHub release, never an untagged branch. It reads the JSON and writes the report in the standard layout: overview with three scores, then Compliance (EU baseline, EU checklist, each jurisdiction and site type, every row with a maximum penalty), Security, SEO and GEO, priorities, one fix prompt for all findings and limitations. Plain text, English, no emoji.

## claude.ai (custom skill)

1. Download `skills/kagicyber-audit/` from this repository and zip the folder.
2. In Claude: Customize, Skills, Upload a skill.
3. Ask: `/kagicyber-audit check example.com`.

Without a shell, the skill opens the site in Claude's browser and runs one collector script that gathers all evidence in a single step (headers, links, legal pages, scripts, robots.txt, sitemap, llms.txt, DNS over HTTPS), then checks the cookie banner. That keeps the audit to a handful of tool calls. The skill carries a compact version of the national modules and site-type checklists for this path.

## Scope

The skill covers the same three pillars as the CLI, with passive checks only. In the browser path, TLS details and the HttpOnly flag of cookies cannot be read, and the collector runs inside the audited page, so everything it returns is treated as untrusted data. Checks that cannot run are reported as "not run" or MANUAL, never as PASS. For a scheduled monthly re-audit, see [kagicyber.com](https://kagicyber.com).
