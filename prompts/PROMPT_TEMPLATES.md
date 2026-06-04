# Sheet Generation and Cropping Prompts

Replace placeholders like `{theme}`, `{sheet_layout}`, `{slot_list}`, `{reference_uuid}`.

## Prompt plan gate

Before generation, write or log the complete prompt plan for each sheet/background. For generated-art reskins, this plan is required but not sufficient: only non-empty provider artifacts count as generated success.

A good prompt plan includes:

```text
sheet id, rows x cols, slot count, exact slot order, target family,
camera/view, scale, spacing, background, negatives,
provider.type and model name, planned background-removal method (rembg / none / command),
whether cutout must preserve sheet canvas/grid, final alpha/opaque behavior
```

## OpenAI provider quick start

When using the built-in OpenAI driver (`provider.type = "openai"`), generation is handled directly by the engine. Set the model in your manifest:

```json
{
  "provider": {
    "type": "openai",
    "model": "gpt-image-2"
  }
}
```

Supported models include `gpt-image-2` and `dall-e-3`. The engine maps `aspect` to OpenAI `size` automatically.

## Universal negative / safety suffix

```text
no text, no watermark, no logo, no brand marks, no UI, no labels, no caption text
```

## Standard 4×4 white-background sheet prompt

Use when the goal is to generate a single sheet that will be cropped later. This is the default for deterministic crop sheets. Use `references/layout-guides/standard-4x4-asset-sheet-grid.png` as an image-to-image layout reference whenever supported.

```text
ref_img-{layout_reference_uuid}, use the provided 4×4 reference grid as a strict layout guide, not as visual style.
{theme}, 1024×1024 square white-background asset sheet, exactly 4 columns by 4 rows, 16 slots total, {slot_list},
consistent style across all slots, same camera angle and same scale,
all objects use a uniform game-icon bounding box, each object fills about 70% of its slot height,
keep every asset centered inside its own cell and inside the blue safe box,
32 px safe padding inside every cell, clear spacing between slots, regular grid,
do not move, warp, rotate, hide, merge, subdivide, or redraw the grid layout,
do not cross cell borders, do not overlap adjacent cells, one asset per slot, no missing slots, no extra objects,
preserve exact row-major slot order from left to right, top to bottom,
simple white or near-white background, no text, no watermark, no logo, no labels
```

If references are unavailable, keep the same prompt but remove `ref_img-{layout_reference_uuid}` and make the 4×4 geometry even more explicit.

If the sheet contains objects with intentionally different gameplay sizes, group them by target size class instead of mixing them in one prompt, for example `small props`, `medium buildings`, `large landmarks`, or `character sprites`. Within one sheet, keep the requested bounding-box occupancy consistent.

## Builder playable-ground background prompt

Use for city-builder, farming-town-builder, room placement, or management maps where gameplay objects are placed on top of the scene.

```text
{theme}, pure empty playable ground plate, isometric view, ground surface only,
open buildable terrain with clear placement space, clean unobstructed empty land,
no prebuilt buildings, no houses, no structures, no landmarks, no walls, no roads,
no large props, no foreground objects, no distant scenery, no horizon, no skyline,
no mountains, no forests, no water bodies, no cinematic vista, no postcard landscape,
sparse ground texture details only, low visual clutter, uniform isometric terrain presentation,
no UI, no text, no watermark, no logo
```

## Reference-preserving sheet prompt

Use when the project already has a composition that should stay stable.

```text
ref_img-{reference_uuid}, redraw this asset sheet with the SAME composition and SAME slot order.
Keep the grid layout consistent. {sheet_layout}. Convert the visual style to {theme}.
Preserve the relative object size and footprint from the reference sheet.
Each object should remain centered in its original slot and fill a similar percentage of the slot as the reference.
Use a clean white background. Keep clear spacing between slots. No text, no watermark, no logo.
```

## Simple solid-block sheet prompt

Use when the user wants simplified material blocks or very clean visuals.

```text
ref_img-{reference_uuid}, same composition and same grid layout, but much simpler.
Use large flat solid color blocks, minimal details, clean shapes, consistent scale,
preserve the reference footprint and slot occupancy, no tiny objects, no oversized objects,
white-background asset sheet, no busy texture, no text, no watermark, no logo.
```

## Size and footprint constraints

Use this fragment for placement assets that are cropped into runtime objects.

```text
size discipline: every object in this sheet uses the same visual scale and the same camera angle;
each asset is centered inside its slot and occupies 65–75% of the slot height with 12–18% clean padding;
small details may vary, but the main silhouette should have comparable bounding-box size;
do not make any asset miniature, do not make any asset touch the slot border, do not crop any asset;
keep consistent isometric footprint and base contact point for placement-game sprites
```

When final runtime objects have different intended sizes, do not ask the model to solve scale implicitly. Split or label prompts by size class:

```text
small props: occupy 55–65% of slot height
medium buildings: occupy 65–75% of slot height
large landmarks: occupy 75–85% of slot height, but still keep full object inside slot with padding
characters: full body occupies 70–80% of slot height, feet aligned near the same baseline
```

## Slot-list examples

### Standard 4×4 sheet

```text
1024×1024 square sheet, exactly 4 columns by 4 rows, 16 total slots, 256×256 px per slot, 32 px safe padding, each slot a different asset, regular grid, centered object per slot, row-major order left to right and top to bottom
```

### Mixed family sheet

