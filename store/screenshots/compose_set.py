#!/usr/bin/env python3
"""Gerçek iPhone ekran görüntülerinden App Store'un istediği tüm boyutlarda mağaza görselleri üretir.

Kullanım:
  python3 store/screenshots/compose_set.py --src <ham_ekran_klasoru> --out <cikti_klasoru> [--captions captions.json]

<ham_ekran_klasoru> içindeki dosyalar ada göre sıralanır (01-*.png, 02-*.png ...). Her dosya için captions.json
içinde "tr" ve "en" listelerinden aynı sıradaki başlık kullanılır. Çıktı:
  <cikti>/iphone-6.3/<dil>/NN.png   (1206x2622)
  <cikti>/iphone-6.9/<dil>/NN.png   (1320x2868)
  <cikti>/ipad-13/<dil>/NN.png      (2064x2752)
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from compose import compose  # noqa: E402

SIZES = {'iphone-6.3': (1206, 2622), 'iphone-6.9': (1320, 2868), 'ipad-13': (2064, 2752)}
DEFAULT_CAPTIONS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'captions.json')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--captions', default=DEFAULT_CAPTIONS)
    a = ap.parse_args()
    caps = json.load(open(a.captions, encoding='utf-8'))
    files = sorted(f for f in os.listdir(a.src) if f.lower().endswith(('.png', '.jpg', '.jpeg', '.webp')))
    if not files:
        sys.exit('ham ekran görüntüsü yok')
    for lang, texts in caps.items():
        if len(texts) < len(files):
            sys.exit(f'{lang}: {len(files)} görsel için {len(texts)} başlık var')
        for size, (w, h) in SIZES.items():
            od = os.path.join(a.out, size, lang)
            os.makedirs(od, exist_ok=True)
            for i, f in enumerate(files):
                compose(os.path.join(a.src, f), texts[i], w, h, i).save(os.path.join(od, f'{i + 1:02d}.png'), optimize=True)
        print('ok', lang, len(files), 'görsel', file=sys.stderr)


if __name__ == '__main__':
    main()
