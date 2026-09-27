"""The loading screen's scene: a small post office at dusk, a street lamp and a pillar box, as hand-cut paper shapes.
codex draws each once in three flat inks on white (black / magenta / cyan = three layers of paper); here the layers are
coloured in fixed dusk tones and saved as one RGBA picture in scene/, with the glass (white enclosed by the shape) cut
out of it and kept as a mask of its own (<key>.win.png, white + alpha) for the light behind the windows."""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageFilter

from .assetset import CodexSet
from .emblem import _border_connected
from .library import ROOT

SCENE_DIR = os.path.join(ROOT, "scene")
MAX_SIDE = 1400
UP = 2                                                   # the raw drawing is worked on at twice its size, for soft edges

# the three papers, darkest first: black ink, magenta ink, cyan ink
# where the type goes on a part, as fractions of its picture [x, y, w, h] (read off the drawing; codex draws no letters)
SIGNS = {"house": [0.135, 0.355, 0.73, 0.095]}

TONES = ((0x0E, 0x15, 0x27), (0x3B, 0x2F, 0x52), (0x3C, 0x4C, 0x78))

COMMON = """Use your image generation tool, square 1024x1024:
- a flat paper cut-out collage seen straight from the front: no perspective, no 3D, no shadows, no shading, no gradients, no texture
- NO outlines at all: shapes are solid pieces of paper that meet edge to edge
- every edge is cut by hand with scissors: slightly uneven and lively, never ruler-perfect, corners a little off square
- few, big, simple shapes; nothing fiddly, no bricks, no roof tiles, no tiny details
- exactly three flat colours on a pure white (#FFFFFF) ground: pure black (#000000), pure magenta (#FF00A8), pure cyan (#00D8FF)
- the subject keeps a clear white margin on every side (it must not touch the edges of the canvas)
- absolutely no letters, numbers or words
"""

# (key, subject and which paper is what, least number of panes of glass)
PARTS = [
    ("house", """Subject: the front of a small village post office, one storey with a gabled attic, a little wider than tall.
- walls: black
- the pitched roof with a small chimney, a plain awning over the shop window, and a long blank sign board above the door and window: magenta
- the door (right of centre) with a step under it, and the thin frames round the windows: cyan
- glass is pure white, left empty: ONE very large shop window on the left taking nearly half the width of the front, a single
  pane with no bars across it; one small round window in the gable; one small pane in the upper part of the door
- the ground is not drawn; the house ends in a straight-ish bottom edge""", 2),
    ("lamp", """Subject: one old street lamp on a plain WHITE background, tall and slender, standing upright in the middle of the canvas and filling its height.
- the post, its slightly wider foot and the short curved arm at the top: solid black paper
- the lantern hanging from the arm is big (about a fifth of the lamp's height): a simple four-sided lantern whose cap, base and
  side bars are THICK strips of cyan paper, as thick as the post
- between the bars the lantern's glass is pure white, left empty, exactly like the white background (one big pane, or two)
- magenta is used only for one small collar ring on the post
- the background is pure white everywhere, never black; nothing else in the picture, no ground""", 1),
    ("mailbox", """Subject: one round pillar post box (a free-standing letter box), squat and friendly, centred.
- the body: black
- the domed cap on top and the base ring: magenta
- the plate round the letter slot and a small door plate: cyan; the slot itself is black
- no white holes inside it, nothing else in the picture, no ground""", 0),
]

PROMPT_TMPL = """You are cutting a picture out of coloured paper with scissors, like Henri Matisse's late paper cut-outs.
{subject}
""" + COMMON + """Save the PNG as "{out}" (overwrite if it exists), then reply with exactly one line: DONE
"""


def _soft(m: np.ndarray) -> np.ndarray:
    img = Image.fromarray((m * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(1.6))
    return np.asarray(img, dtype=np.float32) / 255


def layers(src: Image.Image):
    """(black, magenta, cyan, glass) as boolean masks at UP times the raw size."""
    rgba = src.convert("RGBA")
    im = Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba).convert("RGB")
    im = im.resize((im.width * UP, im.height * UP), Image.LANCZOS).filter(ImageFilter.MedianFilter(5))
    hsv = np.asarray(im.convert("HSV"), dtype=np.float32)
    hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255
    colored = (sat > 0.3) & (val > 0.35)
    dark = ~colored & (val < 0.6)
    white = ~colored & ~dark
    mag = colored & ((hue >= 250) | (hue < 40))
    cyn = colored & ~mag
    if dark.mean() > 0.5:                                   # drawn on black
        dark = dark & ~_border_connected(dark)
    outside = _border_connected(white)
    glass = white & ~outside
    # specks of white inside the paper are not windows
    g = Image.fromarray((glass * 255).astype(np.uint8), "L").filter(ImageFilter.MinFilter(9)).filter(ImageFilter.MaxFilter(9))
    big = np.asarray(g) > 127
    dark = dark | (glass & ~big)
    return dark, mag, cyn, big


