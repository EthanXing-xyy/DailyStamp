"""首页 backdrops: big hand-cut paper shapes after Matisse's late cut-outs (Jazz, Oceania) and Warhol's Flowers, laid
tone-on-tone on the home desk, two a day. codex draws each once as a black silhouette; it is stored as a white
shape on a transparent ground (the alpha is the shape) in backdrops/, so the page can tint it with any colour."""
from __future__ import annotations

import os

import numpy as np
from PIL import Image, ImageFilter

from .assetset import CodexSet
from .library import ROOT

BACKDROPS_DIR = os.path.join(ROOT, "backdrops")
MAX_SIDE = 1024

# (key, subject): order doesn't matter, the page picks two a day by the date
SHAPES = [
    ("sun", "a sun: a round disc ringed by wavy flame-like rays of uneven length, like a Matisse Jazz cut-out"),
    ("algae", "a Matisse Oceania seaweed / algae frond: a tall stem with deep irregular lobed leaves on both sides"),
    ("star", "an irregular five- or six-pointed star with uneven arms, like the yellow bursts in Matisse's Icarus"),
    ("wave", "a big curling ocean wave crest with a few finger-like tips of foam, one single connected shape floating free; its underside is cut into round swelling curves too, with no flat base and no straight edge anywhere"),
    ("flower", "a four-petal hibiscus flower seen flat from above, round petals, homage to Warhol's Flowers (1964)"),
    ("burst", "a comic-book explosion burst: a jagged irregular star of sharp spikes of uneven length, Lichtenstein style"),
    ("bolt", "a fat zig-zag lightning bolt, tilted"),
    ("moon", "a fat crescent moon, tilted"),
    ("palm", "a single palm leaf fanning out into long pointed fingers from one stalk"),
    ("cloud", "a lumpy cartoon cloud made of uneven round bumps"),
]

PROMPT_TMPL = """You are cutting a shape out of paper with scissors, like Henri Matisse's late paper cut-outs.
Shape: {subject}.
Use your image generation tool, square 1024x1024:
- ONE single solid shape, pure flat black (#000000) on a pure white (#FFFFFF) ground
- the edge is cut by hand with scissors: slightly uneven, lively, no ruler-straight lines, no perfect circles
- the shape is big and fills most of the frame, but keeps a clear white margin on every side (it must not touch the edges)
- no inner lines, no outlines, no holes drawn as lines, no shading, no texture, no gradients, no paper grain
- absolutely no letters, numbers or words
Save the PNG as "{out}" (overwrite if it exists), then reply with exactly one line: DONE
"""


def build_mask(src: Image.Image) -> tuple[Image.Image, float]:
    """The silhouette as white on transparent, cropped to the shape with a small margin; also returns how much of the
    raw square was ink (a drawing on a dark ground would come out as a slab)."""
    rgba = src.convert("RGBA")
    im = Image.alpha_composite(Image.new("RGBA", rgba.size, (255, 255, 255, 255)), rgba).convert("L")
    im = im.filter(ImageFilter.MedianFilter(5))
    lum = np.asarray(im, dtype=np.float32) / 255
    a = np.clip((0.72 - lum) / 0.44, 0, 1)                  # soft edge from the anti-aliasing, solid inside
    ink = float((a > 0.5).mean())
    ys, xs = np.nonzero(a > 0.5)
    if not len(xs):
        return Image.new("RGBA", (8, 8)), 0.0
    pad = round(0.02 * max(a.shape))
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
    a = a[y0:y1, x0:x1]
    out = np.zeros(a.shape + (4,), dtype=np.uint8)
    out[..., :3] = 255
    out[..., 3] = (a * 255).round().astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    k = MAX_SIDE / max(img.size)
    if k < 1:
        img = img.resize((round(img.width * k), round(img.height * k)), Image.LANCZOS)
    return img, ink


def _mask(raw: Image.Image):
    m, ink = build_mask(raw)
    if ink > 0.6 or ink < 0.08:                                # a black slab, or next to nothing
        return None, f"ink covers {ink:.0%}"
    return m, ""


def _entry(it, p, file):
    w, h = Image.open(p).size
    return {"key": it[0], "file": file, "w": w, "h": h}


SET = CodexSet(BACKDROPS_DIR, SHAPES, what="backdrop", mask=_mask, entry=_entry,
               prompt=lambda it, out: PROMPT_TMPL.format(subject=it[1], out=out))
