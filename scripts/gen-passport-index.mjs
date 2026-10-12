// Pasaport gücü verisini (Passport Index Data, MIT) sıkıştırılmış bir TS modülüne çevirir.
// Kaynak: https://github.com/imorte/passport-index-data (passportindex.org verisi)
// Kullanım: node scripts/gen-passport-index.mjs [passport-index-tidy-iso2.csv]
// Dosya verilmezse en güncel veri indirilir. Çıktı uygulama ve Edge Function'larda ortaktır.
import { readFileSync, writeFileSync } from 'node:fs';

const URL = 'https://raw.githubusercontent.com/imorte/passport-index-data/main/passport-index-tidy-iso2.csv';
const OUT = new globalThis.URL('../supabase/functions/_shared/passport-index.ts', import.meta.url);

const csv = process.argv[2] ? readFileSync(process.argv[2], 'utf8') : await (await fetch(URL)).text();
const rows = csv.trim().split(/\r?\n/).slice(1).map((l) => l.split(','));
const codes = [...new Set(rows.map((r) => r[1]).concat(rows.map((r) => r[0])))].sort();
const index = new Map(codes.map((c, i) => [c, i]));

// Hücre: bir harf + (biliniyorsa) gün sayısı. F=vizesiz, A=varışta vize, T=elektronik izin (ESTA/ETA),
// E=e-vize, R=vize gerekli, X=giriş yok, S=kendi ülkesi.
function cell(value) {
  if (/^\d+$/.test(value)) return `F${value}`;
  switch (value) {
    case '-1': return 'S';
    case 'visa free': return 'F';
    case 'visa on arrival': return 'A';
    case 'eta': return 'T';
    case 'e-visa': return 'E';
    case 'visa required': return 'R';
    case 'no admission': return 'X';
    default: throw new Error(`Bilinmeyen değer: ${value}`);
  }
}

const matrix = new Map();
for (const [passport, destination, value] of rows) {
  if (!matrix.has(passport)) matrix.set(passport, new Array(codes.length).fill('R'));
  matrix.get(passport)[index.get(destination)] = cell(value);
}
for (const [passport, cells] of matrix) cells[index.get(passport)] = 'S';

const lines = [...matrix.keys()].sort().map((p) => `  ${p}: '${matrix.get(p).join(',')}',`);
const header = `// Bu dosya scripts/gen-passport-index.mjs ile üretilir; elle düzenlemeyin.
// Kaynak: Passport Index Data (MIT), https://github.com/imorte/passport-index-data — passportindex.org verisi.
// Hücre: F=vizesiz (+gün), A=varışta vize, T=elektronik izin, E=e-vize, R=vize gerekli, X=giriş yok, S=kendi ülkesi.
`;
writeFileSync(
  OUT,
  `${header}export const PASSPORT_DATA_UPDATED = '2026-02-17';\nexport const DESTINATIONS = '${codes.join(',')}';\nexport const PASSPORT_ROWS: Record<string, string> = {\n${lines.join('\n')}\n};\n`,
);
console.log(`${matrix.size} pasaport × ${codes.length} ülke yazıldı → ${OUT.pathname}`);
