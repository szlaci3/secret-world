# Gemini world styles

Choose **World style** before generating. The selector stays disabled during a
request so the submitted choice remains visible. All three modes share the
existing description, progress/cancel, validation, enter, save, revisit and delete
flow. Switching styles preserves the current scene and draft description.

| Choice | Generation behavior | Built-in list |
| --- | --- | --- |
| Standard 3D objects | Existing landscape assets and biome guidance | Nine standard worlds |
| Extruded icons | Topic-selected Tabler icons, with optional small grass clumps | Icon World |
| Let Gemini decide | Gemini chooses `standard` or `icons` and returns the complete blueprint in one call | All ten worlds |

Results show the actual style and dimensions before entry. Saved worlds retain
their style through reload and re-entry. Legacy saved/imported worlds without a
style remain standard. The built-in fixtures remain unchanged; the original ten icon silhouettes retain their full-detail appearance.

## Server contract

`POST /api/create-world` accepts `{ "prompt": "...", "style": "icons" }`.
`style` is `standard`, `icons`, or `auto`; omitted style defaults to standard for
older callers. Invalid values are rejected before contacting Gemini. Credentials,
model configuration, rate limiting and bounded requests remain server-side.

The provider receives a schema and instructions for the requested style. Explicit
choices are binding. Automatic output must contain a resolved `style`, then pass
the corresponding narrower local schema. A mislabeled or mixed-style blueprint
is rejected; the compiler never silently changes the selected style.

Standard generation retains the previous asset, terrain, biome, object-budget
and navigation checks. Icon generation uses:

- Only validated catalog names (2,154 pinned Tabler SVGs) and optional `plant`/`grass` assets. No custom
  markup, SVG URLs, models or unsupported object kinds.
- Flat ground with independent 24–128m axes, up to the configured icon budget (96 by default),
  48 reusable assets and at most 96 retained grass clumps. Gemini chooses singles,
  groups or a mixed composition and a single/group policy for each icon kind.
  Authored counts are preserved; the previous 32–48 default does not pad deliberate
  compositions with duplicate symbols. Explicit counts and minimums are enforced
  up to the configured budget. Provider group positions are
  compacted and the ground fitted to actual occupied bounds; see [Icon World](icon-world.md).
- Uniform icon scale, using the blueprint's Y component for all three axes.
  Instance colors and Y rotations are retained; depth, bevels, materials and
  geometry reuse come from the existing icon renderer.
- Full rotated/scaled icon footprints inside the ground and at least 1.2m
  separation along a separating axis between each pair. This conservatively
  reserves walkable gaps, including around diagonal neighbors. Icons use
  explicit placements or `count`/`spread` groups. Repeated icon groups are packed deterministically
  inside the supplied radius, with exactly the final footprint clearance. Counts are preserved;
  groups without room fail admission. Standard-world cluster rules remain unchanged.
- Decorative grass outside the ground or centered inside icon footprints is
  omitted. Out-of-bounds icons still fail admission. Standard-world bounds
  validation is unchanged.
- Blocking icon footprints, connected-space validation and a clear safe spawn
  from the existing navigation compiler. Arrival faces the icon composition.
  A closer overview camera and hemisphere fill keep the compact scene legible.

Generated worlds store `style: standard|icons`; `auto` is never stored as a world
style. JSON admission and browser rendering use the same existing world schema.

Standard generation and clear English icon topics use one provider call. Icon and
automatic modes optionally add a search-term interpretation call for weak keyword
coverage or recognized abstract themes; see [Icon World](icon-world.md). The extra
call uses the same model/key, up to 800 output tokens and an 8-second timeout. Invalid,
failed or timed-out interpretation falls back to keyword selection. Generation retains
its 10,000 output-token limit. All stages share a 45-second deadline and cancellation;
there is no automatic paid retry. Validation failures report a
bounded diagnostic and leave the active world intact. Cancellation and stale
response guards apply to every style.

## Verification

Selective interpretation on 2026-10-27: 247 tests, production build/typecheck and
production smoke check passed. Five real provider calls through the local handler
produced validated worlds for all three briefs: English office (one call, 40 icons),
Dutch village (two calls, 35 icons including bike, church, pig and trees), and burnout
to balance (two calls, 37 icons including broken heart, bed, handshake and charging
battery). These checks verify local/provider integration, not a hosted deployment.
Results and usage metadata: `artifacts/selective-icons/results.json`.

Composition decisions: 253 tests cover singleton preservation, grouped and mixed
counts, world/per-kind consistency, explicit totals/minimums and automatic mode.
Live checks produced three singles for a symbolic journey, a mixed aquarium with
eight fish and single diver/submarine, and a village with one church, one sun,
six cottages and eight tree symbols. An initial village response incorrectly
listed decorative grass among icon kinds and was rejected; the prompt was clarified
and the targeted live rerun passed. These are provider checks through the local
handler; no hosted deployment is implied. Evidence is in `artifacts/icon-composition/`.

```powershell
node scripts/check-selective-icons.mjs --live
```

Original style integration on 2026-10-26: all 203 tests across 21 files, production build,
style-generation browser checks (including recorded live results), built-in icon
checks, existing-world regressions, legacy generation checks, smoke test and
`git diff --check` passed. The browser checks used Edge software WebGL.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run inspect:generation-styles
npm.cmd run inspect:icons
npm.cmd run inspect:worlds
npm.cmd run inspect:generation
npm.cmd run smoke
git diff --check
```

The style browser suite runs the production UI against the real local handler
and compiler, with simulated Gemini responses. It verifies both explicit styles,
both automatic outcomes, one provider call per request, style locking, dimensions
and labels, walking, save/reload/revisit, cancellation, rejected results and mobile
state. Screenshots are under `artifacts/generation-styles/`.

Live provider checks on 2026-10-26 used the existing server-only key and configured
default model `gemini-3.1-flash-lite` through the local handler:

| Requested style | Prompt | Result | Dimensions | Icons | Objects | HTTP |
| --- | --- | --- | --- | --- | --- | --- |
| icons | A sunny pastel office garden on grass with ten different icons, including a lavender gear, coral paperclip, blue clock and yellow folder. Arrange them in loose staggered groups with generous walking space. | Sunny Pastel Office Garden (`icons`) | 48 × 44m | 10 | 50 | 200 |
| auto | A playful productivity playground with oversized pastel stationery and office symbols on a sunny grassy field. | Playful Productivity Playground (`icons`) | 48 × 44m | 6 | 31 | 200 |

Earlier live attempts were rejected for insufficient spacing, coordinates outside
the centered terrain, and decorative grass crossing an edge. Those findings led
to explicit center/spacing guidance and bounded grass cropping. Invalid icon
layouts remain rejected; there are no automatic provider retries. The automatic
standard outcome is covered by simulated provider tests, not a new live request.

To make a deliberate live check (one provider request each):

```powershell
node scripts/check-generation.mjs --live --style=icons "A sunny pastel office garden"
node scripts/check-generation.mjs --live --style=auto "A playful productivity playground"
npm.cmd run inspect:generation-styles -- --live-results
```

The last command imports the recorded live results and walks them without calling
Gemini again. Provider artifacts stay in ignored `artifacts/`; generation does not
add more built-in worlds. Local handler/provider and Edge software-WebGL checks
do not prove hosted deployment, Netlify edge rate limiting or hardware/physical
mobile performance. Vite's existing large-chunk warning remains.
