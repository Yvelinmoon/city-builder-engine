---
name: city-builder-engine
description: Preserve and reuse an existing static HTML/CSS/JS management, builder, placement, room-care, farming-town, or Kairo-like game runtime while customizing it into a new playable theme. Use this skill whenever the user asks to “改主题”, “重做一个 XX 题材游戏”, “换成 XX 风格”, “基于这个项目做新版”, “reskin”, or “theme customization” for an existing static game, even if they do not explicitly say to preserve code. Default to cloning and reusing the source runtime/data/UI/contracts; do not rebuild gameplay from scratch unless the user explicitly requests a new mechanic/engine. Update data/copy/settings as needed, regenerate provider-backed visual assets, run mandatory no-crop background removal/cutout/cropping/normalization, perform visual QA, and publish a clean demo.
---

# City Builder Engine

Use this skill when a user wants to keep an existing playable static management / placement game runtime **functionally stable** while turning it into a new custom themed prototype. This may include data/copy/theme updates plus provider-generated visual assets. The usual asset path is sheet-aware: generate sheet images, preserve/cut out their backgrounds, crop them into final assets, visually QA them, then replace runtime files.

Also use this skill for vague or colloquial requests such as “改主题”, “换皮”, “重做一个 XX 题材”, “做成 XX 风格”, or “基于这个游戏做一个新版” whenever there is an existing static management/placement game to reuse. In those cases, interpret “重做” as **clone the existing project and reskin/theme-customize it**, not as permission to invent a new runtime, new architecture, or unrelated gameplay.

Typical requests:

- “把这个项目素材改成某个新风格，但保留玩法不变”
- “基于这个项目重做一个 XX 题材版本”
- “换成 XX 主题 / XX 风格，做一个可玩的新版”
- “先生成白底 sheet，再按格切图替换”
- “重新生成背景、建筑、角色，但最终文件名和路径不变”
- “把整套素材迁移成另一种视觉主题，最后做 QA 和发布”

## Core principle

**Reuse first. Reskin second. Rebuild never, unless explicitly requested.**

When a source project exists, the default job is to make a target copy and preserve its working code path. Treat the source project as a contract to discover and reuse:

- runtime entry files and script/module structure;
- game loop, placement rules, economy/progression, save/state semantics;
- DOM structure, canvas/layer structure, CSS layout, event bindings, and UI wiring;
- data schema, IDs, filenames, asset paths, dimensions, categories, and ordering;
- validation/build/publish flow.

A user saying “重做一个 XX 题材游戏” or “改成 XX 主题” does **not** authorize rewriting the game from scratch. Only rebuild or redesign gameplay when the user explicitly asks for new mechanics, a different engine, or a structural refactor. If the wording is ambiguous, proceed with clone-and-reskin and mention that assumption in the plan/report.

**Do not rewrite gameplay. Do not redesign the project. Do not replace the runtime.**

**No generated artifact, no final replacement.** If the requested task is a generated-art reskin, do not replace runtime assets, crop final files, publish, or claim completion until the image-generation provider has returned non-empty artifacts for the required sheets/backgrounds. Local drawing, placeholders, heuristic recolors, or old assets are fallback only and require explicit user approval before they can be used as final output.

Only change assets and small metadata/copy if explicitly useful. Keep:

- runtime entry/source files logically stable;
- gameplay data semantics stable;
- asset paths stable where possible;
- IDs and filenames one-to-one with the source project;
- final overlay/object assets transparent unless the runtime explicitly expects opaque rectangles;
- generated sheets traceable with logs and manifest.

## What changed in this version

This skill is **theme-customization focused and provider-asset aware**:

1. Build a sheet plan from the source project’s asset contract.
2. Preserve the source runtime/data/UI contracts by default, even when the user says “重做”.
3. Generate standard 4×4 white-background sheets/backgrounds with a real image provider and verify non-empty artifacts.
4. Run mandatory background removal/cutout with geometry safeguards for generated overlay/object assets.
5. Crop each slot from the sheet.
6. Preserve alpha or flatten each crop according to the runtime contract.
7. Visually QA the outputs before replacing/publishing.
8. Replace final assets using the project’s original filenames and paths.

