import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';

/** Bilet ve otel yükleme akışı 4. adımda bu ekranda kurulacak. */
export default function TicketScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ModalHeader title={t('ticket.title')} subtitle={t('ticket.subtitle')} />
      <EmptyState icon="cloud-upload-outline" title={t('common.comingSoon')} description={t('ticket.notice')} />
    </Screen>
  );
}
