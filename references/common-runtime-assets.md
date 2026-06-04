# Common Runtime Assets

This document lists the pre-generated reusable assets bundled with the Kairo-style placement runtime. New scenes built from this skill should copy and reuse these assets by default instead of recreating road / ground / decoration primitives with CSS, SVG, or local placeholder shapes.

## Rule

For new placement scenes based on `references/kairo-placement-runtime-reference`, the common assets under `assets/image2-clean/roads/` and `assets/image2-clean/common/` are part of the runtime contract.

Do **not** replace these with CSS strips, inline SVG roads, dashed lines, procedural bars, or ad-hoc local drawings unless the user explicitly asks for a different road system.

If a target project is cloned or generated from the reference runtime, verify that these folders are present in the target package:

```text
assets/image2-clean/roads/
assets/image2-clean/common/
```

## Road assets

Runtime road rendering is **data-driven by road type**. Each placed road cell may store a `type` field, and missing legacy road types migrate to the configured default.

Core road variants bundled by default:

```text
assets/image2-clean/roads/<type>-isometric-straight-x.webp
assets/image2-clean/roads/<type>-isometric-straight-y.webp
assets/image2-clean/roads/<type>-isometric-corner.webp
assets/image2-clean/roads/<type>-isometric-cross.webp
assets/image2-clean/roads/<type>-topdown-straight-x.webp
assets/image2-clean/roads/<type>-topdown-straight-y.webp
assets/image2-clean/roads/<type>-topdown-corner.webp
assets/image2-clean/roads/<type>-topdown-cross.webp
```

Default `<type>` values are `stone`, `dirt`, `grass`, and `wood`. The two straight pieces represent the two reusable road directions for the active camera. The corner piece is authored for the runtime's default corner orientation and is reused without CSS rotation; rotating isometric road art breaks the painted perspective / lighting and is rejected. The cross piece also serves as the legacy single-cell / isolated visual.

Compatibility aliases are also kept for older projects:

```text
assets/image2-clean/roads/road-isometric.webp
assets/image2-clean/roads/road-topdown.webp
```

Road types are configured in `data/project-config.json`:

```json
{
  "roads": {
    "defaultType": "stone",
    "types": [
      {
        "id": "dirt",
        "name": "Dirt Path",
        "cost": 40,
        "assets": {
          "isometric": "./assets/image2-clean/roads/dirt-isometric.webp",
          "topdown": "./assets/image2-clean/roads/dirt-topdown.webp",
          "variants": {
            "isometric-straight-x": "./assets/image2-clean/roads/dirt-isometric-straight-x.webp",
            "isometric-straight-y": "./assets/image2-clean/roads/dirt-isometric-straight-y.webp",
            "isometric-corner": "./assets/image2-clean/roads/dirt-isometric-corner.webp",
            "isometric-cross": "./assets/image2-clean/roads/dirt-isometric-cross.webp",
            "topdown-straight-x": "./assets/image2-clean/roads/dirt-topdown-straight-x.webp",
            "topdown-straight-y": "./assets/image2-clean/roads/dirt-topdown-straight-y.webp",
            "topdown-corner": "./assets/image2-clean/roads/dirt-topdown-corner.webp",
            "topdown-cross": "./assets/image2-clean/roads/dirt-topdown-cross.webp"
          }
        }
      }
    ]
  }
}
```

The build menu may expose road variants as `category: "transport"` entries with `assetKind: "road"` and `roadType`. Selecting one enters road drawing mode with that active style.

Road rendering should use image nodes and pass the road cell into the asset resolver:

