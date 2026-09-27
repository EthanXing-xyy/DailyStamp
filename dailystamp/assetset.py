"""A fixed set of pictures codex draws once at dev time (solar-term icons, 撕一张 posters, home backdrops): each set has
its own list of (key, …) items, prompt and mask builder; drawing, retrying, saving and the index are shared here.

Codex runs strictly one at a time: parallel sessions have picked up each other's images and saved them under the
wrong key."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import dataclass
from typing import Callable

from PIL import Image


def run_codex(prompt: str, work: str, timeout: int, images: list[str] = ()) -> None:
    """One non-interactive codex session with image generation, in its own work folder (images: pictures attached
    to the prompt, for reference)."""
    os.makedirs(work, exist_ok=True)
    cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "danger-full-access",
           "--enable", "image_generation", "-c", 'model_reasoning_effort="low"',
           "-C", work, "-o", os.path.join(work, "last.txt")]
    for im in images:
        cmd += ["-i", im]
    cmd += ["--", prompt]                              # -i takes several files: the prompt must not look like one
    try:
        subprocess.run(cmd, cwd=work, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        print("  codex timed out", file=sys.stderr)


@dataclass
class CodexSet:
    folder: str                                       # absolute path; the web app serves it under /<basename>/
    items: list[tuple]                                # (key, …) per picture
    prompt: Callable[[tuple, str], str]               # (item, raw png path) -> the codex prompt
    mask: Callable[[Image.Image], tuple[Image.Image | None, str]]   # raw drawing -> (mask, "") or (None, why it's rejected)
    entry: Callable[[tuple, str, str], dict] = None   # (item, mask path, served file) -> its index entry, before "v"
    what: str = "picture"
    timeout: int = 900
    after: Callable[[], None] = None                  # run once a batch is drawn

    @property
    def keys(self) -> list[str]:
        return [it[0] for it in self.items]

    def item(self, key: str) -> tuple:
        return next(it for it in self.items if it[0] == key)

    def path_for(self, key: str, raw: bool = False) -> str:
        return os.path.join(self.folder, key + (".raw.png" if raw else ".png"))

    def write_index(self) -> None:
        name = os.path.basename(self.folder)
        items = []
        for it in self.items:
            p = self.path_for(it[0])
            if os.path.exists(p):
                file = f"{name}/{it[0]}.png"
                e = self.entry(it, p, file) if self.entry else {"key": it[0], "file": file}
                items.append({**e, "v": int(os.path.getmtime(p))})
        with open(os.path.join(self.folder, "index.json"), "w", encoding="utf-8") as f:
            json.dump(items, f, ensure_ascii=False, indent=2)

    def rebuild(self) -> None:
        """Build every mask again from its raw drawing (after changing the mask builder)."""
        for k in self.keys:
            if os.path.exists(self.path_for(k, raw=True)):
                m, _ = self.mask(Image.open(self.path_for(k, raw=True)))
                if m is not None:
                    m.save(self.path_for(k), optimize=True)
        self.write_index()

    def generate(self, key: str) -> bool:
        """Ask codex for one picture (a second try if the first is missing or rejected), then save its mask."""
        os.makedirs(self.folder, exist_ok=True)
        raw = self.path_for(key, raw=True)
        prompt = self.prompt(self.item(key), raw)
        for _ in range(2):
            if os.path.exists(raw):
                os.remove(raw)
            run_codex(prompt, os.path.join(self.folder, "_work", key), self.timeout)
            if not os.path.exists(raw):
                continue
            m, why = self.mask(Image.open(raw))
            if m is None:
                print(f"  {key}: {why}, drawing again", file=sys.stderr)
                continue
            m.save(self.path_for(key), optimize=True)
            return True
        return False

    def generate_missing(self, keys: list[str] | None = None) -> None:
        """Draw the given keys (again, if present), or every one not drawn yet, one codex run at a time."""
        todo = keys or [k for k in self.keys if not os.path.exists(self.path_for(k))]
        print(f"{len(todo)} {self.what}(s) to draw")
        for k in todo:
            t0 = time.time()
            ok = self.generate(k)
            print(f"  {k}: {'ok' if ok else 'failed'}  ({time.time() - t0:.0f}s)", flush=True)
            self.write_index()
        self.write_index()
        if self.after:
            self.after()
