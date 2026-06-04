# Notes and Cautions for Static Management Game Theme Customization

## What this skill is / is not

This skill is for **static management / placement game theme customization**, including provider-generated asset migration, usually sheet-first.

It should:

- trigger for “改主题 / 换皮 / 重做某题材版本 / 基于现有项目做新版” when an existing static management/placement game is present;
- treat ambiguous “重做” wording as clone-and-reskin, not rebuild-from-scratch;
- preserve runtime/gameplay behavior;
- preserve existing layout and data contracts unless theme customization explicitly requires small data/copy changes;
- rename source-theme IDs, filenames, storage keys, and asset paths when they can be changed consistently in the target copy, so public code/assets do not carry stale source names;
- update theme data, labels, names, descriptions, goals, and lightweight settings when useful for the requested prototype;
- preserve asset IDs and filenames only when they are required compatibility contracts; otherwise apply a documented rename map;
- generate white-background sheets first, then remove background/cut out, then crop and flatten/preserve alpha according to runtime contract;
- treat non-empty provider artifacts as the required source of truth for generated-art reskins;
- replace final clean assets in-place in a target copy;
- publish clean demos/showcases.

It should not:

- interpret “重做一个 XX 主题” as permission to ignore the existing project;
- rewrite the game engine;
- redesign the gameplay loop;
- change grid/layout/placement logic unless explicitly asked;
- skip cutout/background removal for generated object sheets just because the intermediate sheet background is white;
- claim completion when fallback assets remain;
- substitute local/procedural/placeholder assets for failed image-generation artifacts without explicit user approval;
- count prompt files, manifests, or local placeholders as successful provider generation;
- publish raw logs, backups, or provenance by default;
- leave source-theme names in public runtime files/assets unless explicitly documented as compatibility exceptions.

## Important implementation lessons

1. **Clarify “theme redo” vs “gameplay rebuild”.**
   - If the user says “改主题”, “换皮”, “做成 XX 风格”, or “重做一个 XX 题材版本” with an existing project, default to reusing the source runtime and reskinning it.
   - Do not start from a blank HTML/CSS/JS game unless the user explicitly asks for new mechanics, new engine, or a structural redesign.
   - In the plan/report, say that the implementation assumes `clone + theme customization + asset replacement`.

2. **Separate behavior contracts from theme names.**
   - Reuse the runtime and schema, but do not preserve stale source-theme names merely out of habit.
   - If source IDs/filenames such as `old-castle`, `old-hero`, or `old-background` can be renamed consistently in the target copy, create a rename map and update code/data/assets/manifests together.
   - If a legacy ID/path cannot be changed safely, document it as a compatibility exception and keep it out of user-facing UI.
   - Always run a final grep/find for source-theme names before publishing.

3. **Clarify “sheet” vs “single asset” generation.**
   - This version is sheet-first. Final assets are produced by cropping a generated sheet.

4. **Keep success counts honest.**
   - Example: report `sheets 4/5`, `final crops 77/80` if any fallback remains.

5. **Provider artifacts are a hard gate for generated-art reskins.**
   - A prompt file, manifest entry, or local drawing is not proof of generation.
   - If the provider returns failure or empty artifacts, stop before replacing runtime assets unless the user explicitly approves fallback.
   - Do not publish or report a completed generated-art reskin while required provider artifacts are missing.

6. **Low concurrency is safer.**
   - Many generation providers enforce concurrency limits.
   - Use `workers=1` for large batches unless the environment is known to allow more.

7. **Failed logs can poison retries.**
   - If generation returns empty artifacts or failure, delete that sheet’s failed logs before retrying.

8. **Sheets should be regular, explicit, and size-disciplined.**
   - Every slot must have known row/col/geometry.
   - Avoid irregular overlap unless the manifest and crop logic are explicitly prepared for it.
   - Do not rely on vague `same scale` wording alone; add target slot occupancy and padding, such as `fills about 70% of slot height with 12–18% clean padding`.
   - Split sheets by intended runtime size class when needed: small props, medium buildings, large landmarks, characters.

