# Provider Generation, Cropping, and Replacement

This reference documents the concrete provider generation + optional background removal + crop + alpha/flatten + replacement loop. It is environment-neutral: use whichever generation/background-removal tools are available in the current runtime.

## Sheet generation

For deterministic crop sheets, use the standard 4×4 sheet policy by default. The sheet is a spatial data structure, not just an illustration:

```text
1024×1024 square canvas
4 columns × 4 rows
16 equal 256×256 cells
32 px safe padding inside every cell
row-major slot order left to right, top to bottom
```

Use the faint standard layout reference as an image-to-image guide whenever supported:

```text
references/layout-guides/faint-4x4-sheet-grid.png
```

This guide uses very light grid and safe-padding lines. The prompt must say the grid is **layout guidance only** and must not appear in the final output. The older stronger guide remains available for manual QA/reference:

```text
references/layout-guides/standard-4x4-asset-sheet-grid.png
```

The built-in OpenAI driver automatically attaches `references/layout-guides/faint-4x4-sheet-grid.png` by default when it exists. The engine prepends prompt guidance that says: use this as a spatial guide only, place one asset per cell, and do not reproduce grid/safe-box lines in the output. Override with `provider.layout_reference`, `sheet.layout_reference`, or disable with `use_layout_reference: false`.

```text
references/standard-4x4-sheet-policy.md
```

The engine supports built-in OpenAI generation (`provider.type = "openai"`) or any external CLI (`provider.type = "command"`). When using OpenAI, set the model in the manifest (e.g. `gpt-image-2` or `dall-e-3`) and the engine handles size mapping automatically.

If keeping layout/composition, provide the current source image as a reference when supported by the generation tool.

Prompt pattern:

```text
<reference image>, keep same composition, same camera angle, same sheet layout, <new style/theme>, no text, no logo
```

For standard white-background sheets, include:

```text
ref_img-{layout_reference_uuid}, use the provided 4×4 reference grid as a strict layout guide,
1024×1024 square white-background asset sheet, exactly 4 columns by 4 rows, 16 slots total,
each object fills about 70% of its slot height and stays inside the 32 px safe padding box,
clear spacing between slots, regular grid, centered object per slot, row-major slot order,
no tiny objects, no oversized objects, no overlap, no cropped objects, no text, no watermark, no logo
```

Do not mix widely different intended runtime sizes in one sheet unless the manifest and prompt explicitly define size classes. Prefer separate sheets for `small props`, `medium buildings`, `large landmarks`, and `characters` so the model can keep scale stable.

For large content expansions, add new semantic sheets rather than overloading the original sheet. Examples:

```text
market-extra: additional shops, stalls, workshops, small service buildings
city-walls-and-gates: gates, wall segments, corner towers, checkpoints, water gates
large-landmarks: pagodas, temples, guild halls, civic towers, monuments
service-extra: warehouses, stations, docks, clinics, offices
```

Use explicit occupancy by size class:

```text
small props: 55–65% of slot height
medium shops/services: 65–75% of slot height
large landmarks/city structures: 75–85% of slot height, still fully inside the cell
```

After adding new sheets, update runtime data, manifest slices, crop outputs, and QA pages together. Every new active non-road runtime ID needs a final asset file.

Store the raw generation and keep the sheet manifest aligned with the sheet geometry. Verify that the provider response contains at least one non-empty artifact before the sheet can be marked generated. Prompt text alone is not a generated asset.

## Sheet cropping prompt pattern

Each sheet prompt should describe the full standard grid and slot order, for example:

```text
ref_img-{layout_reference_uuid}, use the provided 4×4 reference grid as a strict layout guide, not as visual style.
{theme}, 1024×1024 square white-background asset sheet, exactly 4 columns by 4 rows, 16 slots total, {slot_list},
consistent style across all slots, same camera angle and same scale,
all objects use uniform game-icon bounding boxes and fill about 70% of slot height,
keep every object inside the 32 px safe padding box in its own cell,
clear spacing between slots, regular grid, each slot centered, no overlap,
no tiny objects, no oversized objects, no cropped objects,
row-major slot order left to right and top to bottom,
simple white background, no text, no watermark, no logo, no labels
```

## Background removal step

If the workflow requires it, run background removal on the generated sheet before cropping, or run background removal on the cropped slots if that is the current provider’s better-supported path.

For fixed-grid sheet cropping, use a background-removal mode that preserves the original canvas size and sheet geometry. The built-in `rembg` driver (`provider.cutout.type = "rembg"`) preserves canvas size by default and is recommended for grid sheets.

