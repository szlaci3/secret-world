# SecretWorld implementation plan

Build a small, walkable Japanese garden in React Three Fiber, with scene data
kept separate from rendering so future AI-generated worlds can use the same format.
Each task has its own acceptance gate. Complete tasks in order.

1. **App and world-data foundation (completed)**
   - Set up `secret-world` with React, TypeScript, Vite, and React Three Fiber.
   - Define a JSON-compatible, versioned world schema with runtime validation.
   - Render a minimal ground preview from a separate world fixture, including
     data-driven camera, lighting, and background; show the SecretWorld name.
   - Verify: schema tests, TypeScript check, production build, HTTP smoke check.
     Record browser/WebGL verification separately if unavailable.
2. **Japanese garden composition (completed)**
   - Extend the schema and renderer with paths, pond, rocks, trees, lanterns,
     and an entrance. Place every instance through garden data.
   - Verify: fixture validation and browser inspection of the full garden layout.
3. **First-person walking (completed)**
   - Add keyboard movement, pointer-lock mouse look, explicit entry/exit,
     and accessible instructions. Reset held inputs on focus loss.
   - Verify: enter, walk, look, Escape, and tab-away/resume in a browser.
4. **Walkable bounds and collisions (completed)**
   - Constrain movement to the garden; block water and solid props using
     collision data, with a safe spawn and frame-independent movement.
   - Verify: automated boundary/collision cases and a browser traversal.
5. **Atmosphere and responsive experience (completed)**
   - Refine lighting, shadows, garden details, and responsive overlays;
     provide clear loading/error states and tune rendering cost.
   - Verify: desktop/narrow viewports, keyboard access, visual inspection,
     and a recorded browser performance check.
6. **World-loading handoff (completed)**
   - Load replacement JSON through the versioned validation boundary, preserve
     the active world on rejection, add a second fixture, and document the
     supported format for future AI generation. AI provider integration is future work.
   - Verify: valid world replacement, malformed/unsupported input rejection,
     second-fixture rendering, and full project checks.

## Scope boundary

Task 1 provides the foundation; Task 2 adds the garden composition; Task 3 adds
keyboard walking and pointer-lock mouse look. Task 4 adds boundaries, data-driven
footprint collisions, and spatial spawn validation. Task 5 adds atmosphere,
responsive layouts, loading/recovery states, and rendering-cost controls.
Task 6 adds validated file/paste importing, a second fixture, and the world-format
handoff. All six tasks are complete. AI provider integration remains future work.

## Task 1 verification

- `npm.cmd test`: 12 schema tests passed.
- `npm.cmd run build`: TypeScript check and Vite production build passed.
- `npm.cmd run smoke`: production HTML, JavaScript, and CSS returned HTTP 200.
- `git diff --check`: passed.
- Browser/WebGL rendering has not been verified in this environment.
- Vite reports a bundle-size warning (approximately 1.22 MB JavaScript,
  336 KB gzip); rendering-cost tuning remains in Task 5.

## Task 2 verification

- Added six typed object kinds and 30 JSON-defined instances, including both
  pine and maple trees. No walking or collision behavior was added.
- `npm.cmd test`: 27 schema tests passed, covering the fixture, unique IDs,
  supported kinds, object count, transforms, and type-specific fields.
- `npm.cmd run build`: TypeScript check and production build passed. Vite's
  existing bundle-size warning remains (approximately 1.23 MB / 339 KB gzip).
- `npm.cmd run smoke`: production HTML, JavaScript, and CSS served successfully.
- `npm.cmd run inspect:garden`: installed Edge, headless software WebGL2,
  1440 × 960; active canvas, no visible fallback, no console/page errors.
  Visually inspected `artifacts/garden-desktop.png`: all six kinds are visible,
  with a winding path from the torii, clear pond, and trees around the perimeter.
- `git diff --check`: passed. Hardware GPU performance and walking are unverified;
  responsive visual refinement remains in Task 5.

## Task 3 verification

- Added optional, validated walking settings to world data: spawn, heading,
  speed, walking FOV, and look sensitivity. Older worlds remain valid.
- Enter garden captures the mouse; WASD/arrows walk horizontally and mouse
  movement changes the camera heading/pitch. Escape, Tab, Leave walk, blur,
  and hidden-tab events return to the overview, clear held input, and restore
  keyboard focus. Re-entry starts at the configured spawn, without auto-resume.
- `npm.cmd test`: 38 tests passed, including walking-setting validation,
  heading-relative motion, diagonal normalization, opposite/duplicate bindings,
  frame-rate consistency, and stalled-frame capping.
- `npm.cmd run build`: TypeScript and production build passed. Existing bundle
  warning remains (approximately 1.24 MB JavaScript / 341 KB gzip).
- `npm.cmd run smoke`: production HTML and both built assets served successfully.
- `npm.cmd run inspect:walking`: passed in headless Edge with software WebGL2.
  Verified real pointer lock, keyboard entry, forward movement, mouse look,
  Escape, Tab, a real tab switch while holding a movement key, still re-entry,
  Leave walk, focus restoration, and no console/page errors. Visually inspected
  `artifacts/garden-walking.png` at 1440 × 960.
- `git diff --check`: passed. No collision or boundary behavior was added.
  Hardware GPU performance and touch walking are unverified/not implemented.

