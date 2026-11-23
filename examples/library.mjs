// Run an audit from your own code and write all report formats.
// Usage: node examples/library.mjs example.com
import { writeFileSync } from 'node:fs';
import { audit, renderMarkdown, renderHtml, renderFixPrompt, renderSarif } from 'kagicyber';

const target = process.argv[2] || 'example.com';
const result = await audit(target, { profile: 'balanced' });

console.log(result.scores);
for (const set of result.compliance.sets) console.log(`${set.name}: ${set.score}/100`);

writeFileSync('kagicyber-report.md', renderMarkdown(result));
writeFileSync('kagicyber-report.html', renderHtml(result));
writeFileSync('kagicyber-report.json', JSON.stringify(result, null, 2));
writeFileSync('kagicyber.sarif', JSON.stringify(renderSarif(result), null, 2));
writeFileSync('fix-prompt.md', renderFixPrompt(result));
