#!/usr/bin/env node
// Tüm dil dosyalarının en.json ile aynı anahtarlara sahip olduğunu doğrular.
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flatten(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
// Çoğul biçimleri dile göre değişir (en: _one/_other, ru: _one/_few/_many/_other,
// ar: _zero.._other); karşılaştırmada temel anahtar kullanılır.
const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;
const keysOf = (file) =>
  new Set(flatten(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))).map((k) => k.replace(PLURAL_SUFFIX, '')));

const reference = keysOf('en.json');
let failed = false;
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
  const keys = keysOf(file);
  const missing = [...reference].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !reference.has(k));
  if (missing.length || extra.length) {
    failed = true;
    console.error(`${file}: eksik [${missing.join(', ')}] fazla [${extra.join(', ')}]`);
  }
}
if (failed) process.exit(1);
console.log(`Tüm dil dosyaları uyumlu (${reference.size} anahtar).`);
