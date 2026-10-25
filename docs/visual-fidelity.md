# Natural asset fidelity milestone

Baseline: `14cda4e`. The meadow is the reference; no worlds were added or generated.

## Shared rendering changes

- Trees use tapered branching wood, root flares, folded individual leaves and three deterministic geometry variants per species/palette. Stable ID-based tint variation retains instancing. Spruce, palm, pine and maple use distinct branching/leaf proportions.
- Grass uses curved, tapered ribbons; flowers have radial petals, centers and stem leaves; ferns use paired leaflets. Existing clusters and placement remain intact.
- Rocks use continuously deformed, welded geometry with smooth normals, integrated surface moss, mineral color variation and small-scale relief. Three variants are instanced per palette rather than one React mesh per rock.
- Surface detail uses a generated 128px mipmapped texture, without downloads. Desktop shadows use a cached 2048px soft shadow map. Meadow fill lighting is lower to retain depth.
- Geometry uses indexed vertices and omits hidden branch end caps. The existing slow-device fallback uses fewer leaves/petals, simpler surface materials and no shadows. Its sampling includes slow moving frames instead of discarding all frames longer than 250ms.

The 128 x 128 metre ground, horizontal pavement, collision data, world catalog, object positions and dense small-vegetation count are unchanged. Shared renderers also apply to imported worlds using the existing schema; no AI generation work is included.

## Repeatable visual review

`node scripts/inspect-fidelity.mjs` captures three fixed walking views at 1440 x 960, DPR 1, 65-degree FOV, yaw 0. It uses ordinary world import to change the spawn in a temporary copy, without changing production scene data or adding debug hooks:

| View | Eye position (metres) | Review focus |
| --- | --- | --- |
| Entrance | 0, 1.65, 40 | silhouette, flowers, grass, overall depth |
| Grove | -42, 1.65, -14 | branching, leaf gaps, roots, canopy shadows |
| Stone | -32, 1.65, 5.5 | rock shape, moss, mineral shading |

Images are written to ignored `artifacts/fidelity/after-*.png`. `--baseline` compares against a production build in `artifacts/baseline-dist`, using the baseline lighting from Git. For this milestone that build was made from `git archive 14cda4e`, built with the repository's Vite config. Remove the extracted source after building so Vitest does not discover a duplicate test suite. Before-images live alongside after-images. These stationary captures show full detail; movement may trigger reduced detail on slow devices.

The matched views show separated foliage rather than solid polygon crowns, flower petals and leaves instead of polygon buttons, and irregular rocks whose moss follows the stone surface. This remains a procedural stylized environment, not a photogrammetry asset set.

## Validation

- Production build and TypeScript check passed (existing large-chunk advisory remains).
- 124 tests passed, including finite geometry, deterministic variants, rock bounds and tree mesh budgets.
- Production HTTP smoke passed.
- Software WebGL2 checks passed for walking, pointer lock, collisions, responsive layout/recovery and world imports/switching.
- See the current measurement in `docs/performance.md`. These are local software-renderer results, not hardware GPU or deployment validation.

## Artifact and pavement pass (2026-10-25)

Baseline: `fd4a805` on main, including the earlier natural-asset milestone.

Structures, entrance gates and lantern housings now use shared indexed geometry
with softened masonry edges, stone courses, timber boards/braces, roof courses,
window frames, slatted benches and windmill sail ribs. Solid parts are merged into
one mesh per artifact; lantern/beacon light inserts are separate. Materials reuse
the generated mipmapped surface texture with a directional wood finish. Pond
banks have a rounded profile and water has subtle static ripple normals. Paving
samples grain in scene coordinates so long slabs do not stretch it. There is no
new animation loop, external asset download or new world.

