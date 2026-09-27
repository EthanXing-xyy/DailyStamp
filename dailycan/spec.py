from __future__ import annotations

from dataclasses import dataclass, asdict, field
import json


@dataclass
class CanSpec:
    no: int                 # running number in the series
    date: str               # YYYY-MM-DD
    phrase: str             # the mood, e.g. 摆烂
    en: str = ""            # romanisation / translation shown small
    palette: str = ""       # palette name
    emblem_prompt: str = "" # what the medallion depicts
    emblem_source: str = "" # "codex" | "fallback"
    brand: str = "每日"
    tagline: str = "DAILY CAN · CONDENSED MOOD · 浓缩情绪"
    fine_print: str = "NET WT. 24 HRS · 开罐即食 · 请勿冷藏"

    def to_json(self) -> str:
        return json.dumps(asdict(self), ensure_ascii=False, indent=2)

    @classmethod
    def from_json(cls, s: str) -> "CanSpec":
        d = json.loads(s)
        return cls(**{k: v for k, v in d.items() if k in cls.__dataclass_fields__})
