// Hesabı ve tüm verileri kalıcı olarak siler (App Store 5.1.1(v), Google Play
// hesap silme, KVKK/GDPR). Yüklenen belgeler depodan silinir; kullanıcı
// silinince veritabanındaki tüm kayıtları cascade ile silinir.
//
//   POST { "confirm": "DELETE" } → 204
//
// Gerekli sunucu sırrı: SUPABASE_SERVICE_ROLE_KEY (Supabase verir).
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { isFreshLogin } from '../_shared/fresh-login.ts';
import { corsHeaders, error } from '../_shared/http.ts';

const BUCKETS = ['documents', 'avatars', 'share-cards'];
const PAGE = 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const admin = adminClient();
  if (!admin) return error('not_configured', 503);

  const auth = await userClient(req);
  if (!auth) return error('unauthorized', 401);
  const { user } = auth;

  // deno-lint-ignore no-explicit-any
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // boş gövde
  }
  if (body?.confirm !== 'DELETE') return error('bad_request', 400, 'confirmation required');
  // Uygulama şifre ya da e-posta kodunu yeni doğrulatır; eski bir anahtarla silme yapılmaz.
  if (!isFreshLogin(req.headers.get('Authorization'))) return error('unauthorized', 401, 'reauth_required');

  // Depo temizliği başarısız olursa hesap silinmez: avatars herkese açık olduğundan sahipsiz dosya kalmamalı.
  for (const bucket of BUCKETS) {
    try {
      for (let guard = 0; guard < 50; guard++) {
        const { data: files, error: listError } = await admin.storage.from(bucket).list(user.id, { limit: PAGE });
        if (listError) {
          // Kova yoksa (404) silinecek dosya da yoktur.
          // deno-lint-ignore no-explicit-any
          if ((listError as any).status === 404 || /not.?found/i.test(listError.message)) break;
          throw listError;
        }
        if (!files?.length) break;
        const { error: removeError } = await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
        if (removeError) throw removeError;
        if (files.length < PAGE) break;
      }
    } catch (e) {
      console.error(`delete-account: ${bucket} cleanup failed`, e instanceof Error ? e.message : String(e));
      return error('bad_request', 500, 'cleanup_failed');
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account: delete user failed', deleteError.message);
    return error('bad_request', 500, 'delete_failed');
  }
  return new Response(null, { status: 204, headers: corsHeaders });
});
