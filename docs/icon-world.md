# Icon World

Choose **World style → Extruded icons**, then select **Icon World**. Browsing
styles does not replace the active scene. Standard worlds retain their existing
data, materials, lighting and controls. No provider request is needed to explore
the built-in world. To generate a new one, enter a description under **Create
World** with **Extruded icons** selected. **Let Gemini decide** lets Gemini choose
between standard scenery and icons in the same request. See
[generation styles](generation-styles.md) for the provider/compiler contract and checks.

## Geometry and reuse

- A local catalog of 2,154 Tabler Icons v3.46.0 SVGs, preferring filled versions and
  supplementing them with outline icons for animals, buildings, music, food, transport,
  nature and other everyday subjects. The original ten are preserved byte-for-byte.
  Their MIT license is retained in source and the production output.
- Additional SVGs load on demand from same-origin static assets under `public/tabler/`,
  before the existing canvas reports readiness. Loading errors use the existing retry flow.
  There are no runtime CDN dependencies, generated model files or arbitrary SVG inputs.
- `SVGLoader` parses trusted markup; `ShapePath.toShapes()` preserves
  filled contours and holes. The smooth paperclip stroke is expanded into one
  closed silhouette with round caps before extrusion, then rotated upright. Other outline
  icons use Clipper to expand open/closed strokes, union intersections and preserve holes.
  This handles the pinned catalog, rather than claiming universal SVG support.
- `ExtrudeGeometry` uses a 0.64 m straight depth with 0.05 m rounded bevels at
  either end (0.74 m overall), four bevel segments and 32 curve segments. The
  longest silhouette dimension is 3.2 m before per-object scaling. Bevels round
  inward, keeping the silhouette constant along the straight sidewalls.
- The clock partitions Tabler's silhouette into a blue rim, cream face and dark
  hands. Each section has the same full depth and colors on both front and back.
  Cap normals stay planar; side and bevel normals are smoothed. One pastel
  material treatment and the world's sunlight/hemisphere fill cover every icon. Indexed
  geometry shares equal positions, normals and UVs without changing the surface shading.
- A cache stores geometry per icon name/detail level (full, medium, far), independent of color, position,
  scale and Y rotation. It retains up to 96 recent entries plus any still-active geometry. R3F geometry primitives preserve shared geometry when
  switching worlds. HMR releases the module cache. Spatial batches share geometry and
  materials while retaining per-instance transforms and colors.
- The ten office objects have varied placement, uniform per-instance scales and
  yaw. Existing terrain, grass, on-demand renderer, camera, pointer lock and
  navigation are reused. No extra canvas or model assets. Icon geometry now follows
  distance-based LOD rather than the global slow-frame fallback; see below. A fogged 48m
  walking view remains available under rendering pressure in populous icon worlds.

## Topic selection and capacity

`src/icons/catalog.json` contains upstream categories and tags; `src/icons/names.ts`
provides the validated runtime name list. Selection ranks names/tags against the brief,
with related-term expansion for common subjects. Only up to 80 shortlisted names enter
Gemini's instructions and decoding enum. The server also rejects off-shortlist results.
This remains one provider call; no complete catalog is sent per request. Search metadata
is English, so ambiguous or non-English descriptions may retrieve less useful candidates.
Automatic mode chooses between natural 3D scenery and symbolic icon compositions on any topic.

Edit `src/icons/config.json` (`maxObjects`) and rebuild/redeploy to change the shared
server/browser generation budget. Default: **96**, supported configuration range **25–256**.
Standard worlds keep their 64-complex-object budget. Icon worlds allow 48 reusable assets,
128m ground axes, and the configured object count plus up to 96 decorative grass clumps.
Admission still enforces bounds, walking gaps, connected navigation and a safe spawn.
Higher configured capacity does not guarantee hardware-independent performance.

To reproduce the vendored catalog, download the pinned package and run the importer:

```powershell
npm pack @tabler/icons@3.46.0 --pack-destination artifacts
tar -xf artifacts/tabler-icons-3.46.0.tgz -C artifacts
node scripts/import-icon-catalog.mjs
```

