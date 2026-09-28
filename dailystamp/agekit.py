"""首页的旧邮票 (the kraft home): every stamp on the home looks handled for years: the paper yellowed, its ink faded and
grainy, and two or three of crumpled, folded, water-stained, skinned (at random); and it no longer lies quite flat: a
corner lifted, an edge curled, a corner turned over, a fold half open, the sheet bowed or in waves (dealt like cards,
so neighbours differ). All of it as slight as a stamp that was only handled.

The stamps are dealt afresh on every visit, so none of this can be drawn ahead onto them. What is drawn ahead is a set
of kits that don't depend on what is printed: for every px of the aged picture (the stamp plus PAD px of desk round it,
for the lifted parts and their shadow), which px of the stamp is seen there, the paper's colour and light there, how
much of the ink is left, how much of the face shows, the gummed back where a part turned over, and the shadow on the
desk. web/shell/age.js lays a kit over a printed stamp (ink = 1 - colour / paper, then paper x (1 - ink) x light).

The ageing itself (codex's plates in kraft/plates: paper, fox, ink, crumple, fold, stain, scuff, gum; a different
window of each for every kit) is the one the user picked from mock-ups (style gp): age.py/age2.py/age3.py SOFT.

  python dailystamp.py agekits        # kraft/kits/<i>.uv .a .k [.b] .s (.webp) + index.json
"""
from __future__ import annotations

import json
import os
import time

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, distance_transform_edt, gaussian_filter, map_coordinates, sobel
from scipy.ndimage import shift as moved

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
KRAFT = os.path.join(ROOT, "kraft")
PLATES = os.path.join(KRAFT, "plates")
OUT = os.path.join(KRAFT, "kits")
W0, H0, PAD = 484, 605, 130                                 # the kits' stamp (px), and the desk kept round it
KITS = 12                                                    # two rounds of the deck
P0 = np.array([245, 242, 234], np.float32) / 255             # the paper as the stamps are printed
LUM = np.array([0.299, 0.587, 0.114], np.float32)
rgb = lambda h: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255
# the scale each map is stored at (8 bit): value / scale
A_MAX, M_MAX, B_MAX = 1.6, 2.0, 1.6
GREY, FADE = 0.07, 0.13                                      # the ink gone a little grey, a little faded (age.js too)


# ---- plates and noise
_plates: dict = {}
def plate(name):
    if name not in _plates:
        _plates[name] = np.asarray(Image.open(os.path.join(PLATES, name + ".png")).convert("RGB")).astype(np.float32) / 255
    return _plates[name]