## Required related reading

Before concrete generation, read:

```text
docs/STEPS.md
docs/NOTES.md
docs/PROVIDER_SETUP.md
prompts/PROMPT_TEMPLATES.md
references/manifest-and-discovery.md
references/sheet-generation-and-cropping.md
references/standard-4x4-sheet-policy.md
references/common-runtime-assets.md
references/showcase-and-publishing.md
references/kairo-placement-runtime-reference/README.md
references/kairo-placement-runtime-reference/docs/runtime-contract.md
```

Reusable framework scripts are bundled here:

```text
engine/sheet_engine.py
engine/make_showcase.py
engine/manifest.schema.json
```

These engine files are generic and should not contain project-specific IDs, images, character settings, or theme assumptions.

## Folder contents

This skill is self-contained in one folder:

```text
city-builder-engine/
├── SKILL.md
├── docs/
│   ├── NOTES.md
│   └── STEPS.md
├── prompts/
│   └── PROMPT_TEMPLATES.md
├── engine/
│   ├── sheet_engine.py
│   ├── make_showcase.py
│   └── manifest.schema.json
├── references/
│   ├── manifest-and-discovery.md
│   ├── sheet-generation-and-cropping.md
│   ├── standard-4x4-sheet-policy.md
│   ├── common-runtime-assets.md
│   ├── layout-guides/
│   │   ├── faint-4x4-sheet-grid.png
│   │   └── standard-4x4-asset-sheet-grid.png
│   ├── showcase-and-publishing.md
│   └── kairo-placement-runtime-reference/
│       ├── README.md
│       ├── SOURCE_README.md
│       ├── index.html
│       ├── app.js
│       ├── styles.css
│       ├── sfx.js
│       ├── data/
│       └── docs/runtime-contract.md
└── templates/
    └── tools/sheet_pipeline_template.py
```

## Standard workflow

1. **Confirm source and target**
   - Identify source project folder.
   - Create a new isolated target folder unless the user explicitly says to overwrite.
   - Preserve the source project unchanged.

2. **Discover runtime asset contract**
   - Find loaded asset paths in JS/CSS/HTML.
   - Read data files that define IDs, labels, categories, sizes, and sheet order.
   - Treat bundled road/common primitives as reusable runtime assets, not per-theme generated placeholders: `assets/image2-clean/roads/` and `assets/image2-clean/common/`.
   - Verify new targets keep image-backed road rendering from the reference runtime; do not use CSS/SVG road strips unless explicitly requested.
   - Determine required output groups, e.g. scene/background, sheets for buildings/items/props, sheets for characters, and any icon/thumbnail sets.

3. **Create a sheet manifest**
   - Default every deterministic crop sheet to the standard 4×4 square layout: 1024×1024 canvas, 4 rows, 4 columns, 256×256 cells, 32 px safe padding.
   - Use the faint standard 4×4 layout reference image for image-to-image generation whenever supported: `references/layout-guides/faint-4x4-sheet-grid.png`. Keep `references/layout-guides/standard-4x4-asset-sheet-grid.png` as a stronger QA/manual reference.
   - Define one crop slot per final asset and use row-major order from left to right, top to bottom.
   - If fewer than 16 assets are needed, keep the 4×4 sheet and mark unused slots in the manifest; do not silently switch to irregular layouts.
   - Include sheet size, grid geometry, crop geometry, target path, prompt description, and status fields.
   - Save under a generation workspace chosen for the current project.

4. **Back up current target assets**
   - Back up before replacing.
   - Do not publish backups/raw provenance unless explicitly requested.

