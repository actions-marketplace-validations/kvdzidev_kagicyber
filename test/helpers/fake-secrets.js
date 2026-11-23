// Test credentials are assembled at runtime so the repository never contains a
// literal that secret scanners (including GitHub push protection) would flag.
const j = (...p) => p.join('');
export const FAKE = {
  aws: j('AK', 'IA', 'IOSFODNN7', 'EXAMPLQ'),
  google: j('AI', 'za', 'SyD-1234567890', 'abcdefghijklmnopqrstu'),
  stripeLive: j('sk', '_live_', '51HxTestTestTestTestTest00'),
  github: j('gh', 'p_', 'aBcDeFgHiJkLmNoPqRsTuVwXyZ0123456789'),
  supabaseAnon: j('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', '.', Buffer.from('{"role":"anon","iss":"supabase"}').toString('base64url'), '.', 'abcdefghijklmnop'),
  supabaseService: j('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', '.', Buffer.from('{"role":"service_role","iss":"supabase"}').toString('base64url'), '.', 'abcdefghijklmnop'),
};
