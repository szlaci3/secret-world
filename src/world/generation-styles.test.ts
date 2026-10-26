import { describe, expect, it } from 'vitest'
import { compileBlueprint } from './generation'
import { testBlueprint, testIconBlueprint } from './generation-fixture'
import { ICON_FOOTPRINT } from './icon-types'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { loadWorldJson } from './load-world'

describe('generated world styles', () => {
  it('keeps legacy requests standard and requires a resolved style for auto', () => {
    expect(compileBlueprint(testBlueprint(), 'legacy').style).toBe('standard')
    expect(() => compileBlueprint(testBlueprint(), 'missing-style', 'auto')).toThrow()
    for (const plan of [{ ...testBlueprint(), style: 'standard' }, testIconBlueprint()]) {
      const world = compileBlueprint(plan, 'automatic', 'auto')
      expect(world.style).toBe(plan.style)
      expect(loadWorldJson(JSON.stringify(world))).toEqual({ ok: true, world })
    }
  })
  it('creates bounded icon worlds with collisions, uniform scales and a safe connected arrival', () => {
    const plan = testIconBlueprint()
    plan.placements[0].scale = [1.4, 0.9, 1.5]
    const world = compileBlueprint(plan, 'office', 'icons')
    const icons = world.objects.filter(o => o.type === 'icon'), navigation = createNavigation(world)
    expect(icons).toHaveLength(10)
    expect(icons[0].scale).toEqual([0.9, 0.9, 0.9])
    expect(world.environment.skyLight).toBeDefined()
    for (const icon of icons) {
      expect(icon.collision).toEqual([{ kind: 'box', center: [0, 0], size: ICON_FOOTPRINT }])
      expect(isWalkable({ x: icon.position[0], z: icon.position[2] }, navigation)).toBe(false)
    }
    const spawn = { x: world.walking!.spawn[0], z: world.walking!.spawn[2] }
    expect(isWalkable(spawn, navigation)).toBe(true)
    expect(moveWithinGarden(spawn, { x: 0, z: -1 }, navigation).z).toBeCloseTo(spawn.z - 1)
    expect(loadWorldJson(JSON.stringify(world))).toEqual({ ok: true, world })
  })
  it('enforces explicit choices and rejects mixed or mislabeled automatic output', () => {
    expect(() => compileBlueprint(testIconBlueprint(), 'forced-standard', 'standard')).toThrow()
    expect(() => compileBlueprint({ ...testBlueprint(), style: 'standard' }, 'forced-icons', 'icons')).toThrow()
    expect(() => compileBlueprint({ ...testIconBlueprint(), style: 'standard' }, 'mixed-standard', 'auto')).toThrow()
    expect(() => compileBlueprint({ ...testBlueprint(), style: 'icons' }, 'mixed-icons', 'auto')).toThrow()
    expect(() => compileBlueprint({ ...testIconBlueprint(), style: 'other' }, 'invalid-style', 'auto')).toThrow()
  })
  it('keeps the icon library local and refuses unknown icons, markup and URLs', () => {
    const plan = testIconBlueprint()
    for (const change of [{ icon: 'remote-art' }, { svg: '<svg/>' }, { url: 'https://example.com/shape.svg' }]) {
      expect(() => compileBlueprint({ ...plan, assets: [{ ...plan.assets[0], ...change }] }, 'unsafe', 'icons')).toThrow()
    }
  })
  it('rejects overlapping and tightly packed rotated icons, not just blocked spawns', () => {
    const plan = testIconBlueprint()
    for (const rotation of [0, 0.7, Math.PI / 2]) {
      expect(() => compileBlueprint({ ...plan, placements: [
        { ...plan.placements[0], position: [0, 0], rotation },
        { ...plan.placements[1], position: [0.5, 0.5], rotation: -rotation },
      ] }, 'overlap', 'icons')).toThrow('Icon layout: leave at least 1.2m')
    }
    expect(() => compileBlueprint({ ...plan, placements: [
      { ...plan.placements[0], position: [0, 0], rotation: 0 },
      { ...plan.placements[1], position: [4, 0], rotation: 0 },
    ] }, 'narrow-gap', 'icons')).toThrow('Icon layout: leave at least 1.2m')
  })
  it('requires icons, caps icon/grass budgets and prevents overhangs and hillside props', () => {
    const plan = testIconBlueprint()
    expect(() => compileBlueprint({ ...plan, placements: [plan.placements[10]] }, 'empty', 'icons')).toThrow('use 1–24 icon objects')
    expect(() => compileBlueprint({ ...plan, placements: Array(25).fill(plan.placements[0]) }, 'crowded', 'icons')).toThrow('use 1–24 icon objects')
    expect(() => compileBlueprint({ ...plan, placements: [plan.placements[0],
      ...Array(3).fill({ ...plan.placements[10], count: 36 })] }, 'grass-budget', 'icons')).toThrow('at most 96')
    expect(() => compileBlueprint({ ...plan, placements: [{ ...plan.placements[0], position: [19, 0] }] }, 'overhang', 'icons')).toThrow('Object outside')
    expect(() => compileBlueprint({ ...plan, ground: { ...plan.ground, hills: [{ center: [0, 0], radius: 4, height: 1 }] } }, 'hills', 'icons')).toThrow()
    expect(() => compileBlueprint({ ...plan, ground: { ...plan.ground, size: [128, 128] } }, 'oversized', 'icons')).toThrow()
    expect(() => compileBlueprint({ ...plan, placements: [{ ...plan.placements[0], count: 2, spread: 3 }] }, 'icon-cluster', 'icons')).toThrow('Only vegetation')
  })
  it('removes supporting grass placed inside an icon footprint', () => {
    const plan = testIconBlueprint()
    const world = compileBlueprint({ ...plan, placements: [plan.placements[0],
      { ...plan.placements[10], position: plan.placements[0].position, count: 1, spread: 0 }] }, 'clear-bases', 'icons')
    expect(world.objects).toHaveLength(1)
    expect(world.objects[0].type).toBe('icon')
  })
  it('crops decorative grass at the edge while retaining in-bounds grass and rejecting icon overhangs', () => {
    const plan = testIconBlueprint()
    const world = compileBlueprint({ ...plan, placements: [plan.placements[0],
      { ...plan.placements[10], position: [19, 0], count: 12, spread: 4 }] }, 'cropped-grass', 'icons')
    expect(world.objects.filter(object => object.type === 'icon')).toHaveLength(1)
    const grass = world.objects.filter(object => object.type === 'plant')
    expect(grass.length).toBeGreaterThan(0)
    expect(grass.length).toBeLessThan(12)
    expect(grass.every(object => Math.abs(object.position[0]) < 20)).toBe(true)
  })
})
