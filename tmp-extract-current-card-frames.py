from __future__ import annotations

import base64
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
HTML = ROOT / "table-tennis-elo.html"
OUT = ROOT / "tmp-card-preview" / "current-embedded-frames"
OUT.mkdir(parents=True, exist_ok=True)

text = HTML.read_text(encoding="utf-8")
block = re.search(r"const CARD_FRAME_TIERS = \{(.*?)\};", text, re.S)
if not block:
    raise SystemExit("CARD_FRAME_TIERS not found")

items = re.findall(r"\b(bronze|silver|gold|plat|dia)\s*:\s*'([^']+)'", block.group(1))
order = ["bronze", "silver", "gold", "plat", "dia"]
names = {"bronze": "BRONZE", "silver": "SILVER", "gold": "GOLD", "plat": "PLATINUM", "dia": "DIAMOND"}
by_key = {k: b64 for k, b64 in items}
frames = []

for key in order:
    raw = base64.b64decode(by_key[key])
    path = OUT / f"{key}.webp"
    path.write_bytes(raw)
    im = Image.open(path).convert("RGB")
    frames.append((key, im))

thumbs = []
for key, im in frames:
    t = im.resize((206, 310), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (226, 352), (7, 12, 18))
    canvas.paste(t, (10, 8))
    d = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 18)
    except Exception:
        font = ImageFont.load_default()
    d.text((113, 332), names[key], anchor="mm", fill=(238, 246, 255), font=font)
    thumbs.append(canvas)

sheet = Image.new("RGB", (len(thumbs) * 226, 352), (7, 12, 18))
for i, t in enumerate(thumbs):
    sheet.paste(t, (i * 226, 0))
sheet.save(OUT / "embedded-frame-preview.png", quality=94)
print(OUT / "embedded-frame-preview.png")
