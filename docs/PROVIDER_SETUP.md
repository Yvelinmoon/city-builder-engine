# Provider Setup

The engine is provider-neutral and supports two generation modes, plus three background-removal strategies.

## Generation mode: `provider.type`

### `openai` — built-in HTTP driver

Calls OpenAI Images API directly. No external CLI required. By default, if the faint 4×4 layout guide exists, the engine sends it as an image reference via the edit endpoint; otherwise it falls back to text-only generation.

Required fields:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `type` | string | `"command"` | Must be `"openai"` |
| `api_key` | string | — | Optional if `api_key_env` is set |
| `api_key_env` | string | `"OPENAI_API_KEY"` | Env variable to read the key from |
| `base_url` | string | `"https://api.openai.com/v1"` | Set this for OpenAI-compatible proxies |
| `model` | string | `"gpt-image-2"` | Also supports `dall-e-3` |
| `layout_reference` | string | `"references/layout-guides/faint-4x4-sheet-grid.png"` | Optional 4×4 guide image for layout-stable sheet generation |
| `use_layout_reference` | boolean | `true` | Disable if your provider/model does not support image references |
| `timeout` | integer | `120` | HTTP request timeout in seconds |

**Minimal manifest example:**

```json
{
  "provider": {
    "type": "openai",
    "api_key_env": "OPENAI_API_KEY",
    "model": "gpt-image-2",
    "layout_reference": "references/layout-guides/faint-4x4-sheet-grid.png",
    "use_layout_reference": true
  }
}
```

When `use_layout_reference` is enabled and the reference image exists, the OpenAI driver prepends prompt guidance saying the grid is for layout only and must not be visible in the final output. If your OpenAI-compatible endpoint only supports text-to-image generation, set `"use_layout_reference": false`.

**Aspect-to-size mapping:**

| `aspect` | OpenAI `size` |
|----------|---------------|
| `1:1` | `1024x1024` |
| `16:9` | `1792x1024` |
| `9:16` | `1024x1792` |

Any other aspect falls back to `1024x1024`.

### `command` — subprocess CLI fallback

Runs an external command and expects JSON on stdout with an `artifacts` array.

Required fields:

| Field | Type | Notes |
|-------|------|-------|
| `type` | string | Omit or set `"command"` |
| `generate_command` | string or string[] | Template for sheet generation |
| `cutout_command` | string or string[] | Template for background removal (optional if cutout is handled differently) |

**Placeholder variables:**

For `generate_command`:
- `{prompt}` — the sheet prompt
- `{aspect}` — aspect ratio string
- `{id}` — sheet id
- `{kind}` — sheet kind

For `cutout_command`:
- `{image_url}` — URL of the generated artifact
- `{image_id}` — uuid/id of the generated artifact
- `{raw_path}` — local path to the downloaded raw sheet
- `{id}` — sheet id
- `{kind}` — sheet kind

**Minimal manifest example:**

```json
{
  "provider": {
    "type": "command",
    "generate_command": [
      "my-generator",
      "--prompt", "{prompt}",
      "--aspect", "{aspect}"
    ],
    "cutout_command": [
      "my-cutout",
      "--input", "{image_url}"
    ]
  }
}
```

## Background removal: `provider.cutout.type`

The engine supports three strategies. Set this inside the `provider.cutout` object.

### `rembg` — local background removal

Runs the local `rembg` CLI. Preserves canvas size by default, making it safe for fixed-grid cropping.

Requirements:
- `pip install rembg`
- `rembg` binary available on `$PATH`

Manifest:

```json
{
  "provider": {
    "type": "openai",
    "cutout": {
      "type": "rembg"
    }
  }
}
```

### `none` — skip background removal

Use this when you only need opaque crops, or when you plan to handle transparency outside the engine.

Manifest:

```json
{
  "provider": {
    "type": "openai",
    "cutout": {
      "type": "none"
    }
  }
}
```

### `command` — external CLI fallback

Delegates to `provider.cutout_command` or `provider.cutout.command`. This is the default if `provider.cutout` is omitted.

Manifest:

```json
{
  "provider": {
    "type": "command",
    "generate_command": [...],
    "cutout": {
      "type": "command",
      "command": ["my-cutout", "--input", "{image_url}"]
    }
  }
}
```

If `provider.cutout.command` is omitted, the engine falls back to `provider.cutout_command` for backwards compatibility.

## Complete example manifest

```json
{
  "theme": "cyberpunk-city",
  "camera_mode": "isometric",
  "provider": {
    "type": "openai",
    "api_key_env": "OPENAI_API_KEY",
    "model": "gpt-image-2",
    "cutout": {
      "type": "rembg"
    }
  },
  "sheets": [
    {
      "id": "buildings",
      "kind": "sheet",
      "prompt": "cyberpunk isometric buildings, 4x4 white background sheet, ...",
      "raw": "workspace/raw/buildings.png",
      "cutout": "workspace/cutout/buildings.png",
      "rows": 4,
      "cols": 4,
      "remove_background": true,
      "final_opaque": false,
      "slices": [
        {
          "id": "tower-a",
          "row": 0,
          "col": 0,
          "target": "assets/buildings/tower-a.png"
        }
      ]
    }
  ]
}
```

## Security note

Do not commit API keys into version control. Use `api_key_env` and load the key from your environment or secrets manager.
