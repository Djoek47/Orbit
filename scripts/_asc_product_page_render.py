#!/usr/bin/env python3
"""Render ASC header / search creatives with real Choremaxx assets + Bricolage."""

from __future__ import annotations

import math
import os
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store" / "screenshots" / "asc-product-page"
ART = Path("/opt/cursor/artifacts/asc-product-page")

CORAL = (216, 90, 48)
BROWN = (113, 43, 19)
CITRUS = (239, 159, 39)
GOLD = (250, 199, 117)
SKY = (55, 138, 221)
BERRY = (127, 119, 221)
INK = (7, 13, 28)
WHITE = (255, 255, 255)

FONT_XB = ROOT / "assets/fonts/BricolageGrotesque-ExtraBold.ttf"
FONT_SB = ROOT / "assets/fonts/BricolageGrotesque-SemiBold.ttf"
FONT_MD = ROOT / "assets/fonts/BricolageGrotesque-Medium.ttf"

ICON = ROOT / "assets/brand/icons/icon-coral.png"
MARKS = [
    ROOT / "assets/brand/marks/choremaxx-mark-sky.png",
    ROOT / "assets/brand/marks/choremaxx-mark-citrus.png",
    ROOT / "assets/brand/marks/choremaxx-mark-berry.png",
]


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def paint_background(w: int, h: int) -> Image.Image:
    """Warm night wash with coral / citrus / berry blooms."""
    img = Image.new("RGB", (w, h), INK)
    px = img.load()
    for y in range(h):
        for x in range(0, w, 4):  # stride for speed; blur later
            nx, ny = x / w, y / h
            # base vertical dusk
            base = lerp((18, 10, 14), INK, ny * 0.85)
            # coral bloom bottom-left
            d1 = math.hypot(nx - 0.12, ny - 0.78)
            # citrus bloom top-right
            d2 = math.hypot(nx - 0.82, ny - 0.18)
            # berry bloom bottom-center
            d3 = math.hypot(nx - 0.55, ny - 0.95)
            c = list(base)
            for d, col, strength, falloff in (
                (d1, CORAL, 0.62, 0.55),
                (d2, CITRUS, 0.48, 0.5),
                (d3, BERRY, 0.34, 0.45),
            ):
                k = max(0.0, 1.0 - d / falloff) ** 2 * strength
                for i in range(3):
                    c[i] = min(255, int(c[i] + (col[i] - c[i]) * k))
            for dx in range(4):
                if x + dx < w:
                    px[x + dx, y] = tuple(c)

    img = img.filter(ImageFilter.GaussianBlur(radius=max(8, w // 400)))

    # soft top sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    for i in range(h // 3):
        a = int(28 * (1 - i / (h / 3)))
        sd.line([(0, i), (w, i)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img.convert("RGBA"), sheen).convert("RGB")

    # sparkle dots
    d = ImageDraw.Draw(img)
    sparks = [
        (0.22, 0.16, 5),
        (0.31, 0.11, 3),
        (0.48, 0.14, 4),
        (0.62, 0.09, 2),
        (0.74, 0.18, 4),
        (0.88, 0.12, 3),
        (0.40, 0.22, 2),
        (0.15, 0.28, 3),
    ]
    for nx, ny, r in sparks:
        x, y = int(nx * w), int(ny * h)
        d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD)

    # coral footer bar
    bar = max(8, h // 80)
    d.rectangle([0, h - bar, w, h], fill=CORAL)
    return img


def rounded_shadow(size: int, radius: int, blur: int = 28) -> Image.Image:
    shadow = Image.new("RGBA", (size + blur * 4, size + blur * 4), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    pad = blur * 2
    sd.rounded_rectangle(
        [pad, pad + 8, pad + size, pad + size + 8],
        radius=radius,
        fill=(0, 0, 0, 160),
    )
    return shadow.filter(ImageFilter.GaussianBlur(blur))


def load_icon_rounded(path: Path, size: int, corner: float = 0.2237) -> Image.Image:
    """iOS-ish continuous corner ~22.37%."""
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    r = int(size * corner)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out


def draw_pill(
    base: Image.Image,
    xy: tuple[int, int],
    label: str,
    fill: tuple[int, int, int],
    text_fill: tuple[int, int, int],
    fnt: ImageFont.FreeTypeFont,
) -> int:
    """Draw a pill; return width used."""
    d = ImageDraw.Draw(base)
    bbox = fnt.getbbox(label)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad_x, pad_y = 36, 18
    w, h = tw + pad_x * 2, th + pad_y * 2
    x, y = xy
    # soft glow under pill
    glow = Image.new("RGBA", (w + 24, h + 24), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([4, 4, w + 20, h + 20], radius=(h + 16) // 2, fill=(*fill, 70))
    glow = glow.filter(ImageFilter.GaussianBlur(10))
    base.paste(glow, (x - 12, y - 12), glow)
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=fill)
    # vertical center text (Pillow bbox origin quirks)
    tx = x + pad_x - bbox[0]
    ty = y + (h - th) // 2 - bbox[1]
    d.text((tx, ty), label, font=fnt, fill=text_fill)
    return w


def compose(w: int, h: int, kind: str) -> Image.Image:
    img = paint_background(w, h).convert("RGBA")

    left = int(w * 0.065)
    # Reserve right column for the hero icon so wordmark never collides.
    text_col_w = int(w * (0.52 if w < 2800 else 0.55))
    icon_size = int(min(w, h) * (0.42 if kind == "header" else 0.38))
    if w < 2800:
        icon_size = int(min(w, h) * 0.36)

    # Typography — fit “choremaxx” inside the left column
    title_size = max(64, int(h * 0.15))
    f_probe = font(FONT_XB, title_size)
    while f_probe.getbbox("choremaxx")[2] - f_probe.getbbox("choremaxx")[0] > text_col_w - 24 and title_size > 48:
        title_size -= 4
        f_probe = font(FONT_XB, title_size)

    sub_size = max(24, int(title_size * 0.30))
    tag_size = max(20, int(title_size * 0.22))
    pill_size = max(20, int(title_size * 0.24))

    f_title = font(FONT_XB, title_size)
    f_sub = font(FONT_SB, sub_size)
    f_tag = font(FONT_MD, tag_size)
    f_pill = font(FONT_SB, pill_size)

    title_y = int(h * (0.30 if kind == "search" else 0.28))

    # Wordmark — measure "chore" to place "maxx"
    d = ImageDraw.Draw(img)
    chore = "chore"
    maxx = "maxx"
    chore_bb = f_title.getbbox(chore)
    chore_w = chore_bb[2] - chore_bb[0]
    d.text((left, title_y), chore, font=f_title, fill=GOLD)
    d.text((left + chore_w + int(title_size * 0.02), title_y), maxx, font=f_title, fill=CORAL)

    line2_y = title_y + int(title_size * 1.15)
    d.text((left, line2_y), "The calm OS for your household", font=f_sub, fill=(255, 255, 255, 235))

    line3_y = line2_y + int(sub_size * 1.55)
    if kind == "header" or w >= 3000:
        tag = "Tasks · Grocery · Ranks · Poppins — one shared tablet"
    else:
        tag = "Tasks · Grocery · Ranks · Poppins"
    d.text((left, line3_y), tag, font=f_tag, fill=(*GOLD, 220))

    # Feature pills
    pill_y = int(h * (0.72 if kind == "header" else 0.78))
    if kind == "header":
        pills = [
            ("Home", CORAL, WHITE),
            ("Tasks", CITRUS, BROWN),
            ("Grocery", SKY, WHITE),
            ("Ranks", BERRY, WHITE),
            ("Poppins", GOLD, BROWN),
        ]
    else:
        pills = [
            ("AI Household OS", CORAL, WHITE),
            ("Family · Shared tablet", CITRUS, BROWN),
        ]
    x = left
    gap = int(w * 0.012)
    for label, fill, tfill in pills:
        used = draw_pill(img, (x, pill_y), label, fill, tfill, f_pill)
        x += used + gap
        if x > text_col_w + left:
            break

    icon = load_icon_rounded(ICON, icon_size)
    corner = int(icon_size * 0.2237)

    # glow disc behind icon
    glow_r = int(icon_size * 0.72)
    glow = Image.new("RGBA", (glow_r * 2, glow_r * 2), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(glow_r, 0, -2):
        t = i / glow_r
        a = int(90 * (t**2))
        col = lerp(CITRUS, CORAL, 1 - t)
        gd.ellipse([glow_r - i, glow_r - i, glow_r + i, glow_r + i], fill=(*col, a))
    glow = glow.filter(ImageFilter.GaussianBlur(24))

    icon_left = max(int(w * 0.58), left + text_col_w + int(w * 0.02))
    icon_top = int((h - icon_size) / 2 - h * 0.03)
    # keep on canvas
    icon_left = min(icon_left, w - icon_size - int(w * 0.04))
    icon_top = max(int(h * 0.08), min(icon_top, h - icon_size - int(h * 0.08)))

    glow_left = icon_left + icon_size // 2 - glow_r
    glow_top = icon_top + icon_size // 2 - glow_r
    img.alpha_composite(glow, (glow_left, glow_top))

    shadow = rounded_shadow(icon_size, corner, blur=max(18, icon_size // 40))
    sh_pad = (shadow.size[0] - icon_size) // 2
    img.alpha_composite(shadow, (icon_left - sh_pad, icon_top - sh_pad))
    img.alpha_composite(icon, (icon_left, icon_top))

    # Orbiting theme marks
    small = max(64, int(icon_size * 0.22))
    orbits = [
        (MARKS[0], -0.08, 0.10),
        (MARKS[1], 0.82, 0.78),
        (MARKS[2], 0.78, -0.12),
    ]
    for path, ox, oy in orbits:
        mark = load_icon_rounded(path, small, corner=0.28)
        # tiny shadow
        ms = rounded_shadow(small, int(small * 0.28), blur=12)
        mx = icon_left + int(ox * icon_size)
        my = icon_top + int(oy * icon_size)
        mx = max(8, min(w - small - 8, mx))
        my = max(8, min(h - small - 8, my))
        mpad = (ms.size[0] - small) // 2
        img.alpha_composite(ms, (mx - mpad, my - mpad))
        img.alpha_composite(mark, (mx, my))

    return img.convert("RGB")


def save(img: Image.Image, name: str) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    for dest in (OUT / name, ART / name):
        img.save(dest, "JPEG", quality=93, optimize=True, dpi=(72, 72))
        print(f"{dest.name} → {img.size[0]}×{img.size[1]}")


def main() -> None:
    jobs = [
        ("header-5244x2950.jpg", 5244, 2950, "header"),
        ("header-3840x1646.jpg", 3840, 1646, "header"),
        ("search-5244x2950.jpg", 5244, 2950, "search"),
        ("search-3840x2560.jpg", 3840, 2560, "search"),
        ("search-1920x1280.jpg", 1920, 1280, "search"),
    ]
    for name, w, h, kind in jobs:
        save(compose(w, h, kind), name)
    print("done")


if __name__ == "__main__":
    main()
