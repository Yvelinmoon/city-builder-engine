# Static Management Game Theme Customization Steps

Use this checklist for every “keep management/placement game runtime stable, customize a new theme, and replace visual assets from real provider-generated sheets/backgrounds” task.

## Phase 0 — Load required context

1. Read this skill folder’s main and supporting docs:
   - `SKILL.md`
   - `docs/NOTES.md`
   - this file
   - `prompts/PROMPT_TEMPLATES.md`
   - `references/kairo-placement-runtime-reference/README.md`
   - `references/kairo-placement-runtime-reference/docs/runtime-contract.md`
2. Read whatever image-generation, background-removal, and publishing docs/tools are available in the current environment.
   - Do not assume fixed absolute paths; locate them from the current workspace/tooling.

## Phase 1 — Confirm scope

Ask or infer:

- Source project folder. If the task is based on the bundled Kairo-like placement framework and no external source is specified, use `references/kairo-placement-runtime-reference/` as the runtime reference and copy it into a new project folder before customization.
- Target style/theme.
- Whether the user is asking for a themed clone/reskin or an actual new gameplay/engine rebuild. Default for “改主题 / 重做 XX 题材 / 换风格”: themed clone/reskin with runtime reuse.
- Whether to copy project or overwrite target. Default: copy/create isolated target.
- Asset groups to replace:
  - background / scene
  - buildings / props / items / furniture
  - characters / agents / pets
  - icons / thumbnails if runtime uses them
- Bundled common runtime primitives to preserve/copy by default:
  - `assets/image2-clean/roads/road-isometric.webp`
  - `assets/image2-clean/roads/road-topdown.webp`
  - `assets/image2-clean/common/`
  - do not replace these with CSS/SVG strips or placeholders unless explicitly requested.
- Whether composition/layout must stay unchanged. Default: preserve existing layout and interaction structure.
- Whether final assets should be opaque or preserve alpha. Default: preserve alpha for generated objects/overlays placed on the scene; opaque only for full rectangular backgrounds or runtime targets that explicitly require it.
- Whether user wants public playable, public asset showcase, or both.

## Phase 2 — Copy or prepare target project

Default behavior:

```bash
cp -a "<source-project>" "<target-project>"
```

Rules:

- Do not overwrite source project.
- Do not delete user work.
- If target exists, inspect before replacing.

## Phase 3 — Discover and freeze the reuse contract

Before making theme changes, identify what must be reused. This is the main guardrail against accidentally rebuilding a lower-quality unrelated game.

Search the project for image/media references using the available search tool, for example:

```bash
grep -R "<media-path-pattern>\|\.webp\|\.png\|\.jpg\|\.jpeg" -n <runtime-files-and-data-dirs> || true
```

Identify final target paths from the project’s actual runtime contract:

```text
<final runtime background path>
<final runtime sprite path pattern>
<final runtime character path pattern>
<common road asset paths>
<common runtime asset paths>
```

For Kairo-style placement runtime clones, the common road contract is:

```text
assets/image2-clean/roads/road-isometric.webp
assets/image2-clean/roads/road-topdown.webp
```

The runtime should use `roadAssetSrc()` / image-backed `.preset-road img` nodes. CSS/SVG road strips are legacy/fallback-only and should be rejected for new scenes unless the user explicitly asks for them.

Also list the runtime/data/UI pieces to preserve:

```text
entry files:
core JS modules / game loop:
data/config files and schemas:
CSS/layout files:
asset path patterns:
validation/publish commands:
```

Treat these as read-mostly contracts. Do not replace them with a new architecture or unrelated implementation during a theme-only request.

Read project data/config files that define IDs and names.

## Phase 3.5 — Decide clean target naming

After discovering the source contract, create a rename map for the target theme if the original IDs, filenames, CSS classes, storage keys, or asset paths contain source-theme names that would look stale in the final project. Runtime reuse means preserving behavior and schemas, not blindly keeping user-visible or theme-specific names.

Use grep/find to locate every old name before editing:

```bash
grep -R "<old-theme-name-1>\|<old-theme-name-2>" -n <target-project-runtime-files-and-assets> || true
find <target-project-assets> -iname '*<old-theme-name>*'
```

Default strategy:

- If IDs/filenames are only internal and can be changed consistently, rename them to target-theme names and update every reference in code/data/CSS/HTML/manifests/assets.
- If a legacy ID/path must be preserved for compatibility, record the exception in the manifest/report and keep it out of user-facing UI.
- Do not leave source-theme names in the public package unless they are explicitly compatibility exceptions.
- Validate with a final grep over public runtime files and asset names.

