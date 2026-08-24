from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import shutil

items = [
    ("01 이균호", Path("tmp-card-preview/top5-source-refs/01-이균호.jpg"), Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06\call_ZF6P2iz5rtmsMNAnNWeem7FD.png")),
    ("02 윤경배", Path("tmp-card-preview/top5-source-refs/02-윤경배.jpg"), Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06\call_BIMKNUN4bHLTLAE2E8qbqw5K.png")),
    ("03 서호철", Path("tmp-card-preview/top5-source-refs/03-서호철.jpg"), Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06\call_Yk3lllpJN8hpTyJnevcktpO5.png")),
    ("04 안치훈", Path("tmp-card-preview/top5-source-refs/04-안치훈.jpg"), Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06\call_zxZoH6Rd8MkptscWBHtZknXh.png")),
    ("05 김재훈", Path("tmp-card-preview/top5-source-refs/05-김재훈.jpg"), Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06\call_HS4rrQK0VOF0yQb6kEpvnB18.png")),
]

out_dir = Path("tmp-card-preview/top5-review")
out_dir.mkdir(parents=True, exist_ok=True)
for label, _, gen in items:
    no = label.split()[0]
    shutil.copy2(gen, out_dir / f"{no}-character.png")

col_w, ref_h, char_h = 250, 170, 350
pad, label_h, gap = 18, 32, 12
w = pad + len(items) * (col_w + pad)
h = pad + label_h + ref_h + gap + char_h + pad
sheet = Image.new("RGB", (w, h), (18, 22, 26))
draw = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("malgun.ttf", 17)
except Exception:
    font = ImageFont.load_default()

def fit_box(path, box, bg=(32, 39, 45)):
    im = Image.open(path).convert("RGBA")
    im.thumbnail(box, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", box, bg + (255,))
    canvas.paste(im, ((box[0] - im.width) // 2, (box[1] - im.height) // 2), im)
    return canvas.convert("RGB")

for idx, (label, ref, gen) in enumerate(items):
    x = pad + idx * (col_w + pad)
    draw.text((x, pad), label, fill=(232, 241, 246), font=font)
    sheet.paste(fit_box(ref, (col_w, ref_h)), (x, pad + label_h))
    sheet.paste(fit_box(gen, (col_w, char_h), (245, 247, 249)), (x, pad + label_h + ref_h + gap))

out = out_dir / "top5-character-review.jpg"
sheet.save(out, quality=92)
print(out.resolve())
