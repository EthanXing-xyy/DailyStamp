"""Pre-cut plates for the web app. Every stamp draws an emblem (or a solar-term icon) through its three ink-channel masks
and a die-cut outline grown around it; the browser used to cut these itself on every visit (a pixel loop over each 1024 px
image, a flood fill, a blur), seconds of work on a phone. They are cut here once instead, as alpha PNGs:

  emblems/cut/<id>.r.png .g.png .b.png   the ink / accent / band channels (web/print.js channelMasks)
  emblems/cut/<id>.s0.028.png .s0.05.png the die-cut outline at those grows (web/print.js silhouette)
  emblems/cut/<id>.t.png                 a small ready-coloured picture for the silk-screen picker (p-silk.js), so the
                                         page never decodes four 1024 px plates per word just to show a 46 px button
  emblems/cut/<id>.m.png                 the studio's emblem buttons, recoloured with every palette: MINI px masks side
                                         by side, R/G/B = ink/accent/band on the left, the 0.028 outline on the right.
                                         Decoding 64 words' 1024 px plates for them ran iPhone Safari out of memory.
  terms/cut/<key>.*.png                  the same for the solar-term icons (grows 0.02, 0.028 and 0.05)

cut/index.json records what each was cut from (the emblem's `created`, the icon's mtime), so the page ignores a stale cut
and cuts that one itself as before."""
from __future__ import annotations

import json
import os

import numpy as np
from PIL import Image
from scipy import ndimage

from .library import EMBLEMS, ROOT

TERMS_DIR = os.path.join(ROOT, "terms")
EMBLEM_GROWS = (0.028, 0.05)
TERM_GROWS = (0.02, 0.028, 0.05)
THUMB = 144                                                 # px; the picker button is 46 CSS px
# the picker's inks, as p-silk.js used to tint them: paper outline, band, accent, key
THUMB_INKS = ((244, 238, 223), (35, 213, 232), (255, 46, 136), (17, 17, 17))
MINI = 128                                                  # px; the studio's emblem button draws its emblem at 97


def channels(path: str) -> list[np.ndarray]:
    """the three channel masks as booleans, exactly as print.js thresholds them (R wins over G over B)"""
    a = np.asarray(Image.open(path).convert("RGBA"))
    vis = a[..., 3] > 0                                     # a canvas reads fully transparent pixels back as 0,0,0
    r = vis & (a[..., 0] > 127)
    g = vis & ~r & (a[..., 1] > 127)
    b = vis & ~r & ~g & (a[..., 2] > 127)
    return [r, g, b]


def outline(masks: list[np.ndarray], grow: float) -> np.ndarray:
    """print.js silhouette(): everything the border can't reach at 512 px, grown by `grow`, blurred up to full size and
    re-thresholded to a crisp edge. Returns alpha 0..255."""
    S, N = masks[0].shape[0], 512
    union = (masks[0] | masks[1] | masks[2]).astype(np.float32)
    k = S // N if S >= N else 1
    small = union.reshape(N, k, N, k).mean(axis=(1, 3)) if k > 1 else union
    solid = small * 255 > 60
    lab, _ = ndimage.label(~solid)                          # 4-connected, as the flood fill
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fill = (~np.isin(lab, list(edge))).astype(np.float32)
    r = max(1, round(N * grow))
    acc = fill.copy()
    for i in range(24):
        t = i * np.pi / 12
        sh = ndimage.shift(fill, (np.sin(t) * r, np.cos(t) * r), order=1, mode="constant")
        acc = acc + sh * (1 - acc)                          # source-over
    big = ndimage.zoom(acc, S / N, order=1) if S != N else acc
    big = ndimage.gaussian_filter(big, sigma=max(1.0, S / N * 1.5))
    return np.clip((big * 255 - 110) * 6, 0, 255).astype(np.uint8)


def save_alpha(alpha: np.ndarray, path: str) -> None:
    la = np.zeros(alpha.shape + (2,), np.uint8)
    la[..., 1] = alpha
    Image.fromarray(la, "LA").save(path, optimize=True)


def cut(src: str, out_prefix: str, grows) -> None:
    ms = channels(src)
    for m, c in zip(ms, "rgb"):
        save_alpha(m.astype(np.uint8) * 255, f"{out_prefix}.{c}.png")
    for g in grows:
        save_alpha(outline(ms, g), f"{out_prefix}.s{g}.png")