def _panes(glass: np.ndarray) -> list[tuple[int, int, int, int]]:
    """Bounding boxes (x0, y0, x1, y1) of the separate panes, biggest first (labelled on a small copy)."""
    from collections import deque
    k = 4
    g = glass[::k, ::k].copy()
    h, w = g.shape
    out = []
    for y0 in range(h):
        for x0 in range(w):
            if not g[y0, x0]:
                continue
            q = deque([(y0, x0)]); g[y0, x0] = False
            xs, ys, n = [x0, x0], [y0, y0], 0
            while q:
                y, x = q.popleft(); n += 1
                xs = [min(xs[0], x), max(xs[1], x)]; ys = [min(ys[0], y), max(ys[1], y)]
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < h and 0 <= nx < w and g[ny, nx]:
                        g[ny, nx] = False; q.append((ny, nx))
            if n > 12:
                out.append((n, (xs[0] * k, ys[0] * k, (xs[1] + 1) * k, (ys[1] + 1) * k)))
    return [b for _, b in sorted(out, reverse=True)]


def build(src: Image.Image):
    """(picture RGBA, glass mask RGBA, panes as fractions of the picture [x, y, w, h], ink share)."""
    dark, mag, cyn, glass = layers(src)
    paper = dark | mag | cyn
    ink = float(paper.mean())
    ys, xs = np.nonzero(paper | glass)
    if not len(xs):
        return None, None, [], 0.0
    pad = 6
    x0, x1 = max(0, xs.min() - pad), min(paper.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(paper.shape[0], ys.max() + pad + 1)
    cut = lambda m: m[y0:y1, x0:x1]
    sd, sm, sc, sg = (_soft(cut(m)) for m in (dark, mag, cyn, glass))
    alpha = np.clip(sd + sm + sc, 0, 1)
    wsum = np.maximum(sd + sm + sc, 1e-4)
    rgb = sum(s[..., None] * np.array(t, dtype=np.float32) for s, t in zip((sd, sm, sc), TONES)) / wsum[..., None]
    pic = np.dstack([rgb, alpha * 255]).round().astype(np.uint8)
    win = np.zeros(pic.shape, dtype=np.uint8)
    win[..., :3] = 255
    # the light runs a little under the frames, so no dark seam shows between glass and paper
    wide = np.asarray(Image.fromarray((cut(glass) * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(7)), dtype=np.float32) / 255
    win[..., 3] = (np.maximum(sg, _soft(wide > 0.5)) * 255).round().astype(np.uint8)
    H, W = alpha.shape
    panes = [[round((a - x0) / W, 4), round((b - y0) / H, 4), round((c - a) / W, 4), round((d - b) / H, 4)] for a, b, c, d in _panes(glass)]
    pic, win = Image.fromarray(pic, "RGBA"), Image.fromarray(win, "RGBA")
    k = MAX_SIDE / max(pic.size)
    if k < 1:
        size = (round(pic.width * k), round(pic.height * k))
        pic, win = pic.resize(size, Image.LANCZOS), win.resize(size, Image.LANCZOS)
    return pic, win, panes, ink


def _mask_for(key: str):
    need = next(p[2] for p in PARTS if p[0] == key)

    def mask(raw: Image.Image):
        pic, win, panes, ink = build(raw)
        if pic is None or ink < 0.04 or ink > 0.75:
            return None, f"ink covers {ink:.0%}"
        if len(panes) < need:
            return None, f"{len(panes)} pane(s) of glass, {need} wanted"
        return pic, ""
    return mask


def _entry(it, p, file):
    raw = os.path.join(SCENE_DIR, it[0] + ".raw.png")
    pic, win, panes, _ = build(Image.open(raw))
    e = {"key": it[0], "file": file, "w": pic.width, "h": pic.height, "panes": panes}
    if it[0] in SIGNS:
        e["sign"] = SIGNS[it[0]]
    if panes:
        win.save(os.path.join(SCENE_DIR, it[0] + ".win.png"), optimize=True)
        e["win"] = f"scene/{it[0]}.win.png"
    return e


class SceneSet(CodexSet):
    """Each part has its own glass count to pass, so the mask builder is picked per key."""

    def generate(self, key: str) -> bool:
        self.mask = _mask_for(key)
        return super().generate(key)

    def rebuild(self) -> None:
        for k in self.keys:
            raw = self.path_for(k, raw=True)
            if os.path.exists(raw):
                pic = build(Image.open(raw))[0]
                if pic is not None:
                    pic.save(self.path_for(k), optimize=True)
        self.write_index()


SET = SceneSet(SCENE_DIR, PARTS, what="scene part", mask=_mask_for("mailbox"), entry=_entry,
               prompt=lambda it, out: PROMPT_TMPL.format(subject=it[1], out=out))
