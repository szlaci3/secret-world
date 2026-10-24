# SecretWorld

`secret-world` is a small Japanese garden project built with React, TypeScript,
Vite, Three.js, and React Three Fiber.

## Current scope: Task 2

The app renders a **stationary Japanese garden**, using a validated JSON world
fixture: stepping stones, a pond, rocks, pine and maple trees, stone lanterns,
and a torii entrance. Walking controls are not implemented yet. See the
[six-task implementation plan](docs/implementation-plan.md) for acceptance gates.

## Run locally

Use Node.js 22.12+ (or a newer supported LTS) and npm. On Windows PowerShell:

```powershell
npm.cmd ci
npm.cmd run dev
```

Open the URL printed by Vite. Rendering requires a WebGL-capable browser.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
npm.cmd run smoke
npm.cmd run inspect:garden
npm.cmd run preview
```

`build` also runs the type check. The production output is `dist/`.
`inspect:garden` checks production output in headless Edge on Windows (installed
Edge required), or Playwright Chromium on other platforms. Install Chromium with
`npx.cmd playwright install chromium` when needed. Override the browser channel
with `SECRET_WORLD_BROWSER_CHANNEL`. The check uses software WebGL2 and writes
`artifacts/garden-desktop.png` for visual inspection; artifacts are Git-ignored.
This verifies a desktop rendering, not hardware GPU performance or walking.

## World-data boundary

- `src/world/garden.json` holds JSON scene values, with no React or Three imports.
- `src/world/schema.ts` validates unknown input and derives the TypeScript type.
- `src/scene/WorldScene.tsx` renders validated world settings.
- `src/scene/GardenObject.tsx` contains reusable local shapes and the typed object
  dispatcher. No world-instance placements are embedded in these components.

Version 1 currently supports a ground plane (width and depth in meters), a camera
(position, target, and vertical field of view in degrees), background color,
ambient light, and directional sunlight. The coordinate system is Y-up, with
ground at Y=0. Colors must be six-digit hex strings.

Every entry in `objects` has a unique `id`, a supported `type`, `position` as
`[x, y, z]`, `rotation` around Y in radians, and positive `scale` as `[x, y, z]`.
Each reusable shape's local origin is at its ground contact. Supported kinds:

| Type | Additional fields |
| --- | --- |
| `path` | `size` as `[width, depth]`, `color` |
| `pond` | `radii` as `[xRadius, zRadius]`, `waterColor`, `bankColor` |
| `rock` | `color` |
| `tree` | `variety` (`pine` or `maple`), `foliageColor`, `trunkColor` |
| `lantern` | `stoneColor`, `glowColor` |
| `entrance` | `woodColor`, `roofColor` |

The fixture contains 30 placed objects. Empty foundation worlds remain valid
under schema version 1. There is a 200-object limit, and dimensions and scale
components must be greater than zero and at most 20. Object validation covers
structure and render inputs; walkable bounds and collision rules are Task 4.

The schema rejects unknown fields, unsupported versions, non-finite numbers,
and out-of-range settings. Future generated data must pass `parseWorld` before
rendering. No AI provider or arbitrary model/code loading is connected.
