# SecretWorld

Walkable 128 × 128 meter low-poly worlds built with React, TypeScript, Vite, Three.js, and
React Three Fiber, with Gemini-powered world creation (milestone 3).
Describe a place, generate a walkable landscape, and keep favorites in your browser.

## Explore

Choose a screenshot in the desktop sidebar to enter a world directly. On narrow
screens, open **Worlds** to browse the same list in a drawer. Walk with **WASD** or
**arrow keys**, look with the mouse, and leave with **Escape** or **Tab**.
Each entry resets to that world's spawn. Switching worlds reuses
the WebGL canvas and updates the scene, camera, atmosphere, and walking session.
The sidebar collapses while walking; leaving restores selection focus. If the
browser declines mouse capture, **Click to begin** offers another attempt.
Touch devices support the overview; walking needs a keyboard and mouse.

The built-in **The Open Meadow** spans **128 × 128 meters** (16,384 m²), with
337 objects, including 252 small plant clusters (three times the previous 84): broad meadow routes, two ponds, distant groves, a hilltop windmill,
a cabin, arches, and a lookout. Earlier small worlds are disabled in the picker;
their source fixtures remain for geometry tests. New Gemini worlds use this same
128-meter size rather than stretching an 18-meter layout.

**Silverwood Grove** is the one additional Gemini-generated example: a snowy
128 × 128m woodland with 297 objects, including 268 small plant clusters, spruce
groves, a cabin, and a windmill. It passed the same schema, level-pavement, and
walking-connectivity checks and is available beside the meadow.

Terrain uses a bounded 32 × 32 grid: 1,089 vertices and 2,048 triangles (4m spacing). Object
counts remain bounded, repeated trees, plants, and paths are instanced, and rendering
stays on demand. Slow devices automatically use simpler vegetation, no shadows, and a 0.6 pixel ratio. Walking uses the same controls at 3.6 m/s for the larger landscape.
Pavement stays horizontal on flat terrain; slabs whose rotated footprints cross
slopes are omitted, including in imported or previously saved worlds. Grass
openings remain walkable where hill routes have no pavement.
Generation samples at most 64 positions per terrain axis (a two-meter grid here)
and sweeps each connection against exact collision geometry. This bounds server
validation work; the runtime player collision remains continuous and exact.

Descriptions appear on thumbnail hover or keyboard focus; touch users can read
the selected world's description above the overview. The drawer uses native modal
focus management and closes with Escape, Close, or a backdrop click.
The sidebar's **Open your own world JSON** section accepts files or pasted JSON.
Invalid input preserves the current scene. Imports last until reload; Maple
Courtyard remains a backward-compatibility fixture available for importing.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS). In Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite. A WebGL-capable browser is required.

### Create worlds with Gemini

Use **Create World** in the sidebar (or the **Worlds** drawer). Enter a title or
description and select **Generate world**. When ready, select **Enter world** to
capture the mouse and walk using the existing controls. **Save world** adds it to
**Your worlds**; select its name to revisit. **Delete**, then **Confirm delete**,
removes the saved copy. The Open Meadow and Silverwood Grove remain available below the creator.
Up to 20 worlds are stored locally; no account or database is used. Unsaved results
last until reload or replacement. Clearing browser data removes the saved collection.
Storage failures leave the result available to explore and show a message.

Vite alone serves the explorer; generation requires the Netlify Function. Copy
`.env.example` to `.env` and set `GEMINI_API_KEY` (never prefix it with `VITE_`).
For full local development, use the Netlify CLI:

```powershell
npx.cmd netlify-cli dev
```

Open `http://localhost:8888`. For Netlify hosting, `netlify.toml` builds `dist/`
and bundles `netlify/functions`. Set `GEMINI_API_KEY` in Netlify environment
variables with **Functions** scope, then deploy. Optional `GEMINI_MODEL` defaults
to `gemini-3.1-flash-lite`. The key is read only inside the Function and sent in
Google's request header; it is never bundled in client JavaScript. Descriptions
are sent to Google Gemini; the app does not send the saved collection.

Generation uses one bounded request, no automatic paid retries, a 45-second
provider timeout and a 10,000-token output cap. The deployed Function declares
a Netlify limit of three requests per IP/site per 180 seconds. Local CLI does
not enforce Netlify edge rate limits. This public endpoint is not an account-based
quota or a global spending cap: configure Google project quotas/budgets separately.
Provider quotas, refusals, invalid layouts, cancellation, and unavailable
configuration all produce recoverable messages without changing the active world.
Cancelling stops the local wait; a provider request already underway may still be billed.

