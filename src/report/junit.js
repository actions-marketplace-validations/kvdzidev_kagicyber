// XML 1.0 forbids most control characters; a site could otherwise make the file unparseable.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const esc = (s) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[ch]);

/** JUnit XML: one test suite per pillar, one test case per check; FAIL and PARTIAL are failures. */
export function renderJunit(r) {
  const suites = [];
  const suite = (name, cases) => {
    const failures = cases.filter((x) => x.failure).length;
    const skipped = cases.filter((x) => x.skipped).length;
    suites.push(
      `  <testsuite name="${esc(name)}" tests="${cases.length}" failures="${failures}" skipped="${skipped}">\n${cases
        .map((x) => `    <testcase classname="${esc(name)}" name="${esc(x.name)}">${x.failure ? `<failure message="${esc(x.message)}">${esc(x.detail)}</failure>` : x.skipped ? '<skipped/>' : ''}</testcase>`)
        .join('\n')}\n  </testsuite>`
    );
  };
  const fromChecks = (list) =>
    list.filter((c) => !c.ignored).map((c) => ({ name: `${c.id} ${c.title}`, failure: c.status === 'fail' || c.status === 'partial', skipped: c.status === 'na' || c.status === 'manual', message: c.status.toUpperCase(), detail: `${c.evidence} ${c.fix || ''}` }));
  if (r.compliance) suite('Compliance', fromChecks([...r.compliance.checks, ...(r.compliance.sets || []).flatMap((s) => s.results)]));
  suite('Security', (r.security?.findings || []).filter((f) => !f.ignored).map((f) => ({ name: `${f.id || ''} ${f.title}`.trim(), failure: f.severity !== 'info', message: f.severity.toUpperCase(), detail: `${f.evidence} ${f.fix || ''}` })));
  if (r.seo) suite('SEO and GEO', fromChecks(r.seo.checks));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites name="KagiCyber ${esc(r.target?.host || r.target?.path || '')}">\n${suites.join('\n')}\n</testsuites>\n`;
}
