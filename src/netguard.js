import dns from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

/**
 * Public-address guard for `kagicyber serve`, where the target comes from an API caller.
 * Every hostname is resolved and rejected when any address is loopback, private, link-local
 * (including cloud metadata such as 169.254.169.254), carrier-grade NAT, multicast or reserved.
 *
 * Residual risk: the check runs before the connection, so a DNS answer that changes between the
 * check and the connect (DNS rebinding) is not covered. Also run the API without a route to
 * internal networks (see docs/api.md).
 */
export class BlockedAddressError extends Error {
  constructor(host, address) {
    super(`blocked non-public address for ${host}${address && address !== host ? ` (${address})` : ''}`);
    this.code = 'EBLOCKED';
  }
}

const BLOCKED = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
]) BLOCKED.addSubnet(net, bits, 'ipv4');
for (const [net, bits] of [
  ['::', 128], ['::1', 128], // unspecified, loopback
  ['::', 96], // IPv4-compatible (deprecated)
  ['64:ff9b::', 96], ['64:ff9b:1::', 48], // NAT64: can reach internal IPv4
  ['100::', 64], // discard
  ['2001:db8::', 32], // documentation
  ['2002::', 16], // 6to4: can embed internal IPv4
  ['fc00::', 7], // unique local
  ['fe80::', 10], ['fec0::', 10], // link-local, site-local
  ['ff00::', 8], // multicast
]) BLOCKED.addSubnet(net, bits, 'ipv6');

/** True when the literal IP address is not a public unicast address (IPv4-mapped IPv6 is checked as IPv4). */
export function isBlockedAddress(ip) {
  const v = isIP(ip);
  if (!v) return true;
  const mapped = v === 6 && ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return BLOCKED.check(mapped[1], 'ipv4');
  return BLOCKED.check(ip, v === 4 ? 'ipv4' : 'ipv6');
}

/** Resolve `hostname` and throw BlockedAddressError unless every address is public. */
export async function assertPublicHost(hostname, lookup = dns.lookup) {
  const host = String(hostname).replace(/^\[|\]$/g, '');
  if (isIP(host)) {
    if (isBlockedAddress(host)) throw new BlockedAddressError(host, host);
    return;
  }
  if (/(^|\.)(localhost|local|internal|home\.arpa)$/i.test(host)) throw new BlockedAddressError(host);
  const addrs = await lookup(host, { all: true, verbatim: true });
  if (!addrs.length) throw new BlockedAddressError(host);
  const bad = addrs.find((a) => isBlockedAddress(a.address));
  if (bad) throw new BlockedAddressError(host, bad.address);
}

/** Validate a URL for the guarded fetcher: http(s) only, public host. */
export async function assertPublicUrl(url, lookup) {
  const u = new URL(url);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new BlockedAddressError(`${u.protocol} URL`);
  await assertPublicHost(u.hostname, lookup);
}
