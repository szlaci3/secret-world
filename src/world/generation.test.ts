import { describe, expect, it } from 'vitest'
import { compileBlueprint } from './generation'
import { createNavigation, isWalkable } from '../controls/navigation'

import { testBlueprint } from './generation-fixture'

describe('generation compiler', () => {
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
    const oversized = testBlueprint(); oversized.ground.size = [100, 100]
    expect(() => compileBlueprint(oversized, 'test')).toThrow('dimensions')
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
      ...Array.from({ length: 13 }, (_, i) => ({ asset: 3, position: [-11 + i * 1.8, 0], rotation: 0, scale: [2, 2, 2] })),
    ] }
    expect(() => compileBlueprint(divided, 'test')).toThrow('connected walking space')
  })
})
