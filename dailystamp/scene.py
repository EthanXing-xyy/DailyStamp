"""The loading screen's picture: the door of a small post office, drawn the way a quiet literary-magazine illustration is
(flat matte colour with dry, grainy edges on cream paper, lots of empty paper, faceless figures): a bicycle leaning by a
red door with a hanging sign, an old pillar box, a pot plant, and a calico cat that changes pose; behind the door, the
lit room it swings open onto.

codex draws three pictures once, from the reference pictures the user picked (scene/ref-*.png, local only):
  cover  the door, the bicycle, the pillar box and the plant, without the cat
  cat    the same cat in three poses side by side, and a small envelope
  room   the inside: the stamp cabinet, counter and clock of ref-room-5 with the clerk of ref-room-1 behind the counter
Here the cover is cropped to what's drawn, the cat sheet is cut out of its paper into one picture per pose and the
envelope, and the room is cut to the doorway's shape. Where things are in the cover (the door, the sign, the slot, the
basket, the handlebar, where the cat sits) is measured by hand into SPOTS, and everything goes into scene/index.json for
web/loader.js.

  python dailystamp.py scene [cover|cat|room]   # draw them again (all, or the given ones)
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
    # (the second drawing of the room: the first was seen from its middle, with a rug far off at the foot, so through
    # the doorway its floor met the doorstep like a wall. This one is seen from the doorstep, the floor running in from
    # under your feet; the first is kept in scene/_work/room.v1.raw.png)
    "room": ("portrait, 1024x1536", ["_work/room.v1.raw.png", "cover.raw.png"], """The inside of the small post office whose
front door is the SECOND attached picture, as you see it standing on the doorstep of that door, looking straight in.
Keep everything in the room exactly as in the FIRST attached picture: the same glass-fronted wooden cabinet with its
rows of stamps, the same faceless clerk (dark hair tied back, white shirt, dark brown apron) behind the same wooden
counter sorting a letter, the small brass bell, the ink pad and the rubber stamp on it, the same round clock with no
numerals, the same brick-red pendant lamp, the same plants, the same warm light. Change only where we stand:
- we stand just outside the door, eyes at standing height: the eye level (horizon) is about 28% down from the top of
  the picture, so we look slightly down onto the counter top and the floor
- the floor is warm brown wooden floorboards running straight away from us, their joins converging to one point on
  the eye level at 60% of the picture's width; the boards come right up to the bottom edge of the picture, where they
  are closest and widest; NO rug, nothing lying on the near floor
- the counter stands a few steps in: its top at about 42% down, its foot on the floor at about 66% down; the clerk and
  the middle of the counter sit between 45% and 75% of the picture's width