9. **Final crops are usually transparent for placed objects, but some targets are opaque.**
   - Decide from the runtime contract and visual placement context.
   - Sprites, buildings, furniture, props, characters, pets, icons, and overlays that appear over a live scene usually need alpha.
   - If transparent sprites are required, provider background removal or a documented alpha workflow must run before final replacement.
   - If the final target is opaque, flatten crops onto a deliberate solid background; do not accidentally preserve the sheet’s white background.

10. **Builder backgrounds are playable ground plates, not postcards.**
   - For city builders, room builders, management maps, and placement games, prompt for empty/open buildable terrain.
   - Avoid scenic landscape paintings, cinematic vistas, focal landmarks, or dense decoration that fights the runtime placement layer.
   - Use terms like `open buildable ground`, `empty playable terrain`, `low visual clutter`, and `sparse decorative details`.

11. **Composition-preserving background updates should use reference upload when supported.**
   - Upload the existing source image, then prompt for the same composition/layout.

12. **Use simple prompt language for stubborn sheets.**
   - If generation fails, reduce slot count, simplify the composition, and tighten the style words.

13. **Grid sheets need no-crop cutout, and object sheets need cutout by default.**
    - Provider background removal may auto-crop transparent borders and destroy manifest row/col geometry.
    - When using a local or provider cutout for grid sheets, prefer a no-crop mode (e.g. `rembg` or `remove_background_nocrop`) so canvas geometry stays stable.
    - If no no-crop mode exists, crop raw cells first, then remove background per cell.
    - Do not treat a white generated sheet background as final transparency. White sheets are only a generation/cropping aid; final placed objects should not show white boxes or halos.
    - After provider cutout, **do not run global white / near-white color-key cleanup** on object cells. It can delete legitimate white walls, windows, signs, roofs, clothing, logos, highlights, and eyes. Prefer provider alpha only. If cleanup is still needed, restrict it to edge-connected background remnants or another mask-aware method that preserves internal light pixels.

14. **Character sheets are fragile.**
    - If a character crop becomes a portrait/headshot/bust or loses feet/body, do not accept it.
    - Split unstable character sheets into smaller sheets or single-character generations.
    - Prompts should explicitly say `full body`, `feet visible`, `boots visible`, `complete body inside image`, `not portrait`, `not headshot`, `not bust`, `no crop`.

15. **Visual QA is mandatory and must be semantically correct.**
    - Programmatic checks are not enough; “no missing files” is only a smoke test.
    - Create and inspect a label-readable contact sheet, or provide a clear label map if labels cannot be rendered.
    - QA must check slot identity, white boxes, crop damage, full-body characters/agents/pets when rendered as moving sprites, complete buildings, consistent family/size-class scale, usable scale in runtime, background suitability, and stale assets.
    - Do not accept a prop/item/token in a character sprite slot unless the runtime explicitly represents that actor as a token; otherwise regenerate or mark the visual QA as failed.

16. **Runtime/data QA is separate from visual QA.**
    - If a themed config/data file is loaded, verify the runtime actually consumes it or document it as inactive/flavor-only.
    - Grep definitions and call sites for added systems such as events, quests, goals, recipes, rooms, and characters.
    - Cross-check IDs across data files; a valid JSON file can still be dead or dangling.
    - Browser automation/screenshot failures must be reported as blocked/skipped, not silently replaced by static checks.

17. **Public packages should be clean.**
    - Exclude raw generation, failed logs, backups, and provenance.
    - Exclude stale assets from prior contracts when they are no longer runtime-required, e.g. old SVG files after switching to PNG.

18. **Showcase pages can use the generated sheet or the cropped assets.**
    - For white-background QA boards, use generated-success sheet/crop outputs, not fallback final paths.