## Phase 4 — Build sheet manifest

Create a project-specific sheet manifest in a generation workspace, for example:

```text
<generation-workspace>/manifest.json
```

Each deterministic crop sheet defaults to the standard 4×4 policy: 1024×1024 canvas, 4 rows, 4 columns, 16 slots, 256×256 cells, 32 px safe padding, row-major slot order. Use `references/layout-guides/standard-4x4-asset-sheet-grid.png` as the layout reference whenever image-to-image references are supported. If fewer than 16 final assets are needed, keep the 4×4 sheet and mark remaining slots as `unused`.

Each sheet should include the final target IDs/filenames after any rename map has been applied:

```json
{
  "id": "sheet-id",
  "kind": "sprites",
  "rows": 4,
  "cols": 4,
  "canvas": [1024, 1024],
  "cell": [256, 256],
  "safePadding": 32,
  "layoutReference": "references/layout-guides/standard-4x4-asset-sheet-grid.png",
  "slotOrder": "row-major-left-to-right-top-to-bottom",
  "prompt": "sheet prompt",
  "raw": "<raw sheet path>",
  "cutout": "<optional cutout sheet path>",
  "slices": [
    {
      "id": "asset-id",
      "name": "Human readable name",
      "row": 0,
      "col": 0,
      "target": "<final runtime asset path>"
    }
  ]
}
```

## Phase 4.5 — Prompt review gate

For generated-art reskins, write the planned prompts before calling the provider and verify they are specific enough to crop deterministically.

A prompt plan should include:

- one prompt per sheet/background;
- row/column count and total slot count; default deterministic crop sheets must state `4 columns × 4 rows, 16 slots total`;
- exact slot order matching the manifest slices;
- whether the standard 4×4 reference grid is used as an image-to-image layout guide, and its reference ID / path;
- final target IDs/filenames and any rename map from source IDs to target IDs;
- camera/view, scale, spacing, target size class, target slot occupancy, 32 px safe padding, footprint/baseline, and background requirements;
- universal negatives such as no text, watermark, logo, labels, UI, brand marks;
- whether background removal will run on the sheet or on crops;
- whether sheet background removal must preserve the original canvas/grid (when using a grid crop, prefer a no-crop cutout such as `rembg` so geometry stays stable);
- provider configuration: `provider.type` (`openai` or `command`), model name, and `provider.cutout.type` (`rembg`, `none`, or `command`);
- whether final runtime assets should preserve alpha or be flattened;
- whether post-crop scale normalization is needed, including target occupancy per sheet or per size class.

Size discipline default:

- Do not mix assets with very different intended runtime sizes in the same sheet unless the prompt names explicit size classes.
- For one visual family, prefer separate sheets such as `small props`, `medium buildings`, `large landmarks`, and `characters`.
- For expansion requests such as “double the building assets” or “add larger city/castle/landmark structures”, create additional semantic 4×4 sheets instead of stretching one sheet beyond its family. Recommended families include `market-extra`, `service-extra`, `city-walls-and-gates`, `large-landmarks`, and `small-props`.
- Include a concrete occupancy target in each sheet prompt, for example `each object fills about 70% of its slot height and stays inside the 32 px safe padding box`.
- Size-class guidance: small props 55–65% slot height, medium shops/services 65–75%, large landmarks/city structures 75–85% while still fully inside the cell.
- For reference-preserving sheets, ask to preserve the reference footprint and slot occupancy instead of only saying `same scale`.

Cutout default:

- Generated gameplay objects/overlays on white-background sheets require cutout/background removal before final replacement.
- Only skip cutout for full rectangular opaque targets such as backgrounds, cards, or UI panels, and record `cutout: not required` in the manifest/report.

If the request is style-sensitive or branded/IP-adjacent, show or summarize this prompt plan before expensive generation when feasible.

## Phase 5 — Back up target clean assets

Back up current runtime clean assets under the target project. Do not publish backups.

## Phase 6 — Generate background

Backgrounds are usually single images, not cropped sheets.

For builder / management games, the background is normally a **playable ground plate**, not a scenic landscape illustration. Prompt for:

```text
empty playable terrain background, open buildable ground, sparse decorative details,
low visual clutter, no large focal scenery, no postcard landscape, no cinematic vista,
no buildings blocking placement area, no UI, no text
```

If layout/composition should stay the same:

1. Upload or otherwise provide the existing background as a reference if supported.
2. Generate with “same composition / same camera / same layout”.

