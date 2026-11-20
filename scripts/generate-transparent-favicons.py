#!/usr/bin/env python3
"""Generate browser and launcher assets from the approved GymDrobe PNG master."""

import argparse
import base64
import struct
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


def browser_favicons(master):
    # The first letter is isolated from the approved 1024px GymDrobe wordmark.
    # Use its coverage mask so filtering cannot introduce light/dark colour halos.
    green = (15, 61, 58, 255)
    cream = (245, 218, 191, 255)
    initial = master.crop((89, 430, 226, 564)).getchannel("R")
    coverage = initial.point(lambda value: round(255 * (value - green[0]) / (cream[0] - green[0])))
    coverage = coverage.crop(coverage.point(lambda value: 255 if value > 12 else 0).getbbox())

    # At 16px the initial spans 12px, with room for its opening and crossbar.
    canvas = Image.new("L", (192, 192), 0)
    width = 144
    height = round(width * coverage.height / coverage.width)
    initial = coverage.resize((width, height), Image.Resampling.LANCZOS)
    canvas.paste(initial, ((canvas.width - width) // 2, (canvas.height - height) // 2))

    # 32 edge-coverage steps retain antialiasing while keeping the tab assets small.
    edge_coverage = [round(255 * round(value * 32 / 255) / 32) for value in range(256)]
    outputs = {}
    for size in (16, 32, 48, 64, 96):
        dimensions = (size, size)
        tile = Image.composite(
            Image.new("RGBA", dimensions, cream), Image.new("RGBA", dimensions, green),
            canvas.resize(dimensions, Image.Resampling.LANCZOS).point(edge_coverage),
        )
        filename = "favicon-64-v1.png" if size == 64 else f"favicon-{size}x{size}.png"
        outputs[f"public/{filename}"] = png_bytes(tile)

    # Embed the same optimized PNG bytes served to browsers in each ICO frame.
    frames = (16, 32, 48)
    directory = bytearray(struct.pack("<HHH", 0, 1, len(frames)))
    offset = 6 + 16 * len(frames)
    images = []
    for size in frames:
        data = outputs[f"public/favicon-{size}x{size}.png"]
        directory.extend(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(data), offset))
        images.append(data)
        offset += len(data)
    outputs["public/favicon.ico"] = bytes(directory) + b"".join(images)
    return outputs


def png_bytes(image):
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    return stream.getvalue()


def output_assets(emit_base64=False, browser_only=False):
    master = Image.open(MASTER).convert("RGBA")
    if master.size != (1024, 1024):
        raise ValueError("Expected the 1024 × 1024 GymDrobe brand master")
    outputs = browser_favicons(master)
    if browser_only:
        write_outputs(outputs, emit_base64)
        return
    green = master.getpixel((0, 0))
    artwork = master.crop((89, 430, 935, 592))

    def add(path, image):
        outputs[path] = png_bytes(image)

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

    write_outputs(outputs, emit_base64)


def write_outputs(outputs, emit_base64):
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
    parser.add_argument("--browser-only", action="store_true", help="Write only PNG and ICO browser favicons")
    args = parser.parse_args()
    output_assets(args.emit_base64, args.browser_only)
