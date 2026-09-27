"""Emblem library: palette-independent mask PNGs in emblems/, one JSON sidecar each, aggregated into index.json.

Generate once per mood, reuse across every palette and vessel.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import re
import shutil
import threading

from PIL import Image

from .emblem import build_mask, generate_with_codex
from .words import group_of

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMBLEMS = os.path.join(ROOT, "emblems")

_lock = threading.Lock()
_pending: dict[str, dict] = {}


def slug(s: str) -> str:
    keep = "".join(ch if ch.isalnum() else "-" for ch in s).strip("-")
    keep = re.sub(r"-+", "-", keep)
    return keep[:24] or "emblem"


def make_id(phrase: str) -> str:
    return slug(phrase) + "-" + hashlib.sha1(phrase.encode("utf-8")).hexdigest()[:6]


def _entry_path(eid: str) -> str:
    return os.path.join(EMBLEMS, eid + ".json")


def list_emblems() -> list[dict]:
    os.makedirs(EMBLEMS, exist_ok=True)
    out = []
    for name in sorted(os.listdir(EMBLEMS)):
        if name.endswith(".json") and name != "index.json":
            with open(os.path.join(EMBLEMS, name), encoding="utf-8") as f:
                try:
                    e = json.load(f)
                except json.JSONDecodeError:
                    continue
            e["group"] = group_of(e.get("phrase", ""))          # its cabinet in the pharmacy (words.py)
            out.append(e)
    out.sort(key=lambda e: e.get("created", ""), reverse=True)
    with _lock:
        out = list(_pending.values()) + out
    return out


def write_index() -> str:
    entries = [e for e in list_emblems() if e.get("status") == "ready"]
    p = os.path.join(EMBLEMS, "index.json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
    return p


def add_from_raw(phrase: str, en: str, raw_path: str, concept: str = "", eid: str | None = None) -> dict:
    """Register a raw codex image: copy it, build the channel mask, write the sidecar."""
    os.makedirs(EMBLEMS, exist_ok=True)
    eid = eid or make_id(phrase)
    raw_dst = os.path.join(EMBLEMS, eid + ".raw.png")
    if os.path.abspath(raw_path) != os.path.abspath(raw_dst):
        shutil.copyfile(raw_path, raw_dst)
    mask = build_mask(Image.open(raw_dst))
    mask.save(os.path.join(EMBLEMS, eid + ".png"), optimize=True)
    entry = {
        "id": eid, "phrase": phrase, "en": en, "concept": concept,
        "file": f"emblems/{eid}.png", "raw": f"emblems/{eid}.raw.png",
        "created": dt.datetime.now().isoformat(timespec="seconds"), "status": "ready",
    }
    with open(_entry_path(eid), "w", encoding="utf-8") as f:
        json.dump(entry, f, ensure_ascii=False, indent=2)
    write_index()
    from .cutmasks import cut_emblem                       # the web app's pre-cut masks and outlines
    cut_emblem(entry)
    return entry


def forget(phrase: str) -> None:
    """Drop a word's emblem (drawing, mask, sidecar, cut plates) so it can be drawn again."""
    eid = make_id(phrase)
    for ext in (".json", ".png", ".raw.png"):
        try:
            os.remove(os.path.join(EMBLEMS, eid + ext))
        except OSError:
            pass
    cut = os.path.join(EMBLEMS, "cut")
    if os.path.isdir(cut):
        for name in os.listdir(cut):
            if name.startswith(eid + "."):
                os.remove(os.path.join(cut, name))


def generate(phrase: str, en: str = "", idea: str = "") -> dict:
    """Blocking: ask codex (to draw `idea`, or a motif of its own choosing), then register. Returns the entry (status
    'ready' or 'failed')."""
    os.makedirs(EMBLEMS, exist_ok=True)
    eid = make_id(phrase)
    if os.path.exists(_entry_path(eid)):
        with open(_entry_path(eid), encoding="utf-8") as f:
            return json.load(f)
    with _lock:
        _pending[eid] = {"id": eid, "phrase": phrase, "en": en, "status": "pending",
                         "created": dt.datetime.now().isoformat(timespec="seconds")}
    try:
        raw = os.path.join(EMBLEMS, eid + ".raw.png")
        concept = generate_with_codex(phrase, en, raw, idea=idea)
        if concept is None or not os.path.exists(raw):
            with _lock:
                _pending[eid] = {**_pending[eid], "status": "failed"}
            return _pending[eid]
        entry = add_from_raw(phrase, en, raw, concept, eid)
        return entry
    finally:
        with _lock:
            if _pending.get(eid, {}).get("status") != "failed":
                _pending.pop(eid, None)


def generate_async(phrase: str, en: str = "") -> dict:
    eid = make_id(phrase)
    if os.path.exists(_entry_path(eid)):
        with open(_entry_path(eid), encoding="utf-8") as f:
            return json.load(f)
    with _lock:
        if eid in _pending:
            return _pending[eid]
    t = threading.Thread(target=generate, args=(phrase, en), daemon=True)
    t.start()
    return {"id": eid, "phrase": phrase, "en": en, "status": "pending"}


def import_from_cans(cans_dir: str) -> list[dict]:
    """Pull the emblems already generated by the old per-day pipeline into the library."""
    out = []
    for name in sorted(os.listdir(cans_dir)):
        d = os.path.join(cans_dir, name)
        raw = os.path.join(d, "emblem_raw.png")
        meta = os.path.join(d, "meta.json")
        if not (os.path.exists(raw) and os.path.exists(meta)):
            continue
        with open(meta, encoding="utf-8") as f:
            m = json.load(f)
        eid = make_id(m["phrase"])
        if os.path.exists(_entry_path(eid)):
            continue
        out.append(add_from_raw(m["phrase"], m.get("en", ""), raw, m.get("emblem_prompt", ""), eid))
    return out
