from __future__ import annotations

import base64
from pathlib import Path

from PIL import Image

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
GEN = Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06")
OUT = ROOT / "tmp-card-preview" / "card-frames"
OUT.mkdir(parents=True, exist_ok=True)

SOURCES = {
    "bronze": GEN / "call_q04Vei8QonN7ymz76CmBLoTA.png",
    "silver": GEN / "call_g67urCY4ScJa1N6PImOmMqEM.png",
    "gold": GEN / "call_FFR3EOlTYf5eazwoS3epqvmM.png",
    "plat": GEN / "call_m9iYwbfBYdhmdYuKaTR8tG0u.png",
    "dia": GEN / "call_IxEWRwdKfHucX5OmADiab46x.png",
}

items = {}
for key, src in SOURCES.items():
    im = Image.open(src).convert("RGB").resize((516, 774), Image.Resampling.LANCZOS)
    out = OUT / f"{key}.webp"
    im.save(out, "WEBP", quality=82, method=6)
    items[key] = base64.b64encode(out.read_bytes()).decode("ascii")
    print(out, out.stat().st_size)

js = "const CARD_FRAME_TIERS = {\n" + ",\n".join(
    f"  {key}:'{val}'" for key, val in items.items()
) + "\n};\nconst cardFrameSrc = t => 'data:image/webp;base64,'+(CARD_FRAME_TIERS[(t&&t.k)||'']||CARD_FRAME_TIERS.bronze);\n"
(OUT / "card-frame-tiers.js").write_text(js, encoding="utf-8")
print(OUT / "card-frame-tiers.js")
