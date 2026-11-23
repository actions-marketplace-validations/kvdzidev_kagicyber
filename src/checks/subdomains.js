import dns from 'node:dns/promises';

const TAKEOVER_SUFFIXES = ['github.io', 'herokuapp.com', 'herokudns.com', 'azurewebsites.net', 'cloudapp.net', 'trafficmanager.net', 'cloudfront.net', 's3.amazonaws.com', 's3-website', 'netlify.app', 'vercel.app', 'surge.sh', 'bitbucket.io', 'ghost.io', 'myshopify.com', 'wpengine.com', 'pantheonsite.io', 'zendesk.com', 'readme.io', 'fly.dev', 'pages.dev'];
const INTERESTING = /^(dev|stage|staging|test|uat|qa|preprod|old|beta|admin|panel|jenkins|grafana|kibana|vpn|git|gitlab|internal|backup|db|phpmyadmin|api-dev|sandbox)\b/i;

/** Passive discovery: subdomains from certificate-transparency logs plus a dangling-CNAME check (DNS only). */
export async function ctSubdomains(apex, { limit = 60, concurrency = 10 } = {}) {
  const findings = [];
  let names;
  try {
    const r = await fetch(`https://crt.sh/?q=%25.${encodeURIComponent(apex)}&output=json`, { signal: AbortSignal.timeout(25000), headers: { accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const rows = await r.json();
    names = [...new Set(rows.flatMap((x) => String(x.name_value).split('\n')).map((n) => n.trim().toLowerCase()).filter((n) => n.endsWith(apex) && !n.startsWith('*')))];
  } catch (e) {
    return { findings, subdomains: [], error: `crt.sh unavailable (${e.message})` };
  }
  const interesting = names.filter((n) => INTERESTING.test(n.replace(`.${apex}`, '')));
  if (interesting.length) {
    findings.push({ domain: 'A', severity: 'info', title: 'Sensitive-looking subdomains in certificate logs', evidence: interesting.slice(0, 8).join(', '), fix: 'Make sure staging/admin hosts require authentication or are not publicly reachable.', cwe: 'CWE-200', effort: 'M' });
  }
  const queue = names.slice(0, limit);
  const worker = async () => {
    while (queue.length) {
      const n = queue.shift();
      const target = await danglingTarget(n);
      if (target) {
        findings.push({ domain: 'A', severity: 'high', title: `Possible subdomain takeover: ${n}`, evidence: `${n} has a CNAME to ${target}, which does not resolve.`, fix: 'Remove the dangling DNS record or re-claim the resource at the provider.', cwe: 'CWE-284', owasp: 'Broken Access Control', effort: 'S' });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  return { findings, subdomains: names };
}

/** The CNAME target of a host when it points to a hosting provider and no longer resolves, otherwise null. */
async function danglingTarget(host) {
  let target;
  try {
    [target] = await dns.resolveCname(host);
  } catch {
    return null;
  }
  if (!target || !TAKEOVER_SUFFIXES.some((s) => target.includes(s))) return null;
  try {
    await dns.resolve(target);
    return null;
  } catch (e) {
    return e.code === 'ENOTFOUND' || e.code === 'NXDOMAIN' ? target : null;
  }
}
