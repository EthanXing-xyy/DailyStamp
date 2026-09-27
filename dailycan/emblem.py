"""Library emblems: codex draws one per word, and it is split into a palette-free R/G/B channel mask (dark / magenta /
cyan ink) that the web app tints with any palette."""
from __future__ import annotations

import os
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter

EMBLEM_SIZE = 1024

PROMPT_TMPL = """You are the illustrator for a pop-art series of postage stamps, each "condensing" one mood.
Today's mood: "{phrase}"{en}.

Step 1: {step1}
Step 2: use your image generation tool to draw it as a flat screen-print emblem:
- extra-thick uniform black outlines (the emblem will be printed small), bold simple shapes, 1960s pop-art / vintage packaging feel
- exactly two flat ink colours besides black: pure magenta (#FF00A8) and pure cyan (#00D8FF); no gradients, no shading, no texture
- pure white background, subject centred and filling ~75% of a square 1024x1024 canvas, composition that sits well inside a circle
- absolutely no letters, numbers or words in the image
Step 3: save the PNG as "{out}" (overwrite if it exists).
Step 4: reply with exactly one line: CONCEPT: <the object you drew, in under 12 English words>
"""


STEP1_FREE = "pick ONE iconic, witty object or creature that stands for this mood (be specific and visual, avoid faces of real people, avoid text)."
STEP1_IDEA = "draw exactly this, and nothing else: {idea}. One single subject, simple and bold enough to read at thumbnail size (no real people, no brands, no text)."


def generate_with_codex(phrase: str, en: str, out_png: str, timeout: int = 600, idea: str = "") -> str | None:
    """Ask codex for an emblem (of `idea` when given). Returns the concept line, or None on failure."""
    out_png = os.path.abspath(out_png)
    workdir = os.path.dirname(out_png)
    last = os.path.join(workdir, "_codex_last.txt")
    step1 = STEP1_IDEA.format(idea=idea.rstrip(".")) if idea else STEP1_FREE
    prompt = PROMPT_TMPL.format(phrase=phrase, en=f" ({en})" if en else "", out=out_png, step1=step1)
    cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "danger-full-access",
           "--enable", "image_generation", "-c", 'model_reasoning_effort="low"',
           "-C", workdir, "-o", last, prompt]
    try:
        subprocess.run(cmd, cwd=workdir, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        print("  codex timed out", file=sys.stderr)
        return None
    if not os.path.exists(out_png):
        print("  codex produced no image", file=sys.stderr)
        return None
    concept = ""
    if os.path.exists(last):
        with open(last, encoding="utf-8", errors="ignore") as f:
            for line in f:
                if line.strip().upper().startswith("CONCEPT:"):
                    concept = line.split(":", 1)[1].strip()
        os.remove(last)
    if concept:
        with open(os.path.join(workdir, "concept.txt"), "w", encoding="utf-8") as f:
            f.write(concept)
    return concept or "(no concept reported)"


def classify(src: Image.Image, size: int | tuple[int, int] = EMBLEM_SIZE) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Split an AI screen-print into three boolean masks: (dark ink, magenta ink, cyan ink)."""
    # transparent pixels are background, not black ink: flatten onto white first
    if src.mode in ("RGBA", "LA", "P"):
        rgba = src.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        im = Image.alpha_composite(bg, rgba).convert("RGB")
    else:
        im = src.convert("RGB")
    # crop to the target's aspect (square unless size is a (w, h) pair, e.g. a landscape poster), then resize
    tw, th = size if isinstance(size, tuple) else (size, size)
    w, h = im.size
    cw, ch = (w, round(w * th / tw)) if w * th / tw <= h else (round(h * tw / th), h)
    im = im.crop(((w - cw) // 2, (h - ch) // 2, (w - cw) // 2 + cw, (h - ch) // 2 + ch)).resize((tw, th), Image.LANCZOS)
    hsv = np.asarray(im.convert("HSV"), dtype=np.float32)
    hue, sat, val = hsv[..., 0] * 360 / 255, hsv[..., 1] / 255, hsv[..., 2] / 255

    dark = val < 0.42
    white = (val > 0.86) & (sat < 0.18)
    colored = ~dark & ~white & (sat > 0.25)
    # pixels that are neither (grey mid-tones, anti-aliasing) -> nearest by value
    rest = ~dark & ~white & ~colored
    dark = dark | (rest & (val < 0.65))
    # hue split: magenta side (~ 260..360, 0..30) vs cyan side (~ 150..260)
    mag = colored & ((hue >= 250) | (hue < 40))
    cyn = colored & ~mag

    # clean speckle
    def clean(m: np.ndarray) -> np.ndarray:
        img = Image.fromarray((m * 255).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(5))
        return np.asarray(img) > 127

    dark, mag, cyn = clean(dark), clean(mag), clean(cyn)
    mag &= ~dark
    cyn &= ~dark & ~mag

    # thicken the ink so outlines survive being printed at medallion size
    dark_img = Image.fromarray((dark * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(5))
    dark = np.asarray(dark_img) > 127
    mag &= ~dark
    cyn &= ~dark
    return dark, mag, cyn


def _border_connected(m: np.ndarray) -> np.ndarray:
    """The part of a boolean mask that touches the image edge (4-connected flood from every edge pixel)."""
    from collections import deque
    h, w = m.shape
    seen = np.zeros_like(m)
    q = deque((y, x) for y in range(h) for x in (0, w - 1) if m[y, x])
    q.extend((y, x) for x in range(w) for y in (0, h - 1) if m[y, x])
    for y, x in q: seen[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    return seen


def build_mask(src: Image.Image, size: int = EMBLEM_SIZE) -> Image.Image:
    """Palette-independent emblem: RGB PNG whose R/G/B channels are the dark / magenta / cyan ink masks."""
    dark, mag, cyn = classify(src, size)
    if dark.mean() > 0.35:                                  # drawn on a black ground: that ground is background, not ink
        dark = dark & ~_border_connected(dark)
    arr = np.zeros((size, size, 4), dtype=np.uint8)
    arr[..., 0] = dark * 255
    arr[..., 1] = mag * 255
    arr[..., 2] = cyn * 255
    arr[..., 3] = (dark | mag | cyn) * 255
    fitted = fit_square(Image.fromarray(arr, "RGBA"), size)
    a = np.asarray(fitted).copy()
    a[..., :3] = np.where(a[..., :3] > 127, 255, 0)
    a[a[..., 3] == 0, :3] = 0
    return Image.fromarray(a[..., :3], "RGB")


def fit_square(im: Image.Image, size: int, fill: float = 0.86) -> Image.Image:
    """Crop to the opaque content's bounding box and centre it in a size x size canvas, filling `fill` of it."""
    bbox = im.getbbox()
    if not bbox:
        return im
    crop = im.crop(bbox)
    w, h = crop.size
    scale = fill * size / max(w, h)
    crop = crop.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.LANCZOS)
    # re-snap colours after resampling (keep exact palette values)
    arr = np.asarray(crop).copy()
    arr[..., 3] = np.where(arr[..., 3] > 127, 255, 0)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(Image.fromarray(arr, "RGBA"), ((size - crop.width) // 2, (size - crop.height) // 2))
    return canvas
