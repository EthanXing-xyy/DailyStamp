"""The loading screen's picture: the door of a small post office, drawn the way a quiet literary-magazine illustration is
(flat matte colour with dry, grainy edges on cream paper, lots of empty paper, faceless figures): a bicycle leaning by a
red door with a hanging sign, an old pillar box, a pot plant, and a calico cat that changes pose; behind the door, the
lit room it swings open onto.

codex draws four pictures once, from the reference pictures the user picked (scene/ref-*.png, local only):
  cover  the door, the bicycle, the pillar box and the plant, without the cat
  cat    the same cat in three poses side by side, and a small envelope
  room   the inside: the stamp cabinet, counter and clock of ref-room-5 with the clerk of ref-room-1 behind the counter
  leaf   the door's leaf once more, in the light it stands in when open (turned from the day, the room's lamp raking
         across it): the page fades to it as the door swings, so the door isn't one picture turning like a card
Here the cover is cropped to what's drawn, the cat sheet is cut out of its paper into one picture per pose and the
envelope, the room is cut to the doorway's shape, and the door's leaf is cut out of the cover with its glass as holes
(the room shows through them). Where things are in the cover (the door, the sign, the slot, the basket, the
handlebar, where the cat sits) is measured by hand into SPOTS, and everything goes into scene/index.json for
web/loader.js.

  python dailystamp.py scene [cover|cat|room|leaf]   # draw them again (all, or the given ones)
  python dailystamp.py scene --rebuild          # cut them again from the raw drawings"""
from __future__ import annotations

import json
import os
import sys
import time

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

from .assetset import run_codex
from .library import ROOT

SCENE_DIR = os.path.join(ROOT, "scene")
STYLE_REF = os.path.join(SCENE_DIR, "ref-style.png")

STYLE = """The way it is drawn (the attached pictures show it: learn their drawing style, never add anything not asked for):
- a warm cream paper ground with a very faint paper grain, and a lot of empty paper
- flat matte shapes of colour, like gouache or a risograph print: slightly dry, soft, uneven edges and a fine grain
  inside the colour; almost no outlines, only a few fine dark strokes where needed
- a quiet, muted, earthy palette: off-white, sand, camel, warm brown, dark brown-black, brick red, a little faded
  grey-blue
- NO ground line, NO horizon, NO sky, NO background scenery: things simply rest on the empty paper
- calm, poetic, understated, like an illustration in a small literary magazine
- absolutely no letters, numbers, words or signature anywhere"""

# the room behind the door is drawn by the same hand, but it fills its picture: no empty paper round it
ROOM_STYLE = """The way it is drawn (the attached pictures show it: learn their drawing style, never add anything not asked for):
- flat matte shapes of colour, like gouache or a risograph print: slightly dry, soft, uneven edges and a fine grain
  inside the colour; almost no outlines, only a few fine dark strokes where needed
- a quiet, muted, earthy palette: off-white, sand, camel, warm brown, dark brown-black, brick red, a little faded
  grey-blue
- the room fills the whole picture edge to edge (its back wall and its floor; no empty paper margin, no door frame, no
  border), lit by one warm lamp: the wall a soft warm honey-sand, turning warm brown toward the floor and the corners
- calm, poetic, understated, like an illustration in a small literary magazine; the clerk is faceless
- absolutely no letters, numbers, words or signature anywhere (the clock has no numerals, the stamps are plain blocks
  of colour)"""