5. **Generate sheets**
   - Build prompts for each sheet, not for each final asset.
   - For deterministic crop sheets, use the standard 4×4 reference-grid image as an image-to-image layout guide whenever supported.
   - Make the sheet composition explicit: exact 4×4 layout, 16 slots, slot order, margins, safe box, style consistency, size class, target slot occupancy, padding, white background, and no labels.
   - Avoid mixing very different intended runtime sizes in one sheet; split into small props / medium buildings / large landmarks / characters when needed.
   - If the user wants layout stability, reference the source composition when applicable.
   - Save the provider response and verify that every required generated sheet/background has at least one non-empty artifact before continuing.
   - If any required artifact is missing, stop before replacement/publishing unless the user explicitly approves a fallback.

6. **Mandatory background removal / cutout gate**
   - For any generated sheet whose slots become sprites, buildings, props, furniture, characters, icons, or overlays, run a background-removal/cutout step before final crop replacement unless the runtime target is explicitly a full rectangular opaque image.
   - For grid sheets, prefer no-crop background removal (e.g. local `rembg` or any no-crop provider cutout) so the sheet canvas and manifest row/col geometry remain stable.
   - If no no-crop cutout exists, crop raw cells first, then remove background per cell.
   - Record the cutout method and count it separately: provider `remove_background_nocrop`, provider `remove_background`, mask-aware edge cleanup, or not required. Global heuristic white-key / near-white alpha cleanup is unsafe for buildings and signs and must not be used as the default.
   - Do not silently leave white sheet backgrounds in final gameplay sprites. Visual QA must catch and fix white boxes/halos.
   - Do not fix white boxes by deleting every white / near-white pixel in the crop. Preserve legitimate internal whites such as walls, windows, signs, roofs, highlights, eyes, clothing, and brand panels. Prefer provider alpha only; if remnants remain, use only edge-connected or mask-aware cleanup that cannot punch holes in enclosed object details.
   - Final assets should be opaque only when the runtime contract explicitly expects rectangular opaque images; otherwise preserve alpha for objects placed over live scenes.

7. **Crop sheet slots into final assets**
   - Crop each slot from the sheet by the manifest’s grid plan.
   - Measure the cutout bounding box and normalize scale inside the fixed output canvas when planned, preserving aspect ratio and the family/size-class target occupancy.
   - Flatten onto a solid background if the final file must be opaque.
   - Replace the final asset at the existing target path with the same filename.

8. **Normalize and QA**
   - Verify every required final file exists.
   - Verify crop boundaries and visual mapping against the manifest.
   - For deterministic crop sheets, run the standard 4×4 layout QA: 1024×1024 square canvas, 4 rows, 4 columns, 16 represented slots, no object crossing cell borders, and slot order matching the manifest.
   - Verify relative object scale is consistent within the same family/size class and usable in the runtime scene.
   - Generate a contact sheet/showcase HTML for visual QA.
   - Run project static checks if applicable.

9. **Publish only clean playable files**
   - Copy runtime and final clean assets to a dedicated public/share/export folder appropriate for the current environment.
   - Exclude raw logs, backups, failed attempts, and provenance unless asked.
   - Return a direct entry-file URL/path when publishing supports it.

## Provider setup

This skill supports two generation modes via `manifest.json`:

### Mode A: `provider.type = "openai"` (built-in HTTP driver)

Use any OpenAI-compatible Images API, such as `gpt-image-2` or `dall-e-3`.

Minimal manifest snippet:

```json
{
  "provider": {
    "type": "openai",
    "api_key_env": "OPENAI_API_KEY",
    "model": "gpt-image-2",
    "cutout": {
      "type": "rembg"
    }
  }
}
```

- `api_key` can be set directly in the manifest (not recommended for shared repos), or omitted to read from `api_key_env`.
- `base_url` defaults to `https://api.openai.com/v1`; change it for OpenAI-compatible proxies.
- `model` defaults to `gpt-image-2`; `dall-e-3` is also supported.
- Sheet size is mapped from `aspect`: `1:1` → `1024x1024`, `16:9` → `1792x1024`, `9:16` → `1024x1792`.

### Mode B: `provider.type = "command"` (subprocess CLI fallback)

Use any external CLI tool that returns JSON with an `artifacts` array.

Minimal manifest snippet:

