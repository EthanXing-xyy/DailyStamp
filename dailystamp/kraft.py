"""首页的牛皮纸 (the kraft home): the desk is crumpled kraft wrapping paper with small flaws (codex, kraft/raw/h5-p.png
for upright screens, h5-d.png for wide ones), and on it a few little gouache pictures in the style of a quiet picture
book (codex, kraft/raw/m*.png: six things on flat kraft per sheet, two rows of three). Two sets, one picked per visit:
M4 乡间邮局 (a village post office) and M1-B 邮差 (the postman's round). The home lays them out itself (home.js), only
where the stamps never pass; here they are cut apart and the sets' arrangements written down, as the mock-ups had them.
Also the ink the home's type is printed with (a mask, seamless: never quite solid, missed specks, thin patches).

  python dailystamp.py kraft     # kraft/paper-p.webp, paper-d.webp, ink.png, sprites/*.webp, index.json
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KRAFT = os.path.join(ROOT, "kraft")
RAW = os.path.join(KRAFT, "raw")
SPRITES = os.path.join(KRAFT, "sprites")

# the sheets: what each cell holds, upper row then lower row, left to right
SHEETS = {"m4": ("plane", "clouds", "balloon", "woman", "office", "lamp4"),
          "m4b": ("van", "tree", "sign", "cart", "child", "fence"),
          "m1": ("letters", "swallow", "plane1", "cat", "postman", "box"),
          "m1s": ("kite", "birds", "balloon1", "leaves", "pigeon", "kraft"),
          "m1b": ("woman1", "boy", "lamp", "dog", "door", "tree1")}
# the sets as the user saw and chose them (scratchpad paint8/9/10). Design screens: a phone 390x844, a desktop
# 1440x900. sky: (thing, middle x, middle y, box w, box h, turn); rows: things along the ground, left to right (the
# phone has one row across the screen, the desktop two, either side of the page count); ref: the thing whose height is
# `tall` at most; gap: px between things (justify: the row filled end to end)
SETS = {
    "m4": {
        "phone": dict(sky=[["balloon", 96, 132, 112, 96, -5], ["plane", 306, 104, 86, 74, 5], ["clouds", 206, 84, 58, 46, 0]],
                      rows=[["woman", "office", "lamp4"]], ref="office", tall=128, gap=0, justify=True),
        "desk": dict(sky=[["balloon", 100, 112, 150, 128, -5], ["plane", 1338, 108, 150, 112, 5], ["clouds", 330, 76, 80, 56, 0]],
                     rows=[["woman", "office"], ["lamp4", "child", "van"]], ref="lamp4", tall=260, gap=80),
    },
    "m1b": {
        "phone": dict(sky=[["pigeon", 96, 132, 118, 104, -5], ["kraft", 306, 108, 92, 80, 5], ["birds", 206, 84, 60, 48, 0]],
                      rows=[["cat", "postman", "box"]], ref="box", tall=128, gap=40),
        "desk": dict(sky=[["pigeon", 104, 116, 172, 140, -5], ["kraft", 1336, 112, 172, 132, 5], ["birds", 332, 78, 92, 60, 0]],
                     rows=[["boy", "cat", "postman"], ["box", "lamp"]], ref="box", tall=240, gap=80),
    },
}


def cells(key, names):
    """a sheet of two rows of three on flat kraft: what is painted in each cell, as RGBA (keyed out by the distance
    from the sheet's border colour; stray specks dropped)"""
    rgb = np.asarray(Image.open(os.path.join(RAW, key + ".png")).convert("RGB"), float)
    edge = np.concatenate([rgb[:12].reshape(-1, 3), rgb[-12:].reshape(-1, 3), rgb[:, :12].reshape(-1, 3), rgb[:, -12:].reshape(-1, 3)])
    a = np.clip((np.sqrt(((rgb - np.median(edge, 0)) ** 2).sum(2)) - 9) / 22, 0, 1)
    a *= ndi.binary_dilation(ndi.binary_opening(a > 0.5, iterations=1), iterations=5)
    h, w = a.shape; col, row = a.sum(0), a.sum(1)
    cut = lambda v, at, r: at - r + int(np.argmin(ndi.uniform_filter1d(v, 9)[at - r:at + r]))
    xs = [0, cut(col, w // 3, 120), cut(col, 2 * w // 3, 120), w]; ys = [0, cut(row, h // 2, 100), h]
    out = {}
    for i, n in enumerate(names):
        r, c = divmod(i, 3); own = a[ys[r]:ys[r + 1], xs[c]:xs[c + 1]]
        y, x = np.nonzero(own > 0.1)
        box = (slice(ys[r] + y.min(), ys[r] + y.max() + 1), slice(xs[c] + x.min(), xs[c] + x.max() + 1))
        out[n] = Image.fromarray(np.dstack([rgb[box], a[box] * 255]).astype(np.uint8), "RGBA")
    return out


def ink_mask(N=512):
    """seamless alpha masks for type printed on rough kraft: ink missing where the fibres stood low, thinner in
    patches. The home uses the third weight (重+)"""
    rng = np.random.default_rng(29)
    f = np.fft.fftfreq(N)
    def noise(sigma, aspect=1.0):
        fy, fx = f[:, None], f[None, :] * aspect
        k = np.exp(-2 * (np.pi * sigma) ** 2 * (fx ** 2 + fy ** 2))
        n = np.real(np.fft.ifft2(np.fft.fft2(rng.standard_normal((N, N))) * k))
        return (n - n.min()) / (n.max() - n.min())
    holes = lambda n, share: np.clip((n - np.quantile(n, 1 - share)) / 0.04, 0, 1)
    def mask(top, dens_lo, spk_share, spk_left, fib_share, blot_share, grain):
        a = top * (dens_lo + (1 - dens_lo) * noise(45))              # never solid; thinner in patches
        a *= 1 - (1 - spk_left) * holes(noise(1.1), spk_share)        # fine specks the ink missed
        a *= 1 - 0.5 * holes(noise(1.0, 3.0), fib_share)              # short fibres across the letters
        a *= 1 - 0.7 * holes(noise(4.0), blot_share)                  # a few bigger thin spots
        a += grain * (noise(0.6) - 0.5)
        return np.clip(a, 0, 1)
    weights = [(0.92, 0.85, 0.07, 0.45, 0.00, 0.00, 0.16), (0.90, 0.72, 0.13, 0.25, 0.015, 0.03, 0.20),
               (0.95, 0.62, 0.20, 0.15, 0.03, 0.06, 0.22)]           # 轻, 重, 重+ (drawn in turn: the noise follows on)
    return [mask(*w) for w in weights][2]


def build():
    os.makedirs(SPRITES, exist_ok=True)
    index = {"v": int(time.time()), "paper": {}, "sprites": {}, "sets": SETS}
    for suf in ("p", "d"):
        im = Image.open(os.path.join(RAW, f"h5-{suf}.png")).convert("RGB")
        im.save(os.path.join(KRAFT, f"paper-{suf}.webp"), quality=88, method=6)
        lum = np.asarray(im, np.float32).mean(2)
        index["paper"][suf] = dict(file=f"paper-{suf}.webp", w=im.width, h=im.height, lum=round(float(lum.mean()), 2))
    m = ink_mask()
    ink = Image.new("RGBA", m.shape[::-1], (0, 0, 0, 0)); ink.putalpha(Image.fromarray((m * 255).astype(np.uint8), "L"))
    ink.save(os.path.join(KRAFT, "ink.png"), optimize=True)
    used = {n for s in SETS.values() for scr in s.values() for n in [x[0] for x in scr["sky"]] + [n for r in scr["rows"] for n in r]}
    for key, names in SHEETS.items():
        for name, im in cells(key, names).items():
            if name not in used: continue
            im.save(os.path.join(SPRITES, f"{name}.webp"), quality=90, alpha_quality=100, method=6)
            # its outline, column by column: how far down from its top the paint begins (for fitting it closely)
            a = np.asarray(im)[..., 3] > 76
            cols = np.array_split(np.arange(im.width), 24)
            top = [round(float(np.argmax(a[:, c].any(1)) / im.height), 3) if a[:, c].any() else 1 for c in cols]
            index["sprites"][name] = dict(file=f"sprites/{name}.webp", w=im.width, h=im.height, top=top)
            print(f"  {name}: {im.width}x{im.height}")
    json.dump(index, open(os.path.join(KRAFT, "index.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