PARTS = {
    "cover": ("landscape, 1536x1024", ["ref-04.png", "ref-02.png"], """Redraw the FIRST attached picture (the bicycle by the red door) almost exactly as it is: the same
bicycle with its wicker basket of letters and a brown-paper parcel, the same red door with its window panes, the same
stone lintel above it, the same hanging sign on its iron bracket, the same patchy light wall around the door, the same
small plant in a grey-blue pot. Change only this:
- between the door and the pot plant, stand an old round red pillar post box like the one in the SECOND attached
  picture (its domed cap, its letter slot facing us, its dark base), a little shorter than the door
- make the hanging sign board bigger: about as wide as the door, plain cream and completely blank
- no cat, no people
Composition: everything sits in the lower 55% of the picture, the group centred left to right with empty paper on both
sides; the top 45% is empty paper."""),
    "cat": ("landscape, 1536x1024", ["ref-06.png"], """The small calico cat from the FIRST attached picture (white with orange-brown and dark patches), drawn
three times side by side in a row, well apart from each other, all at the same scale, all facing the same way, each
resting on the empty paper with no shadow:
1. sitting upright, looking up
2. sitting, licking one raised front paw
3. lying curled up asleep
and at the far right, well apart, one small closed white envelope lying flat, seen from the front, with a tiny brick-red
stamp in its corner.
Nothing else in the picture."""),
    "room": ("portrait, 1024x1536", ["ref-room-5.png", "ref-room-1.png", "cover.raw.png"], """The inside of the small post
office whose front door is the THIRD attached picture, seen at eye height straight through that open door.
Redraw the FIRST attached picture almost exactly as it is: the same glass-fronted wooden cabinet with its rows of stamps,
the same wooden counter with the small brass bell, the ink pad and the rubber stamp on it, the same round clock with no
numerals, the same brick-red pendant lamp, the same plants, the same rug and floor. Add only this:
- the clerk from the SECOND attached picture (faceless, dark hair tied back, white shirt, dark brown apron) stands
  behind the counter in front of the cabinet, seen from the waist up (the counter hides the rest), both hands on the
  counter sorting a letter
Composition: the picture will be shown cropped to a tall narrow doorway whose left quarter is hidden by the open door,
so the clerk and the middle of the counter sit between 45% and 75% of the picture's width, and everything that
matters stays between 15% and 90% of its height."""),
    # (its reference is made here from the cover: leaf_ref())
    "leaf": ("portrait, 1024x1536", ["_work/leaf.ref.png"], """The FIRST attached picture is a red wooden door leaf taken off
its wall and laid flat on the paper: four glass panes above, a panel of planks below, a brass handle on the right. It is
lit evenly from the front, its glass dark.
Redraw it EXACTLY as it is: the same place and the same size in the picture, the same outline, the panes, the glazing
bars, the panel, the planks and the handle exactly where they are, the same paint with its worn white specks and
scratches. Change ONLY the light that falls on it:
- the door now stands open into a lit room, turned away from the daylight: its whole face is in soft shadow, a deeper,
  duller, browner red, about a third darker than in the first picture
- warm lamp light from the room falls across the face from the RIGHT, at a low raking angle: a warm glowing orange-red
  band down the right edge (the side of the handle), fading smoothly into the deepest shadow at the left edge
- the raking light shows the relief: the raised frame casts a narrow soft shadow onto the sunken panel and onto the
  glass along their right-hand edges; the left-hand edges of the sunken panel, of the grooves between the planks and
  of the glazing bars catch a thin warm light; the handle casts a short soft shadow to its left
- the four panes are clear old glass seen at a slant, unlit: a dark warm grey-brown, each crossed by one or two soft
  pale diagonal streaks of reflected light
Nothing else: no wall, no door frame, no floor, no shadow on the paper, only the door leaf on the empty cream paper."""),
}
STYLES = {"room": ROOM_STYLE}

PROMPT = """Use your image generation tool to draw one picture, {size}.
{subject}
{style}
Save the PNG as "{out}" (overwrite if it exists), then reply with exactly one line: DONE
"""