```json
{
  "provider": {
    "type": "command",
    "generate_command": ["my-tool", "generate", "--prompt", "{prompt}", "--aspect", "{aspect}"],
    "cutout_command": ["my-tool", "cutout", "--input", "{image_url}"]
  }
}
```

- `{prompt}`, `{aspect}`, `{id}`, `{kind}` are available for `generate_command`.
- `{image_url}`, `{image_id}`, `{raw_path}`, `{id}`, `{kind}` are available for `cutout_command`.
- This is the default mode if `provider.type` is omitted.

### Background removal / cutout

The engine supports three cutout strategies via `provider.cutout.type`:

- `"rembg"` — runs the local `rembg i <input> <output>` CLI. Install with `pip install rembg`.
- `"none"` — skips background removal entirely. Useful when you only need opaque crops or plan to handle transparency externally.
- `"command"` — delegates to `provider.cutout_command` or `provider.cutout_command` subprocess, same as the legacy behavior.

For grid sheets that will be cropped by fixed row/col geometry, always use a **no-crop** background remover (such as `rembg` with its default settings) so the sheet canvas size remains stable. If the cutout changes the canvas dimensions, the engine raises an error unless `allow_cutout_resize: true` is set on the sheet.

## Manifest convention

The manifest is sheet-oriented:

```text
<generation-workspace>/
├── manifest.json
├── sheets/
│   ├── *.json
│   ├── *.generate.json
│   └── *.cutout.json
├── raw/
│   └── <sheet-group>/
├── cropped/
│   └── <sheet-group>/
└── logs/
```

A sheet entry should describe:

- `id`
- `kind`
- `prompt`
- `target`
- `raw`
- `cutout`
- `rows`
- `cols`
- `cellWidth`
- `cellHeight`
- `padding`
- `flattenBackground`
- `slices[]`

Each slice should describe:

- `id`
- `name`
- `row`
- `col`
- `target`
- optional `label` for QA only

Final runtime assets remain at the project’s existing runtime asset paths, as discovered from its code/data contract.

## Generation rules

- Prefer one generated sheet per logical family.
- Preserve and copy bundled common runtime primitives by default: `assets/image2-clean/roads/road-isometric.webp`, `assets/image2-clean/roads/road-topdown.webp`, and `assets/image2-clean/common/`. These are not to be replaced with CSS/SVG strips or local placeholder drawings unless explicitly requested.
- Default deterministic crop sheets to the standard 4×4 square sheet policy: 1024×1024, 4×4 grid, 16 slots, 256×256 cells, 32 px safe padding, row-major slot order.
- Use `references/layout-guides/faint-4x4-sheet-grid.png` as the default image-to-image layout reference whenever the provider supports references. The stronger `standard-4x4-asset-sheet-grid.png` remains available for QA/manual reference.
- Make the sheet prompt explicit about the final slot order.
- In OpenAI provider mode, the engine attaches `references/layout-guides/faint-4x4-sheet-grid.png` by default when it exists and `use_layout_reference` is not false. Prompts must treat it as spatial guidance only and explicitly say not to reproduce grid lines/safe boxes in the final image.
- Use a clean white or near-white background in the sheet generation prompt.
- If the sheet will later be cropped, keep the grid regular and avoid irregular overlap; reject irregular collage-like sheets even if the art looks good.
- For sheet-based sprites/items/buildings, request:
  - clear grid layout;
  - centered full object in each slot;
  - same camera/view and same scale;
  - simple white background;
  - no text, no watermark, no logo;
  - style/theme terms only;
  - enough spacing so crops are clean.
- For backgrounds, use a single scene image rather than a sheet unless the project itself expects multiple scene plates.
- For builder/management games, choose and preserve one camera/projection mode for the full project:
  - default `isometric`: isometric view / 3/4 top-down orthographic view / 2:1 diamond tile footprint;
  - optional `rpg_topdown`: classic 2D RPG map camera / orthographic 2.5D top-down projection / high-angle top-down view / square-grid footprint;
  - record the choice in the manifest as `camera_mode` or `camera.mode`, and keep backgrounds, building sheets, crop QA, and runtime placement math aligned to that mode.