Avoid using auto-cropping cutout outputs directly for manifest row/col grid cropping; the provider may remove transparent borders and shift all crop coordinates. If no no-crop mode exists, crop raw cells first, then remove background per cell.

Record the background-removal method for every sheet/crop:

- provider `remove_background` artifact;
- heuristic white-key / alpha processing;
- no removal, intentionally flattened;
- no removal, fallback/reused asset.

The goal is to end with the alpha/opacity behavior required by the runtime contract. For sprites placed over an in-game scene, preserve alpha unless the runtime explicitly expects opaque rectangles. For opaque targets, flatten onto a deliberate solid background; do not accidentally retain the generated sheet’s white background.

## Background generation for builder games

For builder / management / placement games, backgrounds should be playable terrain plates, not scenic illustrations.

Prompt pattern:

```text
{theme}, empty playable terrain background, open buildable ground,
sparse decorative details, low visual clutter, no large focal scenery,
no postcard landscape, no cinematic vista, no buildings blocking placement area,
no UI, no text, no watermark, no logo
```

## Scale normalization guidance

Generation prompts reduce scale drift, but final runtime assets still need deterministic normalization.

For each cropped object asset:

1. Measure the non-transparent bounding box after background removal.
2. Compare it with the planned target occupancy for that sheet or size class, for example 70% of slot height.
3. If safe, scale the object content inside the fixed output canvas so the main silhouette reaches the target occupancy while preserving aspect ratio.
4. Keep the object centered horizontally and align placement sprites to a consistent visual baseline when the runtime uses ground contact points.
5. Do not enlarge damaged cutouts, cropped objects, or wrong-slot artifacts; regenerate those instead.

Record any normalization script or manual adjustment in the manifest/crop log. Visual QA must compare not only file existence but also relative scale in the contact sheet and in the playable scene.

## Crop and flatten guidance

After the sheet is generated:

1. Crop by known rows/columns. For standard sheets use exact 256×256 cells from the 1024×1024 canvas.
2. Verify each crop against the manifest and the standard 4×4 layout QA before final replacement.
3. Apply the planned alpha/flatten behavior:
   - preserve provider cutout alpha for transparent sprites;
   - flatten onto a deliberate solid background only when the runtime expects opaque assets;
   - never leave accidental white sheet backgrounds visible in final gameplay sprites.
4. Save using the original runtime filename.
5. Record source provenance: provider artifact, approved fallback/local, or reused old asset.
6. Create a contact sheet and visually inspect it before publishing; if any crop is visibly wrong, repair and rerun QA.

For expansion tasks, create two contact sheets when possible:

- an `extra/new assets` board containing only the new sheets/crops;
- an `all runtime assets` board containing every active runtime object/building asset after the data update.

The all-assets board is the best place to catch wrong semantic mapping, duplicate-looking entries, scale jumps between old/new generations, and data entries that have no file. If visual QA shows that the provider produced a usable asset in the wrong slot, remap IDs and filenames consistently, document the remap in the manifest/report, and regenerate the boards.

## Character sheet failure handling

Character sheets often fail visually even when provider calls succeed. If a character is cropped as a headshot/bust or loses body/feet:

1. Reject the crop.
2. Regenerate the character in a smaller sheet or as a single sprite.
3. Use full-body constraints:

```text
full body, feet visible, boots visible, complete body inside image,
not portrait, not headshot, not bust, no crop, generous margin
```

4. Rerun background removal and visual QA.

## Retry rules

If generation fails:

1. Check if the generation tool returned failure / empty artifacts / network errors.
2. Delete that sheet’s failed generation and cutout logs.
3. Retry with low concurrency.
4. Simplify prompt if it repeatedly fails.
5. Do not hide failures. Report exact sheet IDs.
6. Do not crop/replace/publish a completed generated-art reskin from missing/empty artifacts.
7. Use local/procedural/placeholder fallback only after explicit user approval, and count it separately.

## Useful script pattern

A generation script should:

- read `manifest.json` or an equivalent sheet manifest;
- generate sheets one family at a time;
- crop each sheet into final assets;
- flatten final crops when needed;
- write generation, cutout, and crop logs;
- write a generation error report if any errors remain.

See the bundled generic engine:

```text
engine/sheet_engine.py
```

The engine is intentionally clean and manifest-driven. Copy it into a project or call it with a project-specific manifest; do not hard-code prior project IDs or settings into the engine.

