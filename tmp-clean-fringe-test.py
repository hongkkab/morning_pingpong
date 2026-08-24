from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "top50" / "chars" / "03-p_msjq6v7y5ixgz.png"
OUT = ROOT / "tmp-card-preview" / "top50" / "white-fringe-clean-tests-03.png"


def checker(size: tuple[int, int]) -> Image.Image:
    bg = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(bg)
    step = 20
    for y in range(0, size[1], step):
        for x in range(0, size[0], step):
            color = (43, 54, 64, 255) if ((x // step + y // step) % 2) else (22, 31, 39, 255)
            draw.rectangle([x, y, x + step - 1, y + step - 1], fill=color)
    return bg


def clean(im: Image.Image, erode: int, mean_t: int, spread_t: int, band: int) -> Image.Image:
    arr = np.array(im.convert("RGBA"))
    alpha = arr[:, :, 3]
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    inside = alpha > 12
    core = np.array(
        Image.fromarray(np.where(inside, 255, 0).astype("uint8"), "L").filter(ImageFilter.MinFilter(band))
    ) > 128
    edge = inside & ~core
    white = (mean > mean_t) & (spread < spread_t)
    arr[:, :, 3] = np.where(edge & white, 0, alpha)
    mask = Image.fromarray(arr[:, :, 3], "L")
    if erode > 1:
        mask = mask.filter(ImageFilter.MinFilter(erode))
    mask = mask.filter(ImageFilter.GaussianBlur(0.25))
    arr[:, :, 3] = np.array(mask)
    return Image.fromarray(arr, "RGBA")


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    variants = [
        ("orig", im),
        ("band7", clean(im, 1, 190, 70, 7)),
        ("band9", clean(im, 1, 185, 80, 9)),
        ("band11", clean(im, 1, 180, 88, 11)),
        ("band9-erode3", clean(im, 3, 185, 80, 9)),
        ("band11-erode3", clean(im, 3, 180, 88, 11)),
    ]
    cell = (260, 360)
    sheet = Image.new("RGB", (cell[0] * 3, cell[1] * 2), (18, 25, 32))
    for i, (name, img) in enumerate(variants):
        bg = checker(cell)
        pic = img.copy()
        pic.thumbnail((cell[0] - 16, cell[1] - 28), Image.Resampling.LANCZOS)
        bg.alpha_composite(pic, ((cell[0] - pic.width) // 2, 24))
        ImageDraw.Draw(bg).text((4, 4), name, fill=(255, 240, 0))
        sheet.paste(bg.convert("RGB"), ((i % 3) * cell[0], (i // 3) * cell[1]))
    sheet.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
