#!/usr/bin/env python3
"""Create the standard 4×4 asset-sheet layout guide.

The guide is intentionally simple: a 1024×1024 square sheet, 4×4 cells,
256×256 px per cell, and a 32 px safe box inside each cell.
Use it as an image-to-image layout reference for provider-generated sheets.

This script writes a PNG directly using only the Python standard library.
"""
from __future__ import annotations

import argparse
import struct
import zlib
from pathlib import Path

RGBA = tuple[int, int, int, int]


def blend(dst: RGBA, src: RGBA) -> RGBA:
    sr, sg, sb, sa = src
    dr, dg, db, da = dst
    a = sa / 255
    return (
        round(sr * a + dr * (1 - a)),
        round(sg * a + dg * (1 - a)),
        round(sb * a + db * (1 - a)),
        255,
    )


def set_px(buf: bytearray, size: int, x: int, y: int, color: RGBA) -> None:
    if x < 0 or y < 0 or x >= size or y >= size:
        return
    i = (y * size + x) * 4
    dst = (buf[i], buf[i + 1], buf[i + 2], buf[i + 3])
    out = blend(dst, color)
    buf[i:i + 4] = bytes(out)


def rect(buf: bytearray, size: int, x0: int, y0: int, x1: int, y1: int, color: RGBA, fill: bool = True, width: int = 1) -> None:
    if fill:
        for y in range(max(0, y0), min(size, y1 + 1)):
            for x in range(max(0, x0), min(size, x1 + 1)):
                set_px(buf, size, x, y, color)
    else:
        for w in range(width):
            for x in range(x0 + w, x1 - w + 1):
                set_px(buf, size, x, y0 + w, color)
                set_px(buf, size, x, y1 - w, color)
            for y in range(y0 + w, y1 - w + 1):
                set_px(buf, size, x0 + w, y, color)
                set_px(buf, size, x1 - w, y, color)


def line_v(buf: bytearray, size: int, x: int, color: RGBA, width: int = 1) -> None:
    half = width // 2
    for dx in range(-half, width - half):
        for y in range(size):
            set_px(buf, size, x + dx, y, color)


def line_h(buf: bytearray, size: int, y: int, color: RGBA, width: int = 1) -> None:
    half = width // 2
    for dy in range(-half, width - half):
        for x in range(size):
            set_px(buf, size, x, y + dy, color)


def write_png(path: Path, size: int, rgba: bytearray) -> None:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(rgba[y * stride:(y + 1) * stride])
    png = b'\x89PNG\r\n\x1a\n'
    png += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
    png += chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    png += chunk(b'IEND', b'')
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def make_grid(path: Path, size: int = 1024, cols: int = 4, rows: int = 4, safe_padding: int = 32) -> None:
    bg = (247, 248, 251, 255)
    buf = bytearray(bg * (size * size))
    cell_w = size // cols
    cell_h = size // rows
    grid = (201, 206, 216, 255)
    safe = (122, 167, 255, 12)
    safe_stroke = (122, 167, 255, 255)
    border = (48, 54, 66, 255)

    for c in range(1, cols):
        line_v(buf, size, c * cell_w, grid, 3)
    for r in range(1, rows):
        line_h(buf, size, r * cell_h, grid, 3)

    for r in range(rows):
        for c in range(cols):
            x0 = c * cell_w + safe_padding
            y0 = r * cell_h + safe_padding
            x1 = (c + 1) * cell_w - safe_padding
            y1 = (r + 1) * cell_h - safe_padding
            rect(buf, size, x0, y0, x1, y1, safe, fill=True)
            rect(buf, size, x0, y0, x1, y1, safe_stroke, fill=False, width=2)

    rect(buf, size, 3, 3, size - 4, size - 4, border, fill=False, width=6)
    write_png(path, size, buf)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('output', nargs='?', default='references/layout-guides/standard-4x4-asset-sheet-grid.png')
    parser.add_argument('--size', type=int, default=1024)
    parser.add_argument('--safe-padding', type=int, default=32)
    args = parser.parse_args()
    make_grid(Path(args.output), size=args.size, safe_padding=args.safe_padding)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
