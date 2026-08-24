from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"C:\Users\hek72\Downloads\모닝")
SRC = ROOT / "tmp-card-preview" / "top50" / "chars"
OUT = ROOT / "tmp-card-preview" / "attendance-top5"
CHAR_OUT = OUT / "chars"
FRAME_DIR = ROOT / "tmp-card-preview" / "card-frames-v2"

ITEMS = [
    {
        "rank": 1,
        "id": "p_msdxylg84qsjp",
        "name": "이균호",
        "bu": 8,
        "src": SRC / "01-p_msdxylg84qsjp.png",
        "frame": FRAME_DIR / "silver-arena-power-v6.png",
    },
    {
        "rank": 2,
        "id": "p_msdz95a1u7za2",
        "name": "윤경배",
        "bu": 9,
        "src": SRC / "02-p_msdz95a1u7za2.png",
        "frame": FRAME_DIR / "bronze-arena-power-v6.png",
    },
    {
        "rank": 3,
        "id": "p_msdz9xa1t8adp",
        "name": "김재훈",
        "bu": 9,
        "src": SRC / "05-p_msdz9xa1t8adp.png",
        "frame": FRAME_DIR / "bronze-arena-power-v6.png",
    },
    {
        "rank": 4,
        "id": "p_msdzt8fpk7h67",
        "name": "동종성",
        "bu": 8,
        "src": SRC / "07-p_msdzt8fpk7h67.png",
        "frame": FRAME_DIR / "silver-arena-power-v6.png",
    },
    {
        "rank": 5,
        "id": "p_msjq6w145w8fo",
        "name": "안혜경",
        "bu": 9,
        "src": SRC / "08-p_msjq6w145w8fo.png",
        "frame": FRAME_DIR / "bronze-arena-power-v6.png",
    },
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def trim_alpha(im: Image.Image, pad: int = 10) -> Image.Image:
    im = im.convert("RGBA")
    box = im.getchannel("A").getbbox()
    if not box:
        return im
    l, t, r, b = box
    return im.crop((max(0, l - pad), max(0, t - pad), min(im.width, r + pad), min(im.height, b + pad)))


def outline_char(im: Image.Image, color: tuple[int, int, int, int]) -> Image.Image:
    alpha = im.getchannel("A")
    rim = Image.new("RGBA", im.size, (0, 0, 0, 0))
    for dx, dy in [(-2, 0), (2, 0), (0, -2), (0, 2), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
        layer = Image.new("RGBA", im.size, color)
        layer.putalpha(alpha.filter(ImageFilter.GaussianBlur(0.35)))
        rim.alpha_composite(layer, (dx, dy))
    rim.alpha_composite(im)
    return rim


def make_card(item: dict) -> Image.Image:
    frame = Image.open(item["frame"]).convert("RGBA")
    char = trim_alpha(Image.open(item["src"]))
    target = (
        int(frame.width * 0.05),
        int(frame.height * 0.15),
        int(frame.width * 0.95),
        int(frame.height * 0.838),
    )
    max_w = int((target[2] - target[0]) * 1.14)
    max_h = target[3] - target[1]
    scale = min(max_w / char.width, max_h / char.height)
    char = char.resize((round(char.width * scale), round(char.height * scale)), Image.Resampling.LANCZOS)
    rim = (190, 220, 242, 245) if item["bu"] == 8 else (230, 150, 80, 245)
    char = outline_char(char, rim)

    card = frame.copy()
    x = (frame.width - char.width) // 2
    y = target[3] - char.height
    card.alpha_composite(char, (x, y))

    d = ImageDraw.Draw(card)
    name_font = font(72, True)
    sub_font = font(30, True)
    rank_font = font(44, True)
    d.rounded_rectangle((72, 72, 190, 190), radius=20, fill=(5, 15, 30, 205), outline=rim, width=4)
    d.text((131, 102), str(item["rank"]), fill=(255, 255, 255), font=rank_font, anchor="mm")
    d.text((frame.width // 2, frame.height - 180), item["name"], fill=(255, 255, 255), font=name_font, anchor="mm")
    d.text((frame.width // 2, frame.height - 108), f"출석 {item['rank']}위 · {item['bu']}부", fill=(220, 235, 255), font=sub_font, anchor="mm")
    return card


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    CHAR_OUT.mkdir(parents=True, exist_ok=True)
    cards = []
    for item in ITEMS:
        char_path = CHAR_OUT / f"{item['rank']:02d}-{item['id']}.png"
        trim_alpha(Image.open(item["src"])).save(char_path)
        card = make_card(item)
        card_path = OUT / f"{item['rank']:02d}-{item['id']}-preview.png"
        card.save(card_path)
        cards.append(card.resize((300, 450), Image.Resampling.LANCZOS))

    gap = 22
    sheet = Image.new("RGB", (len(cards) * 300 + (len(cards) - 1) * gap, 450), (10, 15, 22))
    for i, card in enumerate(cards):
        sheet.paste(card.convert("RGB"), (i * (300 + gap), 0))
    sheet.save(OUT / "attendance-top5-card-preview.png", quality=92)


if __name__ == "__main__":
    main()
