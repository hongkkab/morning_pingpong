from pathlib import Path
from PIL import Image, ImageDraw

root = Path(r"C:\Users\hek72\Downloads\모닝")
paths = [
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-7fb3e7c8-50c2-49fc-b7c1-291bf194a85e.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-b93e5d9b-501b-4df8-88e6-df29b3489217.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-3ea59488-1474-4f3f-929f-b8e3b6d4f315.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-f03ae5ac-c84c-4a9d-b1df-0c07c06e4578.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-ee4bd6c3-80ff-47c3-924c-ebf65c6a718e.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-4aef1f84-a314-48a3-ad88-9a66b321ddd0.png"),
    Path(r"C:\Users\hek72\AppData\Local\Temp\codex-clipboard-f1af87da-34ba-49b0-bb63-346329d22f94.png"),
]

thumb_w, thumb_h = 360, 480
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
    draw.text((x, y - label_h + 6), f"penholder reference {i + 1}", fill=(0, 0, 0))
    canvas.paste(img, (bx, by))

out = root / "tmp-card-refs" / "penholder-user-refs-montage.png"
canvas.save(out)
print(out)
