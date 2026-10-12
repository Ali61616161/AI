import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useFlipStyle } from '@/lib/rtl';

/** Yön bildiren ikon (ok, ›): sağdan sola dillerde otomatik aynalanır. */
export function DirIcon(props: ComponentProps<typeof Ionicons>) {
  const flip = useFlipStyle();
  return <Ionicons {...props} style={[props.style, flip]} />;
}
