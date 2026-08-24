from PIL import Image, ImageDraw, ImageFont
import json
import os
from pathlib import Path

base = Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "codex-quickmeet-band-deep" / "clicked-result-posts"
out_base = base / "contact-sheets"
out_base.mkdir(parents=True, exist_ok=True)

try:
    font = ImageFont.truetype("arial.ttf", 16)
except Exception:
    font = ImageFont.load_default()

for post in ["926087933", "926087969", "926088102"]:
    image_json = base / post / "images.json"
    if not image_json.exists():
        continue
    rows = json.loads(image_json.read_text(encoding="utf-8"))
    unique = {}
    for row in rows:
        file = row.get("file")
        if not file or not Path(file).exists():
            continue
        if row.get("w", 0) < 500 or row.get("h", 0) < 500 or row.get("size", 0) < 40000:
            continue
        key = row.get("src") or file
        if key not in unique:
            unique[key] = row
    images = list(unique.values())[:80]
    thumb_w, thumb_h = 260, 190
    label_h = 30
    cols = 4
    rows_count = (len(images) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, max(1, rows_count) * (thumb_h + label_h)), "white")
    draw = ImageDraw.Draw(sheet)
    for idx, row in enumerate(images):
        file = Path(row["file"])
        try:
            img = Image.open(file).convert("RGB")
        except Exception:
            continue
        img.thumbnail((thumb_w, thumb_h), Image.LANCZOS)
        x = (idx % cols) * thumb_w + (thumb_w - img.width) // 2
        y = (idx // cols) * (thumb_h + label_h) + label_h
        sheet.paste(img, (x, y))
        label = f"{idx+1}: {file.name} {row.get('w')}x{row.get('h')}"
        draw.text(((idx % cols) * thumb_w + 4, (idx // cols) * (thumb_h + label_h) + 4), label, fill=(0, 0, 0), font=font)
    out = out_base / f"{post}.jpg"
    sheet.save(out, quality=90)
    print(out)

card_882 = Path(os.environ.get("LOCALAPPDATA", "")) / "Temp" / "codex-quickmeet-band-deep" / "card-images-926087882"
image_json = card_882 / "images.json"
if image_json.exists():
    rows = [row for row in json.loads(image_json.read_text(encoding="utf-8")) if row.get("file") and Path(row["file"]).exists()]
    thumb_w, thumb_h = 260, 190
    label_h = 30
    cols = 4
    rows_count = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * thumb_w, max(1, rows_count) * (thumb_h + label_h)), "white")
    draw = ImageDraw.Draw(sheet)
    for idx, row in enumerate(rows):
        file = Path(row["file"])
        try:
            img = Image.open(file).convert("RGB")
        except Exception:
            continue
        img.thumbnail((thumb_w, thumb_h), Image.LANCZOS)
        x = (idx % cols) * thumb_w + (thumb_w - img.width) // 2
        y = (idx // cols) * (thumb_h + label_h) + label_h
        sheet.paste(img, (x, y))
        label = f"{idx+1}: {file.name} {row.get('w')}x{row.get('h')}"
        draw.text(((idx % cols) * thumb_w + 4, (idx // cols) * (thumb_h + label_h) + 4), label, fill=(0, 0, 0), font=font)
    out = out_base / "926087882-card.jpg"
    sheet.save(out, quality=90)
    print(out)
