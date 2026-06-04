# Standard 4×4 Asset Sheet Policy

This policy hardens generated asset sheets against a common failure mode: the provider returns visually plausible assets, but the objects do not sit in predictable crop slots, so deterministic slicing cuts through assets or maps the wrong asset to the wrong runtime file.

For placement-game reskins, the default sheet format is now:

```text
1024×1024 square canvas
4 columns × 4 rows
16 equal cells
256×256 px per cell
32 px safe padding inside every cell
white or near-white sheet background
no labels / text / UI
```

Use the standard reference grid for image-to-image generation whenever the provider supports references:

```text
references/layout-guides/standard-4x4-asset-sheet-grid.png
```

Public preview:

```text
https://public.cohub.run/s/ed597b1a-27b4-42c6-b66a-c0dff7dc4809/standard-4x4-asset-sheet-grid.png
```

## Why this is mandatory

Visual QA alone is not enough. A generated sheet can look good as a whole while still failing deterministic cropping because:

- objects drift out of their intended slots;
- slots are not equally spaced;
- rows/columns are warped or staggered;
- objects overlap cell borders;
- the model creates a collage instead of a grid;
- asset order does not match the manifest;
- background removal auto-crops the canvas and invalidates coordinates.

A fixed 4×4 reference grid gives the model an explicit spatial contract, and the cropper has a stable geometry to verify.

## When to use this policy

Use this policy for generated sheets that will be deterministically cropped into runtime assets, especially:

- buildings;
- props / furniture / items;
- characters / agents if they are not generated one by one;
- icons / thumbnails if they must map to a fixed order.

Exceptions require an explicit note in the manifest and report:

- single full-scene backgrounds;
- one-off hero assets generated individually;
- special animation atlases with a different approved geometry;
- legacy source sheets that must preserve an existing non-4×4 layout.

## Standard prompt contract

Every generated crop sheet prompt must include all of the following:

```text
Use the provided 4×4 reference grid as a strict layout guide.
Create a 1024×1024 square asset sheet with exactly 4 columns and 4 rows, 16 slots total.
Keep every asset centered inside its own cell.
Do not move, warp, rotate, hide, merge, subdivide, or redraw the grid layout.
Do not cross cell borders. Do not overlap adjacent cells.
Each object must stay within the inner safe square of its cell with clear padding.
One asset per slot, no extra objects, no missing slots.
Preserve the exact slot order from left to right, top to bottom.
White or near-white background, no text, no labels, no UI, no watermark, no logo.
```

Then add the theme, camera, size class, and slot list.

Example:

```text
ref_img-{reference_uuid}, use the provided 4×4 reference grid as a strict layout guide.
Create a 1024×1024 square white-background asset sheet with exactly 4 columns and 4 rows, 16 slots total.
Theme: cozy medieval market town buildings, original game assets.
Camera: strict isometric 2:1 view, consistent angle in every slot.
Size class: medium buildings, each building fills 65–75% of the slot height with 12–18% padding.
Slot order, left to right, top to bottom:
slot 1: bakery shop; slot 2: tailor shop; ... slot 16: small fountain plaza.
Keep every asset centered inside its own cell and inside the blue safe box.
Do not cross cell borders. Do not overlap adjacent cells. One asset per slot. No extra objects. No missing slots.
White background, no text, no labels, no UI, no watermark, no logo.
```

## Reference use

When the generation provider supports image references:

1. Upload `references/layout-guides/standard-4x4-asset-sheet-grid.png`.
2. Include the returned `ref_img-{uuid}` in the prompt.
3. Explicitly state that the reference is a **layout guide**, not a visual style guide.
4. Ask the model to keep objects inside the blue safe boxes.

Do not ask the model to remove the guide lines during generation if doing so causes slot drift. It is acceptable for faint guide lines to remain in the raw sheet because the required cutout / background-removal step should remove the sheet background before final per-cell assets are normalized.

## Manifest requirements

Every 4×4 sheet manifest entry should include:

```json
{
  "rows": 4,
  "cols": 4,
  "canvas": [1024, 1024],
  "cell": [256, 256],
  "safePadding": 32,
  "layoutReference": "references/layout-guides/standard-4x4-asset-sheet-grid.png",
  "slotOrder": "row-major-left-to-right-top-to-bottom"
}
```

All 16 slots must be represented. If fewer than 16 final assets are needed, fill unused slots with deliberate throwaway variants and mark them as `unused` in the manifest. Do not reduce the grid size unless explicitly approved.

## Cropping geometry

For a 1024×1024 standard sheet:

```text
cellW = 256
cellH = 256
row = floor(slotIndex / 4)
col = slotIndex % 4
cropX = col * 256
cropY = row * 256
cropW = 256
cropH = 256
safe box = cropX + 32, cropY + 32, 192×192
```

Crop raw or no-crop-cutout sheets by these exact coordinates.

## Background removal

For generated sheets used as sprite/object sources:

- prefer provider `remove_background_nocrop` so the original 1024×1024 canvas and 4×4 grid stay aligned;
- if only auto-crop background removal exists, crop raw 256×256 cells first, then remove background per cell;
- never grid-crop an auto-cropped full-sheet output without recalculating geometry.

## QA gates

### 1. Sheet geometry QA

Before cropping final assets, verify:

- canvas is square and expected size, ideally 1024×1024;
- 4 columns and 4 rows are visually obvious;
- every slot has exactly one asset;
- no asset touches or crosses a cell border;
- no asset is cut off;
- asset order matches manifest slot order;
- grid / safe padding is not severely warped.

### 2. Automated occupancy QA

After cutout or per-cell background removal, measure each crop's alpha / non-background bounding box.

Flag any crop if:

- non-background bbox touches the outer 8 px of the 256×256 cell;
- bbox is smaller than ~35% of cell height for normal objects;
- bbox is larger than ~88% of cell height unless the size class explicitly allows it;
- bbox center is far from cell center;
- the crop is mostly empty;
- multiple disconnected large components suggest two assets in one slot.

### 3. Contact sheet QA

Generate a contact sheet showing:

- all 16 raw crops;
- all 16 final normalized assets;
- slot numbers and target IDs.

Reject / regenerate if any crop is wrong. Do not publish merely because the overall generated sheet looks nice.

## Repair rules

If a sheet fails layout QA:

1. Regenerate with the 4×4 grid reference and a stricter prompt.
2. Reduce visual complexity and shorten slot descriptions.
3. Split by size class if objects vary too much.
4. If one or two slots repeatedly fail, generate those assets individually or in a smaller repair sheet, then place them into the correct 4×4 slot manually with transparent padding and record the repair.
5. Do not silently crop through damaged assets.

## Core principle

The sheet is not just an illustration. It is a spatial data structure. The provider may create the art, but the project owns the grid contract, crop geometry, manifest, QA, and final asset normalization.