```text
row 1 buildings, row 2 props, row 3 characters, row 4 icons, all centered and evenly spaced
```

### Ordered family sheet

```text
slot 1 to 8 are the major landmarks, slot 9 to 16 are common buildings, all in that order
```

## Prompt fragment for individual slot descriptions

If the provider supports slot-aware sheet prompting, each slot description should be short and concrete:

```text
slot 1: a small corner shop
slot 2: a tall office tower
slot 3: a neighborhood park
slot 4: a compact character sprite
```

## Character sprite constraints

Use for characters that must work as in-game sprites rather than portraits.

```text
full body, feet visible, boots visible, complete body inside image,
not portrait, not headshot, not bust, no crop, generous margin,
front three-quarter view, centered, same scale
```

## Background removal step

If the workflow requires it, run background removal on the generated sheet or on the cropped slots, depending on the provider capability and the runtime target.

```text
background removal on generated sheet or crop outputs
```

Record whether background removal is local (`rembg`), provider-based, or skipped (`none`). `rembg` and heuristic white-key/alpha processing must be reported separately.

For fixed-grid sheets, prefer a no-crop cutout so the canvas and row/col coordinates remain stable. With the built-in `rembg` driver:

```bash
pip install rembg
# The engine runs: rembg i <input_sheet> <output_sheet>
```

Do not grid-crop an auto-cropped cutout unless the manifest crop geometry has been recalculated for the new canvas.

## Cropping guidance

After the sheet is generated:

1. Crop by known rows/columns.
2. Verify each crop against the manifest.
3. Preserve alpha if sprites are placed over a live scene; otherwise flatten onto a deliberate solid background if final targets must be opaque.
4. Never leave accidental white sheet backgrounds visible in final gameplay sprites.
5. Save using the original runtime filename.


## Kairo / RPG natural scene common assets

Use for default common props such as trees, bushes, rocks, flowers, and natural patch decorations when the target game should look like an integrated Kairo / RPG map instead of standalone shop icons.

```text
{theme}, high-angle top-down 2D RPG map asset, cozy Kairo-like pixel game look,
planted directly into the terrain with a soft natural ground contact shadow,
readable at small gameplay scale, compact silhouette, map-integrated object,
no pedestal, no circular base, no display stand, no sticker outline, no token rim,
no floating icon look, no hard white box, transparent background, no text, no watermark, no logo
```

For trees specifically:

```text
rounded leafy canopy, short trunk partly visible, natural grass contact, like a tree growing on the map tile, not an apple-tree icon on a base
```

For rocks / bushes / flowers specifically:

```text
low natural map decoration, irregular organic edge, blends into grass, soft shadow, not a product icon, not a potted plant, not a showcase token
```

## Path / road variant tile assets

Use when generating road variants for the reference runtime. Generate both selected camera modes and keep visual scale consistent with one placed tile.

```text
{theme}, seamless single-tile path asset for a placement game, {camera_prompt},
one tile footprint, centered path material, blends naturally into grass at the tile edge,
no UI, no text, no labels, no arrows, no lane markings, no border frame,
no pedestal, no sticker outline, transparent or clean isolated background according to runtime contract
```

Recommended variants: stone path, dirt path, walked grass trail, wood plank path, sand path, gravel path.

## Theme adapters

### Toy brick / LEGO-like original

```text
colorful plastic toy brick style, original design, visible studs, block seams, chunky brick construction, playful, bright clean colors, no official brand marks
```

### Clay / stop-motion

```text
handmade clay miniature style, soft rounded forms, subtle fingerprints, matte clay texture, stop-motion toy set lighting
```

### Pixel art

```text
crisp pixel art style, limited color palette, clean readable silhouette, game asset, no anti-aliased blur
```

### Ink wash

```text
Chinese ink wash illustration style, soft monochrome ink gradients, minimal brush strokes, elegant negative space
```

### Cyberpunk

```text
cyberpunk neon style, dark glossy materials, cyan magenta lighting, futuristic signage shapes without readable text
```


## Camera / projection modes

Use one camera mode consistently for scene backgrounds, object sheets, crop QA, and runtime placement math.

### Mode: isometric

Use for the original builder / placement reference runtime.

```text
isometric 2D game asset, 3/4 top-down orthographic view,
consistent 2:1 diamond tile footprint, base contact aligned for isometric placement,
no perspective distortion, same camera angle across all slots
```

Background fragment:

```text
isometric game map, 3/4 top-down orthographic view,
open buildable terrain, clear isometric ground plane,
2:1 diamond grid-compatible layout, no UI, no text
```

### Mode: rpg_topdown

Use when the user asks for a classic 2D RPG map camera, orthographic 2.5D top-down projection, or high-angle top-down view.

```text
classic 2D RPG map camera, orthographic 2.5D top-down projection,
high-angle top-down view, readable top/front surfaces,
square-grid footprint, base contact aligned for top-down tile placement,
consistent camera angle across all slots, no perspective distortion
```

Background fragment:

```text
classic 2D RPG map camera, orthographic 2.5D top-down projection,
high-angle top-down view, open square-grid buildable terrain,
clear walkable ground plane, no UI, no text, no labels
```

Manifest convention:

```json
{
  "camera_mode": "rpg_topdown",
  "sheets": [
    {
      "id": "buildings",
      "camera_mode": "rpg_topdown"
    }
  ]
}
```

If omitted, `isometric` remains the default.
