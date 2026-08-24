from pathlib import Path
from PIL import Image

src = Path("tmp-card-refs/penholder-ref.jpg")
out = Path("tmp-card-refs/penholder-grip-ref.jpg")
im = Image.open(src).convert("RGB")
w, h = im.size
crop = im.crop((int(w * 0.14), int(h * 0.43), int(w * 0.50), int(h * 0.70)))
crop.save(out, quality=94)
print(out.resolve())
