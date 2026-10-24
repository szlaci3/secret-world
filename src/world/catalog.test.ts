import { describe, expect, it } from 'vitest'
import { worldCatalog } from './catalog'
import { loadWorldJson } from './load-world'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { terrainHeight } from './terrain'
import { isLevelPath } from './paths'

describe('walkable world catalog', () => {
  it('offers one landscape designed for 128-meter exploration', () => {
    expect(worldCatalog).toHaveLength(1)
    expect(new Set(worldCatalog.map(({ world }) => world.id)).size).toBe(1)
    expect(worldCatalog.map(({ world }) => world.objects.filter((object) => object.type === 'pond').length)).toEqual([2])
    // The original meadow had 84 plant clusters. Dense ground cover should
    // increase without increasing the tree/building/collision workload.
    expect(worldCatalog[0].world.objects.filter(object => object.type === 'plant')).toHaveLength(252)
  })

  it.each(worldCatalog)('$world.name loads and has a connected exploration space', ({ world }) => {
    expect(loadWorldJson(JSON.stringify(world))).toEqual({ ok: true, world })
    const navigation = createNavigation(world)
    const spawn = { x: world.walking!.spawn[0], z: world.walking!.spawn[2] }
    expect(isWalkable(spawn, navigation)).toBe(true)
    expect(moveWithinGarden(spawn, { x: 0, z: -0.8 }, navigation).z).toBeLessThan(spawn.z - 0.5)
    // Two-meter connectivity sample stays bounded for the 128m landscape.
    expect(world.ground.size).toEqual([128, 128])
    const spacing = 2
    const points = new Map<string, { x: number; z: number }>()
    for (let x = Math.ceil(navigation.bounds.minX / spacing); x <= navigation.bounds.maxX / spacing; x++) {
      for (let z = Math.ceil(navigation.bounds.minZ / spacing); z <= navigation.bounds.maxZ / spacing; z++) {
        const point = { x: x * spacing, z: z * spacing }
        if (isWalkable(point, navigation)) points.set(`${x},${z}`, point)
      }
    }
    const closest = [...points].sort((a, b) => Math.hypot(a[1].x - spawn.x, a[1].z - spawn.z) - Math.hypot(b[1].x - spawn.x, b[1].z - spawn.z))[0][0]
    const seen = new Set([closest]), queue = [closest]
    for (let i = 0; i < queue.length; i++) {
      const start = points.get(queue[i])!
      for (const [dx, dz] of [[spacing, 0], [-spacing, 0], [0, spacing], [0, -spacing]]) {
        const key = `${(start.x + dx) / spacing},${(start.z + dz) / spacing}`
        if (!points.has(key) || seen.has(key)) continue
        const moved = moveWithinGarden(start, { x: dx, z: dz }, navigation)
        if (Math.hypot(moved.x - start.x - dx, moved.z - start.z - dz) > 0.001) continue
        seen.add(key); queue.push(key)
      }
    }
    expect(seen.size / points.size).toBeGreaterThan(0.95)
    for (const object of world.objects) {
      if (object.type === 'path') expect(isLevelPath(world.ground, object)).toBe(true)
      if (['tree', 'rock', 'structure', 'pond', 'entrance', 'lantern'].includes(object.type)) expect(object.collision?.length).toBeGreaterThan(0)
      if (object.type === 'pond') {
        expect(isWalkable({ x: object.position[0], z: object.position[2] }, navigation)).toBe(false)
        // Water remains level: no hill should protrude through the bank.
        for (let i = 0; i < 32; i++) {
          const angle = i * Math.PI / 16
          const x = object.position[0] + Math.cos(angle) * object.radii[0] * 1.15
          const z = object.position[2] + Math.sin(angle) * object.radii[1] * 1.15
          expect(terrainHeight(world.ground, x, z)).toBeLessThan(0.04)
        }
      }
    }
  })
})
