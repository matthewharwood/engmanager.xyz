"""Rebuild the marble portrait series with Blender 5.1+.

Each sculpture has its own editable source and authoring pipeline. See README.md
and sources/ATTRIBUTION.md before modifying or redistributing licensed geometry.
"""

import argparse
import subprocess
import sys
from pathlib import Path

import bpy
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path(__file__).resolve().parent
OUT = ROOT / "website/assets/journey"
KINDS = ("shop", "coach", "subscribe", "feed")


def package_stills():
    """Compare current exported fallbacks at the same scale without distortion."""
    width, height = 1100, 1300
    canvas = np.ones((height, width * len(KINDS), 4), dtype=np.float32)
    canvas[:, :, :3] = (0.018, 0.021, 0.027)
    for index, kind in enumerate(KINDS):
        path = OUT / f"{kind}.webp"
        if not path.is_file():
            raise FileNotFoundError(f"Build {kind} before packaging the study sheet: {path}")
        img = bpy.data.images.load(str(path), check_existing=False)
        scale = min(width / img.size[0], height / img.size[1])
        w, h = round(img.size[0] * scale), round(img.size[1] * scale)
        img.scale(w, h)
        pixels = np.empty(w * h * 4, dtype=np.float32)
        img.pixels.foreach_get(pixels)
        pixels = pixels.reshape((h, w, 4))
        x, y = index * width + (width - w) // 2, (height - h) // 2
        target = canvas[y:y + h, x:x + w, :3]
        alpha = pixels[:, :, 3:4]
        target[:] = pixels[:, :, :3] * alpha + target * (1 - alpha)
        bpy.data.images.remove(img)
    sheet = bpy.data.images.new("Marble studies — shop, coach, subscribe, feed", width=width * len(KINDS), height=height, alpha=False)
    sheet.pixels.foreach_set(canvas.ravel())
    sheet.filepath_raw = str(SOURCE / "contact-sheet.png")
    sheet.file_format = "PNG"
    sheet.save()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    options = parser.add_mutually_exclusive_group()
    options.add_argument("--only", choices=KINDS)
    options.add_argument("--sheet-only", action="store_true", help="Refresh the comparison without rebuilding any model.")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    if not args.sheet_only:
        # Shop and subscribe read the accepted coach source; full rebuilds must
        # refresh that dependency first. Sheet order follows the site journey.
        for kind in ("coach", "shop", "subscribe", "feed"):
            if args.only and kind != args.only:
                continue
            subprocess.run([
                bpy.app.binary_path, "--background", "--factory-startup", "--python-exit-code", "1",
                "--python", str(SOURCE / f"rebuild_{kind}.py"),
            ], check=True)
    package_stills()


if __name__ == "__main__":
    main()