The importer prefers all filled icons plus outline icons from practical subject categories,
excluding outline off/numbered variants. It retains upstream names, categories and search tags.

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
npm.cmd run check:icon-catalog
npm.cmd run check:icon-catalog -- --low
npm.cmd run check:icon-catalog -- --medium
npm.cmd run inspect:icon-lod
node scripts/inspect-icon-walking.mjs
npm.cmd run check:icon-themes -- --live
npm.cmd run inspect:icon-themes
npm.cmd run inspect:worlds
npm.cmd run smoke
git diff --check
```

`check:icon-catalog` checks all 2,154 geometries (including `--low`) for finite vertices/normals,
bounds and cache reuse. `check:icon-themes --live` makes paid provider calls using the local
server-only key; `inspect:icon-themes` renders those saved results and benchmarks 24/96/192
objects. Artifacts stay under ignored `artifacts/`.

`inspect:icons` uses real browser DOM parsing to check the original ten geometries for
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

## Topic-driven expansion verification (2026-10-26)

Real Gemini requests produced admitted worlds for all five briefs: underwater (11 icons,
9 names), village (7 icons, 6 names), zoo (25 icons, 8 names), music festival (9 icons,
9 names) and office (10 icons, 8 names). A separate large music-festival brief produced
exactly 96 icons with 8 reusable silhouettes. Automatic mode selected icons for a symbolic
underwater brief and standard objects for a natural garden. Provider timeouts/high-demand
503s and invalid initial designs also occurred; they returned bounded errors without
automatic paid retries. Dense repeated icon groups were subsequently given collision-aware
packing, and the admitted 96-object result was rendered and walked.

All 2,154 catalog SVGs passed full- and reduced-detail finite-geometry, envelope and cache
checks. Production rendering checks covered all five live themes, the 96-object result,
world switching, retained canvas identity and zero redraws in settled overviews.

The final local software-rendering benchmark used headless Edge/SwiftShader at a
1440×960 viewport with the existing adaptive fallback (649×497 render buffer).

| Scene | Distinct icons | Moving FPS | P95 frame | Settled redraws |
| --- | ---: | ---: | ---: | ---: |
| Synthetic 24 objects | 24 | 21.1 | 50.1 ms | 0 |
| Synthetic 96 objects | 47 | 18.4 | 66.7 ms | 0 |
| Synthetic 192 objects | 47 | 15.0 | 66.8 ms | 0 |
| Gemini 96-object festival | 8 | 24.3 | 50.1 ms | 0 |

These conservative software results support a 96-object default rather than enabling
192 by default. They also show that silhouette variety matters: more unique shapes cost
more than copies. Individual themed scenes measured about 16–29 FPS in the same software
renderer. Hardware GPU performance, physical mobile performance and hosted deployment
were not measured. Detailed local results/screenshots are under `artifacts/icon-themes/`.

The final build/typecheck, 214 unit tests across 22 files, generation-style UI regression,
all-world walking/collision/import/responsive/recovery regression, original Icon World
regression, HTTP smoke and staged diff checks passed. The collision browser check now
waits for a bounded stable view at obstacles instead of assuming software-rendered
movement reaches the boundary after a fixed wall-clock delay.

## Smooth nearby icons and optional plain ground

Icons have three cached geometry levels, retaining the same 0.64m depth, 0.05m bevels
and upright proportions. Full detail uses four bevel segments and denser curve sampling
(including increased sampling for close-range catalog outlines/fills); medium uses three
bevel segments, far uses two. The original clock partitions and original icon shapes remain.

Distance is measured from the camera to the icon center, divided by its largest scale.
Nominal boundaries are 14m and 36m, with 10% hysteresis: full detail is guaranteed on
approach inside 12.6m and retained while leaving until 15.4m; far/medium boundaries are
32.4m and 39.6m. Larger icons retain detail farther away. Each instance selects its own
level, including copies within the same spatial batch. Only changed membership rewrites
instance buffers; the camera updates before LOD selection. Empty levels are hidden and
nonempty levels retain spatial culling and instancing. Cached shadows refresh when mesh
silhouettes change. There is no extra permanent animation loop.

Nearby icons use the same full mesh under both normal and reduced rendering budgets.
Icon quality can recover after sustained fast moving frames: reduction below 28 FPS over
a two-second window, recovery above 48 FPS for two windows after an eight-second moving
cooldown. Standing still is not treated as evidence of spare rendering capacity. Icon
reduced mode uses 0.85 DPR rather than the former 0.6, disables the directional shadow,
and retains the existing pressure-dependent 48m view cap for populous worlds. Geometry
LOD remains independent of those settings. Standard-world quality behavior is preserved.

**Icon ground → Plain monochrome** is an optional view preference in the world picker.
The default remains **Meadow**. Plain mode draws a flat, two-triangle, untextured plane
in the world's existing ground color and hides decorative planting/patches. It avoids
baking the ground-cover texture and using its textured/grain material. The selector is
scoped to icon worlds; it does not change world JSON, generation requests, saved worlds
or Standard rendering. The preference lasts for this app session and applies across icon
world selections.

The test-only `inspect:icon-lod` harness observes production components while moving the
camera toward and away from a curved icon at both rendering budgets. It verifies exclusive
LOD membership and identical nearby geometry, and captures transition screenshots. The
production walking script exercises the real import UI, keyboard movement in both
directions, meadow/plain/meadow switching, canvas reuse and zero idle redraws.

A controlled paired software benchmark used 96 icons plus 96 meadow grass clumps, fixed
reduced shading, a 1020×680 render buffer and the same repeatable camera motion. Four
alternating samples (meadow/plain/plain/meadow) averaged **24.3 FPS meadow** and **27.5 FPS
plain**, about **13% higher FPS** for plain ground. At the matched final camera pose, calls
fell from **50 to 47**, and rendered triangles from **105,744 to 101,394** (about 4% fewer).
This is a modest optional saving; distance LOD is the main visual-quality change. Hardware
GPU and physical-mobile performance remain unmeasured. The real production walking samples
were approximately **21.4 FPS meadow / 24.0 FPS plain**, with zero settled redraws.
Artifacts and screenshots are under `artifacts/icon-lod/`; these numbers are not directly
comparable to the earlier, lower-resolution benchmark above.

Validation for this change: 218 tests across 23 files, production build/typecheck, all 2,154
full-detail and new medium-detail geometry checks, the LOD transition/ground benchmark,
production 96-icon walking checks, original Icon World checks, all-world walking/collision/
import/responsive/recovery regression, generation-style UI regression, smoke and diff checks
passed. Existing worlds and the three generation choices are preserved.
