# Icon World

Choose **World style → Extruded icons**, then select **Icon World**. Browsing
styles does not replace the active scene. Standard worlds retain their existing
data, materials, lighting and controls. No provider request is needed to explore
the built-in world. To generate a new one, enter a description under **Create
World** with **Extruded icons** selected. **Let Gemini decide** lets Gemini choose
between standard scenery and icons in the same request. See
[generation styles](generation-styles.md) for the provider/compiler contract and checks.

## Geometry and reuse

- Ten local Tabler Icons v3.46.0 SVGs, nine filled and one outline (paperclip).
  Their original MIT license is retained in source and the production output.
- `SVGLoader` parses trusted bundled markup; `ShapePath.toShapes()` preserves
  filled contours and holes. The smooth paperclip stroke is expanded into one
  closed silhouette with round caps before extrusion, then rotated upright.
- `ExtrudeGeometry` uses a 0.64 m straight depth with 0.05 m rounded bevels at
  either end (0.74 m overall), four bevel segments and 32 curve segments. The
  longest silhouette dimension is 3.2 m before per-object scaling. Bevels round
  inward, keeping the silhouette constant along the straight sidewalls.
- The clock partitions Tabler's silhouette into a blue rim, cream face and dark
  hands. Each section has the same full depth and colors on both front and back.
  Cap normals stay planar; side and bevel normals are smoothed. One pastel
  material treatment and the world's sunlight/hemisphere fill cover every icon.
- A bounded cache stores geometry per icon name, independent of color, position,
  scale and Y rotation. R3F geometry primitives preserve shared geometry when
  switching worlds. HMR releases the module cache. Materials remain per instance.
- The ten office objects have varied placement, uniform per-instance scales and
  yaw. Existing terrain, grass, on-demand renderer, camera, pointer lock and
  navigation are reused. No extra canvas, external SVG loading or model assets.

## JSON contract

The optional root `style` is `standard` or `icons`. A new object kind has the
usual `id`, `position`, `rotation` (Y radians) and positive `scale` tuple:

```json
{
  "id": "office-folder", "type": "icon", "icon": "folder",
  "position": [7.2, 0, 5], "rotation": -0.3,
  "scale": [1.08, 1.08, 1.08], "color": "#ffd252"
}
```

Supported names: `settings`, `paperclip`, `clock`, `folder`, `briefcase`,
`calculator`, `device-floppy`, `bulb`, `bell`, `book`. `accentColor` and
`detailColor` optionally set the clock face and hands. JSON supplies names and
colors, never SVG markup or URLs. Unknown fields/names are rejected through
`loadWorldJson`/Zod. A missing collision field defaults to a conservative local
3.2 × 0.74 m box, transformed by the same scale/yaw as the mesh; overrides must
cover that box. Whole-object footprints intentionally block the gear opening.
Old worlds require no migration. Nonuniform scale is supported but uniform
scaling best preserves the authored proportions and bevel treatment.

## Verification

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run inspect:icons
npm.cmd run inspect:worlds
npm.cmd run smoke
git diff --check
```

`inspect:icons` uses real browser DOM parsing to check all ten geometries for
finite vertices/normals, dimensions, flat caps, cache identity, matching front
and back silhouettes, solid sidewalls and the gear hole. It exercises the built
production app for style filtering, walking, front/side/back views, switching
back to Standard, one canvas, no generation calls and a mobile touch overview.
Screenshots are saved under `artifacts/icons/`. `inspect:worlds` provides the
existing walking, collision, import, responsive and graphics-recovery regression
checks. Browser checks use installed Edge and software WebGL2; they do not
establish physical-device or hardware GPU performance.

Initial built-in MVP verified on 2026-10-26: all 190 unit tests, production build/typecheck,
`inspect:icons`, `inspect:worlds`, the mocked `inspect:generation` regression,
HTTP smoke and `git diff --check` passed. Front, close, side, rear, overview and
mobile screenshots were visually reviewed. Vite's existing large-chunk warning
remains; no hosted deployment or live provider request was tested for that initial
MVP. Subsequent Gemini integration is recorded in [generation styles](generation-styles.md).

To refresh just the Icon World card after building:

```powershell
npm.cmd run capture:thumbnails -- --world=icon-world
```

Build again after capturing to include the updated static thumbnail in `dist/`.
