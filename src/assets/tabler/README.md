# Bundled Tabler icons

Source: https://github.com/tabler/tabler-icons/tree/v3.46.0/icons

These ten unmodified SVG files are from Tabler Icons v3.46.0, MIT licensed by
Paweł Kuna. See LICENSE in this directory. Nine use `icons/filled`; paperclip
uses `icons/outline` and is converted to a closed, round-capped outline before
extrusion. The clock's original silhouette and hand cutout are partitioned into
three colors. All adaptation occurs in `src/scene/icon-geometry.ts`.

These original SVGs remain bundled locally. The expanded catalog is vendored under
`public/tabler/` and loaded on demand from the same site. See `docs/icon-world.md`
for catalog selection, provenance, regeneration and geometry checks.
