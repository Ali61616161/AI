"""iPhone'u Apple ekibine kaydetmek için EAS kayıt bağlantısı üretir (eas device:create).
Bağlantı telefonda açılınca küçük bir profil yüklenir ve cihaz kimliği (UDID) EAS'e gelir;
böylece o telefona TestFlight olmadan doğrudan kurulabilen (internal) derleme yapılabilir.
Apple girişi istenmez: ekip kimliği ortam değişkeninden verilir."""
import os
import re
import sys

import pexpect

env = {k: v for k, v in os.environ.items() if k not in ('CI', 'GITHUB_ACTIONS', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'RUN_ID')}
env['TERM'] = 'xterm-256color'
team = os.environ.get('EXPO_APPLE_TEAM_ID', '')
child = pexpect.spawn('npx', ['--yes', 'eas-cli@latest', 'device:create'], encoding='utf-8', timeout=600, dimensions=(60, 200), env=env)
child.logfile_read = sys.stdout

URL = r'https://expo\.dev/register-device/[A-Za-z0-9-]+'
PROMPTS = [
    r'log in to your Apple account',          # 0 → hayır
    r'Apple Team ID',                          # 1 → ekip kimliği
    r'Apple Team type|team type',              # 2 → seçim
    r'How would you like to register',         # 3 → Website (ilk seçenek)
    URL,                                       # 4 → bağlantı
    r'\((?:Y/n|y/N)\)',                        # 5
    r'Use arrow-keys',                         # 6
    pexpect.EOF,                               # 7
    pexpect.TIMEOUT,                           # 8
]
url = None
while True:
    i = child.expect(PROMPTS)
    if i == 0:
        child.sendline('n')
    elif i == 1:
        child.sendline(team)
    elif i == 2:
        # Ekip türü cihaz kaydını etkilemez; varsayılan seçilir.
        child.send('\r')
    elif i == 3:
        child.send('\r')
    elif i == 4:
        url = child.after
        break
    elif i in (5, 6):
        child.send('\r')
    else:
        break
if not url:
    print('::error::Kayıt bağlantısı alınamadı')
    sys.exit(1)
with open(os.environ.get('GITHUB_STEP_SUMMARY', '/dev/null'), 'a') as f:
    f.write(f'### iPhone kayıt bağlantısı\n\nTelefonda Safari ile aç: {url}\n')
print(f'\nKAYIT_BAGLANTISI={url}')
child.terminate(force=True)
