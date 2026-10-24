# Rendering verification

## Natural asset fidelity milestone (2026-10-24)

Matched local production measurements against `14cda4e`, Edge 156.0.4314.42,
headless SwiftShader, 1440 x 960, DPR 1, 2-second movement warmup and sample.
Both runs entered the adaptive 835 x 497 reduced-detail mode. These short
software-renderer samples are diagnostic, not hardware GPU benchmarks.

| Measurement | Baseline | Improved assets |
| --- | --- | --- |
| First WebGL draw | 611 ms | 956 ms |
| Animation-frame cadence | 37.7 FPS | 26.8 FPS |
| p95 frame interval | 33.4 ms | 41.7 ms |
| Mean draw calls per frame | 35.7 | 33.4 |
| Idle overview / standing draws | 0 / 0 | 0 / 0 |

The more detailed assets increase geometry cost: software cadence is about 29%
lower despite fewer draw calls. Hardware desktop performance remains unverified.
Optimizations include indexed geometry, instanced rocks, three shared tree
variants, cached shadows, mipmapped generated surface noise, and a simpler
fallback that removes fine relief, twigs and some petals/leaves. Full-detail
stationary comparisons are documented in [visual-fidelity.md](visual-fidelity.md).
The baseline and final JSON reports are in ignored `artifacts/performance-before.json`
and `artifacts/performance.json`; rerun with `node scripts/measure-performance.mjs`.

## 128 × 128 meter baseline before the denser ground-cover update

These measurements precede the increase from 84 to 252 small plant clusters
and the removal of seven hillside path slabs (current meadow: 337 objects).
Mobile performance is outside the current verification scope.

Recorded 2026-10-24 with the local production build, Edge 156.0.4314.42,
headless SwiftShader software WebGL2, 1440 × 960 viewport. The active built-in
is The Open Meadow: 176 objects over 16,384 m². These results do not establish
hardware GPU, physical phone, cross-browser, or deployed performance.

| Measurement | Observed |
| --- | --- |
| First WebGL draw | 774 ms |
| Terrain vertices / triangles | 1,089 / 2,048 |
| Active animation-frame cadence after warmup | 20.2 FPS |
| p95 animation-frame interval | 58.3 ms |
| Mean draw calls per rendered frame | 36.3 |
| Idle overview / standing draw calls | 0 / 0 |
| Adaptive canvas resolution | 835 × 497 |

The initial 128m implementation measured about 8.5 FPS with 145.5 draw calls per
frame in this software renderer. Tree instancing, a 32-segment terrain mesh,
and simpler vegetation on slow devices reduced the workload. The slow-device
fallback now disables shadows, uses 0.6 pixel density, and reduces tree crown
detail and decorative stems. The full-detail overview remains available before
fallback. Software rendering is still limited; 20 FPS is not a claim of smooth
hardware performance. The 128m size is bounded by geometry/object budgets rather
than a dense one-meter mesh across the whole map.

Walking and visible terrain use the same triangle interpolation. Generation
connectivity sampling is separately bounded at 64 samples per axis; the fixture
compiler took approximately 236ms locally. Collision remains exact during walks.
`node scripts/build-meadow.mjs` rebuilds the authored large-world fixture.

The measurements below are historical small-world baselines, not current claims.

## Original small-world verification

Recorded 2026-10-24 using the local production build, installed Edge
155.0.4283.62, headless SwiftShader software WebGL2, 1440 × 960, DPR 1.
No other browser QA was running during the measurement.

| Measurement | Observed |
| --- | --- |
| First WebGL draw from navigation | 551 ms |
| Overview idle draw calls over 1 second | 0 |
| Walking warmup before measurement | 2 seconds |
| Active sample | 2.002 seconds, 86 rendered frames |
| Browser animation-frame cadence | 43.0 FPS |
| 95th percentile animation-frame interval | 33.4 ms |
| Actual WebGL draw calls during active sample | 2,895 |
| Mean draw calls per rendered frame | 33.7 |
| Standing-still draw calls over 0.5 seconds | 0 |

