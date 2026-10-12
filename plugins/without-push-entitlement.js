// Belge hatırlatmaları sadece yerel bildirim kullanır; uzaktan bildirim (push) yetkisi
// gerekmez. expo-notifications iOS'a 'aps-environment' ekler ve Apple profili push
// içermeyince derleme düşer. Push gerektiğinde (ör. fiyat alarmı) bu eklenti kaldırılır
// ve Apple geliştirici portalında Push Notifications açılır.
const { withEntitlementsPlist } = require('expo/config-plugins');

module.exports = function withoutPushEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    delete c.modResults['aps-environment'];
    return c;
  });
};