- For builder/management games, the background should be a pure playable ground plate, not a scenic postcard illustration:
  - use the selected camera mode and show the ground surface as the primary subject;
  - open buildable terrain with clear empty placement space;
  - no prebuilt buildings, houses, structures, landmarks, walls, or roads;
  - no large props, no foreground objects, no distant scenery, no horizon, no skyline, no mountains, no forests, or no water bodies;
  - sparse ground texture details only;
  - low visual clutter;
  - no large focal landscape or cinematic vista;
  - no UI/text.
- Do not claim full completion if any final asset uses fallback instead of newly generated output; list exceptions explicitly.
- Do not silently substitute local/procedural/placeholder assets for failed provider generations. Fallback requires explicit user approval and must be counted separately from generated artifacts.
- When a task asks for generated art, provider artifacts are the source of truth: a prompt file or manifest entry alone is not evidence that generation succeeded.

## Failure handling

Sheet generation often fails due to quota, concurrency, network, or empty artifacts.

Use conservative retry behavior:

- Start with low concurrency (`workers=1` or at most 2).
- If a task returns empty artifacts, delete that sheet’s failed generation / cutout logs before retrying.
- If a prompt repeatedly fails, simplify the sheet prompt and reduce the number of slots.
- If any required sheet/background still has no non-empty generated artifact after retries, stop the reskin before crop/replace/publish and report the failed sheet IDs.
- Use fallback only after explicit user approval. Clearly label fallback as fallback in filenames/logs/final report; never count fallback as generated success.

## Validation checklist

Run the project’s own validation commands if known. Do not assume a fixed stack.

Also verify:

- every required target file exists;
- no broken runtime asset paths;
- crop boundaries match the manifest grid;
- deterministic crop sheets pass the standard 4×4 layout QA: 1024×1024 square canvas, 4 rows, 4 columns, 16 represented slots, no object crossing cell borders, and slot order matching the manifest;
- final assets are opaque if that is the target contract;
- generated success counts match the manifest;
- visual QA contact sheet/showcase has been created, is label-readable or paired with a clear label map, and has been inspected by the agent;
- visual QA confirms slot identity, no accidental white boxes, no provider cutout/crop damage, full-body character/agent/pet sprites when the runtime renders them as moving sprites, no accidental prop/token substitution for character slots unless explicitly intended, complete buildings, playable-scale assets, and a gameplay-suitable ground/background;
- provider-generated, fallback/local-generated, and old/reused assets are counted separately;
- background-removal counts distinguish provider `remove_background` from heuristic white-key/alpha processing;
- public share excludes raw/provenance/backup folders unless requested;
- runtime/data wiring is verified: loaded themed data files are actually consumed by gameplay or explicitly documented as inactive, cross-file IDs resolve, and save/storage namespaces do not collide with the source theme;
- browser QA status is separated from static smoke tests; if browser automation/headless browser is unavailable or crashes, report it as skipped/blocked rather than “passed”.

## User-facing report format

Return concise status with:

- target project path;
- generated counts, e.g. `provider sheets 6/6`, `provider backgrounds 1/1`, `final crops 78/78`;
- fallback / local-generated / reused old assets count and IDs;
- background-removal method and counts, e.g. `provider remove_background 6/6`, `heuristic white-key 0/6`;
- validation commands and results, separated into syntax/static checks, data wiring checks, browser QA, and visual QA;
- public URL if published;
- paths to contact sheet/showcase HTML if created;
- visual QA status, checked contact sheet path/URL, label-map status, issues found, and fixes performed after QA;
- any loaded-but-unused themed data, fallback/reused assets, or browser QA limitations.

## References

Read the phase-specific references in this skill as needed:

- `references/manifest-and-discovery.md`
- `references/sheet-generation-and-cropping.md`
- `references/standard-4x4-sheet-policy.md`
- `references/common-runtime-assets.md`
- `references/showcase-and-publishing.md`
- `references/kairo-placement-runtime-reference/README.md`
- `references/kairo-placement-runtime-reference/docs/runtime-contract.md`

