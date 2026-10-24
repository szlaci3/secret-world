import { describe, expect, it } from 'vitest'
import { createNavigation, isWalkable, moveWithinGarden } from './navigation'
import type { Point } from './navigation'
import { movementStep } from './movement'
import { parseWorld } from '../world/schema'
import garden from '../world/garden.json'
import type { CollisionShape } from '../world/collision-schema'

function fixture(collision: CollisionShape[], overrides = {}) {
  return createNavigation({
    ground: { size: [20, 20] }, walking: { radius: 0.28 },
    objects: [{ id: 'obstacle', position: [0, 0, 0], rotation: 0, scale: [1, 1, 1], collision, ...overrides }],
  })
}

const box: CollisionShape = { kind: 'box', center: [0, 0], size: [2, 2] }
const ellipse: CollisionShape = { kind: 'ellipse', center: [0, 0], radii: [2, 1] }

describe('garden navigation', () => {
  it('keeps the whole player inside every garden edge', () => {
    const nav = fixture([])
    for (const delta of [{ x: 50, z: 0 }, { x: -50, z: 0 }, { x: 0, z: 50 }, { x: 0, z: -50 }, { x: 50, z: 50 }]) {
      const next = moveWithinGarden({ x: 0, z: 0 }, delta, nav)
      expect(isWalkable(next, nav)).toBe(true)
      expect(Math.abs(next.x)).toBeLessThanOrEqual(9.72)
      expect(Math.abs(next.z)).toBeLessThanOrEqual(9.72)
      expect(Math.max(Math.abs(next.x), Math.abs(next.z))).toBeCloseTo(9.72, 3)
    }
  })

  it('slides along a boundary and allows movement away from it', () => {
    const nav = fixture([])
    const next = moveWithinGarden({ x: 9.5, z: 0 }, { x: 2, z: 2 }, nav)
    expect(next.x).toBeCloseTo(9.72, 3)
    expect(next.z).toBeCloseTo(2, 3)
    expect(moveWithinGarden(next, { x: -1, z: 0 }, nav).x).toBeCloseTo(8.72, 3)
  })

  it.each([box, ellipse])('sweeps across a $kind without tunneling even in one large step', (shape) => {
    const nav = fixture([shape])
    const next = moveWithinGarden({ x: -5, z: 0 }, { x: 10, z: 0 }, nav)
    expect(isWalkable(next, nav)).toBe(true)
    expect(next.x).toBeLessThan(-1)
  })

  it('keeps a player radius of clearance and slides along a box face', () => {
    const nav = fixture([box])
    const next = moveWithinGarden({ x: -3, z: -0.5 }, { x: 3, z: 1 }, nav)
    expect(next.x).toBeCloseTo(-1.28, 3)
    expect(next.z).toBeCloseTo(0.5, 3)
    expect(isWalkable(next, nav)).toBe(true)
  })

  it('handles translated, rotated, nonuniformly scaled footprints and local offsets', () => {
    const nav = fixture([{ kind: 'box', center: [1, 0], size: [2, 1] }],
      { position: [3, 0, 2], rotation: Math.PI / 2, scale: [2, 1, 1] })
    // Local center [1,0] becomes world [3,0]; width becomes world Z depth.
    expect(isWalkable({ x: 3, z: 0 }, nav)).toBe(false)
    const next = moveWithinGarden({ x: 0, z: 0 }, { x: 6, z: 0 }, nav)
    expect(next.x).toBeCloseTo(3 - 0.5 - 0.28, 3)
    expect(isWalkable(next, nav)).toBe(true)
  })

  it('inflates the player in world space after scaling the obstacle', () => {
    const nav = fixture([box], { scale: [2, 1, 0.5] })
    expect(moveWithinGarden({ x: -5, z: 0 }, { x: 5, z: 0 }, nav).x).toBeCloseTo(-2.28, 3)
    expect(moveWithinGarden({ x: 0, z: -5 }, { x: 0, z: 5 }, nav).z).toBeCloseTo(-0.78, 3)
  })

  it('contains the full elliptical bank including diagonal points', () => {
    const nav = fixture([ellipse])
    for (let index = 0; index < 64; index++) {
      const angle = index * Math.PI / 32
      expect(isWalkable({ x: 2 * Math.cos(angle), z: Math.sin(angle) }, nav)).toBe(false)
    }
    expect(isWalkable({ x: 2.5, z: 0 }, nav)).toBe(true)
  })

  it('remains outside a corner over repeated diagonal pushes and can back away', () => {
    const nav = fixture([box])
    let point = { x: -3, z: -3 }
    for (let index = 0; index < 120; index++) {
      point = moveWithinGarden(point, { x: 0.1, z: 0.1 }, nav)
      expect(isWalkable(point, nav)).toBe(true)
    }
    const retreat = moveWithinGarden(point, { x: -0.5, z: -0.5 }, nav)
    expect(retreat.x).toBeLessThan(point.x)
    expect(retreat.z).toBeLessThan(point.z)
  })

  it('preserves frame-independent speed while approaching and sliding along solids', () => {
    const nav = fixture([{ ...box, size: [2, 10] }])
    const simulate = (fps: number) => {
      let point = { x: -2, z: 0 }
      for (let frame = 0; frame < fps; frame++) {
        point = moveWithinGarden(point, movementStep(new Set(['KeyS', 'KeyD']), 0, 2.4, 1 / fps), nav)
      }
      return point
    }
    // Same collision route at 30/60/120 FPS, including skin tolerance.
    const points = [30, 60, 120].map(simulate)
    points.forEach((point) => {
      expect(point.x).toBeCloseTo(-1.28, 3)
      expect(point.x).toBeCloseTo(points[0].x, 3)
      expect(point.z).toBeCloseTo(points[0].z, 3)
      expect(isWalkable(point, nav)).toBe(true)
    })
  })

  it('rejects invalid starting positions instead of pushing through props', () => {
    const nav = fixture([box])
    expect(moveWithinGarden({ x: 0, z: 0 }, { x: 5, z: 0 }, nav)).toEqual({ x: 0, z: 0 })
  })
})

