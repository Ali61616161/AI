import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Telefon internete bağlı mı (TanStack Query'nin ağ durumu). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
    () => true,
  );
}
