#!/usr/bin/env node
// Tek sayfalık web derlemesini (EXPO_WEB_OUTPUT=single) her şeyi içine gömülü tek bir
// HTML dosyasına dönüştürür. Bu dosya önizleme bağlantısı olarak paylaşılır; dosya
// yollarına bağlı olmadığı için hangi adreste açıldığı fark etmez.
//
// Kullanım: node scripts/build-web-preview.mjs <export-klasörü> <çıktı.html>
import fs from 'node:fs';
import path from 'node:path';

const [distDir, outFile] = process.argv.slice(2);
if (!distDir || !outFile) {
  console.error('Kullanım: node scripts/build-web-preview.mjs <export-klasörü> <çıktı.html>');
  process.exit(1);
}

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const entry = html.match(/<script src="\/?([^"]+\.js)"/)?.[1];
if (!entry) throw new Error('index.html içinde giriş script dosyası bulunamadı');
// Gömülü script içinde "</script" geçerse HTML ayrıştırıcı script'i erken kapatır.
const js = fs.readFileSync(path.join(distDir, entry), 'utf8').replaceAll('</script', '<\\/script');

function findFile(dir, pattern) {
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) {
      const found = findFile(full, pattern);
      if (found) return found;
    } else if (pattern.test(name.name)) {
      return full;
    }
  }
  return null;
}

// expo-font, bu id'li style etiketinde aynı isimli @font-face varsa fontu tekrar
// yüklemez; böylece ikon fontu dosya yolu yerine sayfanın içinden gelir.
const ionicons = findFile(path.join(distDir, 'assets'), /^Ionicons\..*\.ttf$/);
const fontCss = ionicons
  ? `@font-face{font-family:"ionicons";src:url(data:font/ttf;base64,${fs.readFileSync(ionicons).toString('base64')});font-display:auto}`
  : '';

const page = `<title>Yola Önizleme</title>
<style>
  html, body { height: 100%; }
  body { overflow: hidden; background: #F7F8FA; }
  @media (prefers-color-scheme: dark) { body { background: #0B1220; } }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<style id="expo-generated-fonts">${fontCss}</style>
<div id="root"></div>
<script>
  // Önizleme herhangi bir adreste açılabilir; Expo Router adresten ekran seçtiği için
  // uygulama başlamadan önce adresi köke çekiyoruz. Engellenirse "bulunamadı" ekranı yönlendirir.
  try { history.replaceState(null, '', '/'); } catch (e) {}
</script>
<script>${js}</script>
`;

fs.writeFileSync(outFile, page);
console.log(`${outFile} (${(page.length / 1024 / 1024).toFixed(2)} MB)`);
