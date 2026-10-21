#!/usr/bin/env python3
"""Generate every Hanuman icon and in-app logo from one square artwork.

Usage: python3 scripts/hanuman/make-icons.py [source.png]   (needs: pip install pillow)

The source defaults to assets/brand/hanuman-logo-source.png. It should be a
square, full-bleed image of at least 1024x1024; it is cut to a rounded square
here, so don't round its corners yourself.
"""

import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
ELECTRON = ROOT / 'packages/bruno-electron'
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'assets/brand/hanuman-logo-source.png'

# Corner radius as a share of the tile's width (close to the macOS squircle).
CORNER = 0.225
# macOS icons sit in an 824px tile on a 1024px canvas (Apple's icon grid).
MAC_TILE = 824 / 1024


def rounded_tile(art, size):
    """The artwork scaled to size x size with transparent rounded corners."""
    # Draw the mask 4x larger and scale it down for smooth corners.
    scale = 4
    mask = Image.new('L', (size * scale, size * scale), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, size * scale - 1, size * scale - 1), radius=round(size * scale * CORNER), fill=255
    )
    tile = art.resize((size, size), Image.LANCZOS)
    tile.putalpha(mask.resize((size, size), Image.LANCZOS))
    return tile


def mac_icon(art, size):
    """A rounded tile centred on a transparent canvas, per Apple's icon grid."""
    canvas = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    tile_size = round(size * MAC_TILE)
    offset = (size - tile_size) // 2
    canvas.alpha_composite(rounded_tile(art, tile_size), (offset, offset))
    return canvas


def save(image, path, **kwargs):
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, **kwargs)
    print(f'  {path.relative_to(ROOT)}')


def main():
    art = Image.open(SOURCE).convert('RGBA')
    width, height = art.size
    if width != height:
        sys.exit(f'{SOURCE} is {width}x{height}; the artwork must be square')
    if width < 1024:
        print(f'warning: {SOURCE} is {width}px; 1024px or larger gives sharper icons', file=sys.stderr)

    print(f'Generating icons from {SOURCE.relative_to(ROOT) if SOURCE.is_relative_to(ROOT) else SOURCE}')
    full = rounded_tile(art, 1024)

    # Linux (electron-builder reads the whole folder) and the app window icon.
    for size in (16, 24, 32, 48, 64, 128, 256, 512, 1024):
        save(full.resize((size, size), Image.LANCZOS), ELECTRON / f'resources/icons/png/{size}x{size}.png')
    save(full.resize((256, 256), Image.LANCZOS), ELECTRON / 'src/about/256x256.png')

    # macOS: Pillow writes every icns size from the 1024px image.
    save(mac_icon(art, 1024), ELECTRON / 'resources/icons/mac/icon.icns')

    # Windows installer and app, and the browser tab icon of the web build.
    save(full, ELECTRON / 'resources/icons/win/icon.ico', sizes=[(s, s) for s in (16, 24, 32, 48, 64, 128, 256)])
    save(full, ROOT / 'packages/bruno-app/public/favicon.ico', sizes=[(s, s) for s in (16, 32, 48)])

    # In-app logo (title bar, welcome screen, error page) and the readme.
    save(full.resize((256, 256), Image.LANCZOS), ROOT / 'packages/bruno-app/src/assets/hanuman-logo.png')
    save(full.resize((512, 512), Image.LANCZOS), ROOT / 'assets/images/hanuman-logo.png')
    save(mac_icon(art, 512), ROOT / 'assets/images/hanuman-icon.png')


if __name__ == '__main__':
    main()
