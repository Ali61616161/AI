// İsteği yapan kullanıcının yetkisiyle çalışan Supabase istemcisi.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2';

export async function userClient(req: Request): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const authorization = req.headers.get('Authorization');
  if (!authorization) return null;
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data } = await supabase.auth.getUser();
  return data.user ? { supabase, user: data.user } : null;
}

export async function consumeQuota(supabase: SupabaseClient, feature: string, tripId: string | null, amount = 1) {
  const { data, error } = await supabase
    .rpc('consume_quota', { p_feature: feature, p_trip_id: tripId, p_amount: amount })
    .single<{ allowed: boolean; plan: string; remaining: number | null }>();
  if (error) throw error;
  return data;
}
