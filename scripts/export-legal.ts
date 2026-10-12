// Gizlilik politikası ve kullanım koşullarını docs/ altına web sayfası olarak yazar
// (GitHub Pages veya başka bir adreste yayınlanıp mağazalara girilir).
// Kullanım: npm run legal:export
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { fillLegal, LEGAL, type LegalDoc } from '../src/features/legal/content.ts';

const brand = JSON.parse(readFileSync(new URL('../src/config/brand.json', import.meta.url), 'utf8'));
const values: Record<string, string> = brand.legal;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(doc: LegalDoc, lang: string, other: { href: string; label: string }) {
  const body = doc.sections
    .map((s) => `<h2>${esc(s.heading)}</h2>\n${fillLegal(s.body, values).split('\n').map((p) => `<p>${esc(p)}</p>`).join('\n')}`)
    .join('\n');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(doc.title)} · ${esc(brand.name)}</title>
<style>body{font:16px/1.6 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#0B1220;background:#fff}h1{color:#FF6B4A}h2{margin-top:2em}a{color:#FF6B4A}@media(prefers-color-scheme:dark){body{background:#0B1220;color:#E8ECF4}}</style>
</head><body>
<h1>${esc(doc.title)}</h1>
<p><a href="${other.href}">${esc(other.label)}</a></p>
${body}
</body></html>
`;
}

for (const [kind, slug] of [['privacy', 'privacy'], ['terms', 'terms'], ['kvkk', 'kvkk']] as const) {
  for (const lang of ['en', 'tr'] as const) {
    const dir = new URL(`../docs/${slug}/${lang === 'en' ? '' : 'tr/'}`, import.meta.url);
    mkdirSync(dir, { recursive: true });
    const other = lang === 'en' ? { href: 'tr/', label: 'Türkçe' } : { href: '../', label: 'English' };
    writeFileSync(new URL('index.html', dir), page(LEGAL[lang][kind], lang, other));
  }
}
writeFileSync(
  new URL('../docs/index.html', import.meta.url),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(brand.name)}</title></head>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px"><h1 style="color:#FF6B4A">${esc(brand.storeName)}</h1>
<p><a href="privacy/">Privacy Policy</a> · <a href="terms/">Terms of Use</a> · <a href="privacy/tr/">Gizlilik Politikası</a> · <a href="terms/tr/">Kullanım Koşulları</a> · <a href="kvkk/tr/">KVKK Aydınlatma Metni</a></p>
<p>Support: ${esc(values.supportEmail)}</p></body></html>\n`,
);
console.log('docs/ güncellendi');
