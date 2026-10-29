// Yeni kullanıcı şikayetinde moderatörlere anlık bildirim gönderir (veritabanı tetikleyicisi pg_net ile çağırır).
// JWT doğrulaması kapalıdır (supabase/config.toml); çağıran x-cron-secret başlığıyla doğrulanır
// (değer veritabanında internal_secrets.cron). Bildirimde şikayet metni/mesaj içeriği yoktur; ayrıntı uygulamada
// yalnızca moderatörün Moderasyon ekranında görünür.
import { adminClient } from '../_shared/admin.ts';
import { error, json } from '../_shared/http.ts';
import { safeEqual, sendPush, type PushMessage } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const admin = adminClient();
  if (!admin) return error('not_configured', 503);

  const { data: secret } = await admin.from('internal_secrets').select('value').eq('key', 'cron').maybeSingle();
  if (!secret?.value || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret.value)) return error('unauthorized', 401);

  const { data: ids } = await admin.rpc('moderator_user_ids');
  const moderators = (ids ?? []) as string[];
  if (moderators.length === 0) return json({ ok: true, moderators: 0 });

  const { count } = await admin.from('user_reports').select('id', { count: 'exact', head: true }).neq('status', 'resolved');
  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', moderators);
  const messages: PushMessage[] = (tokens ?? []).map((t: { token: string }) => ({
    to: t.token,
    title: 'Yola: yeni şikayet',
    body: `İncelenmeyi bekleyen ${count ?? 1} şikayet var.`,
    data: { url: '/moderation' },
    sound: 'default',
    priority: 'high',
  }));
  const dead = await sendPush(messages, 'notify-report');
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
  return json({ ok: true, sent: messages.length });
});
