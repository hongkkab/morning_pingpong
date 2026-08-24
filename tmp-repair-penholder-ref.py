from pathlib import Path
from PIL import Image, ImageFile

ImageFile.LOAD_TRUNCATED_IMAGES = True
src = Path("tmp-card-refs/penholder.png")
out = Path("tmp-card-refs/penholder-ref.jpg")
im = Image.open(src).convert("RGB")
im.save(out, quality=92)
print(out.resolve())
