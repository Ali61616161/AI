// Sadece sunucuda: RLS'yi atlayan service_role istemcisi. Abonelik kayıtları gibi
// kullanıcının kendisinin yazamayacağı veriler için kullanılır.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export function adminClient(): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