19. **Large asset expansions should be split into semantic sheet families.**
    - When the user asks to “double the buildings”, “add many more buildings”, or add a new scale tier such as city walls / castles / large landmarks, do not cram all new assets into the existing sheet or mix tiny props with huge landmarks.
    - Add new 4×4 sheets by family and size class, for example `large-landmarks`, `city-walls-and-gates`, `market-extra`, `small-stalls`, or `service-buildings`.
    - Keep each sheet prompt explicit about the runtime role and size class: large assets can fill 75–85% of the slot height; medium shops usually 65–75%; small props 55–65%.
    - Update runtime data and manifest together. Every newly added non-road building ID needs a matching final asset file, and every generated slice needs a manifest entry.
    - After expansion, regenerate both an “extra assets” contact sheet and an “all runtime assets” contact sheet. Inspect the full board for duplicate-looking assets, wrong semantic mapping, broken scale, accidental crop damage, and whether large assets remain playable at runtime size.

20. **Semantic remapping after visual QA is allowed, but must be recorded.**
    - Provider sheets may return visually strong assets whose slot semantics drift, especially for landmarks, walls, gates, boats, bridges, and mixed city structures.
    - If the generated asset is usable but belongs to a different runtime ID than planned, remap IDs consistently across final filenames, data labels, and manifest notes rather than accepting a semantically wrong contact sheet.
    - Do not pretend the original slot was perfect. Record the remap or exception in the manifest/log/report and rerun the contact sheet.

21. **Public publish targets may be immutable.**
    - Some public-share mounts do not allow deleting or replacing files after publication. If overwriting a public folder fails with permission errors, publish the clean build under a new versioned folder, such as `<project>-v2`, instead of fighting the mount or leaving a half-updated public package.
    - Report the new URL clearly and mention why the previous URL was not overwritten.

## Brand / IP caution

When user requests a branded style, convert it into a safe generic style description, for example:

```text
original toy-brick style, no logo, no brand marks, no official model
```

Do not use protected official assets, logos, minifigure marks, or exact branded set reproductions.

## Prompting caution

For all generation prompts include:

```text
no text, no watermark, no logo
```

For sheet prompts include:

```text
explicit grid layout, clear slot order, enough spacing, consistent scale,
uniform bounding boxes, each object fills about 70% of slot height,
12–18% clean padding, no tiny objects, no oversized objects, white background
```

For backgrounds include:

```text
uncluttered gameplay background, open playable areas, no UI, no text
```

For builder / management gameplay backgrounds, prefer:

```text
empty playable terrain background, open buildable ground, sparse decorative details,
low visual clutter, no large focal scenery, no postcard landscape, no cinematic vista,
no buildings blocking placement area, no UI, no text
```

For character sprites include when relevant:

```text
full body, feet visible, boots visible, complete body inside image,
not portrait, not headshot, not bust, no crop, generous margin
```

## Provider driver caution

When using the built-in OpenAI driver (`provider.type = "openai"`):

- verify the model name in the manifest matches what your API key supports (`gpt-image-2`, `dall-e-3`, etc.);
- record the model and cutout method in manifests and final reports;
- if you switch to `provider.type = "command"`, ensure the external CLI returns the expected JSON shape with an `artifacts` array.

When using local `rembg` (`provider.cutout.type = "rembg"`):

- install it first: `pip install rembg`;
- it preserves canvas size by default, which is safe for fixed-grid cropping;
- record `rembg` as the cutout method in reports.

## File safety

- Always verify paths before copying/removing.
- Avoid destructive commands on source project.
- Use timestamped backup folders.
- Avoid `rm -rf` on broad variables unless the path is already verified and inside the project/public target.

## Reporting caution

If publishing an incomplete-but-playable version:

- Say which sheets or crops are fallback.
- Separately report provider-generated, fallback/local/procedural, and reused-old asset counts.
- Separately report provider background-removal and heuristic white-key/alpha processing counts.
- Report the model name/series used by the provider.
- Report visual QA status, checked contact sheet path/URL, issues found, and fixes performed.
- Say the playable package has no missing images if that is true.
- Do not blur “available final file” with “newly generated successfully”.

