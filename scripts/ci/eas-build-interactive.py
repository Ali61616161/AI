"""EAS iOS derlemesini etkileşimli modda çalıştırır ve kimlik bilgisi sorularını
varsayılan cevapla (Enter) geçer. Sadece ilk sertifika/profil kurulumu için kullanılır;
App Store Connect API anahtarı ortam değişkenlerinden okunur. Apple ID/şifre sorulursa durur."""
import os
import sys

import pexpect

cmd = ['eas-cli@latest', 'build', '--platform', 'ios', '--profile', 'production', '--wait']
# EAS, CI değişkenlerini görünce soruları kapatır; ilk kurulum için bu süreçte gizlenir.
env = {k: v for k, v in os.environ.items() if k not in ('CI', 'GITHUB_ACTIONS', 'CONTINUOUS_INTEGRATION', 'BUILD_NUMBER', 'RUN_ID')}
env['TERM'] = 'xterm-256color'
child = pexpect.spawn('npx', cmd, encoding='utf-8', timeout=3600, dimensions=(60, 200), env=env)
child.logfile_read = sys.stdout

PROMPTS = [
    r'\?\s+Apple ID',           # 0: Apple girişi sorulursa dur
    r'\?\s+Password',           # 1
    r'\((?:Y/n|y/N)\)',         # 2: evet/hayır
    r'Use arrow-keys',          # 3: seçim listesi → ilk seçenek
    pexpect.EOF,                # 4
]
while True:
    i = child.expect(PROMPTS)
    if i in (0, 1):
        print(f'\n--- soru ---\n{child.before[-400:]}{child.after}\n------------')
        print('::error::Apple ID girişi istendi; API anahtarı kullanılamadı.')
        child.terminate(force=True)
        sys.exit(1)
    if i in (2, 3):
        child.send('\r')
        continue
    break
child.close()
sys.exit(child.exitstatus or 0)
