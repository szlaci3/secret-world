# Gemini world styles

Choose **World style** before generating. The selector stays disabled during a
request so the submitted choice remains visible. All three modes share the
existing description, progress/cancel, validation, enter, save, revisit and delete
flow. Switching styles preserves the current scene and draft description.

| Choice | Generation behavior | Built-in list |
| --- | --- | --- |
| Standard 3D objects | Existing landscape assets and biome guidance | Nine standard worlds |
| Extruded icons | Bundled Tabler office icons, with optional small grass clumps | Icon World |
| Let Gemini decide | Gemini chooses `standard` or `icons` and returns the complete blueprint in one call | All ten worlds |

Results show the actual style and dimensions before entry. Saved worlds retain
their style through reload and re-entry. Legacy saved/imported worlds without a
style remain standard. The built-in fixtures and reusable SVG geometry are unchanged.

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

- Only the ten bundled icon names and optional `plant`/`grass` assets. No custom
  markup, SVG URLs, models or unsupported object kinds.
- Flat ground with independent 24–64m axes, 1–24 icon objects and at most 96
  retained grass clumps. Artistic guidance aims for 8–12 icons and 12–36 clumps.
- Uniform icon scale, using the blueprint's Y component for all three axes.
  Instance colors and Y rotations are retained; depth, bevels, materials and
  geometry reuse come from the existing icon renderer.
- Full rotated/scaled icon footprints inside the ground and at least 1.2m
  separation along a separating axis between each pair. This conservatively
  reserves walkable gaps, including around diagonal neighbors. Icons use
  explicit placements; only grass may expand from `count`/`spread`.
- Decorative grass outside the ground or centered inside icon footprints is
  omitted. Out-of-bounds icons still fail admission. Standard-world bounds
  validation is unchanged.
- Blocking icon footprints, connected-space validation and a clear safe spawn
  from the existing navigation compiler. Arrival faces the icon composition.
  A closer overview camera and hemisphere fill keep the compact scene legible.

Generated worlds store `style: standard|icons`; `auto` is never stored as a world
style. JSON admission and browser rendering use the same existing world schema.

The endpoint still makes one provider call per request, with a 45-second timeout,
10,000 output tokens and no automatic paid retry. Validation failures report a
bounded diagnostic and leave the active world intact. Cancellation and stale
response guards apply to every style.

## Verification

Completed on 2026-10-26: all 203 tests across 21 files, production build,
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
