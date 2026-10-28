#!/usr/bin/env python3
"""Reproducibly create GymDrobe transparent website icons from the original GD.

Never render a background into the website PNG/ICO icons. The metallic shading
comes unchanged from src/assets/logo.png, not a reconstructed font or SVG.
Run: python scripts/generate-transparent-favicons.py [--emit-base64]
"""
from __future__ import annotations

import argparse
import base64
from io import BytesIO
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
SOURCE = ROOT / "src" / "assets" / "logo.png"
OUTPUT_SIZES = {
    "favicon-16x16.png": 16,
    "favicon-32x32.png": 32,
    "favicon-48x48.png": 48,
    "apple-touch-icon.png": 180,
    "android-chrome-192x192.png": 192,
    "android-chrome-512x512.png": 512,
}


def isolate_original_monogram() -> Image.Image:
    source = Image.open(SOURCE).convert("RGBA")
    pixels = np.asarray(source).copy()
    alpha = pixels[:, :, 3]
    h, w = alpha.shape
    corners = [int(alpha[y, x]) for y, x in [(0, 0), (0, w-1), (h-1, 0), (h-1, w-1)]]
    fraction_transparent = float(np.mean(alpha < 16))
    print(f"SOURCE RGBA {w}x{h}; corner alpha {corners}; fully transparent pixels {fraction_transparent:.2%}")
    if fraction_transparent > 0.07 and max(corners) < 64:
        print("SOURCE already has true RGBA transparency; preserving its alpha.")
        mask = alpha
    else:
        print("SOURCE background is opaque; extracting metallic logo contour, retaining black letter fills.")
        rgb = np.asarray(source.convert("RGB"))
        gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        # Nearly black pixels outside the bevel are background; close the
        # reflective outlines before filling letter interiors.
        bright = np.uint8(gray > 9) * 255
        bright = cv2.morphologyEx(bright, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
        bright = cv2.dilate(bright, np.ones((3, 3), np.uint8))
        contours, hierarchy = cv2.findContours(bright, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
        if not contours or hierarchy is None:
            raise RuntimeError("No logo contour detected; refusing to manufacture generic text.")
        hierarchy = hierarchy[0]
        canvas = np.zeros((h, w), np.uint8)
        largest = max(cv2.contourArea(c) for c in contours)
        for i, contour in enumerate(contours):
            if hierarchy[i][3] != -1:
                continue
            area = cv2.contourArea(contour)
            if area > max(900, largest * 0.02):
                cv2.drawContours(canvas, contours, i, 255, -1)
                # True enclosed background holes within the letters stay clear.
                child = hierarchy[i][2]
                while child != -1:
                    if cv2.contourArea(contours[child]) > 1600:
                        cv2.drawContours(canvas, contours, child, 0, -1)
                    child = hierarchy[child][0]
        canvas = cv2.GaussianBlur(canvas, (3, 3), 0.55)
        mask = canvas
        # Preserve the full RGB detail in opaque, black-metal areas.
        pixels[:, :, 3] = mask

    output = Image.fromarray(pixels, "RGBA")
    effective = output.getchannel("A").point(lambda value: 255 if value > 18 else 0)
    bounds = effective.getbbox()
    if bounds is None:
        raise RuntimeError("Logo became empty during background extraction.")
    left, top, right, bottom = bounds
    box_fraction = ((right-left) * (bottom-top)) / (w*h)
    if box_fraction < 0.13:
        raise RuntimeError(f"Unexpected logo region {bounds}; refusing to publish tiny/favicon art.")
    # No resizing until now: preserve the original metallic logo pixels.
    return output.crop(bounds)


def fit_on_transparent_canvas(glyph: Image.Image, size: int) -> Image.Image:
    # 90% of available width or height, whichever would overflow first.
    scale = min(size * 0.9 / glyph.width, size * 0.9 / glyph.height)
    dimensions = tuple(max(1, round(length * scale)) for length in glyph.size)
    layer = glyph.resize(dimensions, Image.Resampling.LANCZOS)
    result = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    result.alpha_composite(layer, ((size - layer.width)//2, (size - layer.height)//2))
    return result


def png_bytes(image: Image.Image) -> bytes:
    buf = BytesIO()
    image.save(buf, format="PNG", optimize=True, compress_level=9)
    return buf.getvalue()


def output_assets():
    glyph = isolate_original_monogram()
    print(f"GLYPH cropped to {glyph.width}x{glyph.height}")
    all_assets = {}
    previews = {}
    for filename, size in OUTPUT_SIZES.items():
        canvas = fit_on_transparent_canvas(glyph, size)
        data = png_bytes(canvas)
        bbox = canvas.getchannel("A").getbbox()
        if canvas.getpixel((0, 0))[3] != 0 or not bbox:
            raise RuntimeError(f"Icon background unexpectedly opaque/empty: {filename}")
        # Favicon drawn to 85-90% of canvas along its longest axis.
        cover = max(bbox[2]-bbox[0], bbox[3]-bbox[1]) / size
        if not 0.82 <= cover <= 0.93:
            raise RuntimeError(f"Favicon coverage {cover:.2f} outside acceptable range: {filename}")
        all_assets[filename] = data
        previews[size] = canvas
        print(f"ASSET {filename} {size}x{size}; alpha-corners=0; coverage={cover:.1%}; {len(data)} bytes")

    icon = BytesIO()
    # ICO can contain PNG-compressed bitmaps for standard 16/32/48 sizes.
    fit_on_transparent_canvas(glyph, 48).save(
        icon, format="ICO", sizes=[(16,16), (32,32), (48,48)]
    )
    all_assets["favicon.ico"] = icon.getvalue()
    print(f"ASSET favicon.ico 16/32/48; {len(icon.getvalue())} bytes")

    # 3-up preview is only for visual QA; it is not used by the website.
    reference = previews[512]
    for_bg = []
    for bg in [(255, 255, 255, 255), (28, 29, 32, 255), (190, 190, 190, 255)]:
        background = Image.new("RGBA", (512, 512), bg)
        background.alpha_composite(reference)
        for_bg.append(background.convert("RGB"))
    strip = Image.new("RGB", (1536, 512))
    for i, tile in enumerate(for_bg):
        strip.paste(tile, (512*i, 0))
    buf = BytesIO()
    strip.save(buf, format="PNG", optimize=True)
    all_assets["favicon-preview-qa.png"] = buf.getvalue()

    for filename, data in all_assets.items():
        if filename == "favicon-preview-qa.png":
            continue
        (PUBLIC / filename).write_bytes(data)
    return all_assets


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--emit-base64", action="store_true")
    args = parser.parse_args()
    outputs = output_assets()
    if args.emit_base64:
        # The public icon blobs are small enough to relay from GitHub Actions
        # logs into the GitHub Contents API without uploading to third parties.
        # Chunks avoid GitHub's maximum single-line log size.
        for filename, data in outputs.items():
            encoded = base64.b64encode(data).decode("ascii")
            chunks = [encoded[i:i+3000] for i in range(0, len(encoded), 3000)]
            for i, chunk in enumerate(chunks):
                print(f"FAVICON_ASSET|{filename}|{i}|{len(chunks)}|{chunk}")
        print("FAVICON_ASSETS_COMPLETE")


if __name__ == "__main__":
    main()
