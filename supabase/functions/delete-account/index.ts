// Hesabı ve tüm verileri kalıcı olarak siler (App Store 5.1.1(v), Google Play
// hesap silme, KVKK/GDPR). Yüklenen belgeler depodan silinir; kullanıcı
// silinince veritabanındaki tüm kayıtları cascade ile silinir.
//
//   POST { "confirm": "DELETE" } → 204
//
// Gerekli sunucu sırrı: SUPABASE_SERVICE_ROLE_KEY (Supabase verir).
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { corsHeaders, error } from '../_shared/http.ts';

const BUCKETS = ['documents', 'avatars'];

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

  for (const bucket of BUCKETS) {
    try {
      const { data: files } = await admin.storage.from(bucket).list(user.id, { limit: 1000 });
      if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${user.id}/${f.name}`));
    } catch (e) {
      // Depo silinemezse hesap yine silinir; dosyalar kullanıcı klasöründe sahipsiz kalır ve
      // storage politikaları gereği kimse okuyamaz. Günlüğe yazılır.
      console.error(`delete-account: ${bucket} cleanup failed`, e instanceof Error ? e.message : String(e));
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account: delete user failed', deleteError.message);
    return error('bad_request', 500, deleteError.message);
  }
  return new Response(null, { status: 204, headers: corsHeaders });
});
