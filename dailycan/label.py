"""Flat (unwrapped) label renderer. Three print layers: base (band/field/knockout), accent ink, dark ink."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw

from .fonts import draw_mixed, draw_tracked, fit_font, font, has_cjk
from .palettes import Palette, hex_to_rgb, shade, text_on
from .spec import CanSpec
from .texture import benday_mask, edge_radius_map, grain, shift, soften

LABEL_W, LABEL_H = 3800, 1500   # 2*pi*r : label height, so circles stay round on the tin
SPLIT = 0.47        # band / field boundary
VISIBLE = 0.50      # fraction of label width visible on the cylinder


def _rgba(h: str, a: int = 255):
    return hex_to_rgb(h) + (a,)


def render_label(spec: CanSpec, pal: Palette, emblem: Image.Image | None, W: int = LABEL_W, H: int = LABEL_H,
                 misregister: bool = True) -> Image.Image:
    y_split = int(H * SPLIT)
    cx = W // 2

    base = Image.new("RGBA", (W, H), _rgba(pal.band))
    accent = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ink = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    db, da, di = ImageDraw.Draw(base), ImageDraw.Draw(accent), ImageDraw.Draw(ink)

    # ---- field
    db.rectangle([0, y_split, W, H], fill=_rgba(pal.field))

    def layer_for(color: str):
        """Knockout (paper) goes on base; ink colour on ink layer; anything else on accent."""
        if color == pal.paper:
            return db
        if color == pal.ink:
            return di
        return da

    band_txt = text_on(pal.band, pal)
    field_txt = text_on(pal.field, pal)

    # ---- Ben-Day screen at the band edges (reads as a dot gradient on the cylinder silhouette)
    cell = 22
    rmap = edge_radius_map(W, y_split, inner=0.46, outer=1.0, r_max=cell * 0.42)
    dots = benday_mask(W, y_split, cell, rmap)
    dot_col = shade(pal.band, 0.78) if pal.band != pal.ink else shade(pal.band, 1.9)
    dot_layer = Image.new("RGBA", (W, y_split), _rgba(dot_col))
    base.paste(dot_layer, (0, 0), dots)

    # ---- vertical micro-type columns in the field margins (visible as thin stripes at the silhouette)
    col_txt = f"{spec.brand}一罐 · DAILY CAN · CONDENSED MOOD · " * 3
    col_font_size = 34
    col_img = Image.new("RGBA", (H * 2, col_font_size * 2), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(col_img)
    col_rgb = hex_to_rgb(field_txt) + (110,)
    draw_mixed(cdraw, (0, col_font_size), col_txt, "caps_med", "cjk_small_med", col_font_size, col_rgb, tracking=6, anchor="lm")
    col_rot = col_img.rotate(-90, expand=True)   # reads top-to-bottom
    field_h = H - y_split
    for fx in (0.115, 0.215, 0.785, 0.885):
        x = int(W * fx) - col_rot.width // 2
        crop = col_rot.crop((0, 0, col_rot.width, field_h - 60))
        base.alpha_composite(crop, (x, y_split + 30))

    # ---- brand script
    brand_role = "brand_cjk" if has_cjk(spec.brand) else "brand_latin"
    bf = fit_font(brand_role, spec.brand, int(W * 0.19), int(H * 0.21))
    layer_for(band_txt).text((cx, int(H * 0.185)), spec.brand, font=bf, fill=_rgba(band_txt), anchor="mm")

    # ---- tagline under the brand
    draw_mixed(layer_for(band_txt), (cx, int(H * 0.335)), spec.tagline, "caps", "cjk_small", 34,
               _rgba(band_txt), tracking=8)

    # ---- medallion
    D = int(H * 0.235)
    ring = 22
    r_out = D // 2
    r_in = r_out - ring
    db.ellipse([cx - r_out, y_split - r_out, cx + r_out, y_split + r_out], fill=_rgba(pal.paper))
    r_mid = r_out - ring // 2
    da.ellipse([cx - r_mid, y_split - r_mid, cx + r_mid, y_split + r_mid], outline=_rgba(pal.accent), width=ring)
    for rr in (r_out + 8, r_in - 6):
        di.ellipse([cx - rr, y_split - rr, cx + rr, y_split + rr], outline=_rgba(pal.ink), width=4)

    if emblem is not None:
        e_size = int((r_in - 14) * 2)
        em = emblem.resize((e_size, e_size), Image.LANCZOS)
        arr = np.asarray(em)
        ink_rgb = np.array(hex_to_rgb(pal.ink))
        acc_rgb = np.array(hex_to_rgb(pal.accent))
        band_rgb = np.array(hex_to_rgb(pal.band))
        opaque = arr[..., 3] > 0
        is_ink = np.all(arr[..., :3] == ink_rgb, axis=-1) & opaque
        is_acc = np.all(arr[..., :3] == acc_rgb, axis=-1) & opaque & ~is_ink
        is_band = np.all(arr[..., :3] == band_rgb, axis=-1) & opaque & ~is_ink & ~is_acc
        # circular clip
        yy, xx = np.mgrid[0:e_size, 0:e_size]
        inside = np.hypot(xx - e_size / 2, yy - e_size / 2) <= e_size / 2
        pos = (cx - e_size // 2, y_split - e_size // 2)
        for mask, layer, col in ((is_band & inside, base, pal.band), (is_ink & inside, ink, pal.ink),
                                 (is_acc & inside, accent, pal.accent)):
            m = Image.fromarray((mask * 255).astype(np.uint8), "L")
            solid = Image.new("RGBA", (e_size, e_size), _rgba(col))
            layer.paste(solid, pos, m)

    # ---- flanking rosettes (Ben-Day fleurons)
    for sx in (-1, 1):
        rx = cx + sx * int(W * 0.115)
        _rosette(da, rx, y_split, 44, pal.accent)
        di.ellipse([rx - 6, y_split - 6, rx + 6, y_split + 6], fill=_rgba(pal.ink))

    # ---- the phrase
    phrase = spec.phrase if has_cjk(spec.phrase) else spec.phrase.upper()
    role = "phrase_cjk" if has_cjk(phrase) else "phrase_latin"
    tracking = 0 if has_cjk(phrase) else 6
    pf = fit_font(role, phrase, int(W * 0.245), int(H * 0.23), tracking=tracking)
    py = int(H * 0.712)
    draw_tracked(layer_for(field_txt), (cx, py), phrase, pf, _rgba(field_txt), tracking=tracking)

    # ---- translation
    if spec.en:
        draw_tracked(layer_for(field_txt), (cx, int(H * 0.858)), spec.en.upper(), font("caps", 46),
                     _rgba(field_txt), tracking=14)

    # ---- rule + fine print
    rule_y = int(H * 0.902)
    layer_for(field_txt).line([cx - int(W * 0.085), rule_y, cx + int(W * 0.085), rule_y], fill=_rgba(field_txt), width=3)
    fine = f"{spec.fine_print} · NO. {spec.no:03d} · {spec.date.replace('-', '.')}"
    draw_mixed(layer_for(field_txt), (cx, int(H * 0.945)), fine, "caps_med", "cjk_small_med", 27,
               _rgba(field_txt), tracking=4)

    # ---- press: misregister the two ink layers, slight bleed, paper grain
    if misregister:
        accent = shift(soften(accent, 0.6), -4, 3)
        ink = shift(soften(ink, 0.6), 4, 4)
    out = base
    out.alpha_composite(accent)
    out.alpha_composite(ink)
    out = grain(out, amount=0.045, seed=spec.no)
    return out.convert("RGB")


def _rosette(draw: ImageDraw.ImageDraw, x: int, y: int, R: int, color: str):
    """Ring of dots with a bigger centre dot."""
    import math
    for i in range(8):
        a = i * math.tau / 8
        px, py = x + math.cos(a) * R, y + math.sin(a) * R
        r = 11
        draw.ellipse([px - r, py - r, px + r, py + r], fill=_rgba(color))
    for i in range(8):
        a = i * math.tau / 8 + math.tau / 16
        px, py = x + math.cos(a) * R * 0.55, y + math.sin(a) * R * 0.55
        r = 7
        draw.ellipse([px - r, py - r, px + r, py + r], fill=_rgba(color))
    draw.ellipse([x - 20, y - 20, x + 20, y + 20], fill=_rgba(color))
