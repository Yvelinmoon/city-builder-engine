# Manifest and Discovery

Use this reference to turn an existing static game project into a deterministic sheet-first asset replacement plan. Keep it environment-neutral: discover actual project paths at runtime instead of assuming a fixed folder layout.

## 1. Locate asset path contracts

Search code, styles, templates, and config/data files for media references using the tools available in the current environment.

Example search pattern:

```bash
grep -R "<asset-root-or-media-pattern>\|\.webp\|\.png\|\.jpg\|\.jpeg\|\.gif" -n <candidate-runtime-files-and-data-dirs> || true
```

Common contracts to look for:

- fixed background paths;
- ID-based sprite paths;
- character/avatar paths;
- CSS `url(...)` references;
- data/config fields such as `image`, `sprite`, `asset`, `icon`, `thumbnail`;
- generated template strings in JS/TS.

## 2. Read project data sources and freeze reuse contract

Inspect whichever files define asset IDs, display names, categories, dimensions, sheet order, or crop order. These may be JSON, YAML, JS modules, TS modules, CSV, TOML, or another project-specific format.

Do not assume a specific file name. Use repository discovery.

For theme-only or ambiguous “重做” requests, write down the parts that must be reused before implementing:

```text
entry/runtime files:
game loop / state / save behavior:
placement/grid/economy rules:
DOM/canvas/layer structure:
CSS/layout system:
data schema and IDs:
asset path patterns:
validation/build/publish commands:
```

If the implementation later replaces these with a new architecture, it has drifted out of this skill’s intended path unless the user explicitly requested a rebuild.

## 3. Generate a sheet manifest

A good sheet entry includes:

```json
{
  "id": "<sheet-id>",
  "kind": "sprites",
  "rows": 4,
  "cols": 4,
  "prompt": "<sheet prompt>",
  "raw": "<raw sheet path>",
  "cutout": "<optional cutout sheet path>",
  "slices": [
    {
      "id": "<asset-id>",
      "name": "<human-readable name from project data>",
      "row": 0,
      "col": 0,
      "target": "<final runtime asset path>"
    }
  ]
}
```

Recommended manifest location is inside a project-specific generation workspace chosen at runtime.

## 4. Count before generating

Always state the expected work size before starting:

```text
backgrounds/scenes: N
sheets: N
final crops: N
```

If a project still needs one-shot backgrounds, keep those separate from the sheet plan.

## 5. Preserve source project and reuse runtime

Create an isolated target copy unless the user explicitly approves overwriting:

```bash
cp -a "<source-project>" "<target-project>"
```

Never overwrite source by default.

For “改主题 / 换风格 / 重做 XX 题材” requests, start from this copy and modify theme data/assets in place. Do not create a blank new HTML/CSS/JS game beside it unless explicitly asked.

## 6. Backups

Before replacing final runtime assets, back up the target project’s current clean assets to a project-local backup location.

Do not publish backup folders.