# where things are in the raw cover (px of the 1536x1024 drawing), measured by hand; index.json gets them as fractions
# of the cropped picture. Boxes are [x, y, w, h]; the sign is its board's four corners (top left, top right, bottom
# right, bottom left: it hangs a little askew, and the type on it follows); the slot is [x, y, w] (the line a letter
# vanishes at), the bell a point, the cat [x of its middle, y of its feet, height of the sitting pose]: it sits left of
# the bicycle, a little larger than life so it can be tapped on a phone.
SPOTS_RAW = {
    "door": [691, 404, 224, 486],
    "sign": [[1021, 421], [1257, 403], [1258, 506], [1022, 516]],
    "slot": [1003, 623, 52],
    "box": [966, 537, 137, 380],
    "basket": [515, 560, 150, 152],
    "bell": [482, 590],
    "cat": [128, 926, 178],
    "glass": [726, 425, 136, 194],                         # the door's four panes, with a little frame round them
    # the leaf alone, inside its frame: the frame's top band above it and its right post (past the dark gap at the
    # latch side) stay on the wall when it swings; on the left the leaf meets the wall itself; the doorstep lies below
    "leaf": [692, 396, 197, 489],
    "wheel": [684, 757, 28, 131],                          # the part of the bicycle's front wheel that is over the leaf
}
# the door's paint ends in a ragged edge a little left of the hinge line and below the leaf's foot: the leaf's face
# carries LEAF_PAD px of it on the left and LEAF_FOOT below
LEAF_PAD, LEAF_FOOT = 8, 3
WHEEL = (590, 832, 120)                                    # the front wheel: its middle, the tyre's outer radius (fitted)
# the leaf is drawn again by codex from a reference made here: the leaf LEAF_K times as large, at LEAF_AT on the paper
LEAF_K, LEAF_AT = 2.8, (236, 83)


# the room is cut to the leaf's shape, full height, placed so ROOM_X (the middle of the counter and the clerk, px of the
# raw drawing, measured by hand) sits 62% across it: the open door hides about the opening's left quarter
ROOM_X = 500
ROOM_W = 480                                               # a phone's doorway is ~222 device px wide, a desktop's ~195 css


def raw_path(key: str) -> str:
    return os.path.join(SCENE_DIR, f"{key}.raw.png")


def draw(key: str) -> bool:
    size, refs, subject = PARTS[key]
    out = raw_path(key)
    if key == "leaf":
        os.makedirs(os.path.join(SCENE_DIR, "_work"), exist_ok=True)
        leaf_ref().save(os.path.join(SCENE_DIR, refs[0]))
    if os.path.exists(out):
        os.remove(out)
    t0 = time.time()
    run_codex(PROMPT.format(size=size, subject=subject, style=STYLES.get(key, STYLE), out=out), os.path.join(SCENE_DIR, "_work", key), 900,
              [os.path.join(SCENE_DIR, r) for r in refs] + [STYLE_REF])
    ok = os.path.exists(out)
    print(f"  {key}: {'ok' if ok else 'failed'}  ({time.time() - t0:.0f}s)", flush=True)
    return ok


# ---- cutting

def paper_of(a: np.ndarray) -> np.ndarray:
    """The paper's colour: the median of the picture's edges."""
    edge = np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3), a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)])
    return np.median(edge, axis=0)


def ink_of(a: np.ndarray, paper: np.ndarray) -> np.ndarray:
    """How far each pixel is from the paper (0 = paper, 1 = surely drawn), a soft step over the paper's grain."""
    d = np.sqrt(((a.astype(np.float32) - paper) ** 2).sum(-1))
    d = ndimage.gaussian_filter(d, 1.2)
    return np.clip((d - 9) / 14, 0, 1)


def cover(raw: Image.Image):
    """The cover cropped to what's drawn (and the spot where the cat will sit), its paper colour and the crop box."""
    a = np.asarray(raw.convert("RGB"))
    paper = paper_of(a)
    ink = ink_of(a, paper) > 0.5
    ink = ndimage.binary_opening(ink, iterations=2)
    ys, xs = np.nonzero(ink)
    h, w = ink.shape
    cx, cy, ch = SPOTS_RAW["cat"]
    x0, x1 = min(xs.min(), cx - ch * 0.6), max(xs.max(), cx + ch * 0.6)
    y0, y1 = min(ys.min(), cy - ch), max(ys.max(), cy)
    m = int(min(w, h) * 0.16)                              # room for the page to fade the paper's grain away
    box = (int(x0 - m), int(y0 - m), int(x1 + m + 1), int(y1 + m + 1))
    # where that runs past the drawing (the cat sits near its left edge), the paper goes on in its plain colour
    canvas = Image.new("RGB", (box[2] - box[0], box[3] - box[1]), tuple(int(v) for v in paper))
    canvas.paste(raw.convert("RGB"), (-box[0], -box[1]))
    pic = canvas
    content = (x0, y0, x1, y1)                             # what's drawn, which a narrow screen must keep whole
    return pic, paper_of(np.asarray(pic)), box, content    # the page takes the paper as it is round the crop


