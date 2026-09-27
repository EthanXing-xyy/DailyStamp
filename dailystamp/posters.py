"""撕一张 posters: the big pop picture hidden under each 32-stamp pane, revealed one torn stamp at a time. codex draws each
once; like the emblems they are stored as palette-independent channel masks (R = key ink, G = magenta, B = cyan) in
posters/, landscape at the pane's 8:5, and printed in the browser in the pane's palette."""
from __future__ import annotations

import os

import numpy as np
from PIL import Image

from .assetset import CodexSet
from .emblem import classify
from .library import ROOT

POSTERS_DIR = os.path.join(ROOT, "posters")
SIZE = (1600, 1000)                                   # the pane's stamp area is 8 x 4 stamps of 4:5, i.e. 8:5

# (key, subject): one per pane, in order; after the last one they start over
POSTERS = [
    ("01-lipstick", "a giant lipstick tube, cap off, the bullet leaning diagonally across the whole frame like an Oldenburg monument, a big lip-print kiss beside it"),
    ("02-telephone", "a hand gripping a ringing telephone receiver, Lichtenstein comic style, with jagged ring bursts around it"),
    ("03-icecream", "a huge ice-cream cone tipped at an angle, two scoops melting, drips running down, a cherry on top"),
    ("04-banana", "a giant banana half peeled, lying diagonally across the frame, homage to Warhol's banana"),
    ("05-jet", "a jet fighter diving diagonally with speed lines, a huge comic explosion burst at the far side, Lichtenstein 'Whaam' style but no words"),
    ("06-cherries", "a pair of enormous cherries hanging from one stem with a big leaf, glossy highlights drawn as flat white shapes"),
]

PROMPT_TMPL = """You are painting a big 1960s pop-art screen-print poster. It hides under a sheet of 32 stamps and is revealed one
small tile at a time, so every part of the picture must hold something bold.
Subject: {subject}.
Use your image generation tool, landscape 1536x1024:
- the subject is HUGE and crops off the edges of the frame, filling it edge to edge; big simple shapes, no small fussy detail
- extra-thick uniform black outlines, flat 1960s screen-print feel (Lichtenstein, Warhol, Oldenburg)
- exactly two flat ink colours besides black: pure magenta (#FF00A8) and pure cyan (#00D8FF); no gradients, shading, halftone or texture
- remaining areas pure white (they will be printed in another colour later); no background scenery
- absolutely no letters, numbers or words
Save the PNG as "{out}" (overwrite if it exists), then reply with exactly one line: DONE
"""


def build_poster_mask(src: Image.Image) -> Image.Image:
    dark, mag, cyn = classify(src, SIZE)
    arr = np.zeros((SIZE[1], SIZE[0], 3), dtype=np.uint8)
    arr[..., 0] = dark * 255
    arr[..., 1] = mag * 255
    arr[..., 2] = cyn * 255
    return Image.fromarray(arr, "RGB")


def _mask(raw: Image.Image):
    m = build_poster_mask(raw)
    if (np.asarray(m)[..., 0] > 127).mean() > 0.45:           # drawn on a dark ground: it would print as a black slab
        return None, "too much black"
    return m, ""


SET = CodexSet(POSTERS_DIR, POSTERS, what="poster", mask=_mask,
               prompt=lambda it, out: PROMPT_TMPL.format(subject=it[1], out=out))
