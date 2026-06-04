#!/usr/bin/env python3
"""Sheet-based static game asset reskin engine.

Generic manifest-driven framework for:
- reading and validating a sheet manifest
- generating white-background sheets through a pluggable provider command
- optionally removing backgrounds through a pluggable provider command
- guarding no-crop cutout canvas size
- cropping each sheet slot into final assets
- flattening final crops to an opaque background when required
- writing crop QA metadata
- retry-safe logs
- status and plan reporting

Provider assumptions are intentionally minimal. By default this engine expects a
command-line provider that returns JSON with an `artifacts` array, where each
artifact has at least `url` and optionally `uuid`.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import shlex
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import requests
from PIL import Image, ImageChops, ImageStat

TRANSPARENT_BG_SAFE_CLEANUP_MODES = {
    "none",
    "provider_alpha_only",
    "alpha_only",
    "edge_connected_only",
}

UNSAFE_WHITE_KEY_CLEANUP_MODES = {
    "white_key",
    "white-key",
    "heuristic_white_key",
    "heuristic_white_key_alpha",
    "global_white_key",
    "global_near_white_key",
}


CommandTemplate = str | list[str]
COMMON_RUNTIME_ASSETS = {
    "roads": [
        "assets/image2-clean/roads/road-isometric.webp",
        "assets/image2-clean/roads/road-topdown.webp",
    ],
    "common_dirs": [
        "assets/image2-clean/common",
    ],
}


CAMERA_PROFILES: dict[str, dict[str, str]] = {
    "isometric": {
        "label": "isometric 2D placement camera",
        "asset_prompt": "isometric 2D game asset, 3/4 top-down orthographic view, consistent 2:1 diamond tile footprint, base contact aligned for isometric placement",
        "background_prompt": "isometric game map, 3/4 top-down orthographic view, open buildable terrain, clear isometric ground plane",
    },
    "rpg_topdown": {
        "label": "classic 2D RPG map camera",
        "asset_prompt": "classic 2D RPG map camera, orthographic 2.5D top-down projection, high-angle top-down view, readable top/front surfaces, square-grid footprint, base contact aligned for top-down tile placement",
        "background_prompt": "classic 2D RPG map camera, orthographic 2.5D top-down projection, high-angle top-down view, open square-grid buildable terrain, clear walkable ground plane",
    },
}


def camera_profile(mode: str | None) -> dict[str, str]:
    return CAMERA_PROFILES.get(mode or "isometric", CAMERA_PROFILES["isometric"])


def _resolve_api_key(provider: dict[str, Any]) -> str:
    if provider.get("api_key"):
        return str(provider["api_key"])
    env_name = provider.get("api_key_env", "OPENAI_API_KEY")
    key = os.environ.get(env_name)
    if not key:
        raise RuntimeError(
            f"OpenAI provider requires 'api_key' in manifest or '{env_name}' env variable."
        )
    return key


def generate_sheet_openai(prompt: str, aspect: str, provider: dict[str, Any]) -> dict[str, Any]:
    """Built-in OpenAI Images API generation driver.

    Returns a dict compatible with the engine's artifact format:
    {"artifacts": [{"url": "...", "uuid": "..."}]}
    """
    api_key = _resolve_api_key(provider)
    base_url = str(provider.get("base_url", "https://api.openai.com/v1")).rstrip("/")
    model = str(provider.get("model", "gpt-image-2"))

    size_map = {"1:1": "1024x1024", "16:9": "1792x1024", "9:16": "1024x1792"}
    size = size_map.get(aspect, "1024x1024")

    resp = requests.post(
        f"{base_url}/images/generations",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={"model": model, "prompt": prompt, "size": size, "n": 1, "response_format": "url"},
        timeout=int(provider.get("timeout", 120)),
    )
    resp.raise_for_status()
    data = resp.json()
    image_data = data["data"][0]
    return {
        "artifacts": [
            {
                "url": image_data["url"],
                "uuid": image_data.get("revised_prompt", ""),
            }
        ]
    }


def remove_background_rembg(image_path: Path, output_path: Path) -> dict[str, Any]:
    """Local rembg CLI cutout driver."""
    proc = subprocess.run(
        ["rembg", "i", str(image_path), str(output_path)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    if proc.returncode != 0:
        raise RuntimeError(f"rembg failed: {proc.stderr}")
    return {"artifacts": [{"url": f"file://{output_path.resolve()}", "uuid": ""}]}


def enrich_prompt(prompt: str, sheet: dict[str, Any], manifest: dict[str, Any]) -> str:
    mode = sheet.get("camera_mode") or manifest.get("camera_mode") or manifest.get("camera", {}).get("mode")
    if not mode:
        return prompt
    profile = camera_profile(str(mode))
    fragment = profile["background_prompt"] if sheet.get("kind") in {"background", "scene", "map"} else profile["asset_prompt"]
    if fragment.lower() in prompt.lower():
        return prompt
    return f"{prompt}, camera/view: {fragment}"


def command_from_template(template: CommandTemplate, **values: str) -> list[str]:
    """Render a provider command template.

    String templates are split with shlex for backwards compatibility. Newer
    manifests may use an argv array to avoid shell quoting issues, for example:
    ["npx", "...", "--prompt", "{prompt}"]
    """
    if isinstance(template, list):
        return [str(part).format(**values) for part in template]
    rendered = str(template).format(**values)
    return shlex.split(rendered)


def run_command(command: list[str], cwd: Path, timeout: int = 480) -> dict[str, Any]:
    proc = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout)
    out = proc.stdout.strip()
    if proc.returncode != 0:
        raise RuntimeError(f"Command failed: {command}\nSTDOUT={out}\nSTDERR={proc.stderr}")
    try:
        return json.loads(out)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"Bad JSON for command {command}: {out[:1000]}\nSTDERR={proc.stderr}") from e


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def first_artifact(data: dict[str, Any]) -> dict[str, Any]:
    arts = data.get("artifacts") or []
    if not arts:
        raise RuntimeError(f"No artifacts: {data}")
    return arts[0]


def artifact_url(artifact: dict[str, Any]) -> str:
    url = artifact.get("url") or artifact.get("file_url") or artifact.get("output_url")
    if not url:
        raise RuntimeError(f"Artifact has no URL: {artifact}")
    return url


def artifact_uuid(artifact: dict[str, Any]) -> str:
    return str(artifact.get("uuid") or artifact.get("id") or artifact.get("artifact_id") or "")


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if url.startswith("file://"):
        path.write_bytes(Path(url[7:]).read_bytes())
    elif "://" in url:
        urllib.request.urlretrieve(url, path)
    else:
        path.write_bytes(Path(url).read_bytes())


def log_paths(log_dir: Path, kind: str, item_id: str) -> tuple[Path, Path, Path]:
    return (
        log_dir / f"{kind}-{item_id}.generate.json",
        log_dir / f"{kind}-{item_id}.cutout.json",
        log_dir / f"{kind}-{item_id}.crop.json",
    )


def is_success_log(path: Path) -> bool:
    if not path.exists():
        return False
    try:
        data = read_json(path)
    except Exception:
        return False
    return bool(data.get("artifacts")) and data.get("task_status") != "FAILURE"


def crop_box(item: dict[str, Any], sheet_width: int, sheet_height: int) -> tuple[int, int, int, int]:
    rows = int(item["rows"])
    cols = int(item["cols"])
    row = int(item["row"])
    col = int(item["col"])
    pad = int(item.get("padding", 0))
    cell_w = sheet_width / cols
    cell_h = sheet_height / rows
    left = math.floor(col * cell_w + pad)
    top = math.floor(row * cell_h + pad)
    right = math.ceil((col + 1) * cell_w - pad)
    bottom = math.ceil((row + 1) * cell_h - pad)
    return left, top, right, bottom


def flatten_opaque(img: Image.Image, background: str | tuple[int, int, int] | tuple[int, int, int, int] = "white") -> Image.Image:
    if img.mode == "RGBA":
        canvas = Image.new("RGBA", img.size, background)
        canvas.alpha_composite(img)
        return canvas.convert("RGB")
    if img.mode == "LA":
        rgba = img.convert("RGBA")
        canvas = Image.new("RGBA", img.size, background)
        canvas.alpha_composite(rgba)
        return canvas.convert("RGB")
    return img.convert("RGB")


def image_size(path: Path) -> tuple[int, int]:
    with Image.open(path) as im:
        return im.size


def alpha_bbox(img: Image.Image) -> tuple[int, int, int, int] | None:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    return alpha.getbbox()


def crop_qa_metadata(img: Image.Image, final_img: Image.Image, target: Path, box: tuple[int, int, int, int], final_opaque: bool) -> dict[str, Any]:
    rgba = img.convert("RGBA")
    bbox = alpha_bbox(rgba)
    w, h = rgba.size
    warnings: list[str] = []
    nontransparent_ratio = 1.0
    occupancy = 0.0
    if bbox is None:
        nontransparent_ratio = 0.0
        warnings.append("empty_or_fully_transparent_crop")
    else:
        alpha = rgba.getchannel("A")
        alpha_stat = ImageStat.Stat(alpha)
        nontransparent_ratio = float(alpha_stat.sum[0]) / float(255 * w * h) if w and h else 0.0
        bw = bbox[2] - bbox[0]
        bh = bbox[3] - bbox[1]
        occupancy = max(bw / w, bh / h) if w and h else 0.0
        if occupancy < 0.12:
            warnings.append("very_small_visible_content")
        if occupancy > 0.96:
            warnings.append("visible_content_touches_or_nearly_fills_cell")

    if final_opaque:
        rgb = final_img.convert("RGB")
        white = Image.new("RGB", rgb.size, "white")
        diff = ImageChops.difference(rgb, white).convert("L")
        changed_bbox = diff.point(lambda p: 255 if p > 8 else 0).getbbox()
        if changed_bbox is None:
            warnings.append("opaque_crop_is_nearly_all_white")

    return {
        "box": list(box),
        "crop_size": [w, h],
        "final_size": list(final_img.size),
        "final_mode": final_img.mode,
        "final_opaque": final_opaque,
        "alpha_bbox": list(bbox) if bbox else None,
        "nontransparent_ratio": round(nontransparent_ratio, 6),
        "occupancy": round(occupancy, 6),
        "target_file_size": target.stat().st_size if target.exists() else 0,
        "warnings": warnings,
    }


def validate_manifest(manifest: dict[str, Any]) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    provider = manifest.get("provider", {})
    runtime = manifest.get("runtime", {}) if isinstance(manifest.get("runtime", {}), dict) else {}
    if runtime.get("type") in {"kairo-placement", "kairo-placement-runtime", "static-management-placement"}:
        if runtime.get("use_common_road_assets") is False:
            warnings.append("runtime.use_common_road_assets=false; this is allowed only when the user explicitly requested custom road rendering")
        road_assets = runtime.get("road_assets") or COMMON_RUNTIME_ASSETS["roads"]
        for required in COMMON_RUNTIME_ASSETS["roads"]:
            if required not in road_assets:
                warnings.append(f"common road asset not declared in runtime.road_assets: {required}")
    if not isinstance(manifest.get("sheets"), list):
        errors.append("manifest.sheets must be a list")
        return errors, warnings

    provider_type = str(provider.get("type", "command")).lower()
    cutout_cfg = provider.get("cutout") or {}
    cutout_type = str(cutout_cfg.get("type") if isinstance(cutout_cfg, dict) else "").lower() or "command"

    if provider_type == "openai":
        if not provider.get("api_key") and not os.environ.get(provider.get("api_key_env", "OPENAI_API_KEY")):
            warnings.append(
                "provider.type=openai but neither api_key nor api_key_env resolved at validation time; "
                "runtime will fail if the env variable is also missing."
            )
    elif provider_type != "command":
        warnings.append(f"provider.type='{provider_type}' is not 'command' or 'openai'; verify the engine supports it")

    seen_sheets: set[str] = set()
    seen_targets: dict[str, str] = {}
    for idx, sheet in enumerate(manifest.get("sheets", [])):
        prefix = f"sheets[{idx}]"
        if not isinstance(sheet, dict):
            errors.append(f"{prefix} must be an object")
            continue
        sid = str(sheet.get("id") or "")
        kind = str(sheet.get("kind") or "sheet")
        sheet_key = f"{kind}:{sid}"
        if not sid:
            errors.append(f"{prefix}.id is required")
        elif sheet_key in seen_sheets:
            errors.append(f"duplicate sheet id: {sheet_key}")
        else:
            seen_sheets.add(sheet_key)
        for field in ("prompt", "raw", "rows", "cols"):
            if field not in sheet:
                errors.append(f"{prefix}.{field} is required")
        camera_mode = sheet.get("camera_mode") or manifest.get("camera_mode") or manifest.get("camera", {}).get("mode")
        if camera_mode and str(camera_mode) not in CAMERA_PROFILES:
            errors.append(f"{sheet_key} camera_mode must be one of {sorted(CAMERA_PROFILES)}")
        generate_template = sheet.get("generate_command") or provider.get("generate_command")
        if provider_type == "command" and not generate_template:
            errors.append(f"{sheet_key} missing generate_command in sheet or provider")
        remove_bg = bool(sheet.get("remove_background", False))
        sheet_cutout_type = str(sheet.get("cutout_type") or "").lower() or cutout_type
        cutout_template = sheet.get("cutout_command") or provider.get("cutout_command") or (cutout_cfg.get("command") if isinstance(cutout_cfg, dict) else None)
        if remove_bg and sheet_cutout_type == "command" and not cutout_template:
            errors.append(f"{sheet_key} remove_background=true but no cutout_command is configured")
        if remove_bg and not sheet.get("cutout"):
            warnings.append(f"{sheet_key} remove_background=true but cutout path is missing; raw path will be reused")
        cleanup_mode = str(sheet.get("post_cutout_cleanup") or sheet.get("alpha_cleanup") or provider.get("post_cutout_cleanup") or provider.get("alpha_cleanup") or "provider_alpha_only")
        cleanup_mode_l = cleanup_mode.lower().strip()
        if cleanup_mode_l in UNSAFE_WHITE_KEY_CLEANUP_MODES:
            errors.append(
                f"{sheet_key} uses unsafe global white-key alpha cleanup ({cleanup_mode}); "
                "this can erase legitimate white pixels inside buildings/signage. Use provider_alpha_only or edge_connected_only."
            )
        elif cleanup_mode_l not in TRANSPARENT_BG_SAFE_CLEANUP_MODES:
            warnings.append(
                f"{sheet_key} has unknown post_cutout_cleanup={cleanup_mode}; verify it does not delete internal white/light pixels"
            )
        prompt_text = str(sheet.get("prompt") or "").lower()
        if sheet.get("kind") in {"road", "roads", "path", "transport"}:
            warnings.append(f"{sheet_key} appears to generate road/path art; prefer bundled common road assets unless the user explicitly requested custom roads")
        if "svg" in prompt_text or "css road" in prompt_text or "road strip" in prompt_text:
            warnings.append(f"{sheet_key} prompt mentions svg/css/strip road rendering; common road assets should be used by default")
        try:
            rows = int(sheet.get("rows"))
            cols = int(sheet.get("cols"))
            if rows <= 0 or cols <= 0:
                errors.append(f"{sheet_key} rows and cols must be positive")
        except Exception:
            errors.append(f"{sheet_key} rows and cols must be integers")
            rows = cols = 0
        padding = int(sheet.get("padding", 0) or 0)
        if padding < 0:
            errors.append(f"{sheet_key} padding must be non-negative")
        slices = sheet.get("slices", [])
        if not isinstance(slices, list):
            errors.append(f"{sheet_key}.slices must be a list")
            continue
        if not slices:
            warnings.append(f"{sheet_key} has no slices")
        seen_slice_ids: set[str] = set()
        for sidx, slice_item in enumerate(slices):
            sprefix = f"{sheet_key}.slices[{sidx}]"
            if not isinstance(slice_item, dict):
                errors.append(f"{sprefix} must be an object")
                continue
            slice_id = str(slice_item.get("id") or "")
            if not slice_id:
                errors.append(f"{sprefix}.id is required")
            elif slice_id in seen_slice_ids:
                errors.append(f"{sheet_key} duplicate slice id: {slice_id}")
            else:
                seen_slice_ids.add(slice_id)
            for field in ("row", "col", "target"):
                if field not in slice_item:
                    errors.append(f"{sprefix}.{field} is required")
            try:
                row = int(slice_item.get("row"))
                col = int(slice_item.get("col"))
                if rows and not (0 <= row < rows):
                    errors.append(f"{sprefix}.row {row} is outside 0..{rows - 1}")
                if cols and not (0 <= col < cols):
                    errors.append(f"{sprefix}.col {col} is outside 0..{cols - 1}")
            except Exception:
                errors.append(f"{sprefix}.row and .col must be integers")
            target = str(slice_item.get("target") or "")
            if target:
                previous = seen_targets.get(target)
                if previous:
                    warnings.append(f"target written by multiple slices: {target} ({previous}, {sheet_key}:{slice_id})")
                seen_targets[target] = f"{sheet_key}:{slice_id}"
    return errors, warnings


def plan(root: Path, manifest: dict[str, Any]) -> dict[str, Any]:
    sheets = manifest.get("sheets", [])
    final_crops = sum(len(sheet.get("slices", [])) for sheet in sheets)
    targets = []
    for sheet in sheets:
        kind = sheet.get("kind", "sheet")
        sid = sheet.get("id", "")
        for slice_item in sheet.get("slices", []):
            target = root / slice_item["target"]
            targets.append({
                "sheet": f"{kind}:{sid}",
                "slice": slice_item.get("id"),
                "target": slice_item.get("target"),
                "exists": target.exists(),
            })
    return {
        "theme": manifest.get("theme"),
        "camera_mode": manifest.get("camera_mode") or manifest.get("camera", {}).get("mode") or "isometric",
        "camera_profiles": sorted(CAMERA_PROFILES),
        "common_runtime_assets": COMMON_RUNTIME_ASSETS,
        "sheets": len(sheets),
        "final_crops": final_crops,
        "remove_background_sheets": sum(1 for sheet in sheets if sheet.get("remove_background")),
        "targets": targets,
    }


def process_sheet(root: Path, log_dir: Path, kind: str, sheet: dict[str, Any], provider: dict[str, Any], force: bool = False, manifest: dict[str, Any] | None = None) -> str:
    sheet_id = sheet["id"]
    raw = root / sheet["raw"]
    cutout = root / sheet.get("cutout", sheet["raw"])
    generate_log, cutout_log, crop_log = log_paths(log_dir, kind, sheet_id)
    rows = int(sheet["rows"])
    cols = int(sheet["cols"])
    prompt = enrich_prompt(sheet["prompt"], sheet, manifest or {})
    aspect = sheet.get("aspect", "1:1")
    remove_bg = bool(sheet.get("remove_background", False))
    final_opaque = bool(sheet.get("final_opaque", True))
    allow_cutout_resize = bool(sheet.get("allow_cutout_resize", False))
    provider_type = str(provider.get("type", "command")).lower()
    cutout_cfg = provider.get("cutout") or {}
    cutout_type = str(cutout_cfg.get("type") if isinstance(cutout_cfg, dict) else "").lower() or "command"

    # Legacy fallback: if no cutout.type but provider has cutout_command, behave as command
    sheet_generate_template = sheet.get("generate_command") or provider.get("generate_command")
    sheet_cutout_template = sheet.get("cutout_command") or provider.get("cutout_command") or (cutout_cfg.get("command") if isinstance(cutout_cfg, dict) else None)

    if provider_type == "command" and not sheet_generate_template:
        raise RuntimeError("Missing generate_command in sheet or provider config")
    if remove_bg and cutout_type == "command" and not sheet_cutout_template:
        raise RuntimeError("Missing cutout_command in sheet/provider/cutout.command when remove_background is enabled")

    if generate_log.exists() and is_success_log(generate_log) and not force:
        generate_data = read_json(generate_log)
    else:
        if provider_type == "openai":
            generate_data = generate_sheet_openai(prompt, aspect, provider)
        else:
            command = command_from_template(sheet_generate_template, prompt=prompt, aspect=aspect, id=sheet_id, kind=kind)
            generate_data = run_command(command, cwd=root, timeout=int(sheet.get("timeout", provider.get("timeout", 480))))
        write_json(generate_log, generate_data)
        time.sleep(float(sheet.get("sleep_after_generate", provider.get("sleep_after_generate", 0.5))))

    art = first_artifact(generate_data)
    download(artifact_url(art), raw)
    raw_size = image_size(raw)

    sheet_for_crop = raw
    cutout_size = None
    cutout_method = "not_required"
    if remove_bg:
        cutout_method = str(sheet.get("cutout_method") or provider.get("cutout_method") or "provider")
        if cutout_log.exists() and is_success_log(cutout_log) and not force:
            cutout_data = read_json(cutout_log)
        else:
            if cutout_type == "rembg":
                cutout.parent.mkdir(parents=True, exist_ok=True)
                cutout_data = remove_background_rembg(raw, cutout)
            elif cutout_type == "none":
                cutout_data = {"artifacts": [{"url": f"file://{raw.resolve()}", "uuid": artifact_uuid(art)}]}
            else:
                command = command_from_template(sheet_cutout_template, image_id=artifact_uuid(art), image_url=artifact_url(art), raw_path=str(raw), id=sheet_id, kind=kind)
                cutout_data = run_command(command, cwd=root, timeout=int(sheet.get("timeout", provider.get("timeout", 480))))
            write_json(cutout_log, cutout_data)
            time.sleep(float(sheet.get("sleep_after_cutout", provider.get("sleep_after_cutout", 0.5))))
        cut_art = first_artifact(cutout_data)
        download(artifact_url(cut_art), cutout)
        cutout_size = image_size(cutout)
        if cutout_size != raw_size and not allow_cutout_resize:
            raise RuntimeError(
                f"Cutout canvas size changed for {kind}:{sheet_id}: raw={raw_size} cutout={cutout_size}. "
                "Use a no-crop background remover or set allow_cutout_resize=true explicitly."
            )
        sheet_for_crop = cutout

    im = Image.open(sheet_for_crop).convert("RGBA")
    sheet_w, sheet_h = im.size
    crop_results = []
    crop_warnings: list[dict[str, Any]] = []
    for slice_item in sheet.get("slices", []):
        box = crop_box({**slice_item, "rows": rows, "cols": cols, "padding": sheet.get("padding", 0)}, sheet_w, sheet_h)
        crop = im.crop(box)
        final_crop = flatten_opaque(crop) if final_opaque else crop
        target = root / slice_item["target"]
        existed_before = target.exists()
        target.parent.mkdir(parents=True, exist_ok=True)
        final_crop.save(target)
        metadata = crop_qa_metadata(crop, final_crop, target, box, final_opaque)
        result = {
            "id": slice_item["id"],
            "name": slice_item.get("name"),
            "target": slice_item["target"],
            "existed_before": existed_before,
            **metadata,
        }
        crop_results.append(result)
        if metadata["warnings"]:
            crop_warnings.append({"id": slice_item["id"], "target": slice_item["target"], "warnings": metadata["warnings"]})

    write_json(crop_log, {
        "sheet": sheet_id,
        "kind": kind,
        "raw": str(raw.relative_to(root)),
        "cutout": str(cutout.relative_to(root)) if remove_bg else None,
        "source_artifact": {"url": artifact_url(art), "uuid": artifact_uuid(art)},
        "camera_mode": sheet.get("camera_mode") or (manifest or {}).get("camera_mode") or (manifest or {}).get("camera", {}).get("mode") or "isometric",
        "camera_profile": camera_profile(str(sheet.get("camera_mode") or (manifest or {}).get("camera_mode") or (manifest or {}).get("camera", {}).get("mode") or "isometric"))["label"],
        "sheet_size": [sheet_w, sheet_h],
        "raw_size": list(raw_size),
        "cutout_size": list(cutout_size) if cutout_size else None,
        "remove_background": remove_bg,
        "cutout_method": cutout_method,
        "allow_cutout_resize": allow_cutout_resize,
        "post_cutout_cleanup": str(sheet.get("post_cutout_cleanup") or provider.get("post_cutout_cleanup") or "provider_alpha_only"),
        "internal_light_pixels_policy": "preserve_provider_alpha; do_not_global_white_key",
        "final_opaque": final_opaque,
        "results": crop_results,
        "warnings": crop_warnings,
    })
    return f"done {kind}:{sheet_id} warnings={len(crop_warnings)}"


def flatten_jobs(manifest: dict[str, Any], only_kinds: set[str] | None = None) -> list[tuple[str, dict[str, Any]]]:
    sheets = manifest.get("sheets", [])
    jobs: list[tuple[str, dict[str, Any]]] = []
    for sheet in sheets:
        kind = sheet.get("kind", "sheet")
        if only_kinds and kind not in only_kinds:
            continue
        jobs.append((kind, sheet))
    return jobs


def status(root: Path, manifest: dict[str, Any], log_dir: Path | None = None) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for sheet in manifest.get("sheets", []):
        kind = sheet.get("kind", "sheet")
        sid = sheet["id"]
        key = f"{kind}:{sid}"
        completed = 0
        total = len(sheet.get("slices", []))
        for slice_item in sheet.get("slices", []):
            if (root / slice_item["target"]).exists():
                completed += 1
        entry: dict[str, Any] = {"done": completed, "total": total}
        if log_dir:
            generate_log, cutout_log, crop_log = log_paths(log_dir, kind, sid)
            entry.update({
                "generated": is_success_log(generate_log),
                "cutout": is_success_log(cutout_log) if sheet.get("remove_background") else None,
                "crop_log": crop_log.exists(),
            })
            if crop_log.exists():
                try:
                    crop_data = read_json(crop_log)
                    entry["warnings"] = crop_data.get("warnings", [])
                    entry["validated"] = total - len(crop_data.get("warnings", []))
                except Exception as e:
                    entry["warnings"] = [{"log": str(crop_log), "error": repr(e)}]
        out[key] = entry
    return out


def load_manifest_and_log_dir(root: Path, manifest_arg: str, log_dir_arg: str | None) -> tuple[Path, dict[str, Any], Path]:
    manifest_path = Path(manifest_arg)
    if not manifest_path.is_absolute():
        manifest_path = root / manifest_path
    manifest = read_json(manifest_path)
    log_dir_value = log_dir_arg or manifest.get("log_dir")
    log_dir = Path(log_dir_value) if log_dir_value else (manifest_path.parent / "logs")
    if not log_dir.is_absolute():
        log_dir = root / log_dir
    return manifest_path, manifest, log_dir


def print_validation(errors: list[str], warnings: list[str]) -> None:
    print(json.dumps({"valid": not errors, "errors": errors, "warnings": warnings}, ensure_ascii=False, indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="Project root")
    ap.add_argument("--manifest", required=True, help="Path to a project-specific manifest JSON, relative to root or absolute")
    ap.add_argument("--log-dir", default=None)
    ap.add_argument("--kinds", default="", help="Comma-separated sheet kinds to run")
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--status", action="store_true")
    ap.add_argument("--plan", action="store_true", help="Print expected sheets, crops, and overwrite targets without running provider commands")
    ap.add_argument("--validate-manifest", action="store_true", help="Validate manifest shape and cross references")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    _manifest_path, manifest, log_dir = load_manifest_and_log_dir(root, args.manifest, args.log_dir)
    provider = manifest.get("provider", {})

    errors, warnings = validate_manifest(manifest)
    if args.validate_manifest:
        print_validation(errors, warnings)
        raise SystemExit(1 if errors else 0)
    if errors:
        print_validation(errors, warnings)
        raise SystemExit(1)

    if args.plan:
        print(json.dumps({"validation_warnings": warnings, **plan(root, manifest)}, ensure_ascii=False, indent=2))
        return

    if args.status:
        print(json.dumps(status(root, manifest, log_dir), ensure_ascii=False, indent=2))
        return

    only = {x.strip() for x in args.kinds.split(",") if x.strip()} or None
    jobs = flatten_jobs(manifest, only)
    if args.limit:
        jobs = jobs[: args.limit]

    print(f"jobs={len(jobs)} workers={args.workers}", flush=True)
    errors_out: list[tuple[str, str, str]] = []
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(process_sheet, root, log_dir, kind, sheet, provider, args.force, manifest): (kind, sheet["id"]) for kind, sheet in jobs}
        for fut in as_completed(futs):
            kind, sheet_id = futs[fut]
            try:
                print(fut.result(), flush=True)
            except Exception as e:
                errors_out.append((kind, sheet_id, repr(e)))
                print(f"ERROR {kind}:{sheet_id} {e}", file=sys.stderr, flush=True)
    if errors_out:
        write_json(log_dir / "generation-errors.json", errors_out)
        raise SystemExit(1)
    print(json.dumps(status(root, manifest, log_dir), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
