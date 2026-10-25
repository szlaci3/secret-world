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