def window(src, W, H, rng, span, score=None, tries=1):
    """a window of a plate: `span` plate px to W, anywhere on the sheet (clear of its rim), turned over at random. With
    a score (window -> number), the best of `tries` windows: one with something in it"""
    ph, pw = src.shape[:2]; w = span; h = round(span * H / W)
    if h > ph - 40: h = ph - 40; w = round(h * W / H)
    best = None
    for _ in range(tries):
        x = rng.integers(20, pw - w - 20 + 1); y = rng.integers(20, ph - h - 20 + 1)
        part = src[y:y + h, x:x + w]; v = score(part) if score else 0
        if best is None or v > best[0]: best = (v, part)
    part = best[1]
    if rng.random() < 0.5: part = part[:, ::-1]
    if rng.random() < 0.5: part = part[::-1]
    im = Image.fromarray((np.clip(part, 0, 1) * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS)
    return np.asarray(im).astype(np.float32) / 255

def cloud(W, H, rng, sigma):
    """soft noise, 0..1, its features about sigma px"""
    n = gaussian_filter(rng.standard_normal((H, W)).astype(np.float32), sigma)
    return (n - n.min()) / (n.max() - n.min() + 1e-6)

def smooth(x):
    x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


# ---- what the years did to the paper, flat (age2.py): as maps over the stamp, not a picture
BASE = dict(paper="#EFE4CA", grain=0.8, tex=1.2, edge=0.18)
KINDS = {"crumple": dict(crumple=0.7, crack=0.9), "fold": dict(fold=0.9, crack=0.9),
         "stain": dict(stain=0.8, cockle=0.8), "scuff": dict(scuff=0.9, perf=0.9)}
DECK = ["halfopen", "curl", "waves", "dogear", "bow", "lift"]   # dealt like cards: neighbours never lie alike

def mix(idx, must=()):
    """the user's mix: every stamp takes two or three of crumpled, folded, stained, skinned at random"""
    rng = np.random.default_rng(900 + idx)
    n = rng.choice([2, 3], p=[0.6, 0.4])
    picks = [str(p) for p in rng.choice(list(KINDS), size=n, replace=False)]
    for m in must:
        if m not in picks: picks[[i for i, p in enumerate(picks) if p not in must][0]] = m
    st = {}
    for p in picks:
        for key, v in KINDS[p].items(): st[key] = max(st.get(key, 0), v * (0.85 if n == 3 else 1))
    if "fold" in picks: st["how"] = int(rng.integers(2))    # one fold, down or across
    return st, picks

sharp = lambda q: np.hypot(sobel(q, 0), sobel(q, 1))

def creases(p, k, lo, hi):
    """a plate window lit from the side as light and shade about 0, and how sharp a crease runs through each place"""
    hp = p / gaussian_filter(p, 60 * k) - 1
    g = sharp(gaussian_filter(p, 0.8 * k))
    lo, hi = np.percentile(g, lo), np.percentile(g, hi)
    return hp, smooth((g - lo) / (hi - lo + 1e-6))

def crumpled(W, H, rng, k):
    p = window(plate("crumple"), W, H, rng, 560, lambda q: np.percentile(sharp(q @ LUM), 97), 8) @ LUM
    return creases(p, k, 80, 99.6)

def folded(W, H, rng, k, across):
    """one fold through the stamp, clear of its rim: down it, or (the plate turned) across it"""
    src = plate("fold").transpose(1, 0, 2) if across else plate("fold")
    def alone(q):
        g = np.abs(sobel(gaussian_filter(q @ LUM, 1.5), 0 if across else 1))
        prof = g.mean(axis=1 if across else 0); n = len(prof)
        return prof[int(.28 * n):int(.72 * n)].max() - 2 * max(prof[:int(.22 * n)].max(), prof[int(.78 * n):].max())
    p = window(src, W, H, rng, 520, alone, 30) @ LUM
    return creases(p, k, 97.5, 99.85)

def where(line, k, across):
    """where a fold runs: its place across the stamp as a straight line of the place along it, (slope, at 0)"""
    if across: line = line.T
    n, m = line.shape; rows = np.arange(n)
    w = gaussian_filter(line, (0, 2 * k)) ** 2 + 1e-6
    return np.polyfit(rows, (w * np.arange(m)).sum(axis=1) / w.sum(axis=1), 1)

def folds(W, H, rng, k, how, told):
    parts = [(across, folded(W, H, rng, k, across)) for across in ((False,), (True,), (False, True))[how]]
    told += [(across, where(l, k, across)) for across, (_, l) in parts]
    return sum(h for _, (h, _) in parts), np.clip(sum(l for _, (_, l) in parts), 0, 1)

def flat(a0, st, seed, info):
    """over the stamp: paper (rgb), M (what is left of the ink), L1 (light of the creases), Am (what is left of the
    face: short teeth), sh (px the print is carried over the creases)"""
    st = {**BASE, **st}; info["folds"] = []
    H, W = a0.shape; rng = np.random.default_rng(seed); k = W / W0
    d = distance_transform_edt(a0 > 0.5).astype(np.float32)
    p = window(plate("ink"), W, H, rng, 620) @ LUM
    hi = np.percentile(p, 99.7); mid = np.median(p)
    dens = gaussian_filter(np.clip((hi - p) / (hi - mid + 1e-6), 0, 1.6), 0.6 * k)
    M = np.clip(1 + st["grain"] * 0.55 * (dens - 1), 0.25, 1.15)

    paper = np.broadcast_to(rgb(st["paper"]), (H, W, 3)).copy()
    p = window(plate("paper"), W, H, rng, 700)
    paper *= 1 + st["tex"] * 1.6 * (p / p.reshape(-1, 3).mean(axis=0) - 1)
    tone = np.exp(-d / (30 * k)) * (0.35 + 0.65 * cloud(W, H, rng, 46 * k)) + 0.22 * cloud(W, H, rng, 90 * k)
    paper *= 1 - st["edge"] * tone[..., None] * (1 - rgb("#B98F55"))

    shade = np.zeros((H, W), np.float32); push = np.zeros((H, W), np.float32)
    for key, light, carry in (("crumple", 2.2, 1.0), ("fold", 2.0, 0.35)):
        deep = st.get(key)
        if not deep: continue
        hp, line = crumpled(W, H, rng, k) if key == "crumple" else folds(W, H, rng, k, st.get("how"), info["folds"])
        shade += deep * light * hp; push += deep * carry * hp
        broken = line * (0.45 + 0.55 * cloud(W, H, rng, 5 * k))
        M = M * (1 - np.clip(st["crack"] * min(1, deep * 1.3) * 1.15 * broken, 0, 0.9))
        paper *= 1 - 0.10 * deep * line[..., None] * (1 - rgb("#8A6A42"))
    if st.get("stain"):
        base = np.percentile(plate("stain").reshape(-1, 3), 92, axis=0)
        p = window(plate("stain"), W, H, rng, 430, lambda q: np.std(gaussian_filter(q @ LUM, 3)), 8)
        dark = np.clip(1 - p / base, 0, 1)
        wet = smooth((gaussian_filter(dark @ LUM, 5 * k) - 0.02) / 0.08)
        paper *= 1 - np.clip(st["stain"] * 1.5 * dark, 0, 0.75)
        M = M * (1 - 0.30 * st["stain"] * wet) * (1 + 0.6 * st["stain"] * (dark @ LUM))   # washed thin; gathered at the tide line
    if st.get("cockle"):
        wave = cloud(W, H, rng, 34 * k) - 0.5
        hp = (np.roll(wave, 1, 0) - np.roll(wave, -1, 0) + np.roll(wave, 1, 1) - np.roll(wave, -1, 1))
        hp = gaussian_filter(hp, 2 * k); hp = hp / (np.abs(hp).max() + 1e-6)
        shade += st["cockle"] * 0.13 * hp; push += st["cockle"] * 0.08 * hp
    if st.get("scuff"):
        full = plate("scuff") @ LUM; lo = np.median(full); hi = np.percentile(full, 99.5)
        p = window(plate("scuff"), W, H, rng, 620, lambda q: ((q @ LUM) > lo + 0.35 * (hi - lo)).mean(), 8) @ LUM
        gone = smooth((np.clip((p - lo) / (hi - lo + 1e-6), 0, 1) - 0.12) / 0.5)
        gone = np.clip(st["scuff"] * gone * (0.6 + 0.4 * np.exp(-d / (36 * k))), 0, 0.95)
        M = M * (1 - gone)
        paper = paper + (rgb("#F4EDDC") - paper) * (0.55 * gone)[..., None]
        rub = smooth((np.exp(-d / (9 * k)) * (0.3 + cloud(W, H, rng, 14 * k)) - 0.45) / 0.4)
        M = M * (1 - 0.7 * st["scuff"] * rub)
    Am = np.ones((H, W), np.float32)
    if st.get("perf"):                                       # a few teeth worn short, one corner knocked
        yy, xx = np.mgrid[0:H, 0:W]
        n = cloud(W, H, rng, 9 * k)
        th = 5.5 * k * smooth((n - 0.62) / 0.3) * st["perf"]
        cx, cy = (0, W - 1)[rng.integers(2)], (0, H - 1)[rng.integers(2)]
        th += 7 * k * st["perf"] * np.exp(-np.hypot(xx - cx, yy - cy) / (22 * k))
        Am = smooth((d - th) / (1.2 * k) + 0.5)
    sh = gaussian_filter(push, 1.2 * k) * 14 * k if np.abs(push).max() > 0 else np.zeros((H, W), np.float32)
    return dict(paper=np.clip(paper, 0, 1), M=M, L1=np.clip(1 + shade, 0.55, 1.25), Am=Am, sh=sh)


# ---- the paper in space (age3.py, SOFT): bent as paper bends, seen from above, lit from the upper left
TO = np.array([-1., -2.]) / np.hypot(1, 2)                  # toward the light, on the page
COT, AMB = 1.05, 0.42                                        # how low the light stands; the light from everywhere
CAST = -TO * 0.95                                            # px a shadow falls away per px the paper stands up
EYE = 1150                                                   # px the eye is above the desk

class Layer:
    """for every px of the picture: which px of the paper is seen there, how high it stands, which way it faces"""
    def __init__(self, xx, yy):
        self.uy, self.ux = yy.copy(), xx.copy()
        self.z = np.zeros_like(xx); self.N = np.zeros(xx.shape + (3,), np.float32); self.N[..., 2] = 1
        self.on = np.ones_like(xx); self.worn = np.zeros_like(xx)

class Sheet:
    def __init__(self, W, H, k):
        P = self.P = round(PAD * k); self.W, self.H, self.k = W, H, k
        self.yy, self.xx = np.mgrid[-P:H + P, -P:W + P].astype(np.float32)
        self.face = Layer(self.xx, self.yy); self.backs = []; self.wave = None

    def bend(self, p0, n, T, theta, z0=0.0, crease=0.0):
        """past the line through p0 (n: across it, toward the side that bends) the paper turns up by theta(t) at t px
        along the paper from the line; it stands z0 high at the line. Past a quarter turn it shows its back"""
        k = self.k
        q = (self.xx - p0[0]) * n[0] + (self.yy - p0[1]) * n[1]
        t = np.linspace(0, 3 * T, 3000); th = theta(np.minimum(t, T)); dt = t[1] - t[0]
        mid = (th[1:] + th[:-1]) / 2
        x = np.concatenate([[0], np.cumsum(np.cos(mid)) * dt]); z = np.concatenate([[0], np.cumsum(np.sin(mid)) * dt])
        over = np.nonzero(th >= np.pi / 2)[0]; i = over[0] if len(over) else len(t)
        def lay(L, reg, tt, s):
            qq = q[reg]
            L.ux[reg] = self.xx[reg] + n[0] * (tt - qq); L.uy[reg] = self.yy[reg] + n[1] * (tt - qq)
            L.z[reg] = z0 + np.interp(tt, t, z)
            a = np.interp(tt, t, th)
            L.N[reg] = s * np.stack([-np.sin(a) * n[0], -np.sin(a) * n[1], np.cos(a)], axis=-1)
            if crease: L.worn[reg] = np.maximum(L.worn[reg], smooth(1.4 - tt / crease))
        reg = q > 0
        lay(self.face, reg, np.interp(q[reg], x[:i], t[:i]), 1)
        if crease: self.face.worn = np.maximum(self.face.worn, smooth(1 + q / crease) * (q <= 0))
        if i < len(t):
            self.face.on *= smooth((x[i] - q) / (1.2 * k) + 0.5)
            B = Layer(self.xx, self.yy)
            B.on = smooth((x[i] - q) / (1.2 * k) + 0.5)
            reg = q < x[i] + 2 * k
            lay(B, reg, np.interp(q[reg], x[i:][::-1], t[i:][::-1]), -1)
            B.on[~reg] = 0
            self.backs.append(B)
        return float(np.interp(T, t, z))

    def corner(self, c, a, b):
        cx, sx = ((0, 1), (self.W - 1, -1), (self.W - 1, -1), (0, 1))[c]
        cy, sy = ((0, 1), (0, 1), (self.H - 1, -1), (self.H - 1, -1))[c]
        g = np.array([sx / a, sy / b]); T = 1 / np.hypot(*g)
        return np.array([cx + sx * a, cy], np.float32), -g * T, T

any_corner = lambda rng: int(rng.choice(4, p=[0.16, 0.30, 0.30, 0.24]))   # more often where its shadow shows
any_side = lambda rng: int(rng.choice(4, p=[0.22, 0.14, 0.38, 0.26]))

def lift(sh, rng, c, much=1.0):
    k = sh.k
    a = (150 + 90 * rng.random()) * k; b = a * (0.8 + 0.5 * rng.random())
    p0, n, T = sh.corner(c, a, b)
    end = np.radians(62 + 30 * rng.random()) * much
    sh.bend(p0, n, T, lambda t: end * (t / T) ** 1.5)

def curl(sh, rng, side, much=1.0):
    k = sh.k; W, H = sh.W, sh.H
    T = (42 + 30 * rng.random()) * k; skew = np.radians(rng.uniform(-7, 7))
    n0 = np.array(((-1, 0), (0, -1), (1, 0), (0, 1))[side], np.float32)
    n = np.array([n0[0] * np.cos(skew) - n0[1] * np.sin(skew), n0[0] * np.sin(skew) + n0[1] * np.cos(skew)])
    mid = np.array([W / 2, H / 2]) + n0 * np.array([W / 2, H / 2]) - n0 * T
    end = np.radians(48 + 26 * rng.random()) * much
    sh.bend(mid, n, T, lambda t: end * (t / T) ** 1.3)

def dogear(sh, rng, c):
    k = sh.k
    a = (36 + 22 * rng.random()) * k; b = a * (0.75 + 0.6 * rng.random())
    p0, n, T = sh.corner(c, a, b)
    end = np.pi - np.radians(9 + 12 * rng.random()); r = 1.6 * k
    sh.bend(p0, n, T, lambda t: end * smooth(t / (np.pi * r)), crease=4.5 * k)

def halfopen(sh, rng, fold):
    k = sh.k; W, H = sh.W, sh.H
    across, (slope, at0) = fold
    along = np.array([slope, 1.0]) / np.hypot(slope, 1)
    p0 = np.array([at0 + slope * H / 2, H / 2]) if not across else np.array([W / 2, at0 + slope * W / 2])
    if across: along = along[::-1]
    n = np.array([along[1], -along[0]])
    far = lambda nn: max(((cx - p0[0]) * nn[0] + (cy - p0[1]) * nn[1]) for cx in (0, W) for cy in (0, H))
    sharp_ = lambda ang: (lambda t: ang * smooth(t / (7 * k)))
    if rng.random() < 0.5:                                   # one half up
        up = n if rng.random() < 0.5 else -n
        sh.bend(p0, up, far(up), sharp_(np.radians(3.5 + 2.5 * rng.random())))
    else:                                                    # a roof
        a1 = np.radians(3 + 2 * rng.random()); top = far(n) * np.sin(a1)
        a2 = np.arcsin(min(0.6, top / far(-n)))
        sh.bend(p0, n, far(n), sharp_(-a1), top); sh.bend(p0, -n, far(-n), sharp_(-a2), top)

def bow(sh, rng):
    k = sh.k; W, H = sh.W, sh.H
    down = rng.random() < 0.65
    lean = np.radians(rng.uniform(-5, 5))
    n = np.array([np.cos(lean), np.sin(lean)]) if down else np.array([-np.sin(lean), np.cos(lean)])
    p0 = np.array([W / 2 + rng.uniform(-30, 30) * k, H / 2 + rng.uniform(-30, 30) * k])
    far = lambda nn: max(((cx - p0[0]) * nn[0] + (cy - p0[1]) * nn[1]) for cx in (0, W) for cy in (0, H))
    end = np.radians(10 + 5 * rng.random())
    if rng.random() < 0.6:
        for nn in (n, -n): T = far(nn); sh.bend(p0, nn, T, lambda t, T=T: end * t / T)
    else:
        end *= 0.8; tops = []
        for nn in (n, -n):
            T = far(nn); tops.append((nn, T, -sh.bend(p0, nn, T, lambda t, T=T: -end * t / T)))
        top = max(h for *_, h in tops)
        for nn, T, _ in tops: sh.bend(p0, nn, T, lambda t, T=T: -end * t / T, top)

def waves(sh, rng, high):
    sh.wave = high * sh.k * smooth((cloud(sh.xx.shape[1], sh.xx.shape[0], rng, 50 * sh.k) - 0.3) / 0.55)

def spaced(sh, rng, info, idx):
    """one of them as the deck deals it, and often a second, smaller one"""
    c = any_corner(rng); what = DECK[idx % len(DECK)]
    if what == "lift":
        lift(sh, rng, c)
        if rng.random() < 0.3: dogear(sh, rng, (c + 2) % 4); what += "+dogear"
    elif what == "curl":
        side = any_side(rng); curl(sh, rng, side)
        if rng.random() < 0.3:
            far = {0: (1, 2), 1: (2, 3), 2: (0, 3), 3: (0, 1)}[side]
            (lift if rng.random() < 0.5 else dogear)(sh, rng, int(rng.choice(far))); what += "+corner"
    elif what == "dogear":
        dogear(sh, rng, c)
        if rng.random() < 0.3: lift(sh, rng, (c + 2) % 4, 0.8); what += "+lift"
    elif what == "halfopen": halfopen(sh, rng, info["folds"][0])
    elif what == "bow": bow(sh, rng)
    if what == "waves": waves(sh, rng, 13 + 5 * rng.random())
    elif rng.random() < 0.35: waves(sh, rng, 6 + 3 * rng.random()); what += "+waves"
    return what


def kit(idx, a0):
    """the maps of kit idx over the aged picture (the stamp a0's outline, PAD px of desk round it)"""
    st, picks = mix(idx, ("fold",) if DECK[idx % len(DECK)] == "halfopen" else ())
    info = {}; fm = flat(a0, st, 100 + idx, info)
    H, W = a0.shape; k = W / W0
    sh = Sheet(W, H, k); rng = np.random.default_rng(300 + idx)
    what = spaced(sh, rng, info, idx)
    P = sh.P; size = (W + 2 * P, H + 2 * P)
    near = lambda arr, uy, ux: map_coordinates(arr, [uy, ux], order=1, mode="nearest")
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    A1 = map_coordinates(a0 * fm["Am"], [yy + fm["sh"], xx + fm["sh"]], order=1, mode="constant")  # the face after the push
    paper = rgb(BASE["paper"])

    def facing(L):
        N, z = L.N, L.z
        if sh.wave is not None:
            at = [L.uy + P, L.ux + P]; s = np.sign(N[..., 2:]) + (N[..., 2:] == 0)
            g = np.dstack([map_coordinates(np.gradient(sh.wave, axis=a), at, order=1, mode="nearest") for a in (1, 0)])
            N = N + np.dstack([-g * s, np.zeros_like(z)]); N = N / np.linalg.norm(N, axis=2, keepdims=True)
            z = z + map_coordinates(sh.wave, at, order=1, mode="nearest")
        F = N[..., 2] + (N[..., 0] * TO[0] + N[..., 1] * TO[1]) * COT
        return np.clip(AMB + (1 - AMB) * np.clip(F, 0, 1.7), 0.56, 1.22), z

    L = sh.face
    s0 = near(fm["sh"], L.uy, L.ux)
    u, v = L.ux + s0, L.uy + s0                              # which px of the printed stamp is seen here
    a = map_coordinates(A1, [L.uy, L.ux], order=1, mode="constant") * L.on
    K = near(fm["Am"], v, u) * L.on * binary_dilation(a > 0.002, iterations=3)   # (only where there is paper)
    A = np.dstack([near(fm["paper"][..., c], v, u) for c in range(3)]) * near(fm["L1"], v, u)[..., None]
    M = near(fm["M"], v, u)
    Bc = np.zeros(size[::-1] + (3,), np.float32)
    if L.worn.max() > 0:                                     # the ink broken along a fold made here: the paper shows
        w = L.worn * (0.35 + 0.65 * cloud(*size, rng, 4 * k)) * 0.75
        A = A * (1 - w)[..., None]; Bc = paper * w[..., None]
    light, z = facing(L)
    A = A * light[..., None]; Bc = Bc * light[..., None]
    ba_all = np.zeros_like(a)
    for B in sh.backs:
        ba = map_coordinates(A1, [B.uy, B.ux], order=1, mode="constant") * B.on
        gum = window(plate("gum"), *size, rng, 700)          # the back: gummed paper gone honey-coloured
        back = rgb("#E9D9B4") * (gum / gum.reshape(-1, 3).mean(axis=0)) ** 1.3
        back = back * 0.96                                   # (the print showing through, as an average print)
        back = back + (rgb("#F6EEDC") - back) * (0.5 * B.worn)[..., None]
        lb, bz = facing(B); back = back * lb[..., None]
        dark = gaussian_filter(ba, 3.2 * k) * 0.30           # its shadow on the face
        gap = np.maximum(bz - z, 0); top = gap[ba > 0.5].max() if (ba > 0.5).any() else 0
        for h in np.arange(2 * k, top + 1, 2.5 * k):
            m = ba * smooth((gap - h) / (2 * k) + 0.5)
            off = (1.5 * k + h) * CAST
            dark = np.maximum(dark, 0.46 * gaussian_filter(moved(m, (off[1], off[0]), order=1), 1.2 * k + 0.30 * h))
        keep = ((1 - dark) * (1 - ba))[..., None]
        A = A * keep; Bc = Bc * keep + back * ba[..., None]
        z = np.where(ba > 0.5, bz, z); a = np.maximum(a, ba); ba_all = np.maximum(ba_all, ba)

    # the shadow on the desk, level by level: what stands h high throws its shadow h further and softer
    top = float((z * (a > 0.5)).max())
    shade = np.zeros_like(a)
    for h in np.concatenate([[0], np.arange(2.5 * k, top + 1, 2.5 * k)]):
        m = a if h == 0 else a * smooth((z - h) / (2 * k) + 0.5)
        off = np.array([2.0, 4.0]) * k + h * CAST
        s = gaussian_filter(moved(m, (off[1], off[0]), order=1), 1.5 * k + 0.30 * h)
        shade = np.maximum(shade, s * 0.32 * (1 - 0.4 * h / (h + 40 * k)))

    # the eye is not endlessly far: what stands up is seen a little larger and further out
    cx, cy = W / 2, H / 2
    iy, ix = distance_transform_edt(a <= 0.5, return_distances=False, return_indices=True)
    zs = gaussian_filter(z[iy, ix], 1.2 * k)
    X, Y = sh.xx.copy(), sh.yy.copy()
    for _ in range(6):
        zz = map_coordinates(zs, [Y + P, X + P], order=1, mode="nearest") / (EYE * k)
        X = cx + (sh.xx - cx) * (1 - zz); Y = cy + (sh.yy - cy) * (1 - zz)
    at = [Y + P, X + P]
    seen = lambda arr, mode="nearest": map_coordinates(arr, at, order=1, mode=mode)
    out = dict(u=seen(u), v=seen(v), M=seen(M), K=seen(K, "constant"), ba=seen(ba_all, "constant"),
               A=np.dstack([seen(A[..., c]) for c in range(3)]), Bc=np.dstack([seen(Bc[..., c], "constant") for c in range(3)]),
               shade=shade, what=what, picks=picks)
    return out


def u8(x): return (np.clip(x, 0, 1) * 255 + 0.5).astype(np.uint8)

def save(i, m):
    q = lambda x: np.clip(np.round((x + PAD) * 4), 0, 4095).astype(np.uint16)
    qu, qv = q(m["u"]), q(m["v"])
    uv = np.dstack([qu >> 4, ((qu & 15) << 4) | (qv >> 8), qv & 255]).astype(np.uint8)
    # data exactly (lossless); the paper's colour may lose a little (lossy, a fifth of the size)
    exact = dict(lossless=True, method=6)
    Image.fromarray(uv, "RGB").save(os.path.join(OUT, f"{i}.uv.webp"), **exact)
    Image.fromarray(u8(m["A"] / A_MAX), "RGB").save(os.path.join(OUT, f"{i}.a.webp"), quality=92, method=6)
    Image.fromarray(u8(np.dstack([m["M"] / M_MAX, m["K"], m["ba"]])), "RGB").save(os.path.join(OUT, f"{i}.k.webp"), **exact)
    back = bool(m["Bc"].max() > 0.004)
    if back: Image.fromarray(u8(m["Bc"] / B_MAX), "RGB").save(os.path.join(OUT, f"{i}.b.webp"), quality=92, method=6)
    sh = Image.fromarray(u8(m["shade"]), "L"); half = sh.resize((sh.width // 2, sh.height // 2), Image.LANCZOS)
    s = Image.new("RGBA", half.size, (0, 0, 0, 0)); s.putalpha(half)
    s.save(os.path.join(OUT, f"{i}.s.webp"), **exact)
    return back


def apply(img, i):
    """what age.js does, in numpy (to check the kits against the mock-ups): img RGBA 0..1 at W0 wide -> aged RGBA, shadow"""
    ld = lambda n: np.asarray(Image.open(os.path.join(OUT, f"{i}.{n}.webp"))).astype(np.float32)
    uv = ld("uv").astype(np.int32)                          # (the maps are cut to the index's box)
    u = ((uv[..., 0] << 4) | (uv[..., 1] >> 4)) / 4 - PAD; v = (((uv[..., 1] & 15) << 8) | uv[..., 2]) / 4 - PAD
    A = ld("a") / 255 * A_MAX; kk = ld("k") / 255; M = kk[..., 0] * M_MAX; K = kk[..., 1]; ba = kk[..., 2]
    Bc = ld("b") / 255 * B_MAX if os.path.exists(os.path.join(OUT, f"{i}.b.webp")) else 0
    c = np.dstack([map_coordinates(img[..., n], [v, u], order=1, mode="constant") for n in range(4)])
    a0 = c[..., 3]; col = np.where(a0[..., None] > 0.02, c[..., :3] / np.maximum(a0, 1e-4)[..., None], P0)
    ink = 1 - np.clip(col / P0, 0, 1); ink = (ink + (ink.mean(2, keepdims=True) - ink) * GREY) * (1 - FADE) * M[..., None]
    out = np.clip(A * (1 - ink) + Bc, 0, 1)
    box = json.load(open(os.path.join(OUT, "index.json")))["box"]
    full = np.zeros((H0 + 2 * PAD, W0 + 2 * PAD, 4), np.float32)
    full[box[1]:box[3], box[0]:box[2]] = np.dstack([out, np.maximum(a0 * K, ba)])
    s = np.asarray(Image.open(os.path.join(OUT, f"{i}.s.webp")).resize(full.shape[1::-1], Image.BILINEAR))[..., 3] / 255
    return full, s


def outline():
    """the stamp's die-cut outline (its perforations) at W0 wide: kraft/raw/outline.png"""
    return np.asarray(Image.open(os.path.join(KRAFT, "raw", "outline.png")).convert("L")).astype(np.float32) / 255


def shadow_box():
    """the box all the kits' shadows keep to, in px of the shadow maps (half size): the home cuts its shadow canvases to
    it (most of the PAD round a stamp has no shadow on it, and a phone draws every px of a layer)"""
    box = None
    for i in range(KITS):
        a = np.asarray(Image.open(os.path.join(OUT, f"{i}.s.webp")).convert("RGBA"))[..., 3]
        ys, xs = np.nonzero(a > 1)
        b = [xs.min(), ys.min(), xs.max() + 1, ys.max() + 1]
        box = b if box is None else [min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3])]
    return [int(max(0, box[0] - 3)), int(max(0, box[1] - 3)), int(min(a.shape[1], box[2] + 3)), int(min(a.shape[0], box[3] + 3))]


def build(only=None):
    """all the kits, then each cut to one box: as far as the paper of any of them reaches (the lifted parts stand a
    little outside the stamp), so the home's aged canvases are no bigger than they need be. The shadows keep all PAD
    (the index says which part of them holds any shadow: sbox)"""
    os.makedirs(OUT, exist_ok=True)
    a0 = outline(); assert a0.shape == (H0, W0), a0.shape
    index = []
    for i in range(KITS):
        if only and i not in only:
            continue
        m = kit(i, a0); back = save(i, m)
        index.append(dict(i=i, what=m["what"], picks=m["picks"], back=back))
        print(f"  kit {i}: {'+'.join(m['picks'])} · {m['what']}{' · back' if back else ''}", flush=True)
    if only:
        return
    box = [W0 + 2 * PAD, H0 + 2 * PAD, 0, 0]
    for k in index:
        kk = np.asarray(Image.open(os.path.join(OUT, f"{k['i']}.k.webp")))
        ys, xs = np.nonzero((kk[..., 1] > 0) | (kk[..., 2] > 0))
        box = [min(box[0], xs.min()), min(box[1], ys.min()), max(box[2], xs.max() + 1), max(box[3], ys.max() + 1)]
    box = [int(max(0, box[0] - 4)), int(max(0, box[1] - 4)), int(min(W0 + 2 * PAD, box[2] + 4)), int(min(H0 + 2 * PAD, box[3] + 4))]
    for k in index:
        for n in ("uv", "a", "k", "b"):
            f = os.path.join(OUT, f"{k['i']}.{n}.webp")
            if not os.path.exists(f): continue
            im = Image.open(f).convert("RGB").crop(box)
            im.save(f, **(dict(quality=92, method=6) if n in ("a", "b") else dict(lossless=True, method=6)))
    print(f"  cut to {box} (of {W0 + 2 * PAD}x{H0 + 2 * PAD})")
    json.dump(dict(v=int(time.time()), w=W0, h=H0, pad=PAD, box=box, sbox=shadow_box(), a=A_MAX, m=M_MAX, b=B_MAX, grey=GREY,
                   fade=FADE, p0=[245, 242, 234], kits=index), open(os.path.join(OUT, "index.json"), "w"), indent=1)
