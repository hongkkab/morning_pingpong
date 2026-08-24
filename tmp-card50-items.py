from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
OUT = ROOT / "tmp-card-preview" / "top50"
RANKING = OUT / "top50-by-games.json"
CHAR_DIR = OUT / "chars"

rows = json.loads(RANKING.read_text(encoding="utf-8"))
items = []
missing = []
for r in rows[:50]:
    path = CHAR_DIR / f"{int(r['rank']):02d}-{r['id']}.png"
    if path.exists():
        items.append({"rank": r["rank"], "id": r["id"], "name": r["name"], "path": str(path)})
    else:
        missing.append({"rank": r["rank"], "id": r["id"], "name": r["name"]})

out = OUT / "generated-items.json"
out.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"items": len(items), "missing": missing, "path": str(out)}, ensure_ascii=False, indent=2))