Gemini creates a compact asset/placement blueprint, validated with the existing
Zod dependency. The compiler expands authored vegetation clusters, supplies solid
and water colliders, reduces over-steep hills, reserves flat pond shores, clips
vegetation out of water/structures, and finds an open spawn in a connected walking
region. Lighting has a visibility floor. Limits: 128 × 128m terrain, 14 reusable asset
definitions, 512 expanded objects, 64 solid/complex objects, four ponds. The result then
passes the original world schema on the server and in the browser. No model
downloads, generated code, extra rendering engine, or new dependencies are involved.
Mobile performance is outside the current verification scope.
These checks do not prove artistic quality or reachability of every decorative prop.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
node scripts/inspect-garden.mjs --walk --collisions --worlds
npm.cmd run inspect:generation
# Optional: one real Gemini request using .env (incurs provider usage).
npm.cmd run check:generation
npm.cmd run measure:performance
npm.cmd run measure:performance -- "--world=The Open Meadow"
npm.cmd run capture:thumbnails
# Rebuild the authored 128m fixture after editing its layout recipe.
node scripts/build-meadow.mjs
npm.cmd run preview
```

`build` includes TypeScript checking and writes `dist/`. `inspect:worlds` is the
full production browser gate: real pointer lock, walking, collision traversal,
focus loss/re-entry, responsive/touch layouts, graphics recovery, JSON rejection
and import, the large-world selection, repeated switches, and a persistent WebGL canvas.
The smaller `inspect:garden`, `inspect:walking`, `inspect:collisions`, and
`inspect:experience` gates remain available.

Browser checks use installed Edge on Windows or Playwright Chromium elsewhere;
set `SECRET_WORLD_BROWSER_CHANNEL` to override. They use software WebGL2 and save
screenshots under Git-ignored `artifacts/`. Unit tests additionally verify terrain
interpolation and camera elevation, fixture validity, water clearance, and walking
connectivity. Performance measurements run separately from browser QA; see
[the measurements and limitations](docs/performance.md).

`inspect:generation` verifies the creation UI, walking, saving/revisiting/deleting,
quota errors, and mobile layout against a mocked endpoint. It uses the last live
generated world in `artifacts/` when present, otherwise a built-in fixture.
`check:generation` exercises the actual server handler against Gemini and writes
the validated world to `artifacts/`. Neither check proves hosted deployment or
Netlify's edge rate limiting; those require a deployed site with its Function secret.

`capture:thumbnails` captures the current built-in landscapes from the current production
build into `public/worlds/`. Run `build` first, capture, then build again to include
refreshed images in `dist/`. The sidebar uses these static JPEGs, and never creates additional WebGL contexts for previews. Captures
use a centered 16:9 crop with 1.7× magnification to make landmarks easier to see.

## Shared architecture

- `src/world/schema.ts` validates unknown input and derives TypeScript types.
- `src/world/load-world.ts` limits JSON to 1 MiB before parsing and validation.
- `src/world/catalog.ts` pairs the current landscape with presentation-only descriptions.
- `src/world/terrain.ts` supplies the same triangle-grid elevation to geometry,
  object placement, paths, and the walking camera. Hills are optional.
- `src/scene/WorldScene.tsx` renders any validated world. `Terrain.tsx` builds
  terrain and conforming ground patches; `Plants.tsx` merges and instances plant
  clusters; `InstancedPaths.tsx` batches terrain-aligned path stones by color.
- `GardenObject.tsx` and `Structure.tsx` provide reusable shapes, with every
  placement, scale, palette, and collision footprint supplied through data.
- `WalkSession.ts` owns pointer lock and input; `navigation.ts` provides continuous
  sweep-and-slide collision against transformed X/Z footprints.

Rendering is on demand, static shadows are reused, pixel density is capped, and
sustained slow walking activates a lighter quality mode. Worlds use local primitive
geometry with no external textures, model downloads, or animation loops.

Walking follows gentle terrain at the configured eye height. Collisions remain
2D footprints: there is no jumping, gravity, climbing structures, or interior
navigation inside solid cabins. Arches and pavilions have separate post colliders,
so their openings are walkable. Water is nonwalkable. Soft planting and ground
patches do not block movement. Loading and graphics failures expose a recovery UI.

See the [full world format and authoring guidance](docs/world-format.md) for the
renderer contract, and the [original plan](docs/implementation-plan.md)
for the milestone 1 implementation history.
