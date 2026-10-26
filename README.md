# SecretWorld

Walkable compact gardens and landscapes up to 128 × 128 meters built with React, TypeScript, Vite, Three.js, and
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

Select **World style → Extruded icons → Icon World** for the optional office
playground. Ten local Tabler SVG icons stand on a 48 × 44 m grassy field:
gear, paperclip, clock, folder, briefcase, calculator, floppy disk, bulb, bell,
and book. They use constant-depth SVG extrusion, softly rounded bevels, pastel
materials, and conservative walking footprints. Standard 3D objects remains the
default browser style. All three choices also work with **Create World**:
**Standard 3D objects** generates a landscape, **Extruded icons** generates from
the bundled office icons, and **Let Gemini decide** chooses a style and composes
the world in one request. Results and saved worlds show the resolved style.
Browsing styles preserves the current scene until you choose a world to enter.

Tabler Icons v3.46.0 are [MIT licensed](https://github.com/tabler/tabler-icons/tree/v3.46.0).
The original assets and license are in `src/assets/tabler/`; production also ships
`/tabler-icons-LICENSE.txt`. See [Icon World implementation and checks](docs/icon-world.md).

The built-in **The Open Meadow** spans **128 × 128 meters** (16,384 m²), with
337 objects, including 252 small plant clusters (three times the previous 84): broad meadow routes, two ponds, distant groves, a hilltop windmill,
a cabin, arches, and a lookout.

The picker also includes the original compact worlds, with their dimensions and
content preserved: **Amber Meadow** (24 × 22 m), **Basalt Reach** (26 × 24 m),
**Frostlight Grove** (24 × 22 m), **The Quiet Garden** (18 × 18 m),
**Sandstone Oasis** (24 × 22 m), and **Violet Sanctuary** (24 × 22 m).
**Maple Courtyard** (14 × 12 m) is available too, with its own scene thumbnail.
Each card shows the actual world dimensions. All sizes use the same renderer and walking controls.

**Silverwood Grove** is the one additional Gemini-generated example: a snowy
128 × 128m woodland with 301 objects, including 268 small plant clusters, spruce
groves, a cabin, a windmill, and four authored fallen-log/stump details. It passed the same schema, level-pavement, and
walking-connectivity checks and is available beside the meadow.

Terrain uses a bounded 32 × 32 grid: 1,089 vertices and 2,048 triangles (4m spacing at 128m; finer in compact worlds). Object
counts remain bounded, repeated trees, plants, and paths are instanced, and rendering
stays on demand. Slow devices automatically use simpler vegetation, no shadows, and a 0.6 pixel ratio. Walking uses the same controls at 3.6 m/s for the larger landscape.
Plant clumps have three stable shape variants, with uneven stem heights, natural
lean and subtle color variation. Mossy fallen logs and cut stumps have bark detail
and growth rings; Silverwood Grove showcases them beside its route. Gemini can
use these assets within the existing object budgets.
Ground cover has soft, palette-preserving variation and contact shading around
vegetation, rocks and water. Ponds have stable irregular waterlines and varied
banks, with shadows on the water. These finishes also apply to saved/imported
worlds and remain visible in reduced-detail mode. **The Quiet Garden** is a useful
close-up review scene: follow the stones and look at the pond on the right.
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
Invalid input preserves the current scene. Imports last until reload; original
compact fixtures and previously saved worlds remain compatible.

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
removes the saved copy. The built-in list follows the style selector: nine standard
worlds, one Icon World, or all ten under **Let Gemini decide**.
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
vegetation out of water/structures, clears tree trunks from paved routes, and finds a safe spawn in a connected walking
region. Full scaled/rotated object footprints must fit inside the terrain, including
path ends, roof overhangs and tree canopies; an overhang rejects the design with
a specific validation error. An optional blueprint arrival point lets Gemini compose the entry beside
nearby vegetation; older blueprints retain the original arrival default. Lighting
has a visibility floor. Generated dimensions may vary from 24–128m per axis;
imports and built-in fixtures retain the broader version-1 size contract.
Biome guidance starts with meadow 128 × 128m / 10–25 trees, woodland 96 × 96m /
30–50 trees, dense forest 64 × 64m / about 40–60 trees, and garden 48 × 48m /
5–15 trees. These are composition guidelines, not rigid quotas. Forests favor
interlocking larger canopies, close understory, and narrow connected routes;
meadows retain broad open views. There is no universal open-ground percentage.
Limits remain 14 reusable asset
definitions, 512 expanded objects, 64 solid/complex objects, four ponds. The result then
passes the original world schema on the server and in the browser. No model
downloads, generated code, extra rendering engine, or new dependencies are involved.
Mobile performance is outside the current verification scope.
These checks do not prove artistic quality or reachability of every decorative prop.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run inspect:icons
node scripts/inspect-garden.mjs --walk --collisions --worlds
npm.cmd run inspect:generation
npm.cmd run inspect:generation-styles
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
and import, every built-in world selection, repeated switches, and a persistent WebGL canvas.
The smaller `inspect:garden`, `inspect:walking`, `inspect:collisions`, and
`inspect:experience` gates remain available.

Browser checks use installed Edge on Windows or Playwright Chromium elsewhere;
set `SECRET_WORLD_BROWSER_CHANNEL` to override. They use software WebGL2 and save
screenshots under Git-ignored `artifacts/`. Unit tests additionally verify terrain
interpolation and camera elevation, fixture validity, water clearance, and walking
connectivity. Performance measurements run separately from browser QA; see
[the measurements and limitations](docs/performance.md).

`inspect:generation` verifies the creation UI, walking, saving/revisiting/deleting,
quota errors, and mobile layout against a mocked endpoint and a stable legacy fixture.
`inspect:generation-styles` drives the production UI through the real handler and
compiler with simulated provider responses for explicit Standard, explicit Icons,
and both automatic outcomes. It also verifies style persistence, cancellation,
rejected output and responsive state. Add `-- --live-results` to import and walk
the separately recorded live icon/auto artifacts without making provider requests.
`check:generation` exercises the actual server handler against Gemini and writes
the validated world to `artifacts/`, including a prompt-specific file. It reports
dimensions, tree/total counts, status, and validation diagnostics. Pass a quoted
prompt after `--live` to `node scripts/check-generation.mjs` for a specific brief.
Use `--style=standard`, `--style=icons` or `--style=auto` (default: standard).
See [generation style behavior and verification](docs/generation-styles.md).
Neither check proves hosted deployment or
Netlify's edge rate limiting; those require a deployed site with its Function secret.

`capture:thumbnails` captures the current built-in landscapes from the current production
build into `public/worlds/`. Run `build` first, capture, then build again to include
refreshed images in `dist/`. The sidebar uses these static JPEGs, and never creates additional WebGL contexts for previews. Captures
use a centered 16:9 crop with 1.7× magnification to make landmarks easier to see.

## Shared architecture

- `src/world/schema.ts` validates unknown input and derives TypeScript types.
- `src/world/load-world.ts` limits JSON to 1 MiB before parsing and validation.
- `src/world/catalog.ts` pairs the built-in worlds with presentation-only descriptions.
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

See [compact-world and live biome verification](docs/generation-verification.md) for
the restoration review, actual Gemini dimensions/counts, checks, and remaining limits.
