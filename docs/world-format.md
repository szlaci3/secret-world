# SecretWorld world format, version 1

This is the implemented JSON contract for hand-authored or future AI-generated
worlds. `src/world/schema.ts` is the authoritative runtime schema;
`src/world/load-world.ts` admits JSON text before application state changes.
There is no AI provider, generation endpoint, model loading, or code execution.

## Load a world

1. Leave any active walk with Escape or Tab.
2. Select **Worlds**. Choose an example, or select a `.json` file or paste JSON.
3. Select **Load world** for file/paste input. Files populate the editor first;
   selecting a file does not replace the world by itself.

Invalid input leaves the active scene, renderer, and world definition intact.
The picker reports up to three field errors and keeps the input available for
correction. Valid input replaces the scene data, lighting, camera, and walking
session, returns to the overview, and reuses the renderer. Each walking entry
uses the replacement world's spawn. Worlds without `walking` offer an overview.
The native modal supports Close and Escape and returns focus to Worlds.
Graphics failure dismisses the picker so the focused recovery action remains usable.

Changes are in this tab's memory only. Reloading, including graphics **Try again**,
returns to The Quiet Garden. There is no server upload, browser-storage persistence,
or automatic download of URLs from imported data. Keep your source JSON file.

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

Complete populated examples:

- [`src/world/garden.json`](../src/world/garden.json): 18 × 18 m Quiet Garden,
  30 objects, pond, winding path, pine/maple trees, rocks, lanterns, and entrance.
- [`src/world/maple-courtyard.json`](../src/world/maple-courtyard.json): 14 × 12 m
  Maple Courtyard, 15 objects, autumn colors, shorter path, and a smaller pond.

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
- Ground width/depth are 0.1–100 m. Object dimensions, radii, and scale components
  are 0.01–20. The lower bounds prevent numerically degenerate render/collision data.
- There are at most 200 objects. This is a structural limit, not a frame-rate
  guarantee; complex generated layouts may still render slowly.

## Root settings

| Field | Required value/shape |
| --- | --- |
| `schemaVersion`, `id`, `name` | As above |
| `ground` | `size: [width, depth]`, `color` |
| `camera` | `position: [x,y,z]`, distinct `target: [x,y,z]`, `fov: 20–100` vertical degrees |
| `environment` | `background`, `ambientIntensity: 0–10`, `sunlight` |
| `environment.sunlight` | `position: [x,y,z]`, `color`, `intensity: 0–10`; points toward origin |
| `environment.skyLight` | Optional `{skyColor, groundColor, intensity: 0–10}` hemisphere fill |
| `walking` | Optional settings below |
| `objects` | Array of supported object definitions; can be empty |

The overview preserves the configured camera position/target and widens vertical
FOV on narrow canvases to keep horizontal framing. Walking uses its own FOV.
Renderer quality and shadow-map settings are application concerns, not world fields.

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
layout. Walking is horizontal, with no gravity, jumping, or terrain following.

## Objects

Every object requires `id`, `type`, `position: [x,y,z]`, `rotation`, and
`scale: [x,y,z]`. Local origins sit on the ground. `collision` is optional.

| `type` | Additional required fields | Optional fields |
| --- | --- | --- |
| `path` | `size: [width,depth]`, `color` | — |
| `pond` | `radii: [xRadius,zRadius]`, `waterColor`, `bankColor` | `lilyPads` |
| `rock` | `color` | `mossColor` |
| `tree` | `variety: "pine"` or `"maple"`, `foliageColor`, `trunkColor` | — |
| `lantern` | `stoneColor`, `glowColor` | — |
| `entrance` | `woodColor`, `roofColor` | — |

For a pond, up to 12 `lilyPads` each have `position: [x,z]`, `radius`, and `color`.
These positions are normalized relative to pond radii, with each component
-0.8–0.8; leaf radius is 0.03–0.15. Position length plus radius must be at most 0.9.
Decorations do not create colliders. Repeated path colors are batched automatically.

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

## Future generator handoff

Give a generator this document plus one complete fixture. Request one raw JSON
object with schemaVersion 1, supported fields/kinds only, explicit collision
footprints for solids/water, and a clear in-bounds spawn. Keep the result within
the limits above. Feed its JSON through `loadWorldJson`; never evaluate generated
code or bypass validation. Rejected data should be corrected and submitted again.
Provider integration and automatic generation remain future work.
