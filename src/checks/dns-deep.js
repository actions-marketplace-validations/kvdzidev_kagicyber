import dns from 'node:dns/promises';

const DKIM_SELECTORS = ['default', 'google', 'selector1', 'selector2', 'k1', 'k2', 's1', 's2', 'mail', 'dkim', 'hostingermail1', 'mx', 'smtp', 'zoho', 'protonmail', 'fm1', 'mandrill', 'sendgrid', 'mailjet'];

const txt = async (name) => {
  try {
    return (await dns.resolveTxt(name)).map((r) => r.join(''));
  } catch {
    return [];
  }
};

/** Deep e-mail and DNS checks (passive lookups only): DKIM, MTA-STS, TLS-RPT, DNSSEC. CAA is checked in the core e-mail checks. */
export async function dnsDeep(apex, { doh = true } = {}) {
  const findings = [];
  const f = (severity, title, evidence, fix) => findings.push({ domain: 'M', severity, title, evidence, fix, owasp: 'E-mail security', effort: 'S' });
  const mx = await dns.resolveMx(apex).catch(() => []);
  const found = await Promise.all(DKIM_SELECTORS.map(async (sel) => ((await txt(`${sel}._domainkey.${apex}`)).some((x) => /v=DKIM1|k=rsa|p=/i.test(x)) ? sel : null)));
  const dkim = found.filter(Boolean);
  if (mx.length && !dkim.length) f('info', 'DKIM key not found among common selectors', `Checked ${DKIM_SELECTORS.length} selectors (not proof of absence).`, 'Enable DKIM signing at your mail provider and publish the key.');
  const [mtaSts, tlsRpt] = await Promise.all([txt(`_mta-sts.${apex}`), txt(`_smtp._tls.${apex}`)]);
  if (mx.length && !mtaSts.some((x) => /v=STSv1/i.test(x))) f('info', 'MTA-STS not configured', `No _mta-sts.${apex} record.`, 'Publish MTA-STS (TXT + policy file) to enforce TLS for inbound mail.');
  if (mx.length && !tlsRpt.some((x) => /v=TLSRPTv1/i.test(x))) f('info', 'TLS-RPT not configured', `No _smtp._tls.${apex} record.`, 'Add a TLS-RPT record to receive SMTP TLS failure reports.');
  let caa = [];
  try {
    caa = await dns.resolveCaa(apex);
  } catch {}
  let dnssec = null;
  if (doh) {
    try {
      const r = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(apex)}&type=A&do=1`, { signal: AbortSignal.timeout(8000) });
      dnssec = (await r.json()).AD === true;
      if (!dnssec) f('info', 'DNSSEC not enabled', 'Resolver did not return the AD flag.', 'Enable DNSSEC at the registrar/DNS provider.');
    } catch {}
  }
  return { findings, data: { mx, dkimSelectors: dkim, mtaSts: mtaSts.length > 0, tlsRpt: tlsRpt.length > 0, caa: caa.map((c) => c.issue || c.issuewild).filter(Boolean), dnssec } };
}
