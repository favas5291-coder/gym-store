#!/usr/bin/env python3
"""Generate browser and launcher assets from the approved GymDrobe PNG master."""

import argparse
import base64
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MASTER = ROOT / "public/brand/external/gymdrobe-app-icon-1024.png"


def centered(source, size, artwork_width, background):
    canvas = Image.new("RGBA", size, background)
    artwork_height = round(source.height * artwork_width / source.width)
    artwork = source.resize((artwork_width, artwork_height), Image.Resampling.LANCZOS)
    canvas.alpha_composite(artwork, ((size[0] - artwork.width) // 2, (size[1] - artwork.height) // 2))
    return canvas


def output_assets(emit_base64=False):
    master = Image.open(MASTER).convert("RGBA")
    if master.size != (1024, 1024):
        raise ValueError("Expected the 1024 × 1024 GymDrobe brand master")
    green = master.getpixel((0, 0))
    artwork = master.crop((89, 430, 935, 592))
    initial = master.crop((89, 430, 226, 564))
    favicon = centered(initial, (192, 192), 136, green)
    outputs = {}

    def add(path, image):
        stream = BytesIO()
        image.save(stream, format="PNG", optimize=True)
        outputs[path] = stream.getvalue()

    for size in (16, 32, 48):
        add(f"public/favicon-{size}x{size}.png", favicon.resize((size, size), Image.Resampling.LANCZOS))
    ico = BytesIO()
    favicon.save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    outputs["public/favicon.ico"] = ico.getvalue()

    for size, name in [(180, "apple-touch-icon.png"), (192, "android-chrome-192x192.png"),
                       (512, "android-chrome-512x512.png")]:
        add(f"public/{name}", master.resize((size, size), Image.Resampling.LANCZOS))
    outputs["public/brand/external/gymdrobe-profile-1024.png"] = MASTER.read_bytes()
    maskable = centered(artwork, (512, 512), 335, green)
    add("public/brand/external/gymdrobe-maskable-512.png", maskable)
    add("public/gymdrobe-share-v2.png", centered(artwork, (1200, 630), 960, green))

    # Native launcher tiles keep the wordmark inside the adaptive icon safe area.
    foreground = artwork.copy()
    green_background = Image.new("RGB", artwork.size, green[:3])
    difference = ImageChops.difference(artwork.convert("RGB"), green_background)
    foreground.putalpha(difference.convert("L").point(lambda value: 255 if value else 0))
    for density, scale in [("mdpi", 1), ("hdpi", 1.5), ("xhdpi", 2), ("xxhdpi", 3), ("xxxhdpi", 4)]:
        folder = f"android/app/src/main/res/mipmap-{density}"
        size = round(48 * scale)
        icon = master.resize((size, size), Image.Resampling.LANCZOS)
        add(f"{folder}/ic_launcher.png", icon)
        circle = Image.new("L", (size, size))
        ImageDraw.Draw(circle).ellipse((0, 0, size - 1, size - 1), fill=255)
        round_icon = centered(artwork, (size, size), round(size * .76), green)
        round_icon.putalpha(circle)
        add(f"{folder}/ic_launcher_round.png", round_icon)
        dimension = round(108 * scale)
        add(f"{folder}/ic_launcher_foreground.png",
            centered(foreground, (dimension, dimension), round(dimension * .58), (0, 0, 0, 0)))

    for name, data in outputs.items():
        (ROOT / name).write_bytes(data)
        print("ASSET", name, len(data), "bytes")
        if emit_base64:
            encoded = base64.b64encode(data).decode("ascii")
            chunks = [encoded[i:i + 3000] for i in range(0, len(encoded), 3000)]
            for index, chunk in enumerate(chunks):
                print(f"FAVICON_ASSET|{name}|{index}|{len(chunks)}|{chunk}")
    if emit_base64:
        print("FAVICON_ASSETS_COMPLETE")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit-base64", action="store_true")
    output_assets(parser.parse_args().emit_base64)
