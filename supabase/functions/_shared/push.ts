// Expo Push gönderimi ve zamanlayıcı sırrı karşılaştırması (flight-watch ve price-watch ortak kullanır).
export const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

export type PushMessage = { to: string; title: string; body: string; data: { url: string }; sound: 'default'; priority: 'high' };

/** Zamanlayıcı sırrını sabit sürede karşılaştırır. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Mesajları 100'erli gönderir; artık geçerli olmayan cihaz token'larını döndürür (silinmeli). */
export async function sendPush(messages: PushMessage[], label: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetchImpl(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
      tickets.forEach((t, k) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(batch[k].to);
      });
    } catch (e) {
      console.error(`${label}: push failed`, String(e).slice(0, 120));
    }
  }
  return dead;
}
