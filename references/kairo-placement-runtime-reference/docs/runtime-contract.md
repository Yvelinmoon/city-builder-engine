# Runtime Contract

## Gameplay preserved by default

The framework provides:

- switchable placement camera modes;
- road drawing and road adjacency efficiency;
- building placement, upgrade, bulldoze, monthly economy, and maintenance;
- category build menu;
- goal checklist and event log;
- character/agent movement layer;
- heat map modes;
- localStorage save and grid-position persistence.

Theme-customization tasks should preserve those systems unless the user explicitly asks for gameplay redesign.

## Camera / projection modes

The reference runtime now supports two placement projection modes.

### `isometric`

Default mode. This is the original 2D isometric placement projection:

```text
screenX = originX + (x - y) * tileWidth
screenY = originY + (x + y) * tileHeight
```

Use for:

- 2:1 diamond tile maps;
- isometric 3/4 top-down orthographic building sprites;
- city-builder / Kairo-like placement scenes.

Asset prompt language:

```text
isometric 2D game asset, 3/4 top-down orthographic view,
consistent 2:1 diamond tile footprint, base contact aligned for isometric placement
```

### `rpg_topdown`

Classic RPG / high-angle top-down mode. This uses an orthographic 2.5D top-down square-grid projection:

```text
screenX = originX + x * tileWidth
screenY = originY + y * tileHeight
```

Use for:

- classic 2D RPG map camera;
- orthographic 2.5D top-down projection;
- high-angle top-down view;
- square-grid walkable/buildable maps.

Asset prompt language:

```text
classic 2D RPG map camera, orthographic 2.5D top-down projection,
high-angle top-down view, readable top/front surfaces,
square-grid footprint, base contact aligned for top-down tile placement
```

Runtime camera configuration can be supplied in `data/project-config.json`:

```json
{
  "camera": {
    "mode": "isometric",
    "availableModes": ["isometric", "rpg_topdown"]
  }
}
```

The settings panel includes a camera toggle for quick QA. Grid calibration persists the selected camera mode in localStorage.

## Viewport / map boundary contract

The runtime must not expose empty space outside the visual background map during panning, wheel zoom, minimap navigation, reset, load, camera toggle, or browser resize.

Implementation contract:

- `minGridZoom()` must guarantee that the logical world footprint is never smaller than the viewport.
- `mapPanRange()` clamps the logical world bounds to the viewport.
- `backgroundPanRange()` clamps the translated background image so the player never sees empty shell/background outside the map artwork.
- `panRange()` uses the intersection of logical world bounds and background coverage bounds.
- `clampViewPan()` must be called after pan, zoom, minimap navigation, calibration load, reset, camera toggle, and resize.


## Road variant contract

Road drawing supports multiple visual path styles without changing road adjacency, occupancy, economy, or agent movement semantics.

- `data/project-config.json` defines `roads.defaultType` and `roads.types[]`.
- Each road type has `id`, `name`, `cost`, and camera-specific base assets `assets.isometric` / `assets.topdown`.
- For production-quality preset roads, each type should also expose reusable connection-shape variants under `assets.variants`:
  - `isometric-straight-x`, `isometric-straight-y`, `isometric-corner`, `isometric-cross`;
  - `topdown-straight-x`, `topdown-straight-y`, `topdown-corner`, `topdown-cross`.
- In isometric camera mode, the runtime renders each road cell with the road type's fixed authored `assets.isometric` tile. It must not select connector variants, rotate sprites, or apply turn-specific logic; the generated isometric tile already owns the fixed camera perspective.
- In top-down camera mode, the runtime may derive each placed road cell's visual shape from same-type north / east / south / west neighbors and choose the matching `topdown-*` variant. Road sprites must still be rendered in their authored orientation; the runtime must not rotate road assets with CSS because rotation breaks painted perspective and lighting.
- Build menu transport entries can expose path choices with `category: "transport"`, `assetKind: "road"`, and `roadType`.
- Selecting a transport/path card enters road drawing mode and sets `state.activeRoadType`.
- New road cells are stored as `{ x, y, regionId, type }`; shape is derived at render time, not persisted.
- Old saves without `type` are valid; they normalize to `roads.defaultType`.
- Agent pathfinding and road adjacency continue to use road coordinates only; visual road type does not split or block connectivity.
- Road cost uses the active road type cost.

Default variants bundled with the reference runtime are `stone`, `dirt`, `grass`, and `wood`. Each default type includes both camera modes and four reusable connection shapes. Keep the older `road-isometric.webp` / `road-topdown.webp` and material base assets as compatibility aliases when possible.

## Depth ordering contract

All world-space objects must respect screen-y perspective ordering: the asset whose visual anchor is lower on screen must render in front of assets with a higher anchor. Runtime z-index values are generated through `depthFromTop(top, boost)`, which uses a large screen-y multiplier so semantic boosts can separate roads, buildings, agents, and effects without overriding perspective order for nearby screen positions.

Agents must update their z-index at every waypoint using the current road tile's screen top. Do not place moving agents in a fixed high z-index layer that can float in front of lower foreground objects or behind upper background objects.

## Agent movement contract

Agents are road-bound only.

- Every agent waypoint must be a road cell from `state.roads`.
- Agents may choose a road cell adjacent / nearest to a target building as their destination, but they must not move from that road cell to the building center.
- Do not append arbitrary screen points, building centers, or non-road tile centers to an agent path.
- If no connected road path exists between start and destination road cells, skip spawning that trip rather than falling back to a straight-line movement.
- Characters can speak while standing on roads, but they do not leave the road network for decorative visits.

This keeps visual movement consistent with road adjacency, traffic, and placement logic.

## Files typically customized per theme

- `data/project-config.json`: title, subtitle, brand mark, starting resources, camera mode, initial roads/placements, region labels.
- `data/buildings.json`: names, descriptions, categories, costs, sizes, effects, synergy metadata.
- `data/characters.json`: character names, roles, movement flavor, sprite IDs.
- `data/events.json`: monthly events and flavor copy.
- `data/goals.json`: milestone labels and requirements.
- `index.html`: only lightweight visible copy if not already driven by config.
- `styles.css`: palette and non-gameplay visual treatment.
- assets under `assets/image2-clean/`: provider-generated final scene/sprites.

## High-risk changes

Avoid changing without explicit instruction:

- save key semantics unless intentionally making a new project save namespace;
- asset path templates unless the whole asset contract is migrated;
- road occupancy and adjacency logic;
- goal/economy calculation functions.

Camera math can be changed only as a deliberate camera-mode extension. Keep both camera modes working when adding new modes.
