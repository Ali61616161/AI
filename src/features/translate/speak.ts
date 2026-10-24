import { onlineManager } from '@tanstack/react-query';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { useTranslateStore } from './translate-store';
import { cloudGender, isCloudVoice, pickVoice } from './voices';

let voicesPromise: Promise<Speech.Voice[]> | null = null;

/** Cihazdaki sesler (bir kez yüklenir). Liste boş gelirse sonraki çağrıda yeniden denenir. */
export function loadVoices(): Promise<Speech.Voice[]> {
  voicesPromise ??= Speech.getAvailableVoicesAsync()
    .catch(() => [] as Speech.Voice[])
    .then((v) => {
      if (!v.length) voicesPromise = null;
      return v;
    });
  return voicesPromise;
}

let player: AudioPlayer | null = null;
/** Her okuma isteği bir sıra numarası alır; yenisi gelince eskisinin sesi (geç inse bile) çalınmaz. */
let ticket = 0;

/** Süren okumayı (bulut ya da cihaz sesi) durdurur. */
export function stopSpeaking() {
  ticket++;
  Speech.stop();
  if (player) {
    try {
      player.pause();
      player.remove();
    } catch {
      // oynatıcı zaten kapanmış
    }
    player = null;
  }
}

const cacheDir = () => new Directory(Paths.cache, 'tts');

/**
 * Google'ın doğal sesiyle (Chirp 3 HD / Neural2) okur. Ses dosyası telefonda saklanır: aynı cümle
 * ikinci kez internetsiz ve anında çalar. Başarısız olursa false (cihaz sesine dönülür).
 */
async function playCloud(text: string, speechTag: string, gender: 'female' | 'male', rate: number, my: number): Promise<boolean> {
  if (Platform.OS === 'web' || !isSupabaseConfigured()) return false;
  try {
    const key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `${speechTag}|${gender}|${rate}|${text}`);
    const dir = cacheDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const file = new File(dir, `${key.slice(0, 40)}.mp3`);
    if (!file.exists) {
      if (!onlineManager.isOnline() || !useSessionStore.getState().session) return false;
      const { data, error } = await getSupabase().functions.invoke('translate', {
        body: { mode: 'speak', text, target: speechTag.split('-')[0].toLowerCase(), voice_lang: speechTag, gender, rate },
      });
      const audio = (data as { audio?: string } | null)?.audio;
      if (error || !audio) return false;
      file.write(audio, { encoding: 'base64' });
    }
    if (my !== ticket) return true; // bu arada başka bir okuma başladı
    // Konuşma tanıma sonrası ses ahizeden kısık çıkmasın: yalnızca çalma moduna geçilir.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'duckOthers' }).catch(() => undefined);
    const p = createAudioPlayer({ uri: file.uri });
    player = p;
    p.addListener('playbackStatusUpdate', (status) => {
      if (status.didJustFinish) {
        p.remove();
        if (player === p) player = null;
      }
    });
    p.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * Metni en doğal sesle okur. Varsayılan: Yola'nın doğal sesi (internet gerekir; çalınan cümleler
 * saklanır). Kullanıcı cihaz sesi seçtiyse ya da bulut sesi alınamazsa telefonun en iyi sesi kullanılır.
 */
export async function speakNatural(text: string, speechTag: string, options?: { rate?: number }) {
  stopSpeaking();
  const my = ticket;
  const choice = useTranslateStore.getState().voices[speechTag];
  const rate = options?.rate ?? 0.95;
  if ((!choice || isCloudVoice(choice)) && (await playCloud(text, speechTag, cloudGender(choice), rate, my))) return;
  if (my !== ticket) return;
  const voice = pickVoice(await loadVoices(), speechTag, choice && !isCloudVoice(choice) ? choice : undefined);
  Speech.speak(text, { language: speechTag, voice: voice?.identifier, rate });
}
