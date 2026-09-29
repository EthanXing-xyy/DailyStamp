"""A static copy of the web app for a host with no server of ours (Cloudflare, static assets on Workers):
`python dailystamp.py build` writes dist/, `deploy` builds and uploads it (https://daily-stamp.daily-stamp-2.workers.dev/),
and to Netlify too (https://daily-stamp.netlify.app/, which some of mainland China can reach where workers.dev is blocked).

What the local server works out on the fly is written as files: /api/emblems.json and /api/leaflets.json. The studio's
存入 finds no server there and downloads both sides instead (stage.js). web/boot.js keeps its '__BOOT__' mark, so a
new upload never clears what a visitor's browser kept. The debug buttons (Kit.DEBUG) only show with ?debug in the
address. The drawings' raw sources, codex's references and work folders stay home."""
from __future__ import annotations

import fnmatch
import json
import os
import shutil
import subprocess

from . import leaflet, library

ROOT = library.ROOT
DIST = os.path.join(ROOT, "dist")
MARK = ".dailystamp-build"                       # only a folder carrying this is emptied before a build
PROJECT = "daily-stamp"                          # the Worker: https://daily-stamp.daily-stamp-2.workers.dev/
NETLIFY = "3f543ff1-cbf7-4415-aa32-36e7e4bd3e0a" # the Netlify project: https://daily-stamp.netlify.app/
HOSTS = ["cloudflare", "netlify"]
COMPAT = "2026-09-26"
# the art folders, served as they are under their own names (server.py), less what only the tools use
ART = ["emblems", "terms", "posters", "kraft", "scene"]
SKIP = ["*.raw.png", "*.txt", "ref-*", "_work", "raw", "plates"]
LIMIT_FILE, LIMIT_FILES = 25 * 2**20, 20000     # what Pages takes: per file, per upload
DEBUG_LINE = "const DEBUG = true;"


def _copy(src: str, dst: str):
    shutil.copytree(src, dst, ignore=lambda d, names: [n for n in names if any(fnmatch.fnmatch(n, p) for p in SKIP)],
                    dirs_exist_ok=True)


def _json(path: str, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))


def build(out: str = DIST) -> str:
    if os.path.exists(out):
        if not os.path.exists(os.path.join(out, MARK)):
            raise SystemExit(f"{out} exists and isn't a build: not touching it")
        shutil.rmtree(out)
    _copy(os.path.join(ROOT, "web"), out)
    for d in ART:
        _copy(os.path.join(ROOT, d), os.path.join(out, d))
    library.write_index()
    _json(os.path.join(out, "api", "emblems.json"), library.list_emblems())
    _json(os.path.join(out, "api", "leaflets.json"), leaflet.all_ready())

    kit = os.path.join(out, "shell", "kit.js")
    with open(kit, encoding="utf-8") as f:
        js = f.read()
    if DEBUG_LINE not in js:
        raise SystemExit(f"shell/kit.js no longer says `{DEBUG_LINE}`: build.py can't hide the debug buttons")
    with open(kit, "w", encoding="utf-8") as f:
        f.write(js.replace(DEBUG_LINE, "const DEBUG = /[?&]debug\\b/.test(location.search);   // (online: only with ?debug)"))

    # for a few friends, not for search engines
    with open(os.path.join(out, "_headers"), "w", encoding="utf-8") as f:
        f.write("/*\n  X-Robots-Tag: noindex, nofollow\n")
    with open(os.path.join(out, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nDisallow: /\n")
    open(os.path.join(out, MARK), "w").close()
    with open(os.path.join(out, ".assetsignore"), "w", encoding="utf-8") as f:     # (not uploaded)
        f.write(MARK + "\n")

    files = [os.path.join(d, n) for d, _, ns in os.walk(out) for n in ns]
    size = sum(os.path.getsize(p) for p in files)
    big = max(files, key=os.path.getsize)
    print(f"dist -> {out}: {len(files)} files, {size / 1e6:.1f} MB (largest {os.path.relpath(big, out)}, "
          f"{os.path.getsize(big) / 1e6:.1f} MB)")
    if len(files) > LIMIT_FILES or os.path.getsize(big) > LIMIT_FILE:
        raise SystemExit("too many files, or one too big, for Cloudflare")
    return out


def _tool(*names: str) -> str:
    for n in names:
        if shutil.which(n):
            return shutil.which(n)
    raise SystemExit(f"needs {names[0]}")


def deploy(out: str = DIST, hosts=HOSTS):
    """build, then upload to each host. Cloudflare with wrangler (`npx wrangler login` once first): Pages is part of
    Workers now, the site is a Worker holding nothing but static assets. Netlify with its CLI (`npm i -g netlify-cli
    --ignore-scripts`, `netlify login` once first)"""
    build(out)
    for h in hosts:
        print(f"-> {h}")
        if h == "cloudflare":
            subprocess.run([_tool("npx", "npx.cmd"), "--yes", "wrangler", "deploy", "--assets", out, "--name", PROJECT,
                            "--compatibility-date", COMPAT], check=True)
        elif h == "netlify":
            # its .cmd shim can't find node when Python starts it: run its script with node
            cli = os.path.join(os.path.dirname(_tool("netlify", "netlify.cmd")), "node_modules", "netlify-cli", "bin", "run.js")
            subprocess.run([_tool("node"), cli, "deploy", "--dir", out, "--prod", "--no-build",
                            "--site", NETLIFY], check=True)
        else:
            raise SystemExit(f"no host {h!r}: {HOSTS}")
