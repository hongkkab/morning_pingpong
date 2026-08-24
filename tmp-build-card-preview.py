from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import numpy as np

ROOT = Path(r"C:\Users\hek72\.codex\generated_images\019ff964-d60f-7890-aa8f-7bf8e3d9cf06")
OUT = Path(r"C:\Users\hek72\Downloads\모닝\tmp-card-preview")
CHAR_DIR = OUT / "chars"
CHAR_DIR.mkdir(parents=True, exist_ok=True)

items = [
    ("01", "이균호", "포핸드 드라이브", "silver", "call_mkP7Q4BpKnjrDo6o528f34KV.png"),
    ("02", "윤경배", "펜홀더 포핸드 커트", "bronze", "call_U4cYKiamH48J8VvqaW4QJpuK.png"),
    ("03", "서호철", "펜홀더 포핸드 드라이브", "gold", "call_jYHkibVU26JQguZwCHTMvDLA.png"),
    ("04", "안치훈", "포핸드 스매시", "silver", "call_hEvTY1UAaNr249aM5PDyAcn1.png"),
    ("05", "김재훈", "펜홀더 백핸드 드라이브", "bronze", "call_VyxJo2IlkYohsS49P2PewSEL.png"),
    ("06", "정기진", "백핸드 드라이브", "silver", "call_gC8SnKZ6lcTRZEfzNxMywESI.png"),
    ("07", "동종성", "서브", "silver", "call_afotprXFTAiaz7HOomEmvrZF.png"),
    ("08", "안혜경", "백핸드 커트", "bronze", "call_s7h95FY0VEmg9ATIm3alJJhw.png"),
    ("09", "곽명훈", "포핸드 커트", "silver", "call_nvcOKALgo2Kz4RTjvPzIys1s.png"),
    ("10", "조대우", "백핸드 스매시", "silver", "call_jLgmVXxTECN8of7doLibKNF1.png"),
]

colors = {
    "bronze": ((42, 102, 155), (200, 121, 63)),
    "silver": ((35, 94, 164), (215, 226, 236)),
    "gold": ((32, 100, 176), (240, 200, 79)),
}

def checker_to_alpha(im):
    im = im.convert("RGBA")
    arr = np.array(im)
    if im.mode == "RGBA" and arr[:, :, 3].min() < 250:
        return im
    rgb = arr[:, :, :3].astype(np.int16)
    mean = rgb.mean(axis=2)
    spread = rgb.max(axis=2) - rgb.min(axis=2)
    # Built-in generation sometimes bakes a white/gray checkerboard. Flood-fill only edge-connected pale neutral pixels.
    cand = (mean > 178) & (spread < 46)
    h, w = cand.shape
    bg = np.zeros((h, w), dtype=bool)
    stack = []
    for x in range(w):
        if cand[0, x]: stack.append((0, x)); bg[0, x] = True
        if cand[h - 1, x]: stack.append((h - 1, x)); bg[h - 1, x] = True
    for y in range(h):
        if cand[y, 0] and not bg[y, 0]: stack.append((y, 0)); bg[y, 0] = True
        if cand[y, w - 1] and not bg[y, w - 1]: stack.append((y, w - 1)); bg[y, w - 1] = True
    while stack:
        y, x = stack.pop()
        for ny, nx in ((y+1,x),(y-1,x),(y,x+1),(y,x-1)):
            if 0 <= ny < h and 0 <= nx < w and cand[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = True
                stack.append((ny, nx))
    alpha = np.where(bg, 0, 255).astype("uint8")
    mask = Image.fromarray(alpha, "L").filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.4))
    arr[:, :, 3] = np.array(mask)
    return Image.fromarray(arr, "RGBA")

def crop_alpha(im):
    bbox = im.getbbox()
    if not bbox:
        return im
    l, t, r, b = bbox
    pad = 18
    return im.crop((max(0, l-pad), max(0, t-pad), min(im.width, r+pad), min(im.height, b+pad)))

def load_font(size, bold=False):
    for p in [
        r"C:\Windows\Fonts\malgunbd.ttf" if bold else r"C:\Windows\Fonts\malgun.ttf",
        r"C:\Windows\Fonts\arialbd.ttf" if bold else r"C:\Windows\Fonts\arial.ttf",
    ]:
        if Path(p).exists():
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

name_font = load_font(22, True)
small_font = load_font(14, False)

cards = []
for no, name, pose, tier, fn in items:
    im = checker_to_alpha(Image.open(ROOT / fn))
    im = crop_alpha(im)
    im.save(CHAR_DIR / f"{no}-{name}.png")

    bg1, metal = colors[tier]
    card = Image.new("RGBA", (280, 390), (5, 12, 22, 255))
    dr = ImageDraw.Draw(card)
    for y in range(card.height):
        a = y / card.height
        col = tuple(int(bg1[i]*(1-a) + 8*a) for i in range(3))
        dr.line((0, y, card.width, y), fill=col+(255,))
    dr.rounded_rectangle((5, 5, 275, 385), radius=14, outline=metal+(255,), width=4)
    dr.rounded_rectangle((13, 13, 267, 377), radius=10, outline=(255,255,255,70), width=1)
    thumb = im.copy()
    thumb.thumbnail((250, 300), Image.LANCZOS)
    x = (card.width - thumb.width) // 2
    y = 50 + (275 - thumb.height) // 2
    card.alpha_composite(thumb, (x, y))
    dr.rounded_rectangle((18, 326, 262, 370), radius=9, fill=(4, 13, 27, 218), outline=metal+(190,), width=1)
    dr.text((28, 330), f"{no} {name}", font=name_font, fill=(245, 250, 255, 255))
    dr.text((28, 356), pose, font=small_font, fill=(154, 204, 238, 255))
    cards.append(card)

sheet = Image.new("RGBA", (5*300, 2*420), (8, 15, 24, 255))
for idx, card in enumerate(cards):
    sheet.alpha_composite(card, ((idx % 5) * 300 + 10, (idx // 5) * 420 + 10))
sheet.save(OUT / "top10-character-preview.png")
print(OUT / "top10-character-preview.png")
