import { useEffect, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

// Sekmeler arası geçişte (alt menü veya profil simgesi) açılan sekmenin en üstten başlaması için
// küçük bir olay hattı. Modal kapanınca (aynı sekmeye dönüş) tetiklenmez: konum korunur.

type Listener = (tab: string) => void;
const listeners = new Set<Listener>();

/** Tab düzeni, kullanıcı başka bir sekmeye geçince çağırır. */
export function emitTabEntered(tab: string) {
  listeners.forEach((l) => l(tab));
}

/** Verilen sekme açılınca kaydırma alanını en üste alır. */
export function useResetScrollOnTabEnter(tab: string | undefined, ref: RefObject<ScrollView | null>) {
  useEffect(() => {
    if (!tab) return;
    const listener: Listener = (entered) => {
      if (entered === tab) ref.current?.scrollTo({ y: 0, animated: false });
    };
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [tab, ref]);
}
