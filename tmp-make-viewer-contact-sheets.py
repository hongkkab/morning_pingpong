from PIL import Image, ImageDraw, ImageFont
import json
import os
from pathlib import Path

base = Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "codex-quickmeet-band-deep" / "viewer-media"
out = base / "contact-sheets"
out.mkdir(parents=True, exist_ok=True)

try:
    font = ImageFont.truetype("arial.ttf", 15)
except Exception:
    font = ImageFont.load_default()

for post_dir in sorted([p for p in base.iterdir() if p.is_dir() and p.name != "contact-sheets"]):
    post = post_dir.name
    image_json = base / post / "images.json"
    if not image_json.exists():
        continue
    rows = json.loads(image_json.read_text(encoding="utf-8"))
    valid = []
    for row in rows:
        file = Path(row.get("file", ""))
        if not file.exists() or file.stat().st_size < 10000:
            continue
        try:
            with Image.open(file) as im:
                w, h = im.size
        except Exception:
            continue
        valid.append((row, w, h))
    cols, tw, th, lh = 4, 260, 190, 32
    nrows = (len(valid) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw, max(1, nrows) * (th + lh)), "white")
    draw = ImageDraw.Draw(sheet)
    for idx, (row, w, h) in enumerate(valid):
        file = Path(row["file"])
        img = Image.open(file).convert("RGB")
        img.thumbnail((tw, th), Image.LANCZOS)
        x = (idx % cols) * tw + (tw - img.width) // 2
        y = (idx // cols) * (th + lh) + lh
        sheet.paste(img, (x, y))
        page = row.get("page") or {}
        label = f"{idx+1}: {file.name} {w}x{h} p{page.get('current','')}/{page.get('total','')}"
        draw.text(((idx % cols) * tw + 4, (idx // cols) * (th + lh) + 4), label, fill=(0, 0, 0), font=font)
    target = out / f"{post}.jpg"
    sheet.save(target, quality=90)
    print(target)
