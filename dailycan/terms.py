"""Solar-term icons: the stamp's denomination corner shows the 节气 of its issue date. codex draws each of the 24 once;
they are stored as palette-independent channel masks in terms/ (same R/G/B scheme as the emblems) and recoloured
in the browser. The motif of every term is fixed here so the symbol stays accurate."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from PIL import Image

from .emblem import build_mask
from .library import ROOT

TERMS_DIR = os.path.join(ROOT, "terms")

# (key, name, english, motif) from 立春; key numbers follow the calendar order
TERMS = [
    ("01-lichun", "立春", "Start of Spring", "a young sprout with two leaves breaking out of a mound of soil"),
    ("02-yushui", "雨水", "Rain Water", "three fat raindrops falling"),
    ("03-jingzhe", "惊蛰", "Awakening of Insects", "a zigzag thunderbolt over a small beetle waking up"),
    ("04-chunfen", "春分", "Spring Equinox", "a disc split exactly in half: one half a sun with short rays, the other half a crescent moon"),
    ("05-qingming", "清明", "Clear and Bright", "a drooping willow branch with long slender leaves"),
    ("06-guyu", "谷雨", "Grain Rain", "raindrops falling on a young grain seedling"),
    ("07-lixia", "立夏", "Start of Summer", "one egg standing upright"),
    ("08-xiaoman", "小满", "Grain Buds", "a single plump ear of wheat"),
    ("09-mangzhong", "芒种", "Grain in Ear", "three rice seedlings standing in a paddy, two wavy water lines at their feet (no tools)"),
    ("10-xiazhi", "夏至", "Summer Solstice", "a blazing midsummer sun with bold triangular rays"),
    ("11-xiaoshu", "小暑", "Minor Heat", "a wedge slice of watermelon with seeds"),
    ("12-dashu", "大暑", "Major Heat", "a cicada seen from above, wings spread"),
    ("13-liqiu", "立秋", "Start of Autumn", "one ginkgo leaf falling"),
    ("14-chushu", "处暑", "End of Heat", "a round palm-leaf hand fan"),
    ("15-bailu", "白露", "White Dew", "a big dewdrop hanging from a bent blade of grass"),
    ("16-qiufen", "秋分", "Autumn Equinox", "a simple oval poplar leaf (NOT a maple leaf) split along its midrib: one half filled, the other half left white"),
    ("17-hanlu", "寒露", "Cold Dew", "a chrysanthemum flower head with many petals"),
    ("18-shuangjiang", "霜降", "Frost's Descent", "a persimmon with its four-lobed calyx and a few frost sparkles"),
    ("19-lidong", "立冬", "Start of Winter", "a knitted mitten"),
    ("20-xiaoxue", "小雪", "Minor Snow", "one six-armed snowflake"),
    ("21-daxue", "大雪", "Major Snow", "three snowflakes of different sizes"),
    ("22-dongzhi", "冬至", "Winter Solstice", "a bowl of round tangyuan dumplings, seen from the side"),
    ("23-xiaohan", "小寒", "Minor Cold", "a plum-blossom twig with two five-petal flowers"),
    ("24-dahan", "大寒", "Major Cold", "a row of icicles hanging from a ledge"),
]

PROMPT_TMPL = """You are drawing a tiny pictogram for the corner of a pop-art postage stamp. It marks the Chinese solar term
{name} ({en}). Draw exactly this and nothing else: {motif}.
Use your image generation tool:
- a postal pictogram, not an illustration: at most three or four bold simple shapes, readable when printed 100 px wide
- extra-thick uniform black outlines, 1960s screen-print feel
- inside the outlines only one flat fill colour: pure magenta (#FF00A8); leave other areas white; no gradients, shading or texture
- pure white background, the symbol centred and filling ~80% of a square 1024x1024 canvas
- absolutely no letters, numbers or words
Save the PNG as "{out}" (overwrite if it exists), then reply with exactly one line: DONE
"""


def path_for(key: str, raw: bool = False) -> str:
    return os.path.join(TERMS_DIR, key + (".raw.png" if raw else ".png"))


def write_index() -> None:
    items = [{"key": k, "name": n, "file": f"terms/{k}.png", "v": int(os.path.getmtime(path_for(k)))}
             for k, n, _, _ in TERMS if os.path.exists(path_for(k))]
    with open(os.path.join(TERMS_DIR, "index.json"), "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)


def generate(key: str, timeout: int = 600) -> bool:
    """Ask codex for one icon, then build its channel mask. Returns True on success."""
    _, name, en, motif = next(t for t in TERMS if t[0] == key)
    os.makedirs(TERMS_DIR, exist_ok=True)
    raw = path_for(key, raw=True)
    work = os.path.join(TERMS_DIR, "_work", key)
    os.makedirs(work, exist_ok=True)
    cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "danger-full-access",
           "--enable", "image_generation", "-c", 'model_reasoning_effort="low"',
           "-C", work, "-o", os.path.join(work, "last.txt"),
           PROMPT_TMPL.format(name=name, en=en, motif=motif, out=raw)]
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
        mask = build_mask(Image.open(raw), 512)
        if (np.asarray(mask)[..., 0] > 127).mean() > 0.35:   # drawn on a dark ground: it would print as a solid square
            print(f"  {key}: dark background, drawing again", file=sys.stderr)
            continue
        mask.save(path_for(key), optimize=True)
        return True
    return False


def generate_missing(keys: list[str] | None = None, jobs: int = 1) -> None:
    """Draw the given icons (redraw even if present), or every icon not drawn yet. Keep jobs at 1: parallel codex
    sessions have picked up each other's images and saved them under the wrong term."""
    todo = keys or [k for k, *_ in TERMS if not os.path.exists(path_for(k))]
    print(f"{len(todo)} solar-term icon(s) to draw")

    def one(k):
        t0 = time.time()
        ok = generate(k)
        print(f"  {k}: {'ok' if ok else 'failed'}  ({time.time() - t0:.0f}s)")
    with ThreadPoolExecutor(max_workers=jobs) as ex:
        list(ex.map(one, todo))
    write_index()
    from .cutmasks import build as cut_plates              # the web app's pre-cut masks and outlines
    cut_plates()
