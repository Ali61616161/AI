#!/usr/bin/env node
// Yerel test geçidi: Supabase'in adres yapısını taklit eder ki uygulama ve Edge
// Function'lar gerçek Supabase projesi olmadan uçtan uca denenebilsin.
//
//   /rest/v1/*       → PostgREST (gerçek sorgular, gerçek RLS)
//   /functions/v1/*  → yerelde çalışan Edge Function'lar (functions-router.ts)
//   /auth/v1/*       → basit giriş: her e-posta kabul edilir, kod LOCAL_OTP_CODE;
//                      şifreyle giriş LOCAL_REVIEW_PASSWORD; yönetici kullanıcı silme
//
// SADECE yerel geliştirme ve test içindir; gerçek kimlik doğrulama yapmaz.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.GATEWAY_PORT ?? 54321);
const POSTGREST = process.env.POSTGREST_URL ?? 'http://127.0.0.1:54330';
const FUNCTIONS = process.env.FUNCTIONS_URL ?? 'http://127.0.0.1:8000';
const SECRET = process.env.JWT_SECRET;
const OTP = process.env.LOCAL_OTP_CODE ?? '123456';
// Mağaza inceleme hesabı gibi şifreyle girişi denemek için (sadece yerel).
const REVIEW_PASSWORD = process.env.LOCAL_REVIEW_PASSWORD ?? 'yola-review-123';
const PSQL = ['-h', process.env.PGHOST ?? '/tmp', '-p', process.env.PGPORT ?? '5432', '-U', process.env.PGUSER ?? 'postgres', '-d', process.env.DEV_DB ?? 'yola_dev', '-Atq', '-v', 'ON_ERROR_STOP=1'];

if (!SECRET) throw new Error('JWT_SECRET gerekli');

const b64url = (buf) => Buffer.from(buf).toString('base64url');

export function signJwt(payload, secret = SECRET) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  const [header, body, sig] = (token ?? '').split('.');
  if (!sig) return null;
  const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp && payload.exp * 1000 < Date.now() ? null : payload;
}

function userObject(id, email) {
  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: new Date(0).toISOString(),
  };
}

function session(id, email) {
  const expiresIn = 7 * 24 * 3600;
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresIn;
  return {
    // Gerçek Supabase anahtarında olduğu gibi "iat" (verilme zamanı) vardır; hesap silme taze giriş ister.
    access_token: signJwt({ sub: id, email, role: 'authenticated', aud: 'authenticated', iat, exp, amr: [{ method: 'password', timestamp: iat }] }),
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: exp,
    refresh_token: b64url(JSON.stringify({ id, email })),
    user: userObject(id, email),
  };
}

/** auth.users'ta kullanıcıyı bulur veya oluşturur (handle_new_user tetikleyicisi profili açar). */
function ensureUser(email, language) {
  const sql = `insert into auth.users (email, raw_user_meta_data)
                 select $1, jsonb_build_object('language', $2::text)
                 where not exists (select 1 from auth.users where email = $1);
               select id from auth.users where email = $1 limit 1;`;
  // psql değişken bağlamayı desteklemediği için değerleri güvenli biçimde tırnaklıyoruz.
  const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
  return execFileSync('psql', [...PSQL, '-c', sql.replaceAll('$1', q(email)).replaceAll('$2', q(language ?? 'en'))]).toString().trim().split('\n').pop();
}

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
  'access-control-expose-headers': 'content-range, content-profile, x-total-count',
};

function send(res, status, body) {
  res.writeHead(status, { ...cors, 'content-type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

async function proxy(req, res, target) {
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers['content-length'];
  const upstream = await fetch(target, { method: req.method, headers, body }).catch((e) => ({ error: e }));
  if (upstream.error) return send(res, 502, { error: { code: 'network', message: String(upstream.error) } });
  const out = Buffer.from(await upstream.arrayBuffer());
  const passthrough = {};
  upstream.headers.forEach((v, k) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k) && !k.startsWith('access-control')) passthrough[k] = v;
  });
  res.writeHead(upstream.status, { ...passthrough, ...cors });
  res.end(out);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204);
    const url = new URL(req.url, 'http://localhost');

    if (url.pathname.startsWith('/rest/v1/')) return proxy(req, res, POSTGREST + url.pathname.slice('/rest/v1'.length) + url.search);
    if (url.pathname.startsWith('/functions/v1/')) return proxy(req, res, FUNCTIONS + url.pathname.slice('/functions/v1'.length) + url.search);

    if (url.pathname === '/auth/v1/otp') return send(res, 200, {});
    if (url.pathname === '/auth/v1/verify') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (body.token !== OTP) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
      const id = ensureUser(body.email, body.data?.language);
      return send(res, 200, session(id, body.email));
    }
    if (url.pathname === '/auth/v1/user') {
      const claims = verifyJwt(req.headers.authorization?.replace(/^Bearer /i, ''));
      if (!claims?.sub || claims.role !== 'authenticated') return send(res, 401, { code: 401, msg: 'invalid JWT' });
      return send(res, 200, userObject(claims.sub, claims.email));
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      if (body.password !== REVIEW_PASSWORD) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      const id = ensureUser(body.email, 'en');
      return send(res, 200, session(id, body.email));
    }
    // Hesap silme (Edge Function'ın service_role ile çağırdığı yönetici API'si).
    const adminUser = /^\/auth\/v1\/admin\/users\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (adminUser && req.method === 'DELETE') {
      const claims = verifyJwt(req.headers.authorization?.replace(/^Bearer /i, ''));
      if (claims?.role !== 'service_role') return send(res, 403, { msg: 'service_role required' });
      execFileSync('psql', [...PSQL, '-c', `delete from auth.users where id = '${adminUser[1]}'`]);
      return send(res, 200, {});
    }
    if (url.pathname === '/auth/v1/token') {
      const body = JSON.parse((await readBody(req)).toString() || '{}');
      const { id, email } = JSON.parse(Buffer.from(body.refresh_token ?? '', 'base64url').toString() || '{}');
      if (!id) return send(res, 400, { error: 'invalid_grant' });
      return send(res, 200, session(id, email));
    }
    if (url.pathname === '/auth/v1/logout') return send(res, 204);
    return send(res, 404, { error: 'not found' });
  } catch (e) {
    send(res, 500, { error: String(e) });
  }
});

server.listen(PORT, () => console.log(`gateway http://localhost:${PORT}`));
