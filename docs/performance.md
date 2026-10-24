# Task 5 rendering verification

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
  25 FPS over a 1.5-second sample, shadows turn off and density becomes 1 for
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
