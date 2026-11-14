"""Halloween app icons: our house mark + a witch hat on the roof and a sleepy face.
Run from the repo root: python3 scripts/make-halloween-icons.py"""
from PIL import Image, ImageDraw

S = 4  # supersample
SRC = 'assets/brand/icons'
OUT = 'assets/brand/icons/halloween'


def overlay(kind: str) -> Image.Image:
    im = Image.new('RGBA', (1024 * S, 1024 * S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    p = lambda pts: [(x * S, y * S) for x, y in pts]
    if kind == 'tinted':
        hat, band, buckle, face = (255, 255, 255, 235), (190, 190, 190, 255), (255, 255, 255, 255), (120, 120, 120, 255)
    elif kind == 'dark':
        hat, band, buckle, face = (104, 66, 170, 255), (255, 154, 46, 255), (255, 214, 120, 255), (42, 23, 71, 255)
    else:
        hat, band, buckle, face = (42, 23, 71, 255), (255, 154, 46, 255), (255, 214, 120, 255), (42, 23, 71, 255)
    # Cone with a bent tip, sitting on the roof apex (512, 250)
    d.polygon(p([(432, 236), (592, 236), (566, 120), (600, 70), (668, 58), (612, 40), (556, 62), (520, 120)]), fill=hat)
    # Brim
    d.ellipse([(342 * S, 222 * S), (682 * S, 274 * S)], fill=hat)
    # Band + buckle
    d.polygon(p([(438, 206), (588, 206), (592, 236), (432, 236)]), fill=band)
    d.rectangle([(496 * S, 202 * S), (528 * S, 240 * S)], fill=buckle)
    d.rectangle([(504 * S, 210 * S), (520 * S, 232 * S)], fill=band)
    # Sleepy happy face on the body
    d.ellipse([(450 * S, 590 * S), (478 * S, 624 * S)], fill=face)
    d.ellipse([(546 * S, 590 * S), (574 * S, 624 * S)], fill=face)
    d.arc([(478 * S, 630 * S), (546 * S, 676 * S)], start=20, end=160, fill=face, width=10 * S)
    return im.resize((1024, 1024), Image.LANCZOS)


for palette in ['sky', 'citrus', 'coral', 'berry']:
    for variant, kind in [('', 'light'), ('-dark', 'dark'), ('-tinted', 'tinted'), ('-foreground', 'fg')]:
        base = Image.open(f'{SRC}/icon-{palette}{variant}.png').convert('RGBA')
        base.alpha_composite(overlay(kind))
        base.save(f'{OUT}/icon-{palette}-halloween{variant}.png', optimize=True)
print('ok')
