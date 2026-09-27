"""Screen-print textures: Ben-Day dots, paper grain, misregistration."""
from __future__ import annotations

import numpy as np
from PIL import Image, ImageFilter


def benday_mask(w: int, h: int, cell: int, radius: np.ndarray | float) -> Image.Image:
    """L-mode mask of a Ben-Day dot grid. `radius` is a scalar or an (h, w) array of dot radii in px."""
    ys, xs = np.mgrid[0:h, 0:w]
    # stagger every other row for the classic screen look
    row = ys // cell
    fx = (xs + (row % 2) * (cell / 2)) % cell - cell / 2
    fy = ys % cell - cell / 2
    d = np.hypot(fx, fy)
    r = np.asarray(radius, dtype=np.float32)
    a = np.clip((r - d) + 0.5, 0, 1)  # 1px anti-alias
    return Image.fromarray((a * 255).astype(np.uint8), "L")


def edge_radius_map(w: int, h: int, inner: float, outer: float, r_max: float) -> np.ndarray:
    """Dot radius grows from 0 at |x - centre| = inner*w/2 to r_max at outer*w/2."""
    xs = np.abs(np.arange(w, dtype=np.float32) - w / 2) / (w / 2)
    t = np.clip((xs - inner) / max(1e-6, outer - inner), 0, 1)
    r = (t ** 1.4) * r_max
    return np.tile(r[None, :], (h, 1))


def grain(img: Image.Image, amount: float = 0.05, seed: int = 7, blur: float = 0.6) -> Image.Image:
    """Multiply paper grain into an RGB(A) image."""
    rng = np.random.default_rng(seed)
    w, h = img.size
    n = rng.random((h, w), dtype=np.float32)
    nimg = Image.fromarray((n * 255).astype(np.uint8), "L").filter(ImageFilter.GaussianBlur(blur))
    n = np.asarray(nimg, dtype=np.float32) / 255
    mult = 1 + amount * (n - 0.5) * 2
    arr = np.asarray(img.convert("RGBA"), dtype=np.float32)
    arr[..., :3] = np.clip(arr[..., :3] * mult[..., None], 0, 255)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def shift(layer: Image.Image, dx: int, dy: int) -> Image.Image:
    """Translate an RGBA layer (misregistration)."""
    out = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    out.paste(layer, (dx, dy))
    return out


def soften(layer: Image.Image, radius: float = 0.8) -> Image.Image:
    """Slight ink bleed on an RGBA layer's alpha."""
    if radius <= 0:
        return layer
    r, g, b, a = layer.split()
    a = a.filter(ImageFilter.GaussianBlur(radius))
    return Image.merge("RGBA", (r, g, b, a))
