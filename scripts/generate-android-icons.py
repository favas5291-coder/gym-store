"""Regenerate Android assets from GymDrobe's existing transparent GD monogram."""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "android/app/src/main/res"
SOURCE = Image.open(ROOT / "public/android-chrome-512x512.png").convert("RGBA")
BACKGROUND = "#f5f4ef"


def icon(size, transparent=False):
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0) if transparent else BACKGROUND)
    mark = SOURCE.resize((round(size * .69), round(size * .69)), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return canvas


for density, scale in {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}.items():
    target = RES / f"mipmap-{density}"
    size = round(48 * scale)
    image = icon(size)
    image.save(target / "ic_launcher.png", optimize=True)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    image.putalpha(mask)
    image.save(target / "ic_launcher_round.png", optimize=True)
    icon(round(108 * scale), transparent=True).save(target / "ic_launcher_foreground.png", optimize=True)

for target in RES.glob("drawable*/splash.png"):
    with Image.open(target) as original:
        width, height = original.size
    canvas = Image.new("RGB", (width, height), BACKGROUND)
    mark = SOURCE.copy()
    size = min(320, round(min(width, height) * .23))
    mark.thumbnail((size, size), Image.Resampling.LANCZOS)
    canvas.paste(mark, ((width - mark.width) // 2, (height - mark.height) // 2), mark)
    canvas.save(target, optimize=True)

print("Android launcher and splash assets generated from the existing GD monogram.")
