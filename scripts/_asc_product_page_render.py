#!/usr/bin/env python3
"""
ASC product-page creatives (header + search).

Header note: App Store center-crops landscape headers on iPhone. Keep all
critical content inside ~18% side safe margins (centered lockup).

Brand: coral icon only · Bricolage ExtraBold (blocky titles) · coral/citrus pills.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "store" / "screenshots" / "asc-product-page"
ART = Path("/opt/cursor/artifacts/asc-product-page")

CORAL = (216, 90, 48)
BROWN = (113, 43, 19)
CITRUS = (239, 159, 39)
GOLD = (250, 199, 117)
INK = (7, 13, 28)
WHITE = (255, 255, 255)

FONT_XB = ROOT / "assets/fonts/BricolageGrotesque-ExtraBold.ttf"
FONT_SB = ROOT / "assets/fonts/BricolageGrotesque-SemiBold.ttf"
ICON = ROOT / "assets/brand/icons/icon-coral.png"

# App Store header height-fills then center-crops; wide assets lose ~20%+ per side.
SAFE_SIDE = 0.24


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=max(8, int(size)))


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def paint_background(w: int, h: int, *, quiet: bool = False) -> Image.Image:
    """Fast warm night wash (paint small, upscale + blur).

    quiet=True → softer edge washes only (header). No center bloom / sparkles.
    """
    sw, sh = max(320, w // 8), max(180, h // 8)
    small = Image.new("RGB", (sw, sh), INK)
    px = small.load()
    for y in range(sh):
        for x in range(sw):
            nx, ny = x / sw, y / sh
            base = lerp((22, 12, 16), INK, ny * 0.9)
            c = list(base)
            if quiet:
                # Flat dark field for App Store header — no blooms at all
                blooms = ()
            else:
                blooms = (
                    (math.hypot(nx - 0.30, ny - 0.75), CORAL, 0.55, 0.55),
                    (math.hypot(nx - 0.70, ny - 0.30), CITRUS, 0.40, 0.50),
                    (math.hypot(nx - 0.50, ny - 0.15), GOLD, 0.22, 0.40),
                )
            for d, col, strength, falloff in blooms:
                k = max(0.0, 1.0 - d / falloff) ** 2 * strength
                for i in range(3):
                    c[i] = min(255, int(c[i] + (col[i] - c[i]) * k))
            px[x, y] = tuple(c)

    img = small.resize((w, h), Image.Resampling.LANCZOS)
    img = img.filter(ImageFilter.GaussianBlur(radius=max(6, w // 500)))

    # Soft top sheen
    sheen = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sheen)
    band = h // 3
    for i in range(band):
        a = int((12 if quiet else 22) * (1 - i / band))
        sd.line([(0, i), (w, i)], fill=(255, 255, 255, a))
    img = Image.alpha_composite(img.convert("RGBA"), sheen).convert("RGB")

    if not quiet:
        d = ImageDraw.Draw(img)
        for nx, ny, r in (
            (0.35, 0.18, 4),
            (0.45, 0.12, 3),
            (0.55, 0.16, 3),
            (0.65, 0.11, 2),
            (0.42, 0.24, 2),
            (0.58, 0.22, 3),
        ):
            x, y = int(nx * w), int(ny * h)
            d.ellipse([x - r, y - r, x + r, y + r], fill=GOLD)

    if not quiet:
        bar = max(6, h // 90)
        d = ImageDraw.Draw(img)
        d.rectangle([0, h - bar, w, h], fill=CORAL)
    return img


def rounded_shadow(size: int, radius: int, blur: int = 28) -> Image.Image:
    pad = blur * 2
    shadow = Image.new("RGBA", (size + pad * 2, size + pad * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [pad, pad + 10, pad + size, pad + size + 10],
        radius=radius,
        fill=(0, 0, 0, 170),
    )
    return shadow.filter(ImageFilter.GaussianBlur(blur))


def load_icon_rounded(path: Path, size: int, corner: float = 0.2237) -> Image.Image:
    icon = Image.open(path).convert("RGBA").resize((size, size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    md = ImageDraw.Draw(mask)
    r = int(size * corner)
    md.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(icon, (0, 0), mask)
    return out


def text_size(fnt: ImageFont.FreeTypeFont, label: str) -> tuple[int, int, tuple]:
    bb = fnt.getbbox(label)
    return bb[2] - bb[0], bb[3] - bb[1], bb


def draw_pill(
    base: Image.Image,
    cx: int,
    cy: int,
    label: str,
    fill: tuple[int, int, int],
    text_fill: tuple[int, int, int],
    fnt: ImageFont.FreeTypeFont,
    *,
    pad_x: int,
    pad_y: int,
) -> int:
    """Centered pill at (cx, cy). Returns width."""
    tw, th, bb = text_size(fnt, label)
    w, h = tw + pad_x * 2, th + pad_y * 2
    x, y = cx - w // 2, cy - h // 2

    glow = Image.new("RGBA", (w + 40, h + 40), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.rounded_rectangle([8, 8, w + 32, h + 32], radius=(h + 24) // 2, fill=(*fill, 80))
    glow = glow.filter(ImageFilter.GaussianBlur(14))
    base.paste(glow, (x - 20, y - 20), glow)

    d = ImageDraw.Draw(base)
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=fill)
    tx = x + pad_x - bb[0]
    ty = y + (h - th) // 2 - bb[1]
    d.text((tx, ty), label, font=fnt, fill=text_fill)
    return w


def fit_title(max_width: int, h: int) -> tuple[ImageFont.FreeTypeFont, int]:
    size = max(56, int(h * 0.14))
    while size > 40:
        f = font(FONT_XB, size)
        tw, _, _ = text_size(f, "choremaxx")
        if tw <= max_width:
            return f, size
        size -= 4
    return font(FONT_XB, 40), 40


def draw_tracked(
    draw: ImageDraw.ImageDraw,
    text: str,
    xy: tuple[int, int],
    fnt: ImageFont.FreeTypeFont,
    fill,
    tracking: float,
) -> tuple[int, int]:
    """Draw text with letter-spacing; returns (width, height)."""
    x, y = xy
    max_h = 0
    cursor = x
    for i, ch in enumerate(text):
        bb = fnt.getbbox(ch)
        cw, ch_h = bb[2] - bb[0], bb[3] - bb[1]
        draw.text((cursor - bb[0], y - bb[1]), ch, font=fnt, fill=fill)
        cursor += cw + (0 if i == len(text) - 1 else tracking)
        max_h = max(max_h, ch_h)
    return cursor - x, max_h


def tracked_width(text: str, fnt: ImageFont.FreeTypeFont, tracking: float) -> int:
    total = 0
    for i, ch in enumerate(text):
        bb = fnt.getbbox(ch)
        total += bb[2] - bb[0]
        if i < len(text) - 1:
            total += tracking
    return total


def compose_header(w: int, h: int) -> Image.Image:
    """Header only: small coral icon + choremaxx + tagline. No glow blooms.

    Sit in the mid dark band: below iPad/Apps chrome + Dynamic Island, above
    the product-page white sheet. Tracked type + soft icon edge for a calmer
    premium lockup.
    """
    img = paint_background(w, h, quiet=True).convert("RGBA")
    d = ImageDraw.Draw(img)

    safe_w = int(w * (1 - 2 * SAFE_SIDE))
    cx = w // 2

    # Compact icon with a soft, tight drop (not a glow disc)
    icon_size = int(min(safe_w * 0.11, h * 0.12))
    icon = load_icon_rounded(ICON, icon_size)
    corner = int(icon_size * 0.2237)

    f_title, title_size = fit_title(int(safe_w * 0.72), h)
    title_size = max(40, int(title_size * 0.68))
    f_title = font(FONT_XB, title_size)

    f_sub = font(FONT_SB, max(22, int(title_size * 0.36)))
    sub = "The calm OS for your household"

    title_track = max(1, int(title_size * 0.035))
    sub_track = max(1, int(title_size * 0.045))
    word_gap = max(6, int(title_size * 0.08))  # air between chore | maxx

    chore_w = tracked_width("chore", f_title, title_track)
    maxx_w = tracked_width("maxx", f_title, title_track)
    _, title_h, _ = text_size(f_title, "chore")
    sub_w = tracked_width(sub, f_sub, sub_track)
    _, sh_sub, _ = text_size(f_sub, sub)
    total_w = chore_w + word_gap + maxx_w

    gap_icon_title = int(h * 0.028)
    gap_title_sub = int(title_size * 0.42)
    stack_h = icon_size + gap_icon_title + title_h + gap_title_sub + sh_sub

    # iPad Apps pill + island cover ~top 22–26%; white sheet from ~48%.
    band_top = int(h * 0.26)
    band_bottom = int(h * 0.48)
    stack_top = band_top + max(0, (band_bottom - band_top - stack_h) // 2)
    if stack_top + stack_h > band_bottom:
        overflow = stack_top + stack_h - band_bottom
        gap_icon_title = max(10, gap_icon_title - overflow // 2)
        gap_title_sub = max(8, gap_title_sub - overflow // 2)
        stack_h = icon_size + gap_icon_title + title_h + gap_title_sub + sh_sub
        stack_top = band_top + max(0, (band_bottom - band_top - stack_h) // 2)

    icon_left = cx - icon_size // 2
    icon_top = stack_top

    # Soft premium contact shadow (tight, low opacity — not a glow disc)
    blur = max(8, icon_size // 56)
    pad = blur * 2
    shadow = Image.new("RGBA", (icon_size + pad * 2, icon_size + pad * 2), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle(
        [pad, pad + 3, pad + icon_size, pad + icon_size + 3],
        radius=corner,
        fill=(0, 0, 0, 70),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(blur))
    img.alpha_composite(shadow, (icon_left - pad, icon_top - pad))
    img.alpha_composite(icon, (icon_left, icon_top))

    # Hairline highlight ring for a finished edge
    ring = Image.new("RGBA", (icon_size, icon_size), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ring)
    rd.rounded_rectangle(
        [0, 0, icon_size - 1, icon_size - 1],
        radius=corner,
        outline=(255, 255, 255, 38),
        width=max(1, icon_size // 180),
    )
    img.alpha_composite(ring, (icon_left, icon_top))

    title_x = cx - total_w // 2
    title_y = icon_top + icon_size + gap_icon_title
    draw_tracked(d, "chore", (title_x, title_y), f_title, GOLD, title_track)
    draw_tracked(d, "maxx", (title_x + chore_w + word_gap, title_y), f_title, CORAL, title_track)

    sub_y = title_y + title_h + gap_title_sub
    draw_tracked(d, sub, (cx - sub_w // 2, sub_y), f_sub, (255, 255, 255, 230), sub_track)

    return img.convert("RGB")


def compose_search(w: int, h: int) -> Image.Image:
    """Search card: single orange logo, roomy ExtraBold pills, balanced left/right."""
    img = paint_background(w, h).convert("RGBA")
    d = ImageDraw.Draw(img)

    left = int(w * 0.07)
    text_col = int(w * 0.50)
    cx_icon_col = int(w * 0.76)

    icon_size = int(min(w, h) * 0.42)
    icon = load_icon_rounded(ICON, icon_size)
    corner = int(icon_size * 0.2237)

    glow_r = int(icon_size * 0.75)
    glow = Image.new("RGBA", (glow_r * 2, glow_r * 2), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for i in range(glow_r, 0, -3):
        t = i / glow_r
        a = int(95 * (t**2))
        col = lerp(CITRUS, CORAL, 1 - t)
        gd.ellipse([glow_r - i, glow_r - i, glow_r + i, glow_r + i], fill=(*col, a))
    glow = glow.filter(ImageFilter.GaussianBlur(26))

    icon_left = min(cx_icon_col - icon_size // 2, w - icon_size - int(w * 0.05))
    icon_top = (h - icon_size) // 2 - int(h * 0.02)
    icon_top = max(int(h * 0.10), min(icon_top, h - icon_size - int(h * 0.10)))

    img.alpha_composite(glow, (icon_left + icon_size // 2 - glow_r, icon_top + icon_size // 2 - glow_r))
    shadow = rounded_shadow(icon_size, corner, blur=max(16, icon_size // 40))
    sh_pad = (shadow.size[0] - icon_size) // 2
    img.alpha_composite(shadow, (icon_left - sh_pad, icon_top - sh_pad))
    img.alpha_composite(icon, (icon_left, icon_top))

    f_title, title_size = fit_title(text_col - 20, h)
    title_y = int(h * 0.22)
    chore_w, _, _ = text_size(f_title, "chore")
    gap = max(2, int(title_size * 0.02))
    d.text((left, title_y), "chore", font=f_title, fill=GOLD)
    d.text((left + chore_w + gap, title_y), "maxx", font=f_title, fill=CORAL)

    f_sub = font(FONT_XB, max(26, int(title_size * 0.32)))
    sub_y = title_y + int(title_size * 1.15)
    d.text((left, sub_y), "The calm OS for your household", font=f_sub, fill=WHITE)

    f_tag = font(FONT_SB, max(20, int(title_size * 0.22)))
    tag_y = sub_y + int(title_size * 0.55)
    d.text((left, tag_y), "Tasks · Grocery · Ranks · Poppins", font=f_tag, fill=GOLD)

    # Pills — same ExtraBold for both labels; ~38% smaller than prior pass
    f_pill = font(FONT_XB, max(20, int(title_size * 0.21)))
    pad_x = max(42, int(title_size * 0.48))
    pad_y = max(22, int(title_size * 0.285))
    pill_y = int(h * 0.70)

    # Stack vertically on narrow canvases; side-by-side when wide
    labels = [("AI Household OS", CORAL, WHITE), ("Family · Shared tablet", CITRUS, BROWN)]
    if w < 2800:
        y = pill_y
        for label, fill, tfill in labels:
            tw, th, _ = text_size(f_pill, label)
            pw = tw + pad_x * 2
            draw_pill(img, left + pw // 2, y, label, fill, tfill, f_pill, pad_x=pad_x, pad_y=pad_y)
            y += th + pad_y * 2 + int(h * 0.035)
    else:
        x = left
        gap_p = max(24, int(w * 0.014))
        for label, fill, tfill in labels:
            tw, th, _ = text_size(f_pill, label)
            pw = tw + pad_x * 2
            draw_pill(img, x + pw // 2, pill_y, label, fill, tfill, f_pill, pad_x=pad_x, pad_y=pad_y)
            x += pw + gap_p

    return img.convert("RGB")


def save(img: Image.Image, name: str, *, fmt: str = "PNG") -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    for dest in (OUT / name, ART / name):
        if fmt.upper() == "PNG":
            img.save(dest, "PNG", optimize=True)
        else:
            img.save(dest, "JPEG", quality=93, optimize=True, dpi=(72, 72))
        print(f"{dest.name} → {img.size[0]}×{img.size[1]} ({fmt})")


def main() -> None:
    # ASC product-page header upload accepts PNG; ship PNG only for headers.
    headers = [
        ("header-5244x2950.png", 5244, 2950),
        ("header-3840x1646.png", 3840, 1646),
    ]
    searches = [
        ("search-5244x2950.png", 5244, 2950),
        ("search-3840x2560.png", 3840, 2560),
        ("search-1920x1280.png", 1920, 1280),
    ]
    for name, w, h in headers:
        save(compose_header(w, h), name, fmt="PNG")
    for name, w, h in searches:
        save(compose_search(w, h), name, fmt="PNG")
    print("done")


if __name__ == "__main__":
    main()