def thumb(src: str, path: str) -> None:
    """the emblem in the picker's four inks on its paper outline, THUMB px square"""
    r, g, b = channels(src)
    layers = [outline([r, g, b], 0.05) > 127, b, g, r]
    S = r.shape[0]
    rgba = np.zeros((S, S, 4), np.uint8)
    for m, col in zip(layers, THUMB_INKS):
        rgba[m, :3] = col
        rgba[m, 3] = 255
    Image.fromarray(rgba, "RGBA").resize((THUMB, THUMB), Image.LANCZOS).save(path, optimize=True)


def mini(src: str, path: str) -> None:
    """the three channels and the 0.028 outline at MINI px, packed in one opaque RGB picture twice as wide"""
    r, g, b = channels(src)
    small = lambda m: np.asarray(Image.fromarray(m).resize((MINI, MINI), Image.LANCZOS))
    left = np.stack([small(m.astype(np.uint8) * 255) for m in (r, g, b)], -1)
    right = np.repeat(small(outline([r, g, b], 0.028))[..., None], 3, -1)
    Image.fromarray(np.concatenate([left, right], 1), "RGB").save(path, optimize=True)


def _index(folder: str) -> dict:
    p = os.path.join(folder, "cut", "index.json")
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return {}


def _write_index(folder: str, idx: dict) -> None:
    with open(os.path.join(folder, "cut", "index.json"), "w", encoding="utf-8") as f:
        json.dump(idx, f, ensure_ascii=False, indent=1)


def _emblem_rec(entry: dict) -> dict:
    return {"from": entry.get("created", ""), "grows": list(EMBLEM_GROWS), "thumb": True, "mini": True}


def cut_emblem(entry: dict, idx: dict | None = None) -> None:
    os.makedirs(os.path.join(EMBLEMS, "cut"), exist_ok=True)
    own = idx is None
    idx = _index(EMBLEMS) if own else idx
    src, prefix = os.path.join(ROOT, entry["file"]), os.path.join(EMBLEMS, "cut", entry["id"])
    cut(src, prefix, EMBLEM_GROWS)
    thumb(src, prefix + ".t.png")
    mini(src, prefix + ".m.png")
    idx[entry["id"]] = _emblem_rec(entry)
    if own:
        _write_index(EMBLEMS, idx)


def cut_term(item: dict, idx: dict | None = None) -> None:
    os.makedirs(os.path.join(TERMS_DIR, "cut"), exist_ok=True)
    own = idx is None
    idx = _index(TERMS_DIR) if own else idx
    cut(os.path.join(ROOT, item["file"]), os.path.join(TERMS_DIR, "cut", item["key"]), TERM_GROWS)
    idx[item["key"]] = {"from": item["v"], "grows": list(TERM_GROWS)}
    if own:
        _write_index(TERMS_DIR, idx)


def build(force: bool = False) -> None:
    """cut every emblem and term icon whose cut is missing, stale or at other grows (all of them with force)"""
    from .library import list_emblems
    idx = _index(EMBLEMS)
    todo = [e for e in list_emblems() if e.get("status") == "ready" and (force or idx.get(e["id"], {}) != _emblem_rec(e))]
    for e in todo:
        bare = lambda rec: {k: v for k, v in rec.items() if k != "mini"}
        if not force and bare(idx.get(e["id"], {})) == bare(_emblem_rec(e)):     # cut before there were minis: just add one
            mini(os.path.join(ROOT, e["file"]), os.path.join(EMBLEMS, "cut", e["id"] + ".m.png"))
            idx[e["id"]] = _emblem_rec(e)
            continue
        cut_emblem(e, idx)
    idx = {k: v for k, v in idx.items() if any(e["id"] == k for e in list_emblems())}
    os.makedirs(os.path.join(EMBLEMS, "cut"), exist_ok=True)
    _write_index(EMBLEMS, idx)
    tidx = _index(TERMS_DIR)
    try:
        with open(os.path.join(TERMS_DIR, "index.json"), encoding="utf-8") as f:
            terms = json.load(f)
    except OSError:
        terms = []
    ttodo = [t for t in terms if force or tidx.get(t["key"], {}) != {"from": t["v"], "grows": list(TERM_GROWS)}]
    for t in ttodo:
        cut_term(t, tidx)
    if terms:
        os.makedirs(os.path.join(TERMS_DIR, "cut"), exist_ok=True)
        _write_index(TERMS_DIR, tidx)
    print(f"cut {len(todo)} emblem(s), {len(ttodo)} term icon(s)")
