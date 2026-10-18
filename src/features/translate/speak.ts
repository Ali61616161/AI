import * as Speech from 'expo-speech';

import { useTranslateStore } from './translate-store';
import { pickVoice } from './voices';

let voicesPromise: Promise<Speech.Voice[]> | null = null;

/** Cihazdaki sesler (bir kez yüklenir). Alınamazsa boş liste: sistem varsayılan sesiyle okunur. */
export function loadVoices(): Promise<Speech.Voice[]> {
  voicesPromise ??= Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
  return voicesPromise;
}

/**
 * Metni en doğal sesle okur: kullanıcının seçtiği ses, yoksa o dilin en iyi sesi (Siri/Premium/Gelişmiş),
 * yoksa sistem varsayılanı. Önceki okuma kesilir.
 */
export async function speakNatural(text: string, speechTag: string, options?: { rate?: number }) {
  Speech.stop();
  const voice = pickVoice(await loadVoices(), speechTag, useTranslateStore.getState().voices[speechTag]);
  Speech.speak(text, { language: speechTag, voice: voice?.identifier, rate: options?.rate ?? 0.95 });
}
