import { assertEquals } from 'jsr:@std/assert@1';

import { FRESH_LOGIN_SECONDS, isFreshLogin, tokenIssuedAt } from './fresh-login.ts';

const jwt = (payload: unknown) => `Bearer h.${btoa(JSON.stringify(payload)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;

Deno.test('iat okunur; bozuk anahtar null', () => {
  assertEquals(tokenIssuedAt(jwt({ iat: 1000 })), 1000);
  assertEquals(tokenIssuedAt('Bearer abc'), null);
  assertEquals(tokenIssuedAt(null), null);
  assertEquals(tokenIssuedAt(jwt({ sub: 'x' })), null);
});

Deno.test('taze giriş penceresi', () => {
  const now = 100_000;
  assertEquals(isFreshLogin(jwt({ iat: now - 30 }), now), true);
  assertEquals(isFreshLogin(jwt({ iat: now - FRESH_LOGIN_SECONDS - 1 }), now), false);
  assertEquals(isFreshLogin(jwt({ iat: now + 3600 }), now), false);
  assertEquals(isFreshLogin(null, now), false);
});
