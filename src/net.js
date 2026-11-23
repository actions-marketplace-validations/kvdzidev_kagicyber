import tls from 'node:tls';
import dns from 'node:dns/promises';

/** Inspect the TLS certificate and negotiated protocol (one handshake, no data sent). */
export function tlsInfo(host, port = 443, timeoutMs = 10000) {
  return new Promise((resolve) => {
    // Verification is off on purpose: the audit must read expired or untrusted certificates to report them.
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: timeoutMs }, () => { // kagicyber-ignore
      const cert = socket.getPeerCertificate();
      const info = {
        ok: true,
        authorized: socket.authorized,
        authorizationError: socket.authorizationError ? String(socket.authorizationError) : null,
        protocol: socket.getProtocol(),
        subject: cert?.subject?.CN || null,
        issuer: cert?.issuer?.O || cert?.issuer?.CN || null,
        validFrom: cert?.valid_from || null,
        validTo: cert?.valid_to || null,
        san: cert?.subjectaltname || null,
      };
      if (info.validTo) info.daysLeft = Math.floor((new Date(info.validTo) - Date.now()) / 86400000);
      socket.end();
      resolve(info);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'timeout' });
    });
    socket.on('error', (e) => resolve({ ok: false, error: e.code || e.message }));
  });
}

/**
 * Does the server still accept TLS 1.0/1.1? Returns true / false / null (could not test:
 * the local OpenSSL build may refuse legacy protocols entirely).
 */
export function acceptsLegacyTls(host, port = 443, timeoutMs = 8000) {
  return new Promise((resolve) => {
    let socket;
    try {
      socket = tls.connect(
        // Only the negotiated protocol matters here, not certificate trust.
        { host, port, servername: host, rejectUnauthorized: false, minVersion: 'TLSv1', maxVersion: 'TLSv1.1', ciphers: 'DEFAULT:@SECLEVEL=0', timeout: timeoutMs }, // kagicyber-ignore
        () => {
          const p = socket.getProtocol();
          socket.end();
          resolve(p === 'TLSv1' || p === 'TLSv1.1' ? p : false);
        }
      );
    } catch {
      return resolve(null);
    }
    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });
    socket.on('error', (e) => {
      const msg = `${e.code || ''} ${e.message || ''}`;
      if (/no protocols available|unsupported protocol|NO_PROTOCOLS|ERR_SSL_NO_PROTOCOLS/i.test(msg) && !/alert/i.test(msg)) return resolve(null);
      resolve(false);
    });
  });
}

/** SPF, DMARC and MX records for the apex domain. */
export async function mailDns(domain) {
  const txt = async (name) => {
    try {
      return (await dns.resolveTxt(name)).map((r) => r.join(''));
    } catch (e) {
      return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null;
    }
  };
  const mx = await dns.resolveMx(domain).then(
    (r) => r.map((x) => x.exchange),
    (e) => (e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null)
  );
  const [root, dmarcTxt, caa] = await Promise.all([
    txt(domain),
    txt(`_dmarc.${domain}`),
    dns.resolveCaa(domain).then(
      (r) => r.map((c) => c.issue || c.issuewild || c.iodef).filter(Boolean),
      (e) => (e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? [] : null)
    ),
  ]);
  return {
    domain,
    mx,
    caa,
    spf: root === null ? null : root.filter((r) => /^v=spf1/i.test(r)),
    dmarc: dmarcTxt === null ? null : dmarcTxt.filter((r) => /^v=DMARC1/i.test(r)),
    resolved: root !== null || mx !== null,
  };
}
