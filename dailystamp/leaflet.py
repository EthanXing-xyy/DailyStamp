"""Mood leaflet: the deadpan "drug package insert" printed on the back of each stamp.

codex writes it once per mood phrase (text only, no image tool); the JSON is stored in leaflets/ and reused forever.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LEAFLETS = os.path.join(ROOT, "leaflets")

FIELDS = ["name", "ingredients", "appearance", "indications", "dosage", "adverse", "contra", "cautions", "storage", "slogan"]

PROMPT_TMPL = """你在给一套波普艺术邮票写背面的"情绪药品说明书"。每枚邮票浓缩一种情绪，今天的情绪词是「{phrase}」{en}。
语气：一本正经的药品说明书腔调，内容却是冷幽默、具体、有生活细节，像 Warhol 看中国打工人。不要说教，不要鸡汤，不要网络烂梗堆砌。

只输出一个 JSON 对象，不要代码块、不要解释，字段如下（字数是上限，务必遵守）：
{{
  "name": "品名，形如「周一缓释片」「摆烂颗粒」，≤8字",
  "ingredients": [["成分名≤6字", 百分比整数], ...] 共4到5项，百分比加起来正好100,
  "appearance": "性状，≤26字",
  "indications": "适应症，≤30字",
  "dosage": "用法用量，≤30字",
  "adverse": "不良反应，≤34字",
  "contra": "禁忌，≤24字",
  "cautions": "注意事项，≤34字",
  "storage": "贮藏，≤20字",
  "slogan": "一句极短的英文广告语，全大写，≤5个单词"
}}
"""


def _id(phrase: str) -> str:
    from .library import make_id
    return make_id(phrase)


def path_for(phrase: str) -> str:
    return os.path.join(LEAFLETS, _id(phrase) + ".json")


def load(phrase: str) -> dict | None:
    p = path_for(phrase)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return None


def _parse(text: str) -> dict | None:
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except json.JSONDecodeError:
        return None
    if not all(k in d for k in FIELDS):
        return None
    ing = [[str(a), int(b)] for a, b in d["ingredients"] if str(a)]
    if not ing:
        return None
    total = sum(b for _, b in ing) or 1
    if total != 100:  # normalise, keep integers summing to 100
        ing = [[a, round(b * 100 / total)] for a, b in ing]
        ing[0][1] += 100 - sum(b for _, b in ing)
    d["ingredients"] = ing
    return {k: d[k] for k in FIELDS}


def _codex(prompt: str, parse, timeout: int = 300):
    """Run codex text-only, twice at most, until `parse` accepts its last message."""
    for _ in range(2):
        with tempfile.TemporaryDirectory() as tmp:
            last = os.path.join(tmp, "last.txt")
            cmd = ["codex", "exec", "--skip-git-repo-check", "-s", "read-only",
                   "-c", 'model_reasoning_effort="low"', "-C", tmp, "-o", last, prompt]
            try:
                subprocess.run(cmd, cwd=tmp, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, timeout=timeout, check=False)
            except subprocess.TimeoutExpired:
                print("  codex timed out", file=sys.stderr)
                continue
            if os.path.exists(last):
                with open(last, encoding="utf-8", errors="ignore") as f:
                    d = parse(f.read())
                if d:
                    return d
    return None


def write_with_codex(phrase: str, en: str = "", timeout: int = 300) -> dict | None:
    prompt = PROMPT_TMPL.format(phrase=phrase, en=f"（{en}）" if en else "")
    return _codex(prompt, _parse, timeout)



_lock = threading.Lock()
_pending: dict[str, dict] = {}


def generate(phrase: str, en: str = "") -> dict:
    """Blocking. Returns {"status": "ready", ...leaflet} or {"status": "failed"}."""
    got = load(phrase)
    if got:
        return got
    key = _id(phrase)
    with _lock:
        _pending[key] = {"phrase": phrase, "status": "pending"}
    try:
        d = write_with_codex(phrase, en)
        if not d:
            with _lock:
                _pending[key] = {"phrase": phrase, "status": "failed"}
            return _pending[key]
        d = {"phrase": phrase, "en": en, **d, "status": "ready",
             "created": dt.datetime.now().isoformat(timespec="seconds")}
        os.makedirs(LEAFLETS, exist_ok=True)
        with open(path_for(phrase), "w", encoding="utf-8") as f:
            json.dump(d, f, ensure_ascii=False, indent=2)
        with _lock:
            _pending.pop(key, None)
        return d
    except Exception:
        with _lock:
            _pending[key] = {"phrase": phrase, "status": "failed"}
        raise


def status(phrase: str) -> dict:
    got = load(phrase)
    if got:
        return got
    with _lock:
        return _pending.get(_id(phrase), {"phrase": phrase, "status": "missing"})
