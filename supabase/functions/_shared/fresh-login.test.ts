import { assertEquals } from 'jsr:@std/assert@1';

import { authenticatedAt, FRESH_LOGIN_SECONDS, isFreshLogin } from './fresh-login.ts';

const jwt = (payload: unknown) => `Bearer h.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;
const amr = (method: string, timestamp: number) => ({ amr: [{ method, timestamp }] });

Deno.test('amr zamanı okunur; bozuk ya da amr\'siz anahtar null', () => {
  assertEquals(authenticatedAt(jwt(amr('password', 1000))), 1000);
  assertEquals(authenticatedAt(jwt({ amr: [{ method: 'password', timestamp: 5 }, { method: 'otp', timestamp: 9 }] })), 9);
  assertEquals(authenticatedAt('Bearer abc'), null);
  assertEquals(authenticatedAt(null), null);
  assertEquals(authenticatedAt(jwt({ sub: 'x', iat: 1000 })), null);
  assertEquals(authenticatedAt(jwt(amr('token_refresh', 1000))), null);
});

Deno.test('taze giriş penceresi: yalnızca yakın şifre/kod girişi; iat tek başına yetmez', () => {
  const now = 100_000;
  assertEquals(isFreshLogin(jwt(amr('password', now - 30)), now), true);
  assertEquals(isFreshLogin(jwt(amr('otp', now - 30)), now), true);
  assertEquals(isFreshLogin(jwt(amr('password', now - FRESH_LOGIN_SECONDS - 1)), now), false);
  assertEquals(isFreshLogin(jwt(amr('password', now + 3600)), now), false);
  assertEquals(isFreshLogin(jwt({ iat: now - 5 }), now), false);
  assertEquals(isFreshLogin(null, now), false);
});
