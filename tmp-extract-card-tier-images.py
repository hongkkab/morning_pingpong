from __future__ import annotations

import base64
import re
from pathlib import Path

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
HTML = ROOT / "table-tennis-elo.html"
OUT = ROOT / "tmp-card-preview" / "tier-source"
OUT.mkdir(parents=True, exist_ok=True)

text = HTML.read_text(encoding="utf-8")
items = re.findall(r"\{k:'([^']+)'\s*,\s*n:'([^']+)'\s*,\s*bu:\[[^\]]+\]\s*,\s*img:'([^']+)'\}", text, re.S)
for key, name, b64 in items:
    path = OUT / f"{key}-{name}.webp"
    path.write_bytes(base64.b64decode(b64))
    print(path)