If user asks for simple background:

```text
large flat solid color blocks, minimal detail, no busy texture, uncluttered gameplay background
```

## Phase 7 — Generate asset sheets

For every sheet group:

1. Build a sheet prompt from manifest slices.
2. Generate one white-background sheet with the image provider.
3. Save generation log.
4. Verify the provider response has at least one non-empty artifact for that sheet.
5. Download/store raw sheet from the provider artifact.
6. Run background removal on the sheet or crop outputs unless the target is explicitly a full rectangular opaque image.
   - For fixed-grid sheet cropping, use a no-crop mode when available so the sheet canvas size and row/col coordinates remain unchanged.
   - When using `provider.cutout.type = "rembg"`, the local `rembg` tool preserves canvas size by default.
   - If no no-crop cutout is available, crop raw sheet cells first and run background removal per cell.
   - Do not skip this step merely because the sheet has a white background; white-background sheets are generation intermediates, not final overlay sprites.
   - After provider cutout, preserve internal light colors. Do **not** apply a global `white_to_alpha`, near-white threshold, or chroma-key pass to the whole crop, because it can erase valid white building/signage details. If a repair is needed, use provider alpha only or an edge-connected background cleanup that cannot reach enclosed/internal white pixels.
7. Verify the cutout response has at least one non-empty artifact when provider background removal was requested.
8. Save cutout log.
9. Download/store cutout sheet or per-cell cutout outputs.

Hard gate:

- A prompt file, manifest entry, or local placeholder is not a generated artifact.
- If a required sheet/background has no provider artifact, do not proceed to crop, replace runtime assets, or publish a “completed” reskin.
- Fallback/local/procedural assets may be used only after explicit user approval and must be logged/counted separately.

## Phase 8 — Crop sheets into final assets

For every slice in every sheet:

1. Crop by manifest row/col geometry.
2. Optionally trim inner whitespace if safe.
3. Measure the non-transparent bounding box after cutout for transparent assets.
4. Normalize scale inside the fixed output canvas when planned: preserve aspect ratio, resize the object content toward the target occupancy for its sheet/size class, keep consistent padding, and align placement sprites to a shared baseline when ground contact matters.
5. Apply the planned final treatment: preserve alpha for sprites/objects placed over live scenes, or flatten onto a deliberate solid background only if final target should be opaque.
6. Save to the original runtime target path.
7. Record crop metadata, including source artifact ID/path, measured bbox, scale-normalization result, and whether the crop came from provider output, approved fallback, or reused old asset.

## Phase 9 — Retry failures

If empty artifacts or CLI/network error:

1. Delete failed logs for that sheet.
2. Retry with low concurrency.
3. Reduce sheet slot count if repeated failure.
4. Simplify prompt if repeated failure.
5. If still failing, stop before replacing runtime assets unless the user explicitly approves fallback.
6. If fallback is approved, fill only what is needed to avoid broken images, mark fallback in manifest/logs, and report it clearly.
7. Do not publish a clean demo as a completed generated-art reskin while required generated artifacts are missing.

## Phase 10 — Verify final assets

Check:

- Reuse contract remains intact: source gameplay loop, placement rules, data schema, asset path contract, and UI wiring were not replaced by an unrelated new implementation.
- Every manifest slice target exists.
- Crop boundaries match the grid.
- Deterministic crop sheets pass the standard 4×4 layout QA: 1024×1024 square canvas, 4 rows, 4 columns, 16 represented slots, no object crossing cell borders, and row-major slot order matching the manifest.
- Final crops follow the planned size class / slot occupancy and are not wildly different in visual scale.
- Final crops are opaque if required.
- No runtime path is broken.
- Generated sheet success count is recorded separately from fallback/local/reused count.
- Provider `remove_background` success count is recorded separately from heuristic alpha/white-key processing.
- No fallback/local asset is described as provider-generated.
- Clean runtime asset folders do not contain stale files from previous visual contracts, such as old SVGs after switching to PNG.

## Phase 10.5 — Mandatory visual QA gate

Create and inspect a contact sheet before publishing or claiming completion. Programmatic checks do not replace visual QA. A playable page with no missing files is only a smoke test; it is **not** a completed visual QA pass.

The contact sheet/showcase itself must be QA-usable:

- include visible IDs or labels, or provide an adjacent label map that unambiguously maps every tile to a runtime asset ID;
- if label rendering fails, regenerate the contact sheet or create a label map before claiming visual QA;
- inspect the actual image output, not only file existence or script success.

