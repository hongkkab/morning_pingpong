from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
FRAME = ROOT / "tmp-card-preview" / "card-frames" / "bronze.webp"
CHAR = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-penholder-card-cutout-v1.png"
OUT = ROOT / "tmp-card-preview" / "posecopy-drafts" / "02-yoon-card-preview-v1.png"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for item in candidates:
        p = Path(item)
        if p.exists():
            return ImageFont.truetype(str(p), size)
    return ImageFont.load_default()


def fit(im: Image.Image, max_w: int, max_h: int) -> Image.Image:
    out = im.convert("RGBA")
    out.thumbnail((max_w, max_h), Image.LANCZOS)
    return out


def add_rim(im: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    alpha = im.getchannel("A")
    rim = alpha.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(1.1))
    shadow = alpha.filter(ImageFilter.GaussianBlur(8))
    canvas = Image.new("RGBA", im.size, (0, 0, 0, 0))
    shadow_layer = Image.new("RGBA", im.size, (0, 0, 0, 75))
    shadow_layer.putalpha(shadow)
    rim_layer = Image.new("RGBA", im.size, (*color, 85))
    rim_layer.putalpha(rim)
    canvas.alpha_composite(shadow_layer, (0, 8))
    canvas.alpha_composite(rim_layer)
    canvas.alpha_composite(im)
    return canvas


def main() -> None:
    card = Image.open(FRAME).convert("RGBA").resize((512, 768), Image.LANCZOS)
    char = Image.open(CHAR).convert("RGBA")
    char = fit(char, 408, 532)
    char = add_rim(char, (180, 96, 45))

    x = (card.width - char.width) // 2 - 8
    y = 84
    card.alpha_composite(char, (x, y))

    draw = ImageDraw.Draw(card)
    bronze = (205, 124, 66, 255)
    dark = (4, 12, 26, 232)

    # Restore a clean lower information plate above any character overlap.
    draw.rounded_rectangle((56, 626, 456, 714), radius=13, fill=dark, outline=bronze, width=3)
    draw.text((76, 642), "'26 08", font=font(23, True), fill=(210, 237, 255, 255))
    draw.text((182, 636), "윤경배", font=font(42, True), fill=(255, 255, 255, 255))
    draw.text((76, 688), "9부 · R · pen", font=font(20), fill=(150, 211, 238, 255))

    # Rank number in the shield.
    draw.text((96, 118), "2", font=font(44, True), fill=(255, 255, 255, 255), anchor="mm")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.convert("RGB").save(OUT, quality=94)
    print(OUT)


if __name__ == "__main__":
    main()
