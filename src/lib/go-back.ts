import { router } from 'expo-router';

/** Geri gider; geri gidilecek ekran yoksa (ör. widget ya da bildirimle doğrudan açılmışsa) ana ekrana döner. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
