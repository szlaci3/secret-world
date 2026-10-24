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
2. **Japanese garden composition**
   - Extend the schema and renderer with paths, pond, rocks, trees, lanterns,
     and an entrance. Place every instance through garden data.
   - Verify: fixture validation and browser inspection of the full garden layout.
3. **First-person walking**
   - Add keyboard movement, pointer-lock mouse look, explicit entry/exit,
     and accessible instructions. Reset held inputs on focus loss.
   - Verify: enter, walk, look, Escape, and tab-away/resume in a browser.
4. **Walkable bounds and collisions**
   - Constrain movement to the garden; block water and solid props using
     collision data, with a safe spawn and frame-independent movement.
   - Verify: automated boundary/collision cases and a browser traversal.
5. **Atmosphere and responsive experience**
   - Refine lighting, shadows, garden details, and responsive overlays;
     provide clear loading/error states and tune rendering cost.
   - Verify: desktop/narrow viewports, keyboard access, visual inspection,
     and a recorded browser performance check.
6. **World-loading handoff**
   - Load replacement JSON through the versioned validation boundary, preserve
     the active world on rejection, add a second fixture, and document the
     supported format for future AI generation. AI provider integration is future work.
   - Verify: valid world replacement, malformed/unsupported input rejection,
     second-fixture rendering, and full project checks.

## Scope boundary

Task 1 deliberately provides a stationary ground preview. Garden props, walking,
collisions, JSON import UI, and AI generation belong to later tasks.

## Task 1 verification

- `npm.cmd test`: 12 schema tests passed.
- `npm.cmd run build`: TypeScript check and Vite production build passed.
- `npm.cmd run smoke`: production HTML, JavaScript, and CSS returned HTTP 200.
- `git diff --check`: passed.
- Browser/WebGL rendering has not been verified in this environment.
- Vite reports a bundle-size warning (approximately 1.22 MB JavaScript,
  336 KB gzip); rendering-cost tuning remains in Task 5.