- the room fills the whole picture: no door frame, no doorway, no wall edges round the picture
Composition: the picture will be shown cropped to a tall narrow doorway (its middle 60% of the width), and the left
third of that is hidden by the open door, so nothing that matters is left of 40% of the width."""),
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
}


# the room is cut to the doorway's shape, full height, placed so ROOM_X (the middle of the counter and the clerk, px of
# the raw drawing) sits ROOM_AT across it: the open door hides about the doorway's left third
ROOM_X = 512
ROOM_AT = 0.5
ROOM_W = 480                                               # a phone's doorway is ~222 device px wide, a desktop's ~195 css
# Seen through the doorway, the room lies beyond the wall's thickness. The eye is where the page's door turns from
# (web/index.html: the hinge line, EYE_Y down the leaf) at EYE_D leaf-widths off; the wall is WALL_D leaf-widths deep.
# So the room shows a little smaller inside the opening, and round it you see the doorway's own sides in perspective:
# its head above, the far jamb on the right (the near one is edge-on from the hinge line), the step's top below.
EYE_Y, EYE_D, WALL_D = 0.28, 3.2, 0.33


def doorway(room: Image.Image, cover: Image.Image) -> Image.Image:
    """The picture that fills the opening when the door swings: the room, set back by the wall's depth, framed by the
    doorway's head, far jamb and step, painted with the cover's own wall and step (shaded as they turn from the light)."""
    lx, ly, lw, lh = SPOTS_RAW["leaf"]
    W, H = ROOM_W, round(ROOM_W * lh / lw)
    s = EYE_D / (EYE_D + WALL_D)                            # how much smaller the far side of the doorway looks
    ey = EYE_Y * H
    x1, y0, y1 = s * W, ey * (1 - s), ey + s * (H - ey)     # the far side's rectangle (x0 = 0: the eye is on the hinge line)
    # the room, cut to the opening's shape round ROOM_X, then drawn into the far rectangle
    w = round(room.height * lw / lh)
    rx = int(min(max(0, ROOM_X - w * ROOM_AT), room.width - w))
    inner = room.crop((rx, 0, rx + w, room.height)).resize((round(x1), round(y1 - y0)), Image.LANCZOS)
    out = Image.new("RGB", (W, H))
    out.paste(inner, (0, round(y0)))
    a = np.asarray(out).astype(np.float32)
    c = cover.convert("RGB")
    def painted(box, colour_box=None):
        """A surface in the cover's own paint: the colour of colour_box (or box), with the brush grain of box laid
        over it, mirrored to fill the picture at the cover's scale (stretching it drew streaks)"""
        p = np.asarray(c.crop(box)).astype(np.float32)
        base = np.median(np.asarray(c.crop(colour_box or box)).reshape(-1, 3).astype(np.float32), 0)
        g = p.mean(-1); g = g - ndimage.gaussian_filter(g, 6)            # the grain alone, round zero
        k = W / lw                                                        # cover px -> doorway px
        g = np.asarray(Image.fromarray(g.astype(np.float32), "F").resize((max(1, round(g.shape[1] * k)), max(1, round(g.shape[0] * k))), Image.BILINEAR))
        reps = (H // g.shape[0] + 2, W // g.shape[1] + 2)
        g = np.tile(np.block([[g, g[:, ::-1]], [g[::-1], g[::-1, ::-1]]]), (reps[0] // 2 + 1, reps[1] // 2 + 1))[:H, :W]
        return base[None, None, :] + g[..., None] * grain
    grain = 0.9
    wall = painted((920, 400, 990, 540))                    # the stuccoed wall right of the door
    grain = 0.45
    step = painted((650, 318, 1000, 366), (lx + 10, ly + lh + 3, lx + lw - 10, ly + lh + 12))   # the step's colour, the lintel's stone grain
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # which side of the doorway each pixel shows: above the far rectangle the head, right of it the far jamb, below it
    # the step; in the two right-hand corners the lines from the opening's corners to the far rectangle's split them
    k = (W - xx) / max(1.0, W - x1)                         # 1 at the far rectangle's side, 0 at the opening's edge
    head = (yy < y0) & ((xx <= x1) | (yy < y0 * k))
    sill = (yy > y1) & ((xx <= x1) | (yy > H - (H - y1) * k))
    jamb = (xx > x1) & ~head & ~sill
    warm = np.array([1.0, 0.93, 0.82], np.float32)
    shade_j = (0.80 + 0.12 * (W - xx) / max(1, W - x1))[..., None] * warm   # the far jamb, lit a little more deeper in
    a = np.where(jamb[..., None], wall * np.clip(shade_j, 0, 1), a)
    a = np.where(head[..., None], wall * 0.70 * warm, a)
    a = np.where(sill[..., None], step * 0.96, a)
    # a soft shadow where the room meets the doorway's sides (the corners the light doesn't reach)
    dist = np.minimum.reduce([np.where(xx <= x1, x1 - xx, 1e4), np.where(yy >= y0, yy - y0, 1e4), np.where(yy <= y1, y1 - yy, 1e4)])
    inside = (xx <= x1) & (yy >= y0) & (yy <= y1)
    ao = np.where(inside, 1 - 0.22 * np.exp(-dist / (0.03 * W)), 1)
    a = a * ao[..., None]
    # the step's inner edge, a thin dark line where the floor goes in under the doorway
    edge = sill & (yy < y1 + 2.2)
    a[edge] *= 0.78
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def raw_path(key: str) -> str:
    return os.path.join(SCENE_DIR, f"{key}.raw.png")


def draw(key: str) -> bool:
    size, refs, subject = PARTS[key]
    out = raw_path(key)
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


def glass(raw: Image.Image) -> Image.Image:
    """The door's glass as a mask (white, its alpha the glass): the dark grey panes in the "glass" box, their painted
    edges kept. When the post office opens, the page lights them from inside through it; the paint's own light and
    dark strokes go into the alpha, so the lit glass keeps the brush."""
    x, y, w, h = SPOTS_RAW["glass"]
    a = np.asarray(raw.convert("RGB"))[y:y + h, x:x + w].astype(np.float32)
    mx, mn = a.max(-1), a.min(-1)
    pane = (mx < 125) & (mx - mn < 45)                     # dark and grey: the red wood between the panes is neither
    pane = ndimage.binary_fill_holes(ndimage.binary_closing(pane, iterations=2))
    pane = ndimage.binary_opening(pane, iterations=1)
    lum = a.mean(-1)
    tex = np.clip(0.94 + (lum - lum[pane].mean()) / 80, 0.8, 1)
    alpha = np.clip(ndimage.gaussian_filter(pane.astype(np.float32), 0.7), 0, 1) * tex
    rgba = np.dstack([np.full((h, w, 3), 255, np.uint8), (alpha * 255).round().astype(np.uint8)])
    return Image.fromarray(rgba, "RGBA")


def wheel(raw: Image.Image):
    """The bicycle's front wheel leans over the leaf's hinge side. Cut out as it is in the "leaf" box it stays put in
    front of the door as it swings (wheel.webp, RGBA, the leaf box's size); the door's face (leaf.webp) has it painted
    out with the door's own paint, mirrored from just right of it, so the leaf carries no piece of wheel away."""
    x, y, w, h = SPOTS_RAW["leaf"]
    a = np.asarray(raw.convert("RGB"))[y:y + h, x:x + w].copy()
    f = a.astype(np.int16)
    grey = ndimage.binary_opening((f[..., 0] - f[..., 1]) < 45, iterations=1)      # the door is red; tyre and wall aren't
    lab, _ = ndimage.label(grey)
    edge = set(lab[h // 2:, 0]) - {0}                      # only what comes in from the left edge, low down: the wheel
    tyre = np.isin(lab, list(edge))
    alpha = np.clip(ndimage.gaussian_filter(tyre.astype(np.float32), 0.6), 0, 1)     # soft, but no red rim of door
    front = Image.fromarray(np.dstack([a, (alpha * 255).round().astype(np.uint8)]), "RGBA")
    face = a.copy()
    for r in range(h):
        run = np.flatnonzero(ndimage.binary_dilation(tyre[r], iterations=4))
        if len(run):
            b = run.max() + 1
            src = np.clip(2 * b - 1 - run, b, w - 1)
            face[r, run] = a[r, src]
    return Image.fromarray(face), front


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
        pic, paper, box, content = cover(Image.open(raw_path("cover")))
        pic.save(os.path.join(SCENE_DIR, "cover.webp"), quality=90, method=6)
        entry = {"cover": "scene/cover.webp", "w": pic.width, "h": pic.height, "paper": "#%02X%02X%02X" % tuple(int(v) for v in paper),
                 "spots": spots(box, content), "v": int(os.path.getmtime(raw_path("cover")))}
        gp = os.path.join(SCENE_DIR, "glass.webp")
        glass(Image.open(raw_path("cover"))).save(gp, quality=92, method=6)
        entry["glass"] = {"file": "scene/glass.webp", "v": int(os.path.getmtime(gp))}   # its own version: the cut may change
        face, front = wheel(Image.open(raw_path("cover")))
        face.save(os.path.join(SCENE_DIR, "leaf.webp"), quality=90, method=6)
        front.save(os.path.join(SCENE_DIR, "wheel.webp"), quality=90, method=6)
        entry["leaf"] = {"face": "scene/leaf.webp", "wheel": "scene/wheel.webp", "v": int(os.path.getmtime(gp))}
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
        room = doorway(Image.open(raw_path("room")).convert("RGB"), Image.open(raw_path("cover")))
        rp = os.path.join(SCENE_DIR, "room.webp")
        room.save(rp, quality=90, method=6)
        entry["room"] = {"file": "scene/room.webp", "w": room.width, "h": room.height}
        entry["roomv"] = int(os.path.getmtime(rp))
        print(f"room {room.size}, set in its doorway")
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
