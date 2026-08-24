from pathlib import Path
from PIL import Image, ImageDraw

root = Path(r"C:\Users\hek72\Downloads\모닝")
paths = [
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-bfb3f7d1-fb65-41ef-8e57-1c5fb8296929.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-40465fe0-5042-46d9-9458-f3421ced8cfe.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-0d2f0f57-0c15-47fa-b351-8af01edcf8ba.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-875d45af-780d-40db-a196-55c7a6977c29.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-cc4c9505-e446-44c9-a835-ced6d2ce74fa.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-9cfe55e6-cb12-4148-9f0b-dcc4f79e2001.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-1a86eb57-5478-4acd-b4fc-4c75e71895cd.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-0aa1eaaa-c46a-4004-bd0d-2c98a840b69b.png"),
]

thumb_w, thumb_h = 360, 300
cols = 4
rows = 2
pad = 18
label_h = 34
canvas = Image.new("RGB", (cols * thumb_w + (cols + 1) * pad, rows * (thumb_h + label_h) + (rows + 1) * pad), "white")
draw = ImageDraw.Draw(canvas)

for i, path in enumerate(paths):
    img = Image.open(path).convert("RGB")
    img.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    x = pad + (i % cols) * (thumb_w + pad)
    y = pad + (i // cols) * (thumb_h + label_h + pad) + label_h
    bx = x + (thumb_w - img.width) // 2
    by = y + (thumb_h - img.height) // 2
    draw.text((x, y - label_h + 6), f"shakehand reference {i + 1}", fill=(0, 0, 0))
    canvas.paste(img, (bx, by))

out = root / "tmp-card-refs" / "shakehand-user-refs-montage.png"
canvas.save(out)
print(out)
