# SecretWorld

`secret-world` is a small Japanese garden project built with React, TypeScript,
Vite, Three.js, and React Three Fiber.

## Current scope: Task 4

The app renders a **walkable Japanese garden**, using a validated JSON world
fixture: stepping stones, a pond, rocks, pine and maple trees, stone lanterns,
and a torii entrance. Keyboard walking and pointer-lock mouse look are implemented.
Walking stays inside the garden and stops/slides at the pond bank and solid props.
The torii opening and paths remain walkable. See the
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
npm.cmd run inspect:walking
npm.cmd run inspect:collisions
npm.cmd run preview
```

`build` also runs the type check. The production output is `dist/`.
`inspect:garden` checks production output in headless Edge on Windows (installed
Edge required), or Playwright Chromium on other platforms. Install Chromium with
`npx.cmd playwright install chromium` when needed. Override the browser channel
with `SECRET_WORLD_BROWSER_CHANNEL`. The check uses software WebGL2 and writes
`artifacts/garden-desktop.png` for visual inspection; artifacts are Git-ignored.
This verifies a desktop rendering, not hardware GPU performance.
`inspect:walking` additionally exercises real pointer lock, keyboard entry,
movement and mouse look (rendered-view comparisons), Escape, Tab, tab switching
with a held movement key, re-entry without stale movement, and the Leave walk
button. It saves `artifacts/garden-walking.png` as well.
`inspect:collisions` runs those checks plus a real-input traversal: south-edge
stop/recovery, gate passage, and pond approach/retreat. It also saves
`artifacts/garden-boundary.png` and `artifacts/garden-pond-approach.png` for visual
inspection. Precise water/prop clearance and transformed-shape assertions are
covered by the navigation unit tests; traversal timings are a desktop smoke check.

## Walking

Select **Enter garden** with a keyboard or mouse to capture the pointer. Use
**WASD** or **arrow keys** to walk, and move the mouse to look around. **Escape**,
**Tab**, or the **Leave walk** button returns to the overview and restores focus
to Enter garden. Losing window focus or switching tabs also exits and clears
held input. Walking never resumes automatically; each entry resets to the gate.
Mouse capture failures are shown in the controls panel without losing the overview.

Walking requires a keyboard, mouse, and a browser supporting pointer lock. Touch
walking is not implemented. Motion remains horizontal at the configured eye
height, has normalized diagonal speed, and caps elapsed time after stalled frames.
Movement sweeps the full intended segment to prevent tunneling, stops before
contact, and preserves motion along obstacle faces. The player's entire circular
footprint remains inside the ground rectangle. Every entry uses a spawn validated
against the same geometry used for movement.

## World-data boundary

- `src/world/garden.json` holds JSON scene values, with no React or Three imports.
- `src/world/schema.ts` validates unknown input and derives the TypeScript type.
- `src/scene/WorldScene.tsx` renders validated world settings.
- `src/scene/GardenObject.tsx` contains reusable local shapes and the typed object
  dispatcher. No world-instance placements are embedded in these components.
- `src/controls/WalkSession.ts` owns pointer lock, camera mode, and input listeners;
  `WalkingControls.tsx` connects its lifecycle and frame updates to R3F.
- `src/controls/navigation.ts` compiles world collision data once per session and
  provides shared spawn checks and continuous sweep-and-slide movement.

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
components must be greater than zero and at most 20.

Optional `walking` settings also live in JSON: `spawn` as `[x, eyeHeight, z]`,
`yaw` in radians (zero faces negative Z), `speed` in meters per second, `fov`
in degrees, and `lookSensitivity` in radians per mouse-movement unit. Eye height
must be above zero and at most 3 meters; speed is greater than zero and at most
10; FOV is 50–90; sensitivity is greater than zero and at most 0.01. Older worlds
without this block retain the overview and have walking disabled. Optional
`walking.radius` is 0.1–1 meter and defaults to 0.28 meters when omitted. The current
spawn is before the torii; an out-of-bounds or obstructed spawn is rejected.

## Collision data

Objects may declare up to eight `collision` footprints in their own local X/Z
coordinates. Each shape uses a `center` of `[x, z]` and either:

- `{ "kind": "box", "center": [0, 0], "size": [width, depth] }`
- `{ "kind": "ellipse", "center": [0, 0], "radii": [xRadius, zRadius] }`

Centers range from -40 to 40; sizes/radii must be positive and at most 40.
The owning object's scale and Y rotation transform the footprint into world
space, then the player radius expands it. An omitted or empty `collision` array
means nonblocking; paths deliberately omit it. All solid and water objects in
the supplied fixture have footprints. The entrance has separate post footprints
so its opening remains clear, and trees block trunks rather than whole canopies.

These are conservative 2D footprints, not triangle-mesh or vertical-body physics.
Ellipses use circumscribed 32-sided polygons and boxes use inflated half-planes;
corners may keep the player slightly farther away than the visible mesh. The pond
footprint covers its bank as well as its water. There is no jumping, gravity,
terrain-height following, or overhead collision. Flat-ground eye height is fixed.

The schema rejects unknown fields, unsupported versions, non-finite numbers,
and out-of-range settings. Future generated data must pass `parseWorld` before
rendering. No AI provider or arbitrary model/code loading is connected.
