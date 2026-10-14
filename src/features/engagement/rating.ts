import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

import { shouldAskForRating, type RatingState } from './rating-logic';

const KEY = 'yola.rating';

async function load(now: number): Promise<RatingState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as RatingState;
  } catch {
    // Bozuk kayıt: baştan başlanır.
  }
  return { moments: 0, firstSeen: now, lastAsked: null };
}

/**
 * Memnuniyet anı (plan oluştu, akşam planı geldi, seyahat raporu çıktı). Koşullar
 * uygunsa mağazanın kendi puan penceresi istenir; hata olursa sessizce geçer.
 */
export async function notePositiveMoment(): Promise<void> {
  try {
    const now = Date.now();
    const state = await load(now);
    state.moments += 1;
    if (shouldAskForRating(state, now) && (await StoreReview.hasAction())) {
      state.lastAsked = now;
      state.moments = 0;
      await AsyncStorage.setItem(KEY, JSON.stringify(state));
      await StoreReview.requestReview();
      return;
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Puan istemek hiçbir akışı bozmamalı.
  }
}
