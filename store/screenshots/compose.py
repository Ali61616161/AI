#!/usr/bin/env python3
"""Gerçek iPhone ekran görüntülerinden mağaza görseli üretir (çerçevesiz, tam ekran).

Kullanım:
  python3 store/screenshots/compose.py --out OUT_DIR --size 1206x2622 \
      "01-itinerary|Gün gün hazır seyahat planı|/yol/ekran1.png" \
      "02-map|Canlı harita ve rota|/yol/ekran2.png"

Her argüman: dosya_adı|başlık|ham_görüntü_yolu
Ham görüntü iPhone'un kendi ekran görüntüsüdür (durum çubuğu, Dynamic Island ve içerik gerçek).
Görüntü, başlığın altına köşeleri yuvarlatılmış tam ekran olarak yerleştirilir.
"""
import argparse
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, 'fonts', 'Unbounded_700Bold.ttf')
FALLBACK = '/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf'


def font(size):
    for p in (FONT, FALLBACK):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def wrap(draw, text, fnt, max_w):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if draw.textlength(t, font=fnt) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)
    return lines


def background(W, H, idx):
    bg = Image.new('RGB', (W, H), (7, 11, 22))
    glow = Image.new('RGB', (W, H), (0, 0, 0))
    d = ImageDraw.Draw(glow)
    spots = [((0.12, 0.08), (255, 107, 74)), ((0.88, 0.72), (124, 92, 255))]
    if idx % 2:
        spots = [((0.85, 0.10), (255, 107, 74)), ((0.15, 0.80), (124, 92, 255))]
    for (x, y), c in spots:
        r = int(W * 0.7)
        d.ellipse((x * W - r, y * H - r, x * W + r, y * H + r), fill=tuple(int(v * 0.42) for v in c))
    glow = glow.filter(ImageFilter.GaussianBlur(W // 4))
    return Image.blend(bg, Image.eval(glow, lambda v: v), 1.0).point(lambda v: min(255, v + 0))


def compose(src, caption, W, H, idx):
    img = background(W, H, idx)
    draw = ImageDraw.Draw(img)
    size = int(W * 0.078)
    fnt = font(size)
    lines = wrap(draw, caption, fnt, W * 0.88)
    y = int(H * 0.045)
    for ln in lines:
        w = draw.textlength(ln, font=fnt)
        draw.text(((W - w) / 2, y), ln, font=fnt, fill=(255, 255, 255))
        y += int(size * 1.2)
    bar_w = int(W * 0.12)
    draw.rounded_rectangle(((W - bar_w) / 2, y + 12, (W + bar_w) / 2, y + 12 + max(6, size // 11)), radius=8, fill=(255, 90, 110))
    top = y + int(size * 0.9)
    shot = Image.open(src).convert('RGB')
    avail_h = H - top - int(H * 0.025)
    avail_w = int(W * 0.9)
    s = min(avail_w / shot.width, avail_h / shot.height)
    sw, sh = int(shot.width * s), int(shot.height * s)
    shot = shot.resize((sw, sh), Image.LANCZOS)
    radius = int(sw * 0.115)
    mask = Image.new('L', (sw, sh), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw, sh), radius=radius, fill=255)
    x = (W - sw) // 2
    # ince açık kenarlık + gölge
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x, top + 20, x + sw, top + sh + 20), radius=radius, fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(30))
    img = Image.alpha_composite(img.convert('RGBA'), shadow).convert('RGB')
    border = Image.new('RGB', (sw + 6, sh + 6), (60, 66, 90))
    bm = Image.new('L', (sw + 6, sh + 6), 0)
    ImageDraw.Draw(bm).rounded_rectangle((0, 0, sw + 6, sh + 6), radius=radius + 3, fill=255)
    img.paste(border, (x - 3, top - 3), bm)
    img.paste(shot, (x, top), mask)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', required=True)
    ap.add_argument('--size', default='1206x2622')
    ap.add_argument('items', nargs='+')
    a = ap.parse_args()
    W, H = (int(v) for v in a.size.lower().split('x'))
    os.makedirs(a.out, exist_ok=True)
    for i, it in enumerate(a.items):
        name, caption, src = it.split('|', 2)
        compose(src, caption, W, H, i).save(os.path.join(a.out, name + '.png'), optimize=True)
        print('ok', name, file=sys.stderr)


if __name__ == '__main__':
    main()
