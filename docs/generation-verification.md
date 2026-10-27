# Compact worlds and biome generation verification

## Diagnosing provider failures

The local handler now distinguishes unsuccessful Gemini HTTP responses from
content-policy blocks, unreadable JSON responses, and the server deadline.
An unsuccessful provider request returns `providerStatus`, an optional
`providerCode` (for example `INVALID_ARGUMENT` or `UNAVAILABLE`), and a
`diagnosticId` alongside the user-facing `error`. The API still maps most
provider HTTP failures to HTTP 502; the original status is in `providerStatus`.
Provider HTTP 429 remains HTTP 429.

For a failed deployed request, inspect `/api/create-world` in the browser
Network panel, then find its `diagnosticId` in the Netlify function logs under
`world-generation-provider-error`. That entry includes the configured model,
original HTTP status, provider error code, and up to 1,200 characters of the
provider message with the configured API key redacted. Raw provider messages
and response bodies are not returned to the browser. HTML/non-JSON provider
errors still report the original HTTP status without logging their body.

These diagnostics require deployment. They cannot recover provider bodies
discarded by earlier versions, and a successful local request cannot explain
an earlier intermittent production failure.

Verified locally on 2026-10-25. Existing world JSON files were left unchanged.
All nine built-ins load through the same validation boundary and persistent canvas.

## Restored compact-world review

Reviewed authored spawn/camera/path/object data, overview and walking captures,
collision footprints, pond shores, and sampled walkable connectivity for Amber
Meadow, Basalt Reach, Frostlight Grove, The Quiet Garden, Sandstone Oasis, Violet
Sanctuary, and Maple Courtyard. Safe spawns, initial forward movement, and over
95% connected sampled walkable space pass at 0.5m spacing in these small worlds.
No fixture redesign or dimension change was needed. Amber Meadow and Frostlight
Grove retain legacy hillside stones: the renderer already omits those slabs,
leaving walkable grassy routes. Maple Courtyard now has a scene thumbnail.

## Actual Gemini checks

These are real provider results through the local server handler, using the
configured server-only key and default `gemini-3.1-flash-lite`, not simulated
blueprints. The accepted results were rendered and walked in headless Edge.

| Exact prompt | Dimensions | Trees | Total objects | Schema and connected walking admission |
| --- | --- | --- | --- | --- |
| Open Meadow | 128 × 128 m | 15 | 183 | Passed, HTTP 200 |
| A misty woodland | 96 × 96 m | 40 | 157 | Passed, HTTP 200 |
| Dense forest with a narrow path and soft fog | 64 × 64 m | 48 | 159 | Passed, HTTP 200 |

Earlier exploratory requests were less successful: initial woodland/forest
results contained only 25/27 trees. Focused request guidance increased tree
counts without raising budgets. Several meadow requests were rejected for
malformed tuples, a missing color prefix, an excessive cluster count/spread,
or the former minimum placement-group count. Tuple lengths are now preserved
in the provider decoding schema, ranges are explicit in the instructions, and
the arbitrary minimum group count was removed. Invalid data still fails local
validation; generation remains stochastic and there are no automatic paid retries.

Visual review also exposed trees centered on a paved forest route and an authored
arrival facing away from its composition. The compiler now moves conflicting
trunks onto a nearby verge (or omits them if none fits), and orients authored
arrivals into the route. Crown overlap remains allowed.

Generated worlds and screenshots are diagnostic artifacts under ignored
`artifacts/`; these checks do not add generated examples to the catalog.
`check-generation.mjs --live "description"` reports dimensions/tree counts and
stores prompt-specific accepted worlds and raw blueprints for future inspections.

## Automated checks and limits

- 165 unit tests passed, including mixed dimensions, rectangular worlds, safe
  arrivals, rotated narrow-route clearance, unchanged object budgets, and diagnostics.
- TypeScript and production build passed; Vite still reports its existing large
  JavaScript chunk warning.
- Production smoke check passed.
- `inspect:worlds` passed: all nine cards/images, actual pointer lock, walking,
  collisions, responsive/touch layouts, import failures, focus return, and one canvas.
- `inspect:generation` passed: generation UI, walking, local save/revisit/delete,
  quota error, and mobile drawer. This UI test uses a mocked API response; the
  provider results in the table above are independently live-tested.

Budgets remain 512 total instances and 64 complex objects. Trees/plants retain
existing instancing and on-demand rendering. Dense trees still cost geometry
and shadows, and the adaptive low-detail mode visibly thins foliage; tree counts
do not guarantee a fully closed visual canopy on slow devices. Brief software
WebGL walking samples are diagnostic only, with quality fallback, shader warmup,
and view direction affecting results. They are not hardware/mobile GPU benchmarks.
A final 1200 × 800 headless Edge/SwiftShader check sampled two seconds of forward
walking after a short 700ms settle: meadow about 38 fps (p95 83ms), woodland
44 fps (p95 25ms), forest 34 fps (p95 33ms). These brief, view-dependent samples
include quality/warmup effects and show why bounded counts alone are no performance
guarantee; no hardware performance claim follows from them.
Hosted deployment, Netlify rate limiting, and physical-device performance remain
unverified by these local checks.
