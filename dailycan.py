#!/usr/bin/env python
"""每日一罐 · Daily Can — one condensed-mood tin per day.

  python dailycan.py add "摆烂" --en "Lying Flat"          # today's can (codex draws the emblem)
  python dailycan.py add "摆烂" --en "bai lan" --no-ai      # procedural emblem, no codex
  python dailycan.py add "Monday" --palette "Ruscha Sunset" --date 2026-09-27
  python dailycan.py rebuild                                 # regenerate site/ + wall.png from cans/
  python dailycan.py rerender                                # re-render every can (after code changes)
  python dailycan.py palettes                                # list palettes
  python dailycan.py demo [--ai]                             # eight sample cans
  python dailycan.py serve                                   # web studio: vessels + palettes + emblem library
  python dailycan.py serve --lan                             # same, reachable from other devices on the Wi-Fi
  python dailycan.py emblem "摆烂" --en "lying flat"          # add one emblem to the library
  python dailycan.py import-cans                             # reuse emblems from old cans/
  python dailycan.py leaflets [--jobs 3]                     # codex writes the back-of-stamp leaflet for every library word
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dailycan.can import render_can
from dailycan.emblem import get_emblem
from dailycan.gallery import build_site, build_wall
from dailycan.label import render_label
from dailycan.palettes import PALETTES, pick_palette
from dailycan.spec import CanSpec

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

ROOT = os.path.dirname(os.path.abspath(__file__))
CANS = os.path.join(ROOT, "cans")
SITE = os.path.join(ROOT, "site")


def next_no() -> int:
    nos = []
    for name in os.listdir(CANS):
        p = os.path.join(CANS, name, "meta.json")
        if os.path.exists(p):
            with open(p, encoding="utf-8") as f:
                nos.append(CanSpec.from_json(f.read()).no)
    return (max(nos) + 1) if nos else 1


def slug(s: str) -> str:
    keep = "".join(ch if ch.isalnum() else "-" for ch in s).strip("-")
    return keep[:24] or "can"


def make_can(spec: CanSpec, use_ai: bool, regenerate: bool = False, quiet: bool = False) -> str:
    folder = os.path.join(CANS, f"{spec.date}-{slug(spec.phrase)}")
    os.makedirs(folder, exist_ok=True)
    pal = pick_palette(spec.no, spec.palette or None)
    spec.palette = pal.name
    if not quiet:
        print(f"[{spec.no:03d}] {spec.phrase}  ·  {pal.name}")
    emblem, concept, source = get_emblem(spec.phrase, spec.en, spec.no, pal, folder, use_ai=use_ai, regenerate=regenerate)
    if concept:
        spec.emblem_prompt = concept
    spec.emblem_source = source
    emblem.save(os.path.join(folder, "emblem.png"))
    label = render_label(spec, pal, emblem)
    label.save(os.path.join(folder, "label.png"), optimize=True)
    can = render_can(label, pal)
    can.save(os.path.join(folder, "can.png"), optimize=True)
    with open(os.path.join(folder, "meta.json"), "w", encoding="utf-8") as f:
        f.write(spec.to_json())
    return folder


def rebuild():
    out = build_site(CANS, SITE)
    wall = build_wall(CANS, os.path.join(SITE, "wall.png"))
    print(f"site  -> {out}")
    if wall:
        print(f"wall  -> {wall}")


def cmd_add(a):
    date = a.date or dt.date.today().isoformat()
    spec = CanSpec(no=a.no or next_no(), date=date, phrase=a.phrase, en=a.en or "", palette=a.palette or "")
    folder = make_can(spec, use_ai=not a.no_ai, regenerate=a.regen)
    print(f"can   -> {folder}")
    rebuild()


def cmd_rerender(a):
    for name in sorted(os.listdir(CANS)):
        p = os.path.join(CANS, name, "meta.json")
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8") as f:
            spec = CanSpec.from_json(f.read())
        if a.palette:
            spec.palette = a.palette
        make_can(spec, use_ai=not a.no_ai, regenerate=False)
    rebuild()


DEMO = [
    ("周末", "weekend"),
    ("周一", "monday"),
    ("emo", "emotional"),
    ("清醒", "sober · lucid"),
    ("上头", "hooked"),
    ("咖啡因", "caffeine"),
    ("发疯", "going feral"),
    ("鸽了", "ghosted"),
]


def cmd_demo(a):
    from concurrent.futures import ThreadPoolExecutor
    start = dt.date.today() - dt.timedelta(days=len(DEMO) - 1)
    no = next_no()
    specs = [CanSpec(no=no + i, date=(start + dt.timedelta(days=i)).isoformat(), phrase=ph, en=en)
             for i, (ph, en) in enumerate(DEMO)]
    if a.ai:
        # codex calls are slow and independent: run them side by side, then render
        from dailycan.emblem import generate_with_codex
        def gen(spec):
            folder = os.path.join(CANS, f"{spec.date}-{slug(spec.phrase)}")
            os.makedirs(folder, exist_ok=True)
            raw = os.path.join(folder, "emblem_raw.png")
            if not os.path.exists(raw):
                print(f"  codex -> {spec.phrase}")
                generate_with_codex(spec.phrase, spec.en, raw)
        with ThreadPoolExecutor(max_workers=a.jobs) as ex:
            list(ex.map(gen, specs))
    for spec in specs:
        make_can(spec, use_ai=a.ai)
    rebuild()


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("add", help="make a can")
    p.add_argument("phrase")
    p.add_argument("--en", help="small translation / romanisation line")
    p.add_argument("--date", help="YYYY-MM-DD (default today)")
    p.add_argument("--no", type=int, help="series number (default next)")
    p.add_argument("--palette", help="palette name (default rotates by number)")
    p.add_argument("--no-ai", action="store_true", help="skip codex, use the procedural emblem")
    p.add_argument("--regen", action="store_true", help="ask codex again even if emblem_raw.png exists")
    p.set_defaults(fn=cmd_add)

    p = sub.add_parser("rebuild", help="rebuild site/index.html and wall.png")
    p.set_defaults(fn=lambda a: rebuild())

    p = sub.add_parser("rerender", help="re-render all cans from meta.json (keeps AI emblems)")
    p.add_argument("--palette")
    p.add_argument("--no-ai", action="store_true")
    p.set_defaults(fn=cmd_rerender)

    p = sub.add_parser("palettes", help="list palettes")
    p.set_defaults(fn=lambda a: [print(f"{x.name:22s} band {x.band} field {x.field} ink {x.ink} accent {x.accent}   {x.note}") for x in PALETTES])

    p = sub.add_parser("demo", help="generate eight sample cans")
    p.add_argument("--ai", action="store_true", help="use codex for the emblems")
    p.add_argument("--jobs", type=int, default=4, help="parallel codex sessions")
    p.set_defaults(fn=cmd_demo)

    p = sub.add_parser("serve", help="open the web studio (vessels, palettes, emblem library)")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--host", default="127.0.0.1", help="bind address; 0.0.0.0 opens it to other devices on the LAN")
    p.add_argument("--lan", action="store_true", help="shorthand for --host 0.0.0.0")
    p.add_argument("--no-browser", action="store_true")
    p.set_defaults(fn=cmd_serve)

    p = sub.add_parser("emblem", help="generate one emblem into the library with codex")
    p.add_argument("phrase")
    p.add_argument("--en", default="")
    p.add_argument("--idea", default="", help="what to draw (in English); codex picks a motif when left out")
    p.set_defaults(fn=cmd_emblem)

    p = sub.add_parser("words", help="draw the planned library words that have no emblem yet (dailycan/words.py), then their leaflets")
    p.add_argument("--redo", action="store_true", help="draw the given words again")
    p.add_argument("phrases", nargs="*", help="only these words")
    p.set_defaults(fn=lambda a: __import__("dailycan.words", fromlist=["x"]).generate_missing(a.phrases or None, a.redo))

    p = sub.add_parser("import-cans", help="pull emblems from cans/*/emblem_raw.png into the library")
    p.set_defaults(fn=cmd_import)

    p = sub.add_parser("terms", help="draw the 24 solar-term icons for the stamp corner with codex (missing ones, or the given keys)")
    p.add_argument("--jobs", type=int, default=1, help="keep at 1: parallel codex runs mix up their images")
    p.add_argument("keys", nargs="*", help="redraw only these, e.g. 16-qiufen")
    p.set_defaults(fn=lambda a: __import__("dailycan.terms", fromlist=["x"]).generate_missing(a.keys or None, a.jobs))

    p = sub.add_parser("posters", help="draw the 撕一张 posters hidden under each stamp pane with codex (missing ones, or the given keys)")
    p.add_argument("keys", nargs="*", help="redraw only these, e.g. 01-lipstick")
    p.set_defaults(fn=lambda a: __import__("dailycan.posters", fromlist=["x"]).generate_missing(a.keys or None))

    p = sub.add_parser("backdrops", help="cut the home screen's big Matisse paper shapes with codex (missing ones, or the given keys)")
    p.add_argument("--rebuild", action="store_true", help="only rebuild the masks from the raw drawings")
    p.add_argument("keys", nargs="*", help="redraw only these, e.g. sun")
    p.set_defaults(fn=lambda a: (lambda m: m.rebuild() if a.rebuild else m.generate_missing(a.keys or None))(__import__("dailycan.backdrops", fromlist=["x"])))

    p = sub.add_parser("fonts", help="subset the Chinese web fonts to WOFF2 (web/fonts/sub/), after the text or leaflets change")
    p.set_defaults(fn=lambda a: __import__("dailycan.webfonts", fromlist=["x"]).build())

    p = sub.add_parser("masks", help="pre-cut the emblems' and term icons' ink masks and outlines for the web app (stale or missing ones)")
    p.add_argument("--force", action="store_true", help="cut them all again")
    p.set_defaults(fn=lambda a: __import__("dailycan.cutmasks", fromlist=["x"]).build(a.force))

    p = sub.add_parser("leaflets", help="write missing leaflets (stamp backs) for every emblem-library word")
    p.add_argument("--jobs", type=int, default=3)
    p.add_argument("phrases", nargs="*", help="only these words")
    p.set_defaults(fn=cmd_leaflets)

    a = ap.parse_args()
    os.makedirs(CANS, exist_ok=True)
    a.fn(a)


def cmd_serve(a):
    from dailycan.server import serve
    serve(a.port, open_browser=not a.no_browser, host="0.0.0.0" if a.lan else a.host)


def cmd_emblem(a):
    from dailycan import library
    e = library.generate(a.phrase, a.en, idea=a.idea)
    print(json.dumps(e, ensure_ascii=False, indent=2))


def cmd_import(a):
    from dailycan import library
    added = library.import_from_cans(CANS)
    print(f"imported {len(added)} emblem(s); library now has {len(library.list_emblems())}")


def cmd_leaflets(a):
    import time
    from concurrent.futures import ThreadPoolExecutor
    from dailycan import leaflet, library
    words = [(p, "") for p in a.phrases] or [(e["phrase"], e.get("en", "")) for e in library.list_emblems() if e.get("status") == "ready"]
    todo = [(p, en) for p, en in words if not leaflet.load(p)]
    print(f"{len(words)} word(s), {len(todo)} missing a leaflet")

    def one(w):
        t0 = time.time()
        d = leaflet.generate(*w)
        print(f"  {w[0]}: {d.get('status')}  {d.get('name', '')}  ({time.time() - t0:.0f}s)")
    with ThreadPoolExecutor(max_workers=a.jobs) as ex:
        list(ex.map(one, todo))


if __name__ == "__main__":
    main()
