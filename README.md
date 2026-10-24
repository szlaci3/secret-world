# SecretWorld

Six walkable low-poly worlds built with React, TypeScript, Vite, Three.js, and
React Three Fiber. The world-enrichment work following milestone 2 is complete.
Gemini-powered generation remains milestone 3; no provider is connected.

## Explore

Select **Worlds**, choose a place, then **Enter world**. Walk with **WASD** or
**arrow keys**, look with the mouse, and leave with **Escape**, **Tab**, or
**Leave walk**. Each entry resets to that world's spawn. Switching worlds reuses
the WebGL canvas and replaces the scene, camera, atmosphere, and walking session.
Touch devices support the overview; walking needs a keyboard and mouse.

| World | Composition and landmarks | Water |
| --- | --- | --- |
| The Quiet Garden | Winding stones, torii, bamboo screen, tea pavilion, pond-side planting | One garden pond |
| Sandstone Oasis | Dunes, sandstone spires, ruined gateway, scattered palms and cactus | Three unequal pools |
| Frostlight Grove | Dense spruce pockets, a cabin clearing, branching trail and raised lookout | None |
| Amber Meadow | Open rolling hills, flower drifts and a loop around a hilltop windmill | None |
| Basalt Reach | Crescent shore path, basalt formations, reeds and a weathered beacon | One dominant lake |
| Violet Sanctuary | Processional arches, broken columns, mushroom gardens and a secluded pavilion | Three reflecting pools |

All layouts are authored JSON. Trees, plants, structures, ground patches, stones,
water, terrain, and lighting use the same reusable components across worlds.
The six fixtures contain 60–99 objects, with repeated plants and paths batched.

The picker supports keyboard focus, Escape, a current-world marker, and narrow
screens. Its **Open your own world JSON** section accepts files or pasted JSON.
Invalid input preserves the current scene. Imports last until reload; Maple
Courtyard remains a backward-compatibility fixture available for importing.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS). In Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite. A WebGL-capable browser is required.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run smoke
npm.cmd run inspect:worlds
npm.cmd run measure:performance
npm.cmd run measure:performance -- "--world=Amber Meadow"
npm.cmd run preview
```

`build` includes TypeScript checking and writes `dist/`. `inspect:worlds` is the
full production browser gate: real pointer lock, walking, collision traversal,
focus loss/re-entry, responsive/touch layouts, graphics recovery, JSON rejection
and import, all six selections, repeated switches, and a persistent WebGL canvas.
The smaller `inspect:garden`, `inspect:walking`, `inspect:collisions`, and
`inspect:experience` gates remain available.

Browser checks use installed Edge on Windows or Playwright Chromium elsewhere;
set `SECRET_WORLD_BROWSER_CHANNEL` to override. They use software WebGL2 and save
screenshots under Git-ignored `artifacts/`. Unit tests additionally verify terrain
interpolation and camera elevation, fixture validity, water clearance, and walking
connectivity. Performance measurements run separately from browser QA; see
[the measurements and limitations](docs/performance.md).

## Shared architecture

- `src/world/schema.ts` validates unknown input and derives TypeScript types.
- `src/world/load-world.ts` limits JSON to 1 MiB before parsing and validation.
- `src/world/catalog.ts` pairs six fixtures with presentation-only descriptions.
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
future generator contract, and the [original plan](docs/implementation-plan.md)
for the milestone 1 implementation history.
