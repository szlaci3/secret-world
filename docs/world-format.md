# SecretWorld world format, version 1

This is the implemented JSON contract for hand-authored or future AI-generated
worlds. `src/world/schema.ts` is the authoritative runtime schema;
`src/world/load-world.ts` admits JSON text before application state changes.
Gemini generation compiles a compact blueprint into this same contract through
`netlify/functions/create-world.ts` and `src/world/generation.ts`. There is no
model loading or generated code execution.

## Load a world

1. Leave any active walk with Escape or Tab.
2. Select **Worlds**. Choose The Open Meadow, the 128 × 128m built-in landscape. For file/paste imports, expand
   **Open your own world JSON**, then select a `.json` file or paste JSON.
3. Select **Load world** for file/paste input. Files populate the editor first;
   selecting a file does not replace the world by itself.

Invalid input leaves the active scene, renderer, and world definition intact.
The picker reports up to three field errors and keeps the input available for
correction. Valid input replaces the scene data, lighting, camera, and walking
session, returns to the overview, and reuses the renderer. Each walking entry
uses the replacement world's spawn. Worlds without `walking` offer an overview.
The native modal supports Close and Escape and returns focus to Worlds.
Graphics failure dismisses the picker so the focused recovery action remains usable.

File/paste imports are in this tab's memory only. Reloading, including graphics
**Try again**, returns to The Open Meadow. Generated worlds can be explicitly
saved in the browser and revisited from **Your worlds**. There is no automatic
download of URLs from imported data. Keep your source JSON file for imports.

## Minimal complete world

```json
{
  "schemaVersion": 1,
  "id": "my-garden",
  "name": "My Garden",
  "ground": { "size": [12, 12], "color": "#879579" },
  "camera": { "position": [12, 10, 14], "target": [0, 0, 0], "fov": 45 },
  "environment": {
    "background": "#dce4d8",
    "ambientIntensity": 0.8,
    "sunlight": { "position": [-6, 10, 7], "color": "#fff0d5", "intensity": 2 }
  },
  "walking": {
    "spawn": [0, 1.65, 4], "yaw": 0, "speed": 2.4,
    "fov": 65, "lookSensitivity": 0.002, "radius": 0.28
  },
  "objects": []
}
```

Current built-in and archived authoring examples (all dimensions in meters):

| Fixture | Ground | Objects | Design |
| --- | --- | --- | --- |
| `open-meadow.json` | 128 × 128 | 337 | Long routes, two ponds, distant groves, windmill and cabin |
| `garden.json` | 18 × 18 | 60 | One pond, winding path, bamboo screen, tea pavilion |
| `sandstone-oasis.json` | 24 × 22 | 64 | Three pools, dunes, palms and gateway ruins |
| `frostlight-grove.json` | 24 × 22 | 60 | No water, spruce pockets, cabin and hillside lookout |
| `amber-meadow.json` | 24 × 22 | 99 | No water, rolling flower meadow and windmill loop |
| `basalt-reach.json` | 26 × 24 | 70 | Large lake, crescent shore and beacon |
| `violet-sanctuary.json` | 24 × 22 | 75 | Three pools, arches, columns and secluded pavilion |

Files live under `src/world/`. `maple-courtyard.json` is a 15-object legacy fixture
with flat ground and no new object kinds, retained to verify backward compatibility.

## Global rules

- Plain JSON only: no Markdown fences, comments, expressions, or trailing commas.
  A leading UTF-8 BOM is accepted. Text/file limit is **1,048,576 UTF-8 bytes**.
- `schemaVersion` must be the number `1`. Other versions are rejected; no
  migration/coercion is implemented. Unknown fields are rejected at every level.
- All numeric values must be finite. All colors are six-digit `#rrggbb` hex strings.
- `id` fields are 1–80 characters matching lowercase letters/digits separated by
  single hyphens. Object IDs must be unique within a world.
- `name` is trimmed and must contain 1–80 characters. It is displayed as text.
- Coordinates are meters, Y-up; ground is centered at `[0, 0, 0]`. Position/target/
  spawn components range from -1000 to 1000. Rotation/yaw are radians around Y;
  yaw zero faces negative Z. Object scales are positive X/Y/Z multipliers.
- Ground width/depth are 0.1–128 m. Generated worlds use exactly 128 × 128 m. Object dimensions (except paths), radii, and scale components
  are 0.01–20. Path widths/depths can be up to 128m. The lower bounds prevent numerically degenerate render/collision data.
- There are at most 512 objects. This is a structural limit, not a frame-rate
  guarantee; complex generated layouts may still render slowly.

## Root settings

