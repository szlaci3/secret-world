import { describe, expect, it } from 'vitest'
import { compileBlueprint } from './generation'
import { createNavigation, isWalkable } from '../controls/navigation'

import { testBlueprint } from './generation-fixture'

describe('generation compiler', () => {
  it.each([[48, 48], [64, 64], [96, 96], [128, 128], [48, 64]])('accepts a %s by %s world with an authored arrival', (width, depth) => {
    const plan = { ...testBlueprint(), ground: { size: [width, depth], color: '#708060' }, arrival: [0, 10] }
    const world = compileBlueprint(plan, 'variable-size')
    expect(world.ground.size).toEqual([width, depth])
    expect(Math.hypot(world.walking!.spawn[0], world.walking!.spawn[2] - 10)).toBeLessThanOrEqual(Math.max(width, depth) / 64)
    expect(isWalkable({ x: 0, z: 10 }, createNavigation(world))).toBe(true)
    expect(() => compileBlueprint({ ...plan, arrival: [width, 0] }, 'invalid-arrival')).toThrow()
    expect(() => compileBlueprint({ ...plan, ground: { ...plan.ground, hills: [{ center: [width, 0], radius: 4, height: 1 }] } }, 'invalid-hill')).toThrow()
    expect(() => compileBlueprint({ ...plan, placements: [{ ...plan.placements[0], position: [width / 2 - 1, 0], count: 8, spread: 5 }, ...plan.placements] }, 'invalid-grove')).toThrow('outside the world')
  })
  it('allows overlapping forest crowns within the unchanged complex-object budget', () => {
    const tree = { type: 'tree', variety: 'spruce', foliageColor: '#557755', trunkColor: '#665544' }
    const plan = { ...testBlueprint(), ground: { size: [64, 64], color: '#708060' }, assets: [tree],
      placements: Array.from({ length: 12 }, (_, i) => ({ asset: 0, position: [-12 + (i % 4) * 8, -10 + Math.floor(i / 4) * 8], rotation: i / 3, scale: [1.8, 1.8, 1.8], count: 4, spread: 2.5 })) }
    const forest = compileBlueprint(plan, 'forest')
    expect(forest.objects.filter(o => o.type === 'tree')).toHaveLength(48)
    expect(() => compileBlueprint({ ...plan, placements: plan.placements.map(p => ({ ...p, count: 6 })) }, 'too-many-trees')).toThrow('Too many complex')
  })
  it.each([0, 0.6, Math.PI / 2])('keeps trunks off a narrow route rotated %s radians', (angle) => {
    const plan = { ...testBlueprint(), ground: { size: [64, 64], color: '#708060' },
      assets: [{ type: 'tree', variety: 'maple', foliageColor: '#557755', trunkColor: '#665544' }, { type: 'path', size: [1.5, 30], color: '#999988' }],
      placements: [{ asset: 0, position: [0, 0], rotation: 0, scale: [1.8, 1.8, 1.8], count: 8, spread: 5 },
        { asset: 1, position: [0, 0], rotation: angle, scale: [1, 1, 1] }], arrival: [0, 10] }
    const world = compileBlueprint(plan, 'clear-route'), navigation = createNavigation(world)
    expect(world.objects.filter(o => o.type === 'tree')).toHaveLength(8)
    for (let z = -14; z <= 14; z += 0.5) expect(isWalkable({ x: Math.sin(angle) * z, z: Math.cos(angle) * z }, navigation)).toBe(true)
    expect(world.objects.some(o => o.type === 'tree' && Math.abs(o.position[0]) < 2)).toBe(true)
  })
  it('faces an authored southern arrival into the route and keeps legacy arrival orientation', () => {
    const plan = { ...testBlueprint(), assets: [{ type: 'path', size: [1.5, 30], color: '#999988' }],
      placements: [{ asset: 0, position: [0, 0], rotation: 0, scale: [1, 1, 1] }], arrival: [0, -20] }
    expect(Math.abs(compileBlueprint(plan, 'south-arrival').walking!.yaw)).toBeCloseTo(Math.PI)
    expect(compileBlueprint(testBlueprint(), 'legacy-arrival').walking!.yaw).toBe(0)
  })
  it('supports dense small plants while removing hillside pavement', () => {
    const plan = testBlueprint()
    const dense = { ...plan, assets: [...plan.assets, { type: 'path', size: [3, 10], color: '#aabbcc' }],
      ground: { ...plan.ground, hills: [{ center: [30, -30], radius: 12, height: 3 }] },
      placements: [...plan.placements.filter(p => p.asset === 0).map(p => ({ ...p, count: 24, spread: 3 })),
        { asset: 3, position: [30, -30], rotation: 0, scale: [1, 1, 1] },
        { asset: 3, position: [0, 20], rotation: 0, scale: [1, 1, 1] }],
    }
    const world = compileBlueprint(dense, 'dense-test')
    expect(world.objects.filter(object => object.type === 'plant')).toHaveLength(288)
    expect(world.objects.filter(object => object.type === 'path').map(object => object.position)).toEqual([[0, 0, 20]])
    expect(() => compileBlueprint({ ...plan, placements: Array(15).fill({ ...plan.placements[0], count: 36, spread: 3 }) }, 'over-budget')).toThrow('Too many total instances')
    const cactus = { ...plan, assets: [{ type: 'plant', variety: 'cactus', color: '#779955', accentColor: '#ddddaa' }],
      placements: plan.placements.filter(p => p.asset === 0).map(p => ({ ...p, count: 6, spread: 3 })) }
    expect(() => compileBlueprint(cactus, 'solid-over-budget')).toThrow('Too many complex objects')
  })
  it('generates 128m worlds with distant objects and exact far-boundary collision', () => {
    const plan = testBlueprint()
    plan.placements[0].position = [55, -52]
    const world = compileBlueprint(plan, 'large-world')
    expect(world.ground.size).toEqual([128, 128])
    expect(world.objects[0].position).toEqual([55, 0, -52])
    const navigation = createNavigation(world)
    expect(isWalkable({ x: 63.7, z: 0 }, navigation)).toBe(true)
    expect(isWalkable({ x: 63.8, z: 0 }, navigation)).toBe(false)
    expect(world.walking!.spawn[2]).toBeGreaterThan(30)
    expect(Math.hypot(...world.environment.sunlight.position)).toBeGreaterThanOrEqual(127.9)
  })
  it('expands authored groves deterministically and caps expanded complexity', () => {
    const plan = testBlueprint()
    const clustered = { ...plan, placements: plan.placements.map((p, i) => i === 0 ? { ...p, count: 8, spread: 2 } : p) }
    const world = compileBlueprint(clustered, 'test')
    expect(world.objects.length).toBeGreaterThan(plan.placements.length)
    expect(compileBlueprint(clustered, 'test')).toEqual(world)
    expect(() => compileBlueprint({ ...plan, placements: plan.placements.map(p => ({ ...p, count: 12, spread: 2 })) }, 'test')).toThrow()
    const steep = compileBlueprint({ ...plan, ground: { ...plan.ground, hills: [{ center: [-7, -7], radius: 3, height: 3 }] } }, 'test')
    expect(steep.ground.hills![0].height).toBeLessThanOrEqual(1.2)
  })
  it('expands the library, supplies water/post collisions and finds a safe spawn', () => {
    const world = compileBlueprint(testBlueprint(), 'generated-test')
    const navigation = createNavigation(world)
    expect(world.objects).toHaveLength(14)
    expect(isWalkable({ x: 5, z: 0 }, navigation)).toBe(false)
    expect(isWalkable({ x: 0, z: -4 }, navigation)).toBe(true)
    expect(isWalkable({ x: world.walking!.spawn[0], z: world.walking!.spawn[2] }, navigation)).toBe(true)
  })
  it('rejects unknown assets, oversized worlds and unsupported models; reserves flat shores', () => {
    const invalidReference = testBlueprint(); invalidReference.placements[0].asset = 13
    expect(() => compileBlueprint(invalidReference, 'test')).toThrow('Unknown asset')
    const oversized = testBlueprint(); oversized.ground.size = [129, 100]
    expect(() => compileBlueprint(oversized, 'test')).toThrow()
    expect(() => compileBlueprint({ ...testBlueprint(), url: 'https://example.com/model.glb' }, 'test')).toThrow()
    const hilly = testBlueprint()
    expect(compileBlueprint({ ...hilly, ground: { ...hilly.ground, hills: [{ center: [5, 0], radius: 3, height: 1 }] } }, 'test').ground.hills).toEqual([])
  })
  it('enforces performance and exploration budgets', () => {
    const plan = testBlueprint()
    expect(() => compileBlueprint({ ...plan, placements: Array(101).fill(plan.placements[0]) }, 'test')).toThrow()
    const flooded = { ...plan, assets: [{ type: 'pond', radii: [10, 10], waterColor: '#448899', bankColor: '#999977' }],
      placements: Array(12).fill({ asset: 0, position: [0, 0], rotation: 0, scale: [1, 1, 1] }) }
    expect(() => compileBlueprint(flooded, 'test')).toThrow()
    const divided = { ...plan, assets: [...plan.assets, { type: 'rock', color: '#777777' }], placements: [
      ...plan.placements.filter(p => p.asset === 0),
      ...Array.from({ length: 49 }, (_, i) => ({ asset: 3, position: [-63 + i * 2.625, 0], rotation: 0, scale: [2, 2, 2] })),
    ] }
    expect(() => compileBlueprint(divided, 'test')).toThrow('connected walking space')
  })
})