The walking warmup allows automatic quality reduction on slow rendering devices.
This is an adaptive-quality result, not a measurement of shadows continuously
enabled. Frame cadence is measured using `requestAnimationFrame`; it is not a
GPU timer or an input-latency measurement. The camera moves during the sample,
so visibility and draw counts vary along the route.

The page shell is approximately 326 KB (100 KB gzip estimate); the asynchronously
loaded 3D chunk is approximately 925 KB (245 KB gzip estimate). Splitting lets
the loading UI appear before the 3D module is ready; it does not remove the
eventual 3D download. Vite still warns about the large 3D chunk. Gzip figures
come from the build report, not a verified hosting compression configuration.

## Rendering choices

- Demand rendering in both the overview and standing first-person view.
- Static sun shadows are computed when world data or the shadow size changes,
  then reused during camera motion. The ground and path stones receive shadows;
  prop meshes cast them. Shadow maps are 1024², or 512² for a narrow canvas.
- Path stones are instanced by color: the fixture's 12 stones use two mesh
  batches, with all instance transforms still taken from JSON.
- Pixel density is capped at 1.5. If sustained movement frames average below
  30 FPS over a 1.5-second sample, shadows turn off and density becomes 0.8 for
  that canvas's lifetime. The one-way fallback avoids quality oscillation.
  Idle frames and intermittent mouse look are not counted as movement workload.
- Decorative water, plants, and lighting remain static; there is no background
  animation loop, external model download, or remote font dependency.

## Reproduce

```powershell
npm.cmd run build
npm.cmd run measure:performance
```

The script writes raw results to Git-ignored `artifacts/performance.json`. Run
it separately from other browser checks. Timings vary with CPU load, shader/cache
warmup, browser scheduling, and device capability. Hardware GPU, physical mobile
device, network/deployed latency, and cross-browser performance are unverified.

## Milestone 2: three-world verification

Recorded 2026-10-24 on the same local Edge 155 / SwiftShader setup above,
with browser QA stopped during measurement. Each sample follows two seconds
of walking warmup and about two seconds of measured forward movement.

| World | Objects | Animation-frame FPS | p95 interval | Draw calls / render | Idle overview / standing draws |
| --- | --- | --- | --- | --- | --- |
| The Quiet Garden | 30 | 40.7 | 33.4 ms | 33.7 | 0 / 0 |
| Sandstone Oasis | 20 | 53.6 | 33.4 ms | 7.9 | 0 / 0 |
| Frostlight Grove | 20 | 45.3 | 33.4 ms | 19.7 | 0 / 0 |

These are software-rendered adaptive-quality observations, not hardware GPU
or mobile performance guarantees. Both added worlds stay below the original
world's draw workload on this route. They reuse the existing static primitive
library, instanced paths, cached shadows, pixel cap, and quality fallback.
No textures, models, animations, dependencies, or per-world renderer branches
were added. The new production shell is 337 KB (102 KB gzip estimate), CSS is
6 KB (1.9 KB gzip), and the 3D chunk remains 925 KB (245 KB gzip). The existing
Vite large-chunk warning remains.

```powershell
npm.cmd run measure:performance
npm.cmd run measure:performance -- "--world=Sandstone Oasis"
npm.cmd run measure:performance -- "--world=Frostlight Grove"
```

Raw output is in `artifacts/performance.json`,
`artifacts/performance-sandstone-oasis.json`, and
`artifacts/performance-frostlight-grove.json` (Git-ignored). `firstDrawMs` measures
initial page navigation to the original world's first draw, including in the
runs that subsequently select another world; it is not a switching-latency metric.

The milestone 2 browser gate additionally checks all three selections, walking
from each spawn, repeated switching, canvas identity, the current-world marker,
and picker width at 320px. Unit checks validate the new JSON through the existing
loader, follow each central trail, and verify blocked water and solid footprints.

## Six-world enrichment (current implementation)

Measured 2026-10-24 on Edge 155.0.4283.62, headless SwiftShader software WebGL2,
at 1440 × 960, device scale factor 1. No browser QA ran concurrently. These
measurements supersede the smaller milestone 2 fixtures above.

