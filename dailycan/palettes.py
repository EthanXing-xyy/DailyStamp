"""Curated pop-art palettes. Each palette names its source in pop history.

band   : top label band
field  : lower label field
ink    : dark printing ink (outlines, main type on light fields)
accent : secondary ink (medallion ring, ornaments, emblem mid-tone)
paper  : unprinted paper / knockout colour
wall   : flat backdrop the can sits on
"""
from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Palette:
    name: str
    band: str
    field: str
    ink: str
    accent: str
    paper: str
    wall: str
    note: str = ""


PALETTES: list[Palette] = [
    Palette("Campbell", "#C8102E", "#F3EEE3", "#141414", "#D9A521", "#F3EEE3", "#EFE9DC",
            "Warhol, 32 Campbell's Soup Cans, 1962"),
    Palette("Marilyn Turquoise", "#12A5A9", "#FFD23F", "#1D1B3A", "#F25D9C", "#FFF4E8", "#1D1B3A",
            "Warhol, Shot Marilyns, 1964"),
    Palette("Lichtenstein Primary", "#0047AB", "#FFD500", "#111111", "#E4002B", "#FDF6E3", "#FDF6E3",
            "Lichtenstein, Whaam!, 1963"),
    Palette("Electric Lavender", "#B9A6E9", "#C6F432", "#1A1A1A", "#FF6A13", "#1A1A1A", "#3C2A6E",
            "Warhol, Electric Chair, 1971"),
    Palette("Ruscha Sunset", "#FF6A13", "#E6007E", "#1A0A12", "#FFD23F", "#FFF1E0", "#1B1B1B",
            "Ruscha, word paintings"),
    Palette("Memphis Milano", "#9FE2BF", "#FF8C7A", "#1F1F1F", "#0047AB", "#1F1F1F", "#F4EFE6",
            "Sottsass, Memphis Group, 1981"),
    Palette("Mao Green", "#C4D82E", "#D6003C", "#1A1A1A", "#12A5A9", "#FFF7E6", "#2B2B2B",
            "Warhol, Mao, 1972"),
    Palette("Cow Wallpaper", "#FF69B4", "#FFEA00", "#2B1B2F", "#D6006E", "#FFF7FA", "#2B1B2F",
            "Warhol, Cow Wallpaper, 1966"),
    Palette("Brillo", "#0033A0", "#F4F1EA", "#D22730", "#0033A0", "#F4F1EA", "#F4F1EA",
            "Warhol, Brillo Box, 1964"),
    Palette("Banana", "#1A1A1A", "#FFE135", "#1A1A1A", "#FF4FA3", "#FFE135", "#FFF7CC",
            "Warhol, The Velvet Underground & Nico, 1967"),
    Palette("Flowers", "#FF5A1F", "#0B3B2E", "#0B3B2E", "#FFB3C7", "#FFF4E8", "#F5E9DA",
            "Warhol, Flowers, 1964"),
    Palette("Ink & Cream", "#141414", "#F3EEE3", "#141414", "#C8102E", "#F3EEE3", "#C8102E",
            "Indiana, LOVE, 1966 (inverted)"),
]

BY_NAME = {p.name.lower(): p for p in PALETTES}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def luminance(h: str) -> float:
    def ch(c: int) -> float:
        c2 = c / 255
        return c2 / 12.92 if c2 <= 0.03928 else ((c2 + 0.055) / 1.055) ** 2.4
    r, g, b = hex_to_rgb(h)
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)


def contrast(a: str, b: str) -> float:
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def text_on(bg: str, pal: Palette) -> str:
    """Pick ink or paper, whichever reads better on bg."""
    return pal.ink if contrast(bg, pal.ink) >= contrast(bg, pal.paper) else pal.paper


def shade(h: str, k: float) -> str:
    """Darken (k<1) or lighten (k>1) a hex colour."""
    r, g, b = hex_to_rgb(h)
    f = lambda c: max(0, min(255, int(round(c * k))))
    return "#{:02X}{:02X}{:02X}".format(f(r), f(g), f(b))


def pick_palette(no: int, name: str | None = None) -> Palette:
    if name:
        key = name.lower()
        if key not in BY_NAME:
            raise KeyError(f"unknown palette '{name}'. choices: {', '.join(p.name for p in PALETTES)}")
        return BY_NAME[key]
    return PALETTES[(no - 1) % len(PALETTES)]
