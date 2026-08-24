from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

items = [
    ("01 이균호", Path("tmp-card-preview/top5-source-refs/01-이균호.jpg")),
    ("02 윤경배", Path("tmp-card-preview/top5-source-refs/02-윤경배.jpg")),
    ("03 서호철", Path("tmp-card-preview/top5-source-refs/03-서호철.jpg")),
    ("04 안치훈", Path("tmp-card-preview/top5-source-refs/04-안치훈.jpg")),
    ("05 김재훈", Path("tmp-card-preview/top5-source-refs/05-김재훈.jpg")),
]

thumb_w, thumb_h = 220, 220
pad, label_h = 18, 32
sheet = Image.new("RGB", (pad + len(items) * (thumb_w + pad), pad * 2 + label_h + thumb_h), (18, 22, 26))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("malgun.ttf", 17)
except Exception:
    font = ImageFont.load_default()

for idx, (label, path) in enumerate(items):
    x = pad + idx * (thumb_w + pad)
    y = pad + label_h
    im = Image.open(path).convert("RGB")
    im.thumbnail((thumb_w, thumb_h), Image.Resampling.LANCZOS)
    bg = Image.new("RGB", (thumb_w, thumb_h), (32, 39, 45))
    bg.paste(im, ((thumb_w - im.width) // 2, (thumb_h - im.height) // 2))
    sheet.paste(bg, (x, y))
    draw.text((x, pad), label, fill=(232, 241, 246), font=font)

out = Path("tmp-card-preview/top5-source-refs/contact-sheet.jpg")
sheet.save(out, quality=92)
print(out.resolve())