| World | Objects | Animation-frame FPS | p95 interval | Draws / render | Canvas pixels after sampling |
| --- | --- | --- | --- | --- | --- |
| The Quiet Garden | 60 | 38.0 | 33.4 ms | 43.8 | 1113 × 643 |
| Sandstone Oasis | 64 | 45.0 | 25.1 ms | 27.5 | 1113 × 643 |
| Frostlight Grove | 60 | 30.8 | 41.7 ms | 42.1 | 1392 × 804 |
| Amber Meadow | 99 | 32.1 | 41.6 ms | 27.0 | 1392 × 804 |
| Basalt Reach | 70 | 45.4 | 25.1 ms | 17.8 | 1113 × 643 |
| Violet Sanctuary | 75 | 33.2 | 36.2 ms | 31.3 | 1113 × 643 |

All six recorded **zero draw calls** during the settled overview and while
standing still. Each active sample lasts about two seconds after two seconds of
forward-walking warmup. Results vary by route, visibility, shader warmup, browser
scheduling, and device. These are adaptive-quality results, not fixed-resolution
comparisons or hardware GPU guarantees. The added `canvasPixels` report field
makes the rendered resolution explicit.

The first enrichment pass exposed excess work in software rendering. Terrain now
uses a grid of at most 1 m spacing, ground patches use 256 triangles, and the
existing quality fallback activates below 30 FPS over 1.5 seconds of sustained
movement. Fallback disables shadows and lowers canvas pixel density to 0.8 for
the canvas session; normal rendering remains capped at 1.5. Camera height uses
exact interpolation of the rendered terrain triangles, including in fallback.

Plant clusters are merged into one low-poly geometry and instanced by variety and
two-color palette. Path stones remain instanced by color. Each world has only one
shadow-casting light, static geometry and shadows, and no continuous animations.
Geometry/material resources are released on replacement. Walking input listeners
belong to the shared canvas session and are released when that session is disposed.
There are no added packages, model downloads, textures, or external font requests.

The current production shell is 397 KB (115 KB gzip estimate), the lazy 3D chunk
is 938 KB (249 KB gzip), and CSS is 6 KB (1.9 KB gzip). Vite still reports its
existing large-3D-chunk warning. Compression estimates are from the local build.

Run measurements separately from other browser work:

```powershell
npm.cmd run measure:performance
npm.cmd run measure:performance -- "--world=Sandstone Oasis"
npm.cmd run measure:performance -- "--world=Frostlight Grove"
npm.cmd run measure:performance -- "--world=Amber Meadow"
npm.cmd run measure:performance -- "--world=Basalt Reach"
npm.cmd run measure:performance -- "--world=Violet Sanctuary"
```

Results are written to `artifacts/performance.json` for the default garden and
`artifacts/performance-<world-name>.json` for named worlds. Overview and first-person
screenshots are saved by `inspect:worlds`. Automated checks cover all six worlds,
repeated switches with one WebGL canvas, walking, imports, responsive layouts,
focus recovery, and graphics failure handling. Unit tests additionally check
terrain/camera agreement, gentle-hill bounds, shoreline clearance, and that at
least 95% of the sampled walkable ground is connected to each world's spawn.
Physical mobile devices, hardware GPU performance, and hosted latency remain unverified.

## Sidebar world browser

The world list uses six static JPEG screenshots (about 91 KB combined), with a
centered 1.7× crop for clearer landmarks. Later thumbnails load lazily; browsing
creates no extra canvases or WebGL contexts. The selected scene keeps the shared
renderer and input session. A thumbnail click updates its world and requests
pointer lock synchronously, before React updates scene data.

The production shell is now about 399 KB (115 KB gzip estimate), CSS is 7.1 KB
(2.3 KB gzip), and the 3D chunk remains 938 KB (249 KB gzip). The existing large
3D chunk warning remains. The previous timing tables describe their recorded
builds; they are not measurements of the new sidebar. Screenshot generation is
an offline authoring step, not work performed by a visitor's browser.
