# Kairo-like Placement Runtime Reference

This folder is the reference runtime for the `static-management-game-theme-customization` skill.

It captures the static HTML/CSS/JS placement-management game framework that current theme-customization work is based on. Use it as the source runtime contract when creating a new themed prototype, then replace copy/data/assets in an isolated target project while preserving the gameplay loop.

## Included runtime files

- `index.html` — static entry page and HUD/stage/panel DOM contract.
- `app.js` — core placement, road, grid, idle economy, goals, character movement, save-state, and UI logic.
- `styles.css` — full-screen game layout, map, panels, HUD, sprite, and interaction styling.
- `sfx.js` — lightweight browser-generated sound effects.
- `data/*.json` — example runtime data contract for buildings, characters, events, goals, and project config.
- `SOURCE_README.md` — README copied from the source project for historical context.

## Asset contract

The runtime expects clean final assets at these paths relative to the project root:

```text
assets/image2-clean/scene/main.webp
assets/image2-clean/buildings-normalized/<building-id>.webp
assets/image2-clean/characters-normalized/<character-id>.webp
```

The IDs come from:

```text
data/buildings.json
data/characters.json
```

When reskinning, keep final paths and IDs aligned with the data files, or update the data and runtime references together.

## Usage rule

Do not edit this reference directly for a user project. Copy it into a new isolated target folder, then customize the copied project.
