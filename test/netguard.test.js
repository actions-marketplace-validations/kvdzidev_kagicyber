import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isBlockedAddress, assertPublicHost } from '../src/netguard.js';
import { Fetcher } from '../src/http.js';

test('non-public addresses are blocked, public ones are not', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.16.0.1', '192.168.1.1', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', '::ffff:127.0.0.1', '::ffff:7f00:1', 'fe80::1', 'fd00::1', '64:ff9b::a9fe:a9fe', '2002:a9fe:a9fe::1', 'nonsense']) {
    assert.equal(isBlockedAddress(ip), true, ip);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '::ffff:8.8.8.8', '2606:4700:4700::1111']) assert.equal(isBlockedAddress(ip), false, ip);
});

test('a hostname is blocked when any of its addresses is private', async () => {
  const lookup = async () => [{ address: '93.184.216.34', family: 4 }, { address: '10.0.0.5', family: 4 }];
  await assert.rejects(assertPublicHost('mixed.example', lookup), /blocked non-public address/);
  await assert.rejects(assertPublicHost('printer.local', lookup), /blocked/);
  await assertPublicHost('public.example', async () => [{ address: '93.184.216.34', family: 4 }]);
});

test('publicOnly re-checks every redirect hop', async (t) => {
  const realFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = realFetch));
  const seen = [];
  globalThis.fetch = async (url) => {
    seen.push(url);
    return new Response('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } });
  };
  const f = new Fetcher({ delayMs: 0, publicOnly: true, lookup: async () => [{ address: '93.184.216.34', family: 4 }] });
  const r = await f.get('https://public.example/');
  assert.equal(r.status, 0);
  assert.match(r.error, /blocked non-public address for 169\.254\.169\.254/);
  assert.deepEqual(seen, ['https://public.example/'], 'the metadata address is never requested');
});