Check at minimum:

- every crop matches the manifest slice ID/name;
- no accidental white sheet backgrounds or edge remnants are visible;
- legitimate internal white / near-white details are preserved, e.g. white walls, windows, signs, roofs, highlights, eyes, clothing, or brand panels are not punched transparent by over-aggressive cleanup;
- provider background removal did not crop or shift sheet geometry;
- buildings are complete and not cut off;
- characters/agents/pets that are rendered as moving sprites are semantically valid sprites for the runtime slot: full-body when required, feet/boots visible where applicable, not portrait/headshot/bust crops, and not unrelated prop/item/token substitutions unless the runtime explicitly treats them as tokens;
- asset scale is consistent within the same family/size class and usable in the runtime layout;
- background is a playable ground plate for builder games, not a scenic postcard image;
- no text, watermark, logo, UI, brand marks, or official assets appear;
- no stale files from previous visual contracts are present.

For asset expansion work, generate both an `extra/new assets` contact sheet for just-added sheets and an `all runtime assets` contact sheet for every active non-road runtime building/item ID. Use the full board to catch duplicate-looking assets, semantic drift, wrong ID mapping, scale jumps between old and new sheets, and missing files after data growth. If a generated slot is visually good but semantically belongs to another ID, remap filenames/data/manifest consistently, record the remap, and regenerate QA.

If visual QA fails, do not publish or describe the build as QA-complete. Regenerate, switch cutout method, split unstable sheets into smaller sheets/single assets, or otherwise repair, then rerun visual QA and record the fix. If an incomplete build must be shared for review, label it as incomplete/playable-smoke only and list the failed visual IDs.

## Phase 11 — Visual QA

Create one or both:

- Contact sheet with labels for internal QA.
- Pure-white no-text HTML showcase for screenshot/display use.

Visual QA must verify that each crop’s visible content matches the manifest slice name/description. If character sheets fail due to crop/cutout instability, regenerate those characters as smaller sheets or single full-body sprites with prompt constraints such as:

```text
full body, feet visible, boots visible, complete body inside image,
not portrait, not headshot, not bust, no crop, generous margin
```

## Phase 12 — Runtime validation

Run the project’s own validation commands if they exist. Do not assume a fixed stack.

Runtime QA must cover data wiring, not just syntax:

- verify every data file that is loaded is either consumed by gameplay or explicitly documented as inactive/flavor-only;
- if a themed data file (for example `events.json`, goals, quests, characters, rooms, recipes) is added or changed, grep the runtime for where it is used and validate at least one execution path;
- verify all ID references across data files resolve to real runtime entities;
- verify save keys/storage namespaces were updated for the new themed clone;
- verify the browser/app can initialize without console-blocking errors. If browser automation/headless Chrome is unavailable or crashes, report that limitation and do not call browser QA complete.
- verify the target did not regress to CSS/SVG roads:
  - `grep -q "roadAssetSrc" app.js`
  - `grep -q "road-isometric.webp" app.js`
  - `grep -q "road-topdown.webp" app.js`
  - no active `roadClass` / `road-x` / `road-y` CSS road strip renderer unless explicitly requested.

## Phase 13 — Publish

If publishing is available in the current environment:

- Publish the playable demo to a dedicated public/share/export folder.
- Publish showcase pages to a separate dedicated folder.
- Return direct file URLs or paths, not just folder URLs.

If the previous public folder cannot be deleted or overwritten because the mounted share is immutable / permission-protected, publish the clean build under a new versioned directory such as `<project>-v2` and return that URL. Do not leave a partially overwritten public package.

Do not include raw logs/backups/provenance unless requested.

## Phase 14 — Final report

Report:

```text
Target project: ...
Provider-generated backgrounds: X/Y
Provider-generated sheets: X/Y
Provider background-removal: X/Y
Heuristic/local cutout: X/Y
Final crops: X/Y
Fallback/local/reused old assets: count + IDs
Failed sheets/backgrounds: IDs + provider error
Runtime/data wiring QA: passed/failed, loaded-but-unused data, dangling IDs, save namespace status
Browser QA: passed/failed/skipped with reason; screenshot/interaction evidence if available
Visual QA: passed/failed, contact sheet/showcase path or URL, label map status, issues found, fixes after QA
Public playable: ...
Public showcase: ...
Important paths: ...
```

Never merge these statuses into a vague “QA passed”. Report smoke test, runtime/data QA, visual QA, browser QA, and generated-asset pipeline status separately.

