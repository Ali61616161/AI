import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

// Web'de titreşim yok; çağrılar sessizce yok sayılır.
const enabled = Platform.OS === 'ios' || Platform.OS === 'android';

export const haptic = {
  tap: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined),
  press: () => enabled && Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined),
  select: () => enabled && Haptics.selectionAsync().catch(() => undefined),
  success: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined),
  warning: () => enabled && Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined),
};
