#!/usr/bin/env python
"""每日一枚 · Daily Stamp — dev-time tools and the local server for the web app.

Everything a model makes (emblems, leaflets, solar-term icons, posters, backdrops) is made here, ahead of time, with
the local codex CLI; the app itself never calls a model.

  python dailystamp.py serve [--lan]              # the web app on http://127.0.0.1:8765/ (--lan: other devices too)
  python dailystamp.py words [词…] [--redo]       # draw the planned library words that have no emblem yet, then leaflets
  python dailystamp.py emblem "摆烂" --idea "…"   # one emblem into the library
  python dailystamp.py leaflets [词…]             # write missing leaflets (stamp backs)
  python dailystamp.py terms | posters | backdrops [keys…]   # the fixed codex art sets
  python dailystamp.py masks [--force]            # pre-cut the emblems' ink masks for the web app
  python dailystamp.py fonts                      # subset the web fonts after any text changes
"""
from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

PKG = "dailystamp"
mod = lambda name: importlib.import_module(f"{PKG}.{name}")


def cmd_serve(a):
    mod("server").serve(a.port, open_browser=not a.no_browser, host="0.0.0.0" if a.lan else a.host)


def cmd_emblem(a):
    print(json.dumps(mod("library").generate(a.phrase, a.en, idea=a.idea), ensure_ascii=False, indent=2))


def cmd_leaflets(a):
    from concurrent.futures import ThreadPoolExecutor
    leaflet, library = mod("leaflet"), mod("library")
    words = [(p, "") for p in a.phrases] or [(e["phrase"], e.get("en", "")) for e in library.list_emblems() if e.get("status") == "ready"]
    todo = [(p, en) for p, en in words if not leaflet.load(p)]
    print(f"{len(words)} word(s), {len(todo)} missing a leaflet")

    def one(w):
        t0 = time.time()
        d = leaflet.generate(*w)
        print(f"  {w[0]}: {d.get('status')}  {d.get('name', '')}  ({time.time() - t0:.0f}s)")
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        list(ex.map(one, todo))


def cmd_backdrops(a):
    s = mod("backdrops").SET
    s.rebuild() if a.rebuild else s.generate_missing(a.keys or None)


# name: (help, arguments as (flags, kwargs), handler)
KEYS = (["keys"], {"nargs": "*", "help": "only these keys"})
COMMANDS = {
    "serve": ("the web app (static files + the emblem/leaflet JSON API)", [
        (["--port"], {"type": int, "default": 8765}),
        (["--host"], {"default": "127.0.0.1", "help": "bind address; 0.0.0.0 opens it to other devices on the LAN"}),
        (["--lan"], {"action": "store_true", "help": "shorthand for --host 0.0.0.0"}),
        (["--no-browser"], {"action": "store_true"})], cmd_serve),
    "words": ("draw the planned library words that have no emblem yet (words.py), then their leaflets", [
        (["--redo"], {"action": "store_true", "help": "draw the given words again"}),
        (["phrases"], {"nargs": "*", "help": "only these words"})],
        lambda a: mod("words").generate_missing(a.phrases or None, a.redo)),
    "emblem": ("draw one emblem into the library with codex", [
        (["phrase"], {}), (["--en"], {"default": ""}),
        (["--idea"], {"default": "", "help": "what to draw (in English); codex picks a motif when left out"})], cmd_emblem),
    "leaflets": ("write missing leaflets (stamp backs) for every library word", [
        (["--jobs"], {"type": int, "default": 3}), (["phrases"], {"nargs": "*", "help": "only these words"})], cmd_leaflets),
    "terms": ("draw the 24 solar-term icons for the stamp corner (missing ones, or the given keys, e.g. 16-qiufen)", [KEYS],
              lambda a: mod("terms").SET.generate_missing(a.keys or None)),
    "posters": ("draw the 撕一张 posters hidden under each stamp pane (missing ones, or the given keys)", [KEYS],
                lambda a: mod("posters").SET.generate_missing(a.keys or None)),
    "backdrops": ("cut the home screen's big Matisse paper shapes (missing ones, or the given keys)", [
        (["--rebuild"], {"action": "store_true", "help": "only rebuild the masks from the raw drawings"}), KEYS], cmd_backdrops),
    "masks": ("pre-cut the emblems' and term icons' ink masks and outlines for the web app (stale or missing ones)", [
        (["--force"], {"action": "store_true", "help": "cut them all again"})], lambda a: mod("cutmasks").build(a.force)),
    "fonts": ("subset the Chinese web fonts to WOFF2 (web/fonts/sub/), after the text or leaflets change", [],
              lambda a: mod("webfonts").build()),
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name, (help_, args, fn) in COMMANDS.items():
        p = sub.add_parser(name, help=help_)
        for flags, kw in args:
            p.add_argument(*flags, **kw)
        p.set_defaults(fn=fn)
    a = ap.parse_args()
    a.fn(a)


if __name__ == "__main__":
    main()
