"""Wrap a flat label onto a tin can and light it on a flat pop backdrop."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .palettes import Palette, hex_to_rgb
from .texture import grain

OUT_W, OUT_H = 1800, 2400
SS = 2  # supersampling


def render_can(label: Image.Image, pal: Palette, out_w: int = OUT_W, out_h: int = OUT_H) -> Image.Image:
    S = SS
    W, H = out_w * S, out_h * S
    cx = W // 2
    r = int(0.311 * out_w) * S
    ry = int(r * 0.27)
    y0 = int(0.235 * out_h) * S
    y1 = int(0.845 * out_h) * S
    rim_f = 0.030          # metal rim fraction of body height above and below the label
    body_h = y1 - y0

    canvas = Image.new("RGBA", (W, H), hex_to_rgb(pal.wall) + (255,))

    # ---- shadow on the wall
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    sd.ellipse([cx - int(r * 1.10), y1 - int(ry * 0.6), cx + int(r * 1.10), y1 + int(ry * 1.9)], fill=(0, 0, 0, 95))
    sh = sh.filter(ImageFilter.GaussianBlur(28 * S))
    contact = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(contact).ellipse([cx - r, y1 - int(ry * 0.4), cx + r, y1 + int(ry * 1.15)], fill=(0, 0, 0, 120))
    contact = contact.filter(ImageFilter.GaussianBlur(7 * S))
    canvas.alpha_composite(sh)
    canvas.alpha_composite(contact)

    # ---- body via numpy
    x_lo, x_hi = cx - r - 4, cx + r + 4
    y_lo, y_hi = y0, y1 + ry + 4
    bw, bh = x_hi - x_lo, y_hi - y_lo
    xs = (np.arange(bw, dtype=np.float32) + x_lo - cx) / r            # u in [-1,1]
    ys = (np.arange(bh, dtype=np.float32) + y_lo)
    u = np.clip(xs, -1, 1)
    dy = ry * np.sqrt(np.clip(1 - u * u, 0, 1))
    top = y0 + dy                                                       # (bw,)
    bot = y1 + dy
    Y = ys[:, None]
    # anti-aliased body coverage
    a_v = np.clip(np.minimum(Y - top[None, :], bot[None, :] - Y) + 0.5, 0, 1)
    a_h = np.clip((1 - np.abs(xs)) * r + 0.5, 0, 1)
    alpha = (a_v * a_h[None, :]).astype(np.float32)

    v = (Y - top[None, :]) / body_h                                     # 0..1 down the body
    vl = (v - rim_f) / (1 - 2 * rim_f)
    on_label = (vl >= 0) & (vl <= 1)

    theta = np.arcsin(u)
    xl = 0.5 + theta / (2 * np.pi)                                      # 0.25..0.75 of the label
    LA = np.asarray(label.convert("RGB"), dtype=np.float32)
    lh, lw = LA.shape[:2]
    xi = np.clip((xl * (lw - 1)).round().astype(np.int32), 0, lw - 1)
    yi = np.clip((np.clip(vl, 0, 1) * (lh - 1)).round().astype(np.int32), 0, lh - 1)
    rgb = LA[yi, xi[None, :].repeat(bh, axis=0)]                        # (bh, bw, 3)

    # metal rims above / below the label
    metal = np.array([214, 214, 212], dtype=np.float32)
    rgb = np.where(on_label[..., None], rgb, metal)
    groove = (np.abs(vl - 0.0) < 0.004) | (np.abs(vl - 1.0) < 0.004)
    rgb = np.where(groove[..., None], rgb * 0.55, rgb)
    bead = ((vl < -0.012) & (vl > -0.020)) | ((vl > 1.012) & (vl < 1.020))
    rgb = np.where(bead[..., None], np.minimum(255, rgb * 1.18), rgb)

    # ---- cylinder lighting
    lam = np.sqrt(np.clip(1 - u * u, 0, 1))
    diffuse = 0.58 + 0.42 * lam
    right_fall = 1 - 0.20 * np.clip((u - 0.45) / 0.55, 0, 1) ** 2
    left_fall = 1 - 0.10 * np.clip((-u - 0.80) / 0.20, 0, 1) ** 2
    shade = (diffuse * right_fall * left_fall).astype(np.float32)
    spec = 0.30 * np.exp(-((u + 0.36) / 0.10) ** 2) + 0.10 * np.exp(-((u - 0.82) / 0.06) ** 2)
    vert = 1 - 0.07 * np.clip(v, 0, 1) ** 2
    rgb = rgb * shade[None, :, None] * vert[..., None]
    rgb = rgb + (255 - rgb) * spec[None, :, None]
    rgb = np.clip(rgb, 0, 255)

    body = np.dstack([rgb, alpha[..., None] * 255]).astype(np.uint8)
    body_img = Image.fromarray(body, "RGBA")
    canvas.alpha_composite(body_img, (x_lo, y_lo))

    # ---- lid
    lid = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(lid)
    # brushed gradient across the lid face
    g = np.linspace(0, 1, 2 * ry, dtype=np.float32)[:, None]
    gx = np.linspace(0, 1, 2 * r, dtype=np.float32)[None, :]
    tone = 232 - 70 * (0.55 * g + 0.45 * gx)
    face = np.dstack([tone, tone, tone - 3, np.full_like(tone, 255)]).clip(0, 255).astype(np.uint8)
    face_img = Image.fromarray(face, "RGBA")
    mask = Image.new("L", (2 * r, 2 * ry), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, 2 * r - 1, 2 * ry - 1], fill=255)
    lid.paste(face_img, (cx - r, y0 - ry), mask)
    # rim + concentric ridges
    def ell(k, **kw):
        ld.ellipse([cx - r * k, y0 - ry * k, cx + r * k, y0 + ry * k], **kw)
    ell(1.0, outline=(245, 245, 243, 255), width=5 * S)
    ell(0.965, outline=(120, 120, 118, 255), width=2 * S)
    ell(0.90, outline=(150, 150, 148, 255), width=2 * S)
    ell(0.86, fill=(178, 178, 176, 255))
    ell(0.83, fill=(196, 196, 194, 255))
    ell(0.80, outline=(150, 150, 148, 255), width=1 * S)
    ell(0.40, outline=(165, 165, 163, 255), width=1 * S)
    # highlight sweep on the lid
    hl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(hl).ellipse([cx - r * 0.7, y0 - ry * 0.95, cx - r * 0.1, y0 - ry * 0.35], fill=(255, 255, 255, 40))
    hl = hl.filter(ImageFilter.GaussianBlur(10 * S))
    lid.alpha_composite(hl)
    lid_mask = Image.new("L", (W, H), 0)
    ImageDraw.Draw(lid_mask).ellipse([cx - r - 2, y0 - ry - 2, cx + r + 2, y0 + ry + 2], fill=255)
    lid.putalpha(Image.fromarray(np.minimum(np.asarray(lid.split()[3]), np.asarray(lid_mask))))
    canvas.alpha_composite(lid)

    out = canvas.resize((out_w, out_h), Image.LANCZOS)
    out = grain(out, amount=0.03, seed=11, blur=0.8)
    return out.convert("RGB")
