#!/usr/bin/env python3
"""Build approved external GymDrobe icons from the reconstructed SVG source.

The in-store wordmark and native splash are intentionally left unchanged.
The SVG is a trace of an approved mockup, not original master artwork.
"""
from __future__ import annotations
import argparse
import base64
from io import BytesIO
from pathlib import Path
import subprocess
import sys
from PIL import Image, ImageDraw

try:
    import cairosvg
except ModuleNotFoundError:
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cairosvg"])
    import cairosvg

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SVG = PUBLIC / "brand/gymdrobe-app-icon.svg"
LOCKUP = PUBLIC / "brand/gymdrobe-lockup.svg"
DARK = (11, 13, 17, 255)


def rasterize(source: Path, width: int, height: int) -> Image.Image:
    data = cairosvg.svg2png(url=str(source), output_width=width, output_height=height)
    return Image.open(BytesIO(data)).convert("RGBA")


def png(image: Image.Image) -> bytes:
    stream = BytesIO()
    image.convert("RGBA").save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def output_assets(emit_base64=False):
    if not SVG.is_file() or not LOCKUP.is_file():
        raise RuntimeError("Missing approved GymDrobe external source SVG")
    outputs = {}

    def add(path, data):
        outputs[path] = data
        print("ASSET", path, len(data), "bytes")

    master = rasterize(SVG, 1024, 1024)
    for size, name in [
        (16, "favicon-16x16.png"), (32, "favicon-32x32.png"),
        (48, "favicon-48x48.png"), (180, "apple-touch-icon.png"),
        (192, "android-chrome-192x192.png"), (512, "android-chrome-512x512.png")
    ]:
        add("public/" + name, png(master.resize((size, size), Image.Resampling.LANCZOS)))

    ico = BytesIO()
    master.save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    add("public/favicon.ico", ico.getvalue())
    add("public/brand/external/gymdrobe-app-icon-1024.png", png(master))
    add("public/brand/external/gymdrobe-profile-1024.png", png(master))

    # PWA launcher foreground stays within typical platform mask safe zones.
    maskable = Image.new("RGBA", (512, 512), DARK)
    lockup = rasterize(LOCKUP, 335, 119)
    maskable.alpha_composite(lockup, ((512 - 335) // 2, (512 - 119) // 2))
    add("public/brand/external/gymdrobe-maskable-512.png", png(maskable))

    share = Image.new("RGBA", (1200, 630), DARK)
    wordmark = rasterize(LOCKUP, 950, 338)
    share.alpha_composite(wordmark, ((1200 - 950) // 2, (630 - 338) // 2))
    add("public/gymdrobe-share-v2.png", png(share))

    # Launcher only. Existing Android splash images are intentionally preserved.
    for density, scale in [
        ("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2),
        ("xxhdpi", 3), ("xxxhdpi", 4)
    ]:
        folder = f"android/app/src/main/res/mipmap-{density}"
        size = round(48 * scale)
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        add(f"{folder}/ic_launcher.png", png(icon))
        circle = Image.new("L", (size, size), 0)
        ImageDraw.Draw(circle).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon = icon.copy()
        round_icon.putalpha(circle)
        add(f"{folder}/ic_launcher_round.png", png(round_icon))
        fg_size = round(108 * scale)
        foreground = Image.new("RGBA", (fg_size, fg_size), (0, 0, 0, 0))
        mark = rasterize(LOCKUP, round(fg_size * .64), round(fg_size * .23))
        foreground.alpha_composite(
            mark, ((fg_size - mark.width) // 2, (fg_size - mark.height) // 2)
        )
        add(f"{folder}/ic_launcher_foreground.png", png(foreground))

    for path, data in outputs.items():
        file = ROOT / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(data)

    if emit_base64:
        for name, data in outputs.items():
            encoded = base64.b64encode(data).decode("ascii")
            chunks = [encoded[i:i+3000] for i in range(0, len(encoded), 3000)]
            for i, chunk in enumerate(chunks):
                print(f"FAVICON_ASSET|{name}|{i}|{len(chunks)}|{chunk}")
        print("FAVICON_ASSETS_COMPLETE")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit-base64", action="store_true")
    args = parser.parse_args()
    output_assets(args.emit_base64)
