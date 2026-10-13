import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { openBookingLink } from '@/features/places/api';
import { Spacing } from '@/theme/tokens';

import { PARTNER_NAMES, TICKET_ICONS, type TicketOption } from './api';

/** Bilet bağlantıları (tren, otobüs, feribot, uçak, araç kiralama); ortaklık notuyla. */
export function TicketLinks({ options, showModes = false }: { options: TicketOption[]; showModes?: boolean }) {
  const { t } = useTranslation();
  if (!options.length) return null;
  return (
    <View style={styles.box}>
      <View style={styles.row}>
        {options.map((o) => (
          <Chip
            key={o.url}
            icon={TICKET_ICONS[o.mode]}
            label={showModes ? `${t(`route.ticketMode.${o.mode}`)} · ${PARTNER_NAMES[o.partner]}` : PARTNER_NAMES[o.partner]}
            onPress={() => openBookingLink(o.url)}
          />
        ))}
      </View>
      {options.some((o) => o.affiliate) && (
        <Text variant="caption" color="textMuted">
          {t('route.affiliateNote')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
