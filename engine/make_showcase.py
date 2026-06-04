#!/usr/bin/env python3
"""Create screenshot-friendly showcase HTML from generated assets.

Default output remains a pure white, no-caption contact sheet for clean visual
review. Use --labels and/or --checkerboard when QA needs readable identity and
transparent-edge inspection.
"""
from __future__ import annotations

import argparse
import json
from html import escape
from pathlib import Path

from PIL import Image


def image_size(path: Path) -> tuple[int, int] | None:
    try:
        with Image.open(path) as im:
            return im.size
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--project-root", default=".")
    ap.add_argument("--scene", default="")
    ap.add_argument("--asset-dirs", nargs="+", required=True)
    ap.add_argument("--out", default="qa/assets-showcase.html")
    ap.add_argument("--label-map", default="", help="Optional JSON label-map output path; defaults to <out>.labels.json when --labels is used")
    ap.add_argument("--width", type=int, default=1600)
    ap.add_argument("--asset-size", type=int, default=150)
    ap.add_argument("--gap", type=int, default=28)
    ap.add_argument("--include-scene", action="store_true")
    ap.add_argument("--labels", action="store_true", help="Render readable filename labels below assets")
    ap.add_argument("--show-size", action="store_true", help="Include image dimensions in labels")
    ap.add_argument("--checkerboard", action="store_true", help="Use checkerboard tile backgrounds to inspect transparency")
    args = ap.parse_args()

    root = Path(args.project_root).resolve()
    imgs: list[tuple[str, Path]] = []
    if args.include_scene and args.scene:
        scene = root / args.scene
        if scene.exists():
            imgs.append(("scene", scene))
    for d in args.asset_dirs:
        p = root / d
        for ext in ("*.webp", "*.png", "*.jpg", "*.jpeg"):
            for f in sorted(p.glob(ext)):
                imgs.append(("asset", f))

    def rel(p: Path) -> str:
        return "./" + p.relative_to(root).as_posix()

    scene_w = int(args.width * 0.45)
    tile_background = (
        "background-color:#fff;"
        if not args.checkerboard
        else "background-color:#fff;background-image:linear-gradient(45deg,#ddd 25%,transparent 25%),linear-gradient(-45deg,#ddd 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ddd 75%),linear-gradient(-45deg,transparent 75%,#ddd 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;"
    )
    html = [
        "<!doctype html>",
        "<html>",
        "<head>",
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        "<style>",
        "html,body{margin:0;background:#fff;color:#111;font-family:system-ui,-apple-system,Segoe UI,sans-serif;}",
        f"body{{min-width:{args.width}px;}}",
        f".wrap{{box-sizing:border-box;width:{args.width}px;margin:0 auto;padding:40px;background:#fff;display:flex;flex-wrap:wrap;gap:{args.gap}px;align-items:flex-start;justify-content:center;}}",
        ".card{display:flex;flex-direction:column;align-items:center;gap:8px;}",
        f".scene{{width:{scene_w}px;height:auto;object-fit:contain;display:block;{tile_background}}}",
        f".asset{{width:{args.asset_size}px;height:{args.asset_size}px;object-fit:contain;display:block;{tile_background}}}",
        f".label{{box-sizing:border-box;width:{max(args.asset_size, 180)}px;text-align:center;font-size:12px;line-height:1.25;overflow-wrap:anywhere;}}",
        "</style>",
        "</head>",
        "<body>",
        '<div class="wrap">',
    ]
    label_map = []
    for cls, path in imgs:
        size = image_size(path)
        label = path.stem if cls == "asset" else "scene"
        if args.show_size and size:
            label = f"{label} · {size[0]}×{size[1]}"
        label_map.append({
            "class": cls,
            "src": rel(path),
            "label": label,
            "size": list(size) if size else None,
        })
        if args.labels:
            html.append('<figure class="card">')
            html.append(f'<img class="{cls}" src="{rel(path)}" alt="{escape(label)}">')
            html.append(f'<figcaption class="label">{escape(label)}</figcaption>')
            html.append('</figure>')
        else:
            html.append(f'<img class="{cls}" src="{rel(path)}" alt="">')
    html += ["</div>", "</body>", "</html>"]

    out = root / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(html), encoding="utf-8")
    print(out)
    print(f"assets={len(imgs)}")

    if args.labels or args.label_map:
        label_map_path = root / (args.label_map or f"{args.out}.labels.json")
        label_map_path.parent.mkdir(parents=True, exist_ok=True)
        label_map_path.write_text(json.dumps(label_map, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"label_map={label_map_path}")


if __name__ == "__main__":
    main()