`vegetation-clearance.ts` computes each plant variety's horizontal geometry bounds
at both quality levels, caches their union, and uses separating-axis tests against
scaled/rotated, level paved slabs with a 12cm margin. A cluster whose foliage
reaches paving is omitted from rendering. The source JSON is retained, so imports
receive the same treatment without a schema change. Uphill slabs already excluded
from rendering do not cause vegetation removal. The meadow retains 246/252 small
plant clusters; Silverwood retains 267/268; all other catalog plant counts remain
unchanged. One meadow maple was moved from the windmill path to adjacent ground;
its collision shape moves with it. Existing-world tests also check root clearance
while allowing tree canopies to overhang paths.

Validation: production build/typecheck, 146 tests, HTTP smoke, browser walking,
collisions, imports/world switches and responsive/recovery checks passed. Tests
independently transform every retained plant vertex at both quality levels and
check that none lies on rendered pavement in any catalog world. Geometry tests
cover all nine artifact types and the arch opening.

`node scripts/inspect-fidelity.mjs --artifacts` captures fixed arch, cabin, pavilion,
windmill, beacon and pavement viewpoints. Matching before views were captured
using the production archive build and `--baseline --baseline-ref=fd4a805`.
Images are in ignored `artifacts/fidelity/`. `--baseline-ref` reads the entire
reference world from Git, including its original object positions.

The final isolated Edge 156 SwiftShader run at a 1440 x 960 viewport recorded
35.0 animation frames/sec, 33.4ms p95, 19.2 draw calls/frame and zero overview or
standing idle draws. Adaptive canvas size was 649 x 497, so this is not directly
comparable to the previous 835 x 497 measurements. Hardware GPU and hosted
rendering performance remain unverified. A preceding run caught one late overview
frame during startup; the isolated rerun passed both idle assertions.


## Woodland detail and plant variation (2026-10-25)

This pass adds reusable `structure` varieties `fallen-log` and `stump`, with bark
ridges embedded in the surface, cut-end growth rings, tapered wood and small moss
patches. The fallen trunk tilts just enough to rest both tapered ends on flat
ground. Each prop is one merged indexed mesh, with no additional per-detail draw
calls, animations or external downloads. Explicit collision and full-footprint
boundary checks cover both kinds. The 512-total/64-complex generation limits are
unchanged, and Gemini's instructions describe the new assets and safe placement.

Silverwood Grove is the reference: two logs and two stumps were added, taking it
from 297 to 301 objects. Existing terrain, paths, spawns, trees and plants retain
their authored data. From arrival, walk through the gate: the first fallen log is
on the left before the paved route, and a stump is on the right a little farther
ahead. The western spruce grove contains another log and stump. The other eight
worlds retain their original scene data. Recent trunk overlap and root-removal
adjustments are preserved.

Every plant palette now has three deterministic ID-selected geometry variants.
Stem spacing, height, lean and shade vary within bounded envelopes; flowers and
leaves lean with their stems rather than detaching from them. Variants still use
instancing, with at most three batches per variety/palette. Both detail levels
share the same first stems, and pavement clearance uses the union of all variants
at both levels. Existing saved/imported worlds receive this rendering improvement
without changing their JSON.

Repeatable close views: `node scripts/inspect-fidelity.mjs --natural` captures the
three Silverwood locations at the same fixed eye positions and headings. They use
low eye heights to expose the log cut faces, stump top and ground contact.
Screenshots go to `artifacts/fidelity/after-natural-*.png`.

Verification: 174 unit tests pass, including generated prop collisions, boundary
envelopes against actual mesh variants, deterministic plant geometry, and actual
retained vegetation vertices remaining clear of paving across all catalog worlds.
TypeScript and production build pass (the existing chunk-size advisory remains).
A real Gemini request for a natural woodland trail with a mossy fallen log, cut
stumps, ferns and mushrooms returned a valid 96 × 96m world with 186 objects,
40 trees, one fallen log and one stump. This was a real provider call through the
local function; hosted deployment and provider reliability are separate concerns.

Production HTTP smoke and browser walking/collision/responsive checks pass.
All-world switching and generation UI checks pass. The UI test mocks its API
response; the Gemini request described above was a separate real provider call.
See `docs/performance.md` for the software-rendering sample and its resolution
limitations; no hardware GPU or physical-mobile performance claim is made.