## Task 4 verification

- Added optional object-local box/ellipse collision data and a configurable
  player radius (default 0.28 m). All fixture solids and water have footprints;
  paths and the torii opening remain clear.
- A shared navigation compiler transforms footprints by object scale/yaw,
  inflates them by player radius, and supplies spawn validation and continuous
  segment sweeps. Movement slides at contacts and retains horizontal eye height.
- `npm.cmd test`: 60 tests passed. Coverage includes all garden edges, edge
  recovery, radius clearance, rotated/nonuniformly scaled/offset shapes, large
  steps without tunneling, repeated corner pushes, frame-rate consistency,
  invalid spawns, gate posts/opening, every solid kind, and an actual-garden route.
- `npm.cmd run build`: TypeScript and production build passed. Existing Vite
  bundle warning remains (approximately 1.24 MB JavaScript / 342 KB gzip).
- `npm.cmd run smoke`: production HTML, JavaScript, and CSS served successfully.
- `npm.cmd run inspect:collisions`: passed in headless Edge, software WebGL2,
  1440 × 960, including the full walking/focus regression checks. Repeated
  outward input stopped at the south edge; retreat, gate passage, and pond
  approach/retreat worked. No console/page errors. Visually inspected
  `artifacts/garden-boundary.png` and `artifacts/garden-pond-approach.png`.
- `git diff --check`: passed. Collision footprints are conservative 2D geometry;
  hardware GPU performance, gravity, jumping, and vertical/overhead collision
  are outside this task. Task 5 has not been started.

## Task 5 verification

- Added static sun shadows, hemisphere fill, JSON-configured lily pads and moss,
  and a complete garden overview on narrow screens. System fonts avoid external
  font requests. Touch-only devices get clear overview-only instructions.
- Lazy-loaded the 3D renderer so preparation UI can appear first. Entry is
  disabled until ready; graphics failures expose a keyboard-focused retry that
  reloads the page, including recovery from cached module-download failures.
- Batched path stones by color, reused static shadow maps, capped pixel density,
  and added a one-way shadow/density fallback for sustained slow movement frames.
- `npm.cmd test`: 62 tests passed, including invalid decoration-data checks.
- `npm.cmd run build`: TypeScript and production build passed. Initial shell is
  approximately 326 KB / 100 KB gzip; lazy 3D chunk 925 KB / 245 KB gzip. The large
  3D chunk warning remains; splitting improves preparation UI, not total download.
- `npm.cmd run inspect:experience`: passed in headless Edge software WebGL2,
  including walking, collision traversal, focus recovery, 320/390/768/1440 layouts,
  walking resize, touch overview, delayed loading, native context loss/retry,
  and failed renderer-download/retry. Normal navigation had no console/page errors;
  deliberate download failure emits expected browser/React error diagnostics.
- Visually inspected desktop, narrow overview, walking, loading, and error
  screenshots under `artifacts/`.
- `npm.cmd run measure:performance`: approximately 43 FPS after quality warmup,
  33.4 ms p95 frame interval, zero idle WebGL draw calls. See
  [the recorded method and limits](performance.md); hardware GPU and physical
  mobile performance are unverified.
- `npm.cmd run smoke` and `git diff --check`: passed. Task 6 has not been started.

## Task 6 verification

- Added a single JSON admission boundary, capped at 1 MiB of UTF-8, with strict
  version/field validation and bounded field-error messages. Files are size-checked
  before reading. Numeric coordinates/dimensions and IDs now have finite, practical
  bounds to prevent degenerate generated input from reaching Three.js/navigation.
- Added the Worlds modal with example selection, local file reading, pasted JSON,
  and explicit Load world. Rejection preserves the current world and live canvas;
  acceptance replaces data and the walking session while reusing the renderer.
  Changes are in tab memory only and reset on reload.
- Added the 15-object Maple Courtyard fixture and the complete
  [version 1 format and generator handoff](world-format.md). No AI provider or
  arbitrary code/model/asset loading is connected.
- `npm.cmd test`: 87 tests passed. New coverage includes both fixtures, UTF-8/BOM,
  exact/oversized byte limits, malformed JSON, unsupported versions/kinds/fields,
  extreme/degenerate numeric input, duplicate IDs, and obstructed spawns.
- `npm.cmd run build`: TypeScript and production build passed. Initial shell is
  approximately 332 KB / 101 KB gzip; lazy 3D chunk remains 925 KB / 245 KB gzip,
  with the existing Vite large-chunk warning.
- `npm.cmd run inspect:worlds`: passed in headless Edge software WebGL2, including
  all walking/collision/responsive/recovery regression checks. New checks verify
  modal keyboard/background isolation and Escape, rejection without canvas
  replacement, oversized files, valid file and paste replacement, same-ID updates,
  imported-world walking, both example buttons, overview-only worlds, and the
  320-pixel picker. A focused follow-up also verified native graphics-context loss
  while the picker is open: the modal closes and recovery receives focus.
  No unexpected page/console errors in normal navigation.
- Visually inspected `artifacts/world-maple-courtyard.png`,
  `artifacts/world-import-error.png`, and `artifacts/world-picker-320.png`.
- `npm.cmd run smoke` and `git diff --check`: passed. Hardware GPU, physical mobile,
  hosted deployment, persistence, and AI generation are unverified/not implemented.