```js
function roadVisual(rd){
  // Inspect same-type N/E/S/W neighbors and return:
  // { shape: 'straight-x' | 'straight-y' | 'corner' | 'cross' }
  // Do not return rotation metadata for isometric road sprites.
}

function roadAssetSrc(rd){
  const type = roadTypeById(rd?.type || state.activeRoadType);
  if (!isTopDownCamera()) return type.assets.isometric;
  const shape = rd?.shape || roadVisual(rd).shape;
  return type.assets.variants?.[`topdown-${shape}`] || type.assets.topdown;
}

function renderRoadNode(rd,className='preset-road',boost=0){
  const s=tileToScreen(rd.x,rd.y);
  const visual=roadVisual(rd);
  const node=document.createElement('div');
  node.className=className;
  node.dataset.roadType=rd.type;
  node.dataset.roadShape=visual.shape;
  node.style.left=`${s.left}px`;
  node.style.top=`${s.top}px`;
  node.style.zIndex=String(depthFromTop(s.top,boost));
  node.innerHTML=`<img src="${roadAssetSrc({...rd,shape:visual.shape})}" alt="" aria-hidden="true">`;
  els.roadLayer.appendChild(node);
}
```

Rejected road rendering patterns:

```text
inline <svg> road strips
CSS-only .preset-road background gradients
CSS dashed lane / direction marks
roadClass-based road-x / road-y / road-cross drawing
procedural local placeholder rectangles
hard-coded single roadAssetSrc() that ignores road type
hard-coded single tile per camera that ignores road connection shape
```

These patterns are legacy or fallback-only. They should fail review for new scenes unless explicitly requested.

## Common ground assets

Reusable ground materials:

```text
assets/image2-clean/common/ground/grass-isometric.webp
assets/image2-clean/common/ground/grass-topdown.webp
assets/image2-clean/common/ground/dirt-isometric.webp
assets/image2-clean/common/ground/dirt-topdown.webp
assets/image2-clean/common/ground/gravel-isometric.webp
assets/image2-clean/common/ground/gravel-topdown.webp
assets/image2-clean/common/ground/sand-isometric.webp
assets/image2-clean/common/ground/sand-topdown.webp
```

Use these for generic buildable terrain, fill tiles, or theme-neutral floor patches when a project needs reusable non-road ground primitives.

## Common prop assets

Reusable neutral decoration props:

```text
assets/image2-clean/common/props/tree.webp
assets/image2-clean/common/props/bush.webp
assets/image2-clean/common/props/rock.webp
assets/image2-clean/common/props/flowers.webp
```

These are optional decoration primitives. They should be copied with the runtime but only placed if the specific target scene needs ambient decoration. For Kairo / RPG-like natural scenes, they should look like map-integrated terrain objects: no pedestal, no circular display base, no sticker outline, no token rim, soft ground contact shadow, and transparent background.

## Source / QA assets

The asset folders also include source and QA files under `source/` and `qa/`. They are useful for development and review but do not need to be included in a clean public runtime package unless requested.

Recommended public package contents:

```text
assets/image2-clean/roads/road-isometric.webp
assets/image2-clean/roads/road-topdown.webp
assets/image2-clean/common/ground/*.webp
assets/image2-clean/common/props/*.webp
```

Exclude raw `source/` and `qa/` folders from minimal public packages unless the user asks for provenance / asset QA materials.

## Target project checklist

After creating or cloning a new scene:

1. Confirm road assets exist:

```bash
for type in stone dirt grass wood; do
  for camera in isometric topdown; do
    for shape in straight-x straight-y corner cross; do
      test -s "assets/image2-clean/roads/${type}-${camera}-${shape}.webp"
    done
  done
done
```

2. Confirm runtime uses image-backed road nodes:

```bash
grep -q "roadAssetSrc" app.js
grep -q "roadTypeById" app.js
grep -q "activeRoadType" app.js
```

3. Confirm legacy CSS/SVG road fallback is not active:

```bash
! grep -q "function roadClass" app.js
! grep -q "road-x\|road-y\|road-cross\|road-corner" styles.css
! grep -q "<svg" app.js index.html
```

4. If a target project lacks these assets or uses CSS/SVG roads, repair it by copying the assets and road rendering implementation from the reference runtime.

## Principle

Roads and common primitives are runtime assets, not per-theme generated art by default. Generate new themed buildings / characters / scene art as needed, but keep these common assets available and wired unless the user's requested theme specifically requires replacing them.
