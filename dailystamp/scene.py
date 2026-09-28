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
}


# the room is cut to the doorway's shape, full height, placed so ROOM_X (the middle of the counter and the clerk, px of
# the raw drawing, measured by hand) sits 62% across it: the open door hides about the doorway's left quarter
ROOM_X = 500
ROOM_W = 480                                               # a phone's doorway is ~222 device px wide, a desktop's ~195 css


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
        dw, dh = SPOTS_RAW["door"][2:]
        w = round(raw.height * dw / dh)
        x0 = int(min(max(0, ROOM_X - w * 0.62), raw.width - w))
        room = raw.crop((x0, 0, x0 + w, raw.height)).resize((ROOM_W, round(ROOM_W * raw.height / w)), Image.LANCZOS)
        room.save(os.path.join(SCENE_DIR, "room.webp"), quality=90, method=6)
        entry["room"] = {"file": "scene/room.webp", "w": room.width, "h": room.height}
        entry["roomv"] = int(os.path.getmtime(raw_path("room")))
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
