"""首页 backdrops: big hand-cut paper shapes after Matisse's late cut-outs (Jazz, Oceania) and Warhol's Flowers, laid
tone-on-tone on the home desk, two a day. codex draws each once as a black silhouette; it is stored as a white
shape on a transparent ground (the alpha is the shape) in backdrops/, so the page can tint it with any colour."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time

import numpy as np
from PIL import Image, ImageFilter

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


def path_for(key: str, raw: bool = False) -> str:
    return os.path.join(BACKDROPS_DIR, key + (".raw.png" if raw else ".png"))


def write_index() -> None:
    items = []
    for k, _ in SHAPES:
        p = path_for(k)
        if os.path.exists(p):
            w, h = Image.open(p).size
            items.append({"key": k, "file": f"backdrops/{k}.png", "w": w, "h": h, "v": int(os.path.getmtime(p))})
    with open(os.path.join(BACKDROPS_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


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


def generate(key: str, timeout: int = 900) -> bool:
    """Ask codex for one shape, then build its mask. Returns True on success."""
    subject = next(s for k, s in SHAPES if k == key)
    os.makedirs(BACKDROPS_DIR, exist_ok=True)
    raw = path_for(key, raw=True)
    work = os.path.join(BACKDROPS_DIR, "_work", key)
    os.makedirs(work, exist_ok=True)
    cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "danger-full-access",
           "--enable", "image_generation", "-c", 'model_reasoning_effort="low"',
           "-C", work, "-o", os.path.join(work, "last.txt"),
           PROMPT_TMPL.format(subject=subject, out=raw)]
    for _ in range(2):
        if os.path.exists(raw):
            os.remove(raw)
        try:
            subprocess.run(cmd, cwd=work, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                           stderr=subprocess.DEVNULL, timeout=timeout, check=False)
        except subprocess.TimeoutExpired:
            print(f"  {key}: codex timed out", file=sys.stderr)
        if not os.path.exists(raw):
            continue
        mask, ink = build_mask(Image.open(raw))
        if ink > 0.6 or ink < 0.08:                         # a black slab, or next to nothing
            print(f"  {key}: ink covers {ink:.0%}, drawing again", file=sys.stderr)
            continue
        mask.save(path_for(key), optimize=True)
        return True
    return False


def rebuild() -> None:
    """Rebuild every mask from its raw drawing (after changing build_mask)."""
    for k, _ in SHAPES:
        if os.path.exists(path_for(k, raw=True)):
            build_mask(Image.open(path_for(k, raw=True)))[0].save(path_for(k), optimize=True)
    write_index()


def generate_missing(keys: list[str] | None = None) -> None:
    """Draw the given shapes (redraw even if present), or every shape not drawn yet, one codex run at a time
    (parallel runs have picked up each other's images)."""
    todo = keys or [k for k, _ in SHAPES if not os.path.exists(path_for(k))]
    print(f"{len(todo)} backdrop(s) to draw")
    for k in todo:
        t0 = time.time()
        ok = generate(k)
        print(f"  {k}: {'ok' if ok else 'failed'}  ({time.time() - t0:.0f}s)", flush=True)
        write_index()
    write_index()