| Field | Required value/shape |
| --- | --- |
| `schemaVersion`, `id`, `name` | As above |
| `ground` | `size: [width, depth]`, `color`, optional `hills` (below) |
| `camera` | `position: [x,y,z]`, distinct `target: [x,y,z]`, `fov: 20–100` vertical degrees |
| `environment` | `background`, `ambientIntensity: 0–10`, `sunlight` |
| `environment.sunlight` | `position: [x,y,z]`, `color`, `intensity: 0–10`; points toward origin |
| `environment.skyLight` | Optional `{skyColor, groundColor, intensity: 0–10}` hemisphere fill |
| `environment.fog` | Optional `{color, near: 5–100, far: 10–200}`; far must exceed near |
| `walking` | Optional settings below |
| `objects` | Array of supported object definitions; can be empty |

The overview preserves the configured camera position/target and widens vertical
FOV on narrow canvases to keep horizontal framing. Walking uses its own FOV.
Renderer quality and shadow-map settings are application concerns, not world fields.

## Terrain and atmosphere

Optional `ground.hills` is an array of at most eight compact radial hills:

```json
"hills": [{ "center": [0, -3], "radius": 6, "height": 1.9 }]
```

Centers use bounded X/Z coordinates. Radius is 2–32 m, height 0–6 m, and
height/radius must not exceed 0.4. Each hill contributes
`height * max(0, 1 - distanceSquared / radiusSquared)^2`. Overlapping hills add;
keep them separated or lightly overlapping to retain gentle slopes. This is a
height field with no caves, overhangs, cliffs, or vertical terrain walls.

The surface samples a grid with at most 32 segments per axis (4m spacing at 128m). Walking height uses exact
triangle interpolation from that grid. Object Y is an offset above the terrain
at its X/Z anchor; `walking.spawn[1]` is eye height above the terrain. Omitted
hills preserve the previous flat-ground behavior. Paths remain horizontal; any path with more than 2cm of terrain variation across its sampled rotated footprint is omitted by generation and the renderer;
`patch` meshes conform to the surface. Keep large structures and pond footprints
on flat ground: other rigid objects are anchored at their centers and stay upright.
Ponds do not flatten terrain, and collision footprints remain horizontal.

Fog is linear distance fog. In overview, the renderer offsets its distances to
account for the distant overview camera, preserving legibility of the whole scene.
Walking uses the authored near/far distances. Fog, ground colors, sunlight, and
hemisphere fill are static and add no animation loop or extra shadow lights.

## Walking settings

If `walking` exists, all fields below except `radius` are required.

| Field | Constraint |
| --- | --- |
| `spawn` | `[x, eyeHeight, z]`; eye height greater than 0 and at most 3 m |
| `yaw` | Finite radians; zero faces negative Z |
| `speed` | Greater than 0 and at most 10 m/s |
| `fov` | 50–90 vertical degrees |
| `lookSensitivity` | Greater than 0 and at most 0.01 radians per movement unit |
| `radius` | Optional 0.1–1 m; omitted value uses 0.28 m |

The whole circular player footprint must fit inside the ground and clear every
declared collider at spawn. A blocked or out-of-bounds spawn rejects the world.
Validation does not prove every destination is reachable or validate the artistic
layout. Horizontal motion follows terrain elevation; there is no gravity or jumping.

## Objects

Every object requires `id`, `type`, `position: [x,y,z]`, `rotation`, and
`scale: [x,y,z]`. Local origins sit on the terrain at the anchor, plus position Y.
`collision` is optional; supply it explicitly for solids and water.

| `type` | Additional required fields | Optional fields |
| --- | --- | --- |
| `path` | `size: [width,depth]`, `color` | — |
| `pond` | `radii: [xRadius,zRadius]`, `waterColor`, `bankColor` | `lilyPads` |
| `rock` | `color` | `mossColor` |
| `tree` | `variety: "pine"`, `"maple"`, `"spruce"`, or `"palm"`, `foliageColor`, `trunkColor` | — |
| `lantern` | `stoneColor`, `glowColor` | — |
| `entrance` | `woodColor`, `roofColor` | — |
| `plant` | `variety` (below), `color`, `accentColor` | — |
| `structure` | `variety` (below), `color`, `accentColor` | — |
| `patch` | `radii: [xRadius,zRadius]`, `color` | — |

For a pond, up to 12 `lilyPads` each have `position: [x,z]`, `radius`, and `color`.
These positions are normalized relative to pond radii, with each component
-0.8–0.8; leaf radius is 0.03–0.15. Position length plus radius must be at most 0.9.
Decorations do not create colliders. Repeated path colors are batched automatically.

### Reusable plants, structures, and ground patches

Plant varieties are `grass`, `flowers`, `reeds`, `bamboo`, `cactus`, `fern`, and
`mushrooms`. Each is a small cluster with a local footprint around 1–1.5 m wide;
scales vary density and height. Grass/flowers/ferns/mushrooms are roughly 0.4–1 m
high, reeds 1–1.5 m, cactus 1–1.7 m, and bamboo 3–3.5 m before scaling. Repeated
plants with the same variety and two colors share merged instanced geometry.
Use a few consistent palette pairs per world rather than unique colors per plant.
Soft plants normally have no collider; cactus and dense bamboo use a local ellipse
with radii `[0.65, 0.65]` in the shipped fixtures.

