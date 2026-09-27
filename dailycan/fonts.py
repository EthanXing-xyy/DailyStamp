"""Font lookup + mixed CJK/Latin text drawing helpers for PIL."""
from __future__ import annotations

import os
import re
from functools import lru_cache

from PIL import ImageDraw, ImageFont

FONT_DIRS = [
    os.path.join(os.path.dirname(__file__), "..", "fonts"),
    r"C:\Windows\Fonts",
    os.path.expanduser(r"~\AppData\Local\Microsoft\Windows\Fonts"),
]

# role -> candidate filenames, first hit wins
ROLES = {
    "brand_cjk":   ["STXINGKA.TTF", "STLITI.TTF", "simkai.ttf"],
    "brand_latin": ["FREESCPT.TTF", "BRADHITC.TTF", "MISTRAL.TTF", "segoesc.ttf"],
    "phrase_cjk":  ["方正粗黑宋简体.ttf", "STHUPO.TTF", "HarmonyOS_Sans_SC_Bold.ttf", "simhei.ttf"],
    "phrase_latin": ["ariblk.ttf", "impact.ttf", "arialbd.ttf"],
    "caps":        ["DINNextLTPro-Bold.ttf", "bahnschrift.ttf", "arialbd.ttf"],
    "caps_med":    ["DINNextLTPro-Medium.ttf", "bahnschrift.ttf", "arial.ttf"],
    "cjk_small":   ["HarmonyOS_Sans_SC_Bold.ttf", "Dengb.ttf", "simhei.ttf"],
    "cjk_small_med": ["HarmonyOS_Sans_SC_Regular.ttf", "Deng.ttf", "simhei.ttf"],
}

CJK_RE = re.compile(r"[\u3000-\u303f\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]")


def has_cjk(s: str) -> bool:
    return bool(CJK_RE.search(s))


@lru_cache(maxsize=None)
def font_path(role: str) -> str:
    for name in ROLES[role]:
        for d in FONT_DIRS:
            p = os.path.join(d, name)
            if os.path.exists(p):
                return p
    raise FileNotFoundError(f"no font for role {role}: tried {ROLES[role]}")


@lru_cache(maxsize=None)
def font(role: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(font_path(role), size)


def text_size(fnt: ImageFont.FreeTypeFont, s: str, tracking: int = 0) -> tuple[int, int]:
    l, t, r, b = fnt.getbbox(s)
    w = r - l + tracking * max(0, len(s) - 1)
    return w, b - t


def fit_font(role: str, s: str, max_w: int, max_h: int, tracking: int = 0, lo: int = 8, hi: int = 1200) -> ImageFont.FreeTypeFont:
    """Largest size whose rendered bbox fits in max_w x max_h."""
    best = lo
    while lo <= hi:
        mid = (lo + hi) // 2
        w, h = text_size(font(role, mid), s, tracking)
        if w <= max_w and h <= max_h:
            best, lo = mid, mid + 1
        else:
            hi = mid - 1
    return font(role, best)


def draw_tracked(draw: ImageDraw.ImageDraw, xy: tuple[float, float], s: str, fnt, fill, tracking: int = 0, anchor: str = "mm"):
    """Draw text with letter spacing. anchor 'mm' centres the whole run at xy; 'lm' left-centres."""
    if tracking == 0:
        draw.text(xy, s, font=fnt, fill=fill, anchor=anchor)
        return
    widths = [fnt.getlength(ch) for ch in s]
    total = sum(widths) + tracking * (len(s) - 1)
    x, y = xy
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for ch, w in zip(s, widths):
        draw.text((x, y), ch, font=fnt, fill=fill, anchor="l" + anchor[1])
        x += w + tracking


def split_runs(s: str) -> list[tuple[bool, str]]:
    """Split into (is_cjk, text) runs."""
    runs: list[tuple[bool, str]] = []
    for ch in s:
        c = bool(CJK_RE.match(ch))
        if runs and runs[-1][0] == c:
            runs[-1] = (c, runs[-1][1] + ch)
        else:
            runs.append((c, ch))
    return runs


def draw_mixed(draw: ImageDraw.ImageDraw, xy: tuple[float, float], s: str, latin_role: str, cjk_role: str,
               size: int, fill, tracking: int = 0, cjk_scale: float = 0.92, anchor: str = "mm"):
    """Draw a line mixing Latin (latin_role) and CJK (cjk_role) fonts, centred or left-anchored at xy."""
    fl = font(latin_role, size)
    fc = font(cjk_role, int(size * cjk_scale))
    runs = split_runs(s)
    pieces = []
    total = 0.0
    for is_cjk, txt in runs:
        f = fc if is_cjk else fl
        w = sum(f.getlength(ch) for ch in txt) + tracking * max(0, len(txt) - 1)
        pieces.append((f, txt, w))
        total += w + tracking
    total -= tracking
    x, y = xy
    if anchor[0] == "m":
        x -= total / 2
    elif anchor[0] == "r":
        x -= total
    for f, txt, w in pieces:
        for ch in txt:
            draw.text((x, y), ch, font=f, fill=fill, anchor="l" + anchor[1])
            x += f.getlength(ch) + tracking
    return total
