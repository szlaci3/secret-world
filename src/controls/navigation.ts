import type { CollisionShape } from '../world/collision-schema'

export type Point = { x: number; z: number }
type Plane = { normal: Point; offset: number }
type Hit = { time: number; normal: Point }
export type Navigation = {
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  obstacles: { id: string; planes: Plane[] }[]
}

// Structural input avoids tying the geometry engine to React or schema parsing.
type NavigationSource = {
  ground: { size: [number, number] }
  walking?: { radius?: number }
  objects: {
    id: string; position: [number, number, number]; rotation: number
    scale: [number, number, number]; collision?: CollisionShape[]
  }[]
}

const dot = (a: Point, b: Point) => a.x * b.x + a.z * b.z
const EPSILON = 1e-9
const SKIN = 1e-5
const ELLIPSE_SIDES = 32
export const DEFAULT_PLAYER_RADIUS = 0.28

export function createNavigation(world: NavigationSource): Navigation {
  const radius = world.walking?.radius ?? DEFAULT_PLAYER_RADIUS
  const [width, depth] = world.ground.size
  const obstacles = world.objects.flatMap((object) => (object.collision ?? []).map((shape) => {
    const cos = Math.cos(object.rotation)
    const sin = Math.sin(object.rotation)
    const transform = (x: number, z: number): Point => {
      const localX = (shape.center[0] + x) * object.scale[0]
      const localZ = (shape.center[1] + z) * object.scale[2]
      return { x: object.position[0] + cos * localX + sin * localZ,
        z: object.position[2] - sin * localX + cos * localZ }
    }
    const vertices = shape.kind === 'box'
      ? [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, z]) => transform(x * shape.size[0] / 2, z * shape.size[1] / 2))
      : Array.from({ length: ELLIPSE_SIDES }, (_, index) => {
        const angle = index * 2 * Math.PI / ELLIPSE_SIDES
        // Circumscribe the real ellipse so the polygon never cuts into water/props.
        const padding = 1 / Math.cos(Math.PI / ELLIPSE_SIDES)
        return transform(Math.cos(angle) * shape.radii[0] * padding, Math.sin(angle) * shape.radii[1] * padding)
      })
    const planes = vertices.map((a, index) => {
      const b = vertices[(index + 1) % vertices.length]
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      const normal = { x: (b.z - a.z) / length, z: (a.x - b.x) / length }
      // Inflate each convex footprint by the circular player's world-space radius.
      return { normal, offset: dot(normal, a) + radius }
    })
    return { id: object.id, planes }
  }))
  return { bounds: { minX: -width / 2 + radius, maxX: width / 2 - radius,
    minZ: -depth / 2 + radius, maxZ: depth / 2 - radius }, obstacles }
}

export function isWalkable(point: Point, navigation: Navigation): boolean {
  const { minX, maxX, minZ, maxZ } = navigation.bounds
  if (point.x < minX || point.x > maxX || point.z < minZ || point.z > maxZ) return false
  return !navigation.obstacles.some(({ planes }) => planes.every(({ normal, offset }) => dot(normal, point) <= offset + EPSILON))
}

/** Segment clipping against an inflated convex footprint: no endpoint-only tests. */
function sweepObstacle(start: Point, delta: Point, planes: Plane[]): Hit | null {
  let enter = -Infinity
  let leave = Infinity
  let normal: Point | null = null
  for (const plane of planes) {
    const distance = dot(plane.normal, start) - plane.offset
    const velocity = dot(plane.normal, delta)
    if (Math.abs(velocity) < EPSILON) {
      if (distance > EPSILON) return null
      continue
    }
    const time = -distance / velocity
    if (velocity < 0) {
      if (time > enter) { enter = time; normal = plane.normal }
    } else {
      leave = Math.min(leave, time)
    }
    if (enter > leave) return null
  }
  return normal && enter >= -EPSILON && enter <= 1 && leave >= 0
    ? { time: Math.max(0, enter), normal } : null
}

function firstHit(start: Point, delta: Point, navigation: Navigation): Hit | null {
  let closest: Hit | null = null
  const consider = (hit: Hit | null) => {
    if (hit && hit.time >= 0 && hit.time <= 1 && (!closest || hit.time < closest.time)) closest = hit
  }
  const { minX, maxX, minZ, maxZ } = navigation.bounds
  if (delta.x > EPSILON) consider({ time: (maxX - start.x) / delta.x, normal: { x: -1, z: 0 } })
  if (delta.x < -EPSILON) consider({ time: (minX - start.x) / delta.x, normal: { x: 1, z: 0 } })
  if (delta.z > EPSILON) consider({ time: (maxZ - start.z) / delta.z, normal: { x: 0, z: -1 } })
  if (delta.z < -EPSILON) consider({ time: (minZ - start.z) / delta.z, normal: { x: 0, z: 1 } })
  for (const obstacle of navigation.obstacles) consider(sweepObstacle(start, delta, obstacle.planes))
  return closest
}

/** Sweep and slide, retaining tangential motion while discarding blocked motion. */
export function moveWithinGarden(start: Point, delta: Point, navigation: Navigation): Point {
  // Reject invalid callers rather than trying to depenetrate through another prop.
  if (!isWalkable(start, navigation)) return { ...start }
  const result = { ...start }
  let remaining = { ...delta }
  for (let iteration = 0; iteration < 6; iteration++) {
    const length = Math.hypot(remaining.x, remaining.z)
    if (length < EPSILON) break
    const hit = firstHit(result, remaining, navigation)
    if (!hit) {
      result.x += remaining.x
      result.z += remaining.z
      break
    }
    const travel = Math.max(0, hit.time - SKIN / length)
    result.x += remaining.x * travel
    result.z += remaining.z * travel
    remaining.x *= 1 - travel
    remaining.z *= 1 - travel
    const inward = Math.min(0, dot(remaining, hit.normal))
    remaining.x -= hit.normal.x * inward
    remaining.z -= hit.normal.z * inward
  }
  return result
}
