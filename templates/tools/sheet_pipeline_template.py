#!/usr/bin/env python3
"""Template for a project-specific sheet pipeline script.

Supports two provider modes via manifest:
- provider.type=command  -> subprocess CLI (any external tool)
- provider.type=openai   -> built-in OpenAI Images API (gpt-image-2 / dall-e-3)

Copy this file into your project and adapt if needed.
"""
from __future__ import annotations

import json
import os
import subprocess
import urllib.request
from pathlib import Path
from typing import Any

import requests


def read_manifest(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def download(url: str, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if url.startswith("file://"):
        path.write_bytes(Path(url[7:]).read_bytes())
    elif "://" in url:
        urllib.request.urlretrieve(url, path)
    else:
        path.write_bytes(Path(url).read_bytes())


def generate_sheet_openai(prompt: str, aspect: str, provider: dict[str, Any]) -> dict[str, Any]:
    api_key = provider.get("api_key") or os.environ.get(
        provider.get("api_key_env", "OPENAI_API_KEY")
    )
    if not api_key:
        raise RuntimeError("OpenAI provider requires api_key or api_key_env")
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
    return {
        "artifacts": [
            {"url": data["data"][0]["url"], "uuid": data["data"][0].get("revised_prompt", "")}
        ]
    }


def remove_background_rembg(image_path: Path, output_path: Path) -> dict[str, Any]:
    subprocess.run(
        ["rembg", "i", str(image_path), str(output_path)],
        check=True,
        capture_output=True,
    )
    return {"artifacts": [{"url": f"file://{output_path.resolve()}", "uuid": ""}]}


# Legacy command-based adapters (fill these when using provider.type=command)
def generate_sheet_command(prompt: str, aspect: str, provider: dict[str, Any]) -> dict[str, Any]:
    raise NotImplementedError(
        "Adapt this to your CLI tool, or switch provider.type=openai in manifest."
    )


def remove_background_command(image_artifact: dict[str, Any], provider: dict[str, Any]) -> dict[str, Any]:
    raise NotImplementedError(
        "Adapt this to your CLI tool, or use provider.cutout.type=rembg/none."
    )


if __name__ == "__main__":
    print("Template only: copy into your project and set provider.type in manifest.")
