from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SCENE = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-character-swap-original-pose-v1.png"
FRAME = ROOT / "tmp-card-preview" / "card-frames" / "bronze.webp"
OUT = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-original-pose-in-card-v1.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    paths = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for item in paths:
        p = Path(item)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def cover(im: Image.Image, size: tuple[int, int], focus_x: float = 0.5, focus_y: float = 0.5) -> Image.Image:
    src = im.convert("RGBA")
    tw, th = size
    scale = max(tw / src.width, th / src.height)
    rw, rh = round(src.width * scale), round(src.height * scale)
    src = src.resize((rw, rh), Image.LANCZOS)
    max_x = max(0, rw - tw)
    max_y = max(0, rh - th)
    left = round(max_x * focus_x)
    top = round(max_y * focus_y)
    return src.crop((left, top, left + tw, top + th))


def restore_frame_parts(card: Image.Image, frame: Image.Image) -> None:
    # Restore the opaque visual frame and lower plate that the art fill covered.
    masks = Image.new("L", card.size, 0)
    d = ImageDraw.Draw(masks)
    w, h = card.size
    d.rectangle((0, 0, w, 34), fill=255)
    d.rectangle((0, h - 34, w, h), fill=255)
    d.rectangle((0, 0, 35, h), fill=255)
    d.rectangle((w - 35, 0, w, h), fill=255)
    d.rounded_rectangle((42, 598, 470, 724), radius=8, fill=255)
    d.rectangle((34, 590, 478, 628), fill=255)
    poly = Image.new("L", card.size, 0)
    pd = ImageDraw.Draw(poly)
    pd.polygon(((45, 35), (184, 35), (184, 130), (116, 182), (45, 130)), fill=255)
    arr = np.array(frame.convert("RGBA"))
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    bronze = (rgb[:, :, 0] > 75) & (rgb[:, :, 1] > 35) & (rgb[:, :, 0] > rgb[:, :, 2] + 20)
    bright = mean > 175
    shield = (bronze | bright) & (np.array(poly) > 0)
    mask_arr = np.maximum(np.array(masks), np.where(shield, 255, 0).astype("uint8"))
    masks = Image.fromarray(mask_arr, "L")
    card.paste(frame, (0, 0), masks)


def main() -> None:
    frame = Image.open(FRAME).convert("RGBA").resize((512, 768), Image.LANCZOS)
    scene = Image.open(SCENE).convert("RGBA")
    card = frame.copy()

    art_box = (28, 30, 484, 610)
    art_w = art_box[2] - art_box[0]

    # Keep the original successful pose: wide scene, racket left, face right, net in the lower art area.
    # A slight vertical stretch is preferable here because it preserves the full left-to-right action
    # inside a portrait card without cutting off the racket or face.
    sharp = scene.resize((art_w, 500), Image.LANCZOS)
    scene_pos = (art_box[0], 96)
    card.alpha_composite(sharp, scene_pos)

    restore_frame_parts(card, frame)

    draw = ImageDraw.Draw(card)
    draw.text((116, 124), "2", font=font(40, True), fill=(255, 255, 255, 255), anchor="mm")
    draw.text((75, 642), "'26 08", font=font(23, True), fill=(210, 237, 255, 255))
    draw.text((180, 634), "윤경배", font=font(44, True), fill=(255, 255, 255, 255))
    draw.text((75, 688), "9부 · R · pen", font=font(21), fill=(150, 211, 238, 255))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.convert("RGB").save(OUT, quality=94)
    print(OUT)


if __name__ == "__main__":
    main()