describe('the actual garden collision data', () => {
  const world = parseWorld(garden)
  const nav = createNavigation(world)

  it('defines footprints for every solid and water object, leaving paths walkable', () => {
    world.objects.forEach((object) => {
      if (object.type === 'path' || object.type === 'patch' || (object.type === 'plant' && !['bamboo', 'cactus'].includes(object.variety))) expect(object.collision ?? []).toHaveLength(0)
      else expect(object.collision?.length).toBeGreaterThan(0)
    })
    expect(isWalkable({ x: world.walking!.spawn[0], z: world.walking!.spawn[2] }, nav)).toBe(true)
  })

  it('allows the gate opening while blocking each post', () => {
    expect(isWalkable({ x: -1.8, z: 6.5 }, nav)).toBe(true)
    expect(isWalkable({ x: -3, z: 6.5 }, nav)).toBe(false)
    expect(isWalkable({ x: -0.6, z: 6.5 }, nav)).toBe(false)
    const through = moveWithinGarden({ x: -1.8, z: 7.7 }, { x: 0, z: -3 }, nav)
    expect(through.z).toBeCloseTo(4.7)
  })

  it('blocks the pond, rocks, trunks, and lanterns', () => {
    for (const object of world.objects.filter((entry) => ['pond', 'rock', 'tree', 'lantern'].includes(entry.type))) {
      expect(isWalkable({ x: object.position[0], z: object.position[2] }, nav), object.id).toBe(false)
    }
  })

  it('walks through the gate, follows the path, approaches water, and returns', () => {
    let point: Point = { x: -1.8, z: 7.7 }
    const targets = [{ x: -1.8, z: 5.2 }, { x: -1.1, z: 2.6 }, { x: -1, z: 0 },
      { x: 3.1, z: 0.1 }, { x: -1, z: 0 }, { x: -1.5, z: -3.9 },
      { x: -0.2, z: -6.2 }, { x: -1, z: 0 }, { x: -1.8, z: 7.7 }]
    targets.forEach((target, index) => {
      const start = { ...point }
      const delta = { x: (target.x - start.x) / 180, z: (target.z - start.z) / 180 }
      for (let frame = 0; frame < 180; frame++) {
        point = moveWithinGarden(point, delta, nav)
        expect(isWalkable(point, nav)).toBe(true)
      }
      if (index === 3) expect(point.x).toBeLessThan(1) // Attempt to cross water stops at the bank.
      else expect(Math.hypot(point.x - target.x, point.z - target.z), `Route target ${index}: ${JSON.stringify(point)}`).toBeLessThan(0.01)
    })
  })
})
