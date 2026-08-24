from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-dynamic-pose-card-base-v6.png"
OUT = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-dynamic-pose-card-v6.png"


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


def main() -> None:
    im = Image.open(SRC).convert("RGBA")
    draw = ImageDraw.Draw(im)
    w, h = im.size
    sx = w / 1024
    sy = h / 1536

    # Rank number in the generated bronze shield.
    draw.text((128 * sx, 156 * sy), "2", font=font(int(60 * sx), True), fill=(255, 255, 255, 255), anchor="mm")

    # Lower plate text. Keep it compact so the generated plate remains visible.
    draw.text((92 * sx, 1320 * sy), "'26 08", font=font(int(30 * sx), True), fill=(210, 237, 255, 255))
    draw.text((270 * sx, 1312 * sy), "윤경배", font=font(int(60 * sx), True), fill=(255, 255, 255, 255))
    draw.text((92 * sx, 1398 * sy), "9부 · R · pen", font=font(int(28 * sx)), fill=(150, 211, 238, 255))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(OUT, quality=94)
    print(OUT)


if __name__ == "__main__":
    main()
