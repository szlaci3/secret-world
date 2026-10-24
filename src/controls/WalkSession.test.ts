import { expect, it } from 'vitest'
import { PerspectiveCamera } from 'three'
import { WalkSession } from './WalkSession'
import { parseWorld } from '../world/schema'
import { terrainHeight } from '../world/terrain'
import garden from '../world/garden.json'
import oasis from '../world/sandstone-oasis.json'

it('keeps eye height above the rendered terrain on entry and while walking, then restores overview', () => {
  const world = parseWorld({ ...garden, objects: [],
    ground: { size: [20, 20], color: '#778855', hills: [{ center: [0, 0], radius: 6, height: 2 }] },
    walking: { ...garden.walking, spawn: [-4, 1.65, 0], yaw: -Math.PI / 2 },
  })
  const document = Object.assign(new EventTarget(), {
    defaultView: new EventTarget(), pointerLockElement: null as unknown, hidden: false,
    hasFocus: () => true, exitPointerLock() { this.pointerLockElement = null },
  })
  const canvas = { ownerDocument: document, requestPointerLock: () => {
    document.pointerLockElement = canvas
    document.dispatchEvent(new Event('pointerlockchange'))
  } } as unknown as HTMLCanvasElement
  const camera = new PerspectiveCamera()
  const session = new WalkSession(canvas, camera, world, () => {}, () => {})
  session.enter()
  const entryHeight = camera.position.y
  expect(entryHeight).toBeCloseTo(1.65 + terrainHeight(world.ground, -4, 0))
  document.dispatchEvent(Object.assign(new Event('keydown'), { code: 'KeyW', repeat: false }))
  for (let i = 0; i < 20; i++) session.update(0.05)
  expect(camera.position.x).toBeGreaterThan(-4)
  expect(camera.position.y).toBeGreaterThan(entryHeight)
  expect(camera.position.y).toBeCloseTo(1.65 + terrainHeight(world.ground, camera.position.x, camera.position.z))
  session.exit()
  expect(camera.position.toArray()).toEqual(world.camera.position)
  session.dispose()
})

it('switches worlds and requests capture synchronously without canceling capture when React catches up', () => {
  const first = parseWorld(garden)
  const next = parseWorld(oasis)
  let requests = 0
  let exits = 0
  const document = Object.assign(new EventTarget(), {
    defaultView: new EventTarget(), pointerLockElement: null as unknown, hidden: false,
    hasFocus: () => true, exitPointerLock() { exits++; this.pointerLockElement = null },
  })
  const canvas = { ownerDocument: document, requestPointerLock: () => { requests++ } } as unknown as HTMLCanvasElement
  const camera = new PerspectiveCamera()
  const session = new WalkSession(canvas, camera, first, () => {}, () => {})
  session.enter(next)
  expect(requests).toBe(1)
  // The React world effect must not reset a request made in the thumbnail click.
  session.replaceWorld(next)
  expect(exits).toBe(0)
  document.pointerLockElement = canvas
  document.dispatchEvent(new Event('pointerlockchange'))
  const [x, eyeHeight, z] = next.walking!.spawn
  expect(camera.position.toArray()).toEqual([x, eyeHeight + terrainHeight(next.ground, x, z), z])
  expect(camera.rotation.y).toBe(next.walking!.yaw)
  session.exit()
  expect(exits).toBe(1)
  expect(camera.position.toArray()).toEqual(next.camera.position)
  session.dispose()
})
