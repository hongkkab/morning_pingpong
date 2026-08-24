import base64
import json
import re
from pathlib import Path

TOP5 = [
    ("01", "p_msdxylg84qsjp"),
    ("02", "p_msdz95a1u7za2"),
    ("03", "p_msjq6v7y5ixgz"),
    ("04", "p_msdzslncxpa8u"),
    ("05", "p_msdz9xa1t8adp"),
]

src = Path("backup-2026-08-18-before-card-char-rollback.json")
out = Path("tmp-card-preview/top5-refs")
out.mkdir(parents=True, exist_ok=True)

data = json.loads(src.read_text(encoding="utf-8"))
players = data.get("players") or []
by_id = {p.get("id"): p for p in players if isinstance(p, dict)}

summary = []
for no, pid in TOP5:
    p = by_id.get(pid)
    if not p:
        summary.append({"id": pid, "missing": True})
        continue
    val = p.get("cardImg") or p.get("cardImgRef") or ""
    m = re.match(r"data:image/([^;]+);base64,(.*)", val, re.S)
    path = None
    if m:
        ext = "jpg" if m.group(1).lower() == "jpeg" else m.group(1).lower()
        path = out / f"{no}-{p.get('name')}.{ext}"
        path.write_bytes(base64.b64decode(m.group(2)))
    summary.append({
        "no": no,
        "id": pid,
        "name": p.get("name"),
        "bu": p.get("bu"),
        "hand": p.get("hand") or "R",
        "grip": p.get("grip") or "shake",
        "sex": p.get("sex"),
        "ref": str(path) if path else None,
        "hasCardImg": bool(p.get("cardImg")),
        "hasCardImgRef": bool(p.get("cardImgRef")),
    })

print(json.dumps(summary, ensure_ascii=False, indent=2))