Structure varieties and recommended unscaled collision footprints:

| Variety | Geometry / use | Footprints |
| --- | --- | --- |
| `arch` | 3.8 m wide stone gateway, about 4 m high | Two boxes `[0.7,1]` centered at `[-1.4,0]` and `[1.4,0]` |
| `pavilion` | Four-post open shelter with a pyramidal roof | Four `[0.25,0.25]` boxes centered at each combination of X/Z ±1.2 |
| `cabin` | Solid 2.8 × 2.2 m body, roof, window and chimney | Box `[3,2.5]`; no interior |
| `beacon` | Tapered 5.3 m tower with an emissive lens | Box `[2.4,2.4]` |
| `windmill` | Tapered tower with four static sails | Box `[2.4,2.4]`; sails are overhead |
| `column` | Octagonal shaft, base and capital | Box `[1.2,1.2]` |
| `bench` | Simple timber seat on two supports | Box `[1.9,0.7]` |

`patch` adds a thin elliptical, terrain-conforming region for gravel, sand,
clearing soil, or a different grass tone. It is decorative and normally has no
collider. Its radii, scale, rotation, and Y offset apply as for other objects.
Avoid coincident overlapping patches or large patches over water.

## Collision footprints

Supply up to eight shapes per object's `collision` array. Both use object-local
X/Z coordinates before the object's scale and rotation:

```json
[
  { "kind": "box", "center": [0, 0], "size": [1.2, 0.8] },
  { "kind": "ellipse", "center": [1.2, 0], "radii": [0.3, 0.3] }
]
```

Centers range -40–40. Size/radius components are 0.01–40. Shapes are transformed
to world space and expanded by the player radius. Ellipses use conservative
circumscribed 32-sided polygons; boxes use inflated half-planes. The geometry is
2D and conservative, not triangle-mesh or overhead collision.

An omitted/empty `collision` array means **nonblocking**, even for a rock/tree/
pond. Add footprints deliberately for all solids and water. Paths normally omit
them; entrances need two separate post footprints to leave an opening. Tree
footprints should cover trunks, not overhead canopy. Pond banks extend to 1.15
times their radii before object scale; cover the bank as well as water. Inspect
generated layouts because geometric/visual alignment is the author's responsibility.

## Built-in catalog

`src/world/catalog.ts` validates the single selectable 128m fixture with `parseWorld`
and adds presentation-only theme/description metadata outside the versioned JSON
contract. The picker sends each selection through the same `loadWorldJson` path
as imports. The shared renderer, lighting, overview camera, and walking session
read only `WorldDefinition`; no world-specific rendering code is needed. Switching
reuses the canvas and disposes the previous walking session and input listeners.
Imported worlds can use arbitrary valid IDs and get generic introductory copy.
Only an exact match to a catalog fixture is marked as the current built-in world.

## Generator handoff

Give a generator this document plus one complete fixture. Request one raw JSON
object with schemaVersion 1, supported fields/kinds only, explicit collision
footprints for solids/water, and a clear in-bounds spawn. Keep the result within
the limits above. Feed its JSON through `loadWorldJson`; never evaluate generated
code or bypass validation. Rejected data should be corrected and submitted again.
Design the composition before choosing counts: reserve clear routes and negative
space, place a landmark, then cluster supporting plants and rocks asymmetrically.
Vary water count/size, route topology, tree density, hill placement, and shelter
locations between worlds. Keep ponds on flat terrain and footpaths out of water.
The shipped small fixtures remain authoring examples but are disabled in the picker. The active fixture is `open-meadow.json` (128 × 128m, 337 objects). Catalog tests sample
walkable connectivity and shoreline clearance; schema validity alone does not
prove good composition, reachability, or visual alignment. The implemented Gemini
endpoint uses a compact blueprint rather than repeating full object definitions.
Its compiler adds collisions, expands plant/tree clusters, normalizes steep hills
and flat shores, and checks a connected walking region before admitting the result.
See the README for configuration, budgets, local storage, and verification scope.

Generation limits and sampling: 512 expanded objects, including at most 64 complex
objects, four ponds, and 14 reusable asset definitions. Plant/tree cluster radii
can reach 12m; object anchors and hill centers span the full -64 to +64m extent.
The compiler uses a bounded 64-sample grid per axis to find connected exploration
space; each connection uses exact swept collision. This is a sampled admission
check, not a proof that every narrow route is reachable. Runtime collision and
terrain height still use the exact player footprint and rendered terrain triangles.

Small plants can use up to 36 instances per authored drift. The current meadow
has 252 small plant clusters, up from 84; solid/complex instances remain capped
at 64, including blocking bamboo and cactus. Generation aims for lush small
ground cover and explicitly avoids pavement on hillsides.
