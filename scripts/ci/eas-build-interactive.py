"""EAS iOS derlemesini etkileşimli modda çalıştırır ve kimlik bilgisi sorularını
varsayılan cevapla (Enter) geçer. Sadece ilk sertifika/profil kurulumu için kullanılır;
App Store Connect API anahtarı ortam değişkenlerinden okunur. Apple ID/şifre sorulursa durur."""
import sys

import pexpect

cmd = ['eas-cli@latest', 'build', '--platform', 'ios', '--profile', 'production', '--wait']
child = pexpect.spawn('npx', cmd, encoding='utf-8', timeout=3600, dimensions=(60, 200))
child.logfile_read = sys.stdout

PROMPTS = [
    r'Apple ID',                # 0: Apple girişi istenirse dur
    r'[Pp]assword',             # 1
    r'\((?:Y/n|y/N)\)',         # 2: evet/hayır
    r'Use arrow-keys',          # 3: seçim listesi → ilk seçenek
    pexpect.EOF,                # 4
]
while True:
    i = child.expect(PROMPTS)
    if i in (0, 1):
        print('\n::error::Apple ID girişi istendi; API anahtarı kullanılamadı.')
        child.terminate(force=True)
        sys.exit(1)
    if i in (2, 3):
        child.send('\r')
        continue
    break
child.close()
sys.exit(child.exitstatus or 0)
