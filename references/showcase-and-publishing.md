# Showcase and Publishing

Use this reference to create screenshot-friendly asset boards and clean public demos. Keep it environment-neutral: publish only if the current environment provides a public-share mechanism.

## Pure white asset showcase HTML

When the user wants a screenshot board of all successfully generated assets:

- Use pure white page background.
- Do not include text, captions, labels, or explanations.
- Use only generated-success assets, not fallback assets, unless the user asks to include fallbacks.
- Optionally include the generated background first.

Example structure:

```html
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
html,body{margin:0;background:#fff;}
body{min-width:1600px;}
.wrap{box-sizing:border-box;width:1600px;margin:0 auto;padding:40px;background:#fff;display:flex;flex-wrap:wrap;gap:28px;align-items:center;justify-content:center;}
.scene{width:720px;height:auto;object-fit:contain;display:block;background:#fff;}
.asset{width:150px;height:150px;object-fit:contain;display:block;background:#fff;}
</style>
</head>
<body><div class="wrap">
  <img class="scene" src="./<relative-generated-background-path>" alt="">
  <img class="asset" src="./<relative-generated-cutout-path>" alt="">
</div></body>
</html>
```

Save the showcase in a project-appropriate QA/output folder.

## Mandatory labeled visual QA contact sheet

In addition to any pure-white user-facing showcase, create an internal labeled contact sheet and inspect it before publishing. Labels are allowed here because this is for QA, not presentation.

The contact sheet should make it easy to check:

- the generated background and whether it is gameplay-suitable;
- every final crop with its asset ID/name;
- transparent areas on a checkerboard or contrasting background;
- slot/order correctness;
- full-body character sprites where required;
- no accidental white boxes, cutout damage, watermark/text/logo, or stale assets.

If visual QA fails, fix and regenerate the contact sheet before publishing.

The bundled generic helper is:

```text
engine/make_showcase.py
```

## Clean public playable package

If public publishing is available, publish to a dedicated folder, not a shared root.

Only include runtime-required files:

```text
<runtime entry files>
<runtime source files>
<runtime data/config files>
<final clean runtime asset folders>
```

Exclude unless explicitly requested:

```text
<generation-workspace>/logs/
<generation-workspace>/raw/
<generation-workspace>/cutout/    # unless a showcase needs it
<backup folders>
<raw provenance folders>
<version-control metadata>
```

## Clean public showcase package

For showcase pages, publish separately from the playable demo and include only assets referenced by the showcase HTML.

## URL construction

Use the URL mechanism provided by the current environment. Return a direct file URL, usually the HTML entry file, not only a folder URL.

## Final checks

Run the project’s own validation commands, if known.

Also count files and package size using environment-appropriate commands/tools when useful.