def spots(box, content) -> dict:
    """SPOTS_RAW (and the drawn part, as a box) as fractions of the cropped cover."""
    x0, y0, x1, y1 = box
    W, H = x1 - x0, y1 - y0
    fx, fy = (lambda v: round((v - x0) / W, 4)), (lambda v: round((v - y0) / H, 4))
    a, b, c, d = content
    out = {"content": [fx(a), fy(b), round((c - a) / W, 4), round((d - b) / H, 4)]}
    for k, v in SPOTS_RAW.items():
        if k == "sign":
            out[k] = [[fx(x), fy(y)] for x, y in v]
        elif k == "slot":
            out[k] = [fx(v[0]), fy(v[1]), round(v[2] / W, 4)]
        elif k == "bell":
            out[k] = [fx(v[0]), fy(v[1])]
        elif k == "cat":
            out[k] = [fx(v[0]), fy(v[1]), round(v[2] / H, 4)]
        else:
            out[k] = [fx(v[0]), fy(v[1]), round(v[2] / W, 4), round(v[3] / H, 4)]
    return out


def glass(raw: Image.Image, plain: bool = False):
    """The door's glass as a mask (white, its alpha the glass): the dark grey panes in the "glass" box, their painted
    edges kept. When the post office opens, the page lights them from inside through it; the paint's own light and
    dark strokes go into the alpha, so the lit glass keeps the brush. (plain: only which pixels are glass)"""
    x, y, w, h = SPOTS_RAW["glass"]
    a = np.asarray(raw.convert("RGB"))[y:y + h, x:x + w].astype(np.float32)
    mx, mn = a.max(-1), a.min(-1)
    pane = (mx < 125) & (mx - mn < 45)                     # dark and grey: the red wood between the panes is neither
    pane = ndimage.binary_fill_holes(ndimage.binary_closing(pane, iterations=2))
    pane = ndimage.binary_opening(pane, iterations=1)
    if plain:
        return pane
    lum = a.mean(-1)
    tex = np.clip(0.94 + (lum - lum[pane].mean()) / 80, 0.8, 1)
    alpha = np.clip(ndimage.gaussian_filter(pane.astype(np.float32), 0.7), 0, 1) * tex
    rgba = np.dstack([np.full((h, w, 3), 255, np.uint8), (alpha * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def leaf(raw: Image.Image):
    """The door's leaf cut out of the cover so that it can swing: (the cover without what swings, the leaf's face, its
    dark panes, the wheel that stays in front).
    - the face is the "leaf" box with LEAF_PAD px left of it and LEAF_FOOT below, RGBA: the door's paint up to its
      ragged edges, the glass cut out as holes (what is behind the door shows through them), and the bicycle's wheel,
      which leans over its hinge side, painted out with the door's own paint mirrored from just right of it
    - the panes are the glass as painted (dark: the lamps are off), a little larger than the holes they back
    - the wheel ("wheel" box) is what's inside the tyre's circle and isn't door: it stays put in front of the door
    - in the cover, the door's paint outside the leaf's box is painted out with the wall and the step: it goes with
      the door"""
    a = np.asarray(raw.convert("RGB")).copy()
    lx, ly, lw, lh = SPOTS_RAW["leaf"]
    X0, W, H = lx - LEAF_PAD, lw + LEAF_PAD, lh + LEAF_FOOT
    yy, xx = np.mgrid[ly:ly + H, X0:X0 + W]
    c = a[ly:ly + H, X0:X0 + W].copy()
    red = (c[..., 0].astype(np.int16) - c[..., 1]) >= 38    # the door's paint; wall, step, tyre and spokes aren't
    wx, wy, wr = WHEEL
    inwheel = (xx - wx) ** 2 + (yy - wy) ** 2 <= wr ** 2
    wheel = inwheel & ~red
    # the paint's left edge, row by row: the first red pixel with wall just left of it; under the wheel, from the rows round it
    edge = np.full(H, np.nan)
    for r in range(H):
        run = np.flatnonzero(red[r, :LEAF_PAD + 8])
        if len(run) and run[0] > 0 and not inwheel[r, run[0] - 1] and c[r, run[0] - 1].min() > 150:
            edge[r] = run[0]
    ok = ~np.isnan(edge)
    edge = np.interp(np.arange(H), np.flatnonzero(ok), ndimage.median_filter(edge[ok], 5, mode="nearest")).round()
    box = (xx >= lx) & (yy < ly + lh)
    whole = (xx >= lx - 1) & (yy < ly + lh)                # (a pixel more: scaled, the face's edge is soft, and the room showed at the hinge)
    door = whole | (((xx - X0) >= edge[:, None]) & (yy < ly + lh)) | (red & ~box)     # outside the box, only what is painted red
    # the face: whole from the hinge line on (where the paint ends right of it, it goes on, mirrored in its edge), the
    # wheel painted out (mirrored from just right of it), the glass cut out
    face = c.copy()
    out = ndimage.binary_dilation(wheel, iterations=3) & door & (yy < ly + lh)
    for r in np.flatnonzero(out.any(1)):
        run = np.flatnonzero(out[r])
        b = run.max() + 1
        face[r, run] = c[r, np.clip(2 * b - 1 - run, b, W - 1)]
    for r in np.flatnonzero(edge[:lh] >= LEAF_PAD - 2):
        e = int(edge[r]) + 3                               # past the edge's own soft pixels
        run = np.arange(min(LEAF_PAD - 1, int(edge[r])), e)
        face[r, run] = face[r, 2 * e - 1 - run]
    gx, gy, gw, gh = SPOTS_RAW["glass"]
    pane = np.zeros((H, W), bool)
    pane[gy - ly:gy - ly + gh, gx - X0:gx - X0 + gw] = glass(raw, plain=True)
    soft = lambda m, s=0.7: np.clip(ndimage.gaussian_filter(m.astype(np.float32), s), 0, 1)
    alpha = np.maximum(soft(door, 0.5), whole) * (1 - soft(pane))
    rgba = lambda rgb, al: Image.fromarray(np.dstack([rgb, (np.clip(al, 0, 1) * 255).round().astype(np.uint8)]), "RGBA")
    back = soft(ndimage.binary_dilation(pane, iterations=2))[gy - ly:gy - ly + gh, gx - X0:gx - X0 + gw]
    panes = rgba(a[gy:gy + gh, gx:gx + gw], back)
    # the wheel: its own colours to its very edge (where the painting mixed the door's red into it, the nearest that isn't)
    sx, sy, sw, sh = SPOTS_RAW["wheel"]
    part = (slice(sy - ly, sy - ly + sh), slice(sx - X0, sx - X0 + sw))
    near = ndimage.distance_transform_edt(~ndimage.binary_erosion(wheel, iterations=1), return_indices=True)[1]
    front = rgba(np.where(wheel[..., None], c, c[near[0], near[1]])[part], soft(wheel, 0.6)[part])
    # the cover: the paint outside the box goes with the door. Behind it on the left is the wall (mirrored from just
    # left of the edge; where that is the wheel, from the wall higher up), below it the step (from a little lower)
    inside = lambda x, y: (x - wx) ** 2 + (y - wy) ** 2 <= wr ** 2
    wall = a[ly + 170:ly + 320, X0 - 2 * LEAF_PAD:X0].copy()              # clean wall left of the door, above the wheel
    away = ndimage.binary_dilation(door & ~box, iterations=1) & ~box & ~wheel
    for r, x in zip(*np.nonzero(away)):
        if r >= lh:
            src = (ly + r + LEAF_FOOT + 2, X0 + x)
            a[ly + r, X0 + x] = a[src[0], src[1] + 30] if inside(src[1], src[0]) else a[src]
            continue
        src = X0 + int(2 * min(edge[r], x) - 1 - x)                       # mirrored in the edge, in the cover's columns
        a[ly + r, X0 + x] = wall[r % wall.shape[0], (x * 3 + r) % wall.shape[1]] if inside(src, ly + r) else a[ly + r, src]
    return Image.fromarray(a), rgba(face, alpha), panes, front


def leaf_ref() -> Image.Image:
    """What codex draws the open door's leaf from: the leaf's face (its glass as painted, the wheel painted out), LEAF_K
    times as large, on the cover's paper."""
    raw = Image.open(raw_path("cover")).convert("RGB")
    _, face, panes, _ = leaf(raw)
    lx, ly = SPOTS_RAW["leaf"][:2]
    gx, gy = SPOTS_RAW["glass"][:2]
    whole = Image.new("RGBA", face.size)
    whole.alpha_composite(panes, (gx - lx + LEAF_PAD, gy - ly))
    whole.alpha_composite(face)
    big = whole.resize((round(whole.width * LEAF_K), round(whole.height * LEAF_K)), Image.LANCZOS)
    out = Image.new("RGBA", (1024, 1536), tuple(int(v) for v in paper_of(np.asarray(raw))) + (255,))
    out.alpha_composite(big, LEAF_AT)
    return out.convert("RGB")


def fit(ref: np.ndarray, got: np.ndarray):
    """Where a redrawn picture lies against the one it was drawn from: (kx, ky, tx, ty), a point (x, y) of ref being
    at (kx * x + tx, ky * y + ty) in got. codex keeps the place and size closely but not to the pixel; the edges of
    both (at half size) are laid over each other at a few sizes, each time wherever they agree best."""
    def edges(a, size=None):
        im = Image.fromarray(a).convert("L")
        im = im.resize(size or (im.width // 2, im.height // 2), Image.LANCZOS)
        g = ndimage.gaussian_gradient_magnitude(np.asarray(im).astype(np.float32), 1.2)
        return (g - g.mean()) / (g.std() + 1e-6)
    e0 = edges(ref)
    h, w = e0.shape
    F0 = np.conj(np.fft.rfft2(e0))
    best = (-1e9,)
    for kx in np.arange(0.96, 1.0401, 0.005):
        for ky in np.arange(0.96, 1.0401, 0.005):
            # got shrunk by (kx, ky) about its corner, so that it is ref's size where the door is
            im = Image.fromarray(got).transform((ref.shape[1], ref.shape[0]), Image.AFFINE, (kx, 0, 0, 0, ky, 0), Image.BILINEAR)
            c = np.fft.irfft2(np.fft.rfft2(edges(np.asarray(im))) * F0, s=(h, w))
            i = np.unravel_index(np.argmax(c), c.shape)
            dy, dx = [(v + n // 2) % n - n // 2 for v, n in zip(i, (h, w))]
            if c[i] > best[0]:
                best = (c[i], kx, ky, dx * 2 * kx, dy * 2 * ky)
    return best[1:]


def leaf_open(drawn: Image.Image, face: Image.Image, raw: Image.Image):
    """The open door's leaf, from codex's drawing of it (PARTS "leaf"): (its face, the film on its glass), both laid
    exactly over the leaf cut from the cover.
    - the face has the closed face's own outline and holes; the page fades from the one to the other
    - the film is what the drawing has in the panes, thin: a dark tint, more solid and paler where a reflection
      streaks across. Under it the room shows through the holes"""
    got = np.asarray(drawn.convert("RGB"))
    seen = os.path.join(SCENE_DIR, PARTS["leaf"][1][0])     # the reference it was drawn from (local: without it, as drawn)
    kx, ky, tx, ty = fit(np.asarray(Image.open(seen).convert("RGB")), got) if os.path.exists(seen) else (1, 1, 0, 0)
    print(f"leaf: drawn at x {kx:.3f} + {tx:.1f}, y {ky:.3f} + {ty:.1f} of its reference")
    W, H = face.size
    big = (round(W * LEAF_K), round(H * LEAF_K))
    at = drawn.convert("RGB").transform(big, Image.AFFINE, (kx, 0, kx * LEAF_AT[0] + tx, 0, ky, ky * LEAF_AT[1] + ty), Image.BICUBIC)
    a = np.asarray(at.resize((W, H), Image.LANCZOS)).astype(np.float32)
    # what's paper in the drawing (its door's edge is ragged in its own way) takes the nearest paint
    paper = paper_of(got)
    paint = ndimage.binary_erosion(np.sqrt(((a - paper) ** 2).sum(-1)) > 60, iterations=1)
    near = ndimage.distance_transform_edt(~paint, return_indices=True)[1]
    a = a[near[0], near[1]]
    # (drawn, it is as light as the shut door: turned from the day it is darker, most at the hinge side, far from the lamp)
    a = a * np.linspace(0.78, 0.96, W, dtype=np.float32)[None, :, None]
    alpha = np.asarray(face)[..., 3]
    out = Image.fromarray(np.dstack([a.round().astype(np.uint8), alpha]), "RGBA")
    # the film on the glass
    lx, ly = SPOTS_RAW["leaf"][:2]
    gx, gy, gw, gh = SPOTS_RAW["glass"]
    g = a[gy - ly:gy - ly + gh, gx - lx + LEAF_PAD:gx - lx + LEAF_PAD + gw]
    pane = glass(raw, plain=True)
    lum = g.mean(-1)
    t = np.clip((ndimage.gaussian_filter(lum, 0.8) - np.median(lum[pane])) / 60, 0, 1)      # how much of a streak
    pale = np.array([244, 232, 208], np.float32)
    rgb = g * (1 - 0.55 * t[..., None]) + pale * 0.55 * t[..., None]
    al = (0.26 + 0.5 * t) * np.clip(ndimage.gaussian_filter(ndimage.binary_dilation(pane, iterations=1).astype(np.float32), 0.7), 0, 1)
    film = Image.fromarray(np.dstack([rgb.round().astype(np.uint8), (al * 255).round().astype(np.uint8)]), "RGBA")
    return out, film


def sprites(raw: Image.Image, paper: np.ndarray):
    """The cat sheet cut into its pieces, left to right, each an RGBA picture on nothing. The cat's white fur is close to
    the paper, so the outline is found with a low threshold and then closed and filled: every piece is solid inside."""
    a = np.asarray(raw.convert("RGB"))
    d = np.sqrt(((a.astype(np.float32) - paper) ** 2).sum(-1))
    d = ndimage.gaussian_filter(d, 1.5)
    solid = ndimage.binary_closing(d > 7, iterations=5)
    solid = ndimage.binary_fill_holes(solid)
    solid = ndimage.binary_opening(solid, iterations=3)
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    keep = [i + 1 for i in np.argsort(sizes)[::-1][:4]]
    out = []
    for k in keep:
        sl = ndimage.find_objects((lab == k).astype(int))[0]
        pad = 6
        y0, x0 = max(0, sl[0].start - pad), max(0, sl[1].start - pad)
        y1, x1 = min(a.shape[0], sl[0].stop + pad), min(a.shape[1], sl[1].stop + pad)
        mask = ndimage.binary_erosion(lab[y0:y1, x0:x1] == k, iterations=1)
        alpha = np.clip(ndimage.gaussian_filter(mask.astype(np.float32), 1.0) * 1.15, 0, 1)
        rgba = np.dstack([a[y0:y1, x0:x1], (alpha * 255).round().astype(np.uint8)])
        out.append((x0, Image.fromarray(rgba, "RGBA")))
    return [im for _, im in sorted(out, key=lambda t: t[0])]


def rebuild() -> None:
    entry = {}
    if os.path.exists(raw_path("cover")):
        still, face, panes, front = leaf(Image.open(raw_path("cover")))
        pic, paper, box, content = cover(still)
        pic.save(os.path.join(SCENE_DIR, "cover.webp"), quality=90, method=6)
        entry = {"cover": "scene/cover.webp", "w": pic.width, "h": pic.height, "paper": "#%02X%02X%02X" % tuple(int(v) for v in paper),
                 "spots": spots(box, content), "v": int(os.path.getmtime(os.path.join(SCENE_DIR, "cover.webp")))}   # the cut's: it may change
        gp = os.path.join(SCENE_DIR, "glass.webp")
        glass(Image.open(raw_path("cover"))).save(gp, quality=92, method=6)
        entry["glass"] = {"file": "scene/glass.webp", "v": int(os.path.getmtime(gp))}   # its own version: the cut may change
        for name, im in (("leaf", face), ("panes", panes), ("wheel", front)):
            im.save(os.path.join(SCENE_DIR, name + ".webp"), quality=92, method=6)
        if os.path.exists(raw_path("leaf")):
            lit, film = leaf_open(Image.open(raw_path("leaf")), face, Image.open(raw_path("cover")))
            lit.save(os.path.join(SCENE_DIR, "leaf-open.webp"), quality=92, method=6)
            film.save(os.path.join(SCENE_DIR, "film.webp"), quality=92, method=6)
        entry["leaf"] = {"face": "scene/leaf.webp", "panes": "scene/panes.webp", "wheel": "scene/wheel.webp",
                         "open": "scene/leaf-open.webp", "film": "scene/film.webp",
                         "pad": round(LEAF_PAD / SPOTS_RAW["leaf"][2], 4), "foot": round(LEAF_FOOT / SPOTS_RAW["leaf"][3], 4),
                         "v": int(os.path.getmtime(os.path.join(SCENE_DIR, "leaf.webp")))}
        print(f"cover {pic.size}, paper {entry['paper']}")
    if os.path.exists(raw_path("cat")):
        raw = Image.open(raw_path("cat"))
        pieces = sprites(raw, paper_of(np.asarray(raw.convert("RGB"))))
        names = [f"cat-{i + 1}" for i in range(len(pieces) - 1)] + ["letter"]
        files = []
        for name, im in zip(names, pieces):
            im.save(os.path.join(SCENE_DIR, f"{name}.webp"), quality=92, method=6)
            files.append({"key": name, "file": f"scene/{name}.webp", "w": im.width, "h": im.height})
        entry["cat"] = [f for f in files if f["key"].startswith("cat")]
        entry["letter"] = next((f for f in files if f["key"] == "letter"), None)
        entry["catv"] = int(os.path.getmtime(raw_path("cat")))
        print("pieces", [(f["key"], f["w"], f["h"]) for f in files])
    if os.path.exists(raw_path("room")):
        raw = Image.open(raw_path("room")).convert("RGB")
        dw, dh = SPOTS_RAW["leaf"][2:]
        w = round(raw.height * dw / dh)
        x0 = int(min(max(0, ROOM_X - w * 0.62), raw.width - w))
        room = raw.crop((x0, 0, x0 + w, raw.height)).resize((ROOM_W, round(ROOM_W * raw.height / w)), Image.LANCZOS)
        rp = os.path.join(SCENE_DIR, "room.webp")
        room.save(rp, quality=90, method=6)
        entry["room"] = {"file": "scene/room.webp", "w": room.width, "h": room.height}
        entry["roomv"] = int(os.path.getmtime(rp))
        print(f"room {room.size} from x {x0}..{x0 + w}")
    with open(os.path.join(SCENE_DIR, "index.json"), "w", encoding="utf-8") as fh:
        json.dump(entry, fh, ensure_ascii=False, indent=2)


def main(args) -> None:
    os.makedirs(SCENE_DIR, exist_ok=True)
    if not args.rebuild:
        for k in args.keys or list(PARTS):
            if k not in PARTS:
                print(f"  no part {k}", file=sys.stderr)
                continue
            draw(k)
    rebuild()
