import { describe, expect, it } from 'vitest'
import { worldCatalog } from './catalog'
import { loadWorldJson } from './load-world'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { terrainHeight } from './terrain'

describe('walkable world catalog', () => {
  it('offers six distinct worlds with different water layouts', () => {
    expect(worldCatalog).toHaveLength(6)
    expect(new Set(worldCatalog.map(({ world }) => world.id)).size).toBe(6)
    expect(worldCatalog.map(({ world }) => world.objects.filter((object) => object.type === 'pond').length)).toEqual([1, 3, 0, 0, 1, 3])
  })

  it.each(worldCatalog)('$world.name loads and has a connected exploration space', ({ world }) => {
    expect(loadWorldJson(JSON.stringify(world))).toEqual({ ok: true, world })
    const navigation = createNavigation(world)
    const spawn = { x: world.walking!.spawn[0], z: world.walking!.spawn[2] }
    expect(isWalkable(spawn, navigation)).toBe(true)
    expect(moveWithinGarden(spawn, { x: 0, z: -0.8 }, navigation).z).toBeLessThan(spawn.z - 0.5)
    // Half-meter flood fill catches accidental enclosures and disconnected clearings.
    const points = new Map<string, { x: number; z: number }>()
    for (let x = Math.ceil(navigation.bounds.minX * 2); x <= navigation.bounds.maxX * 2; x++) {
      for (let z = Math.ceil(navigation.bounds.minZ * 2); z <= navigation.bounds.maxZ * 2; z++) {
        const point = { x: x / 2, z: z / 2 }
        if (isWalkable(point, navigation)) points.set(`${x},${z}`, point)
      }
    }
    const closest = [...points].sort((a, b) => Math.hypot(a[1].x - spawn.x, a[1].z - spawn.z) - Math.hypot(b[1].x - spawn.x, b[1].z - spawn.z))[0][0]
    const seen = new Set([closest]), queue = [closest]
    for (let i = 0; i < queue.length; i++) {
      const start = points.get(queue[i])!
      for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
        const key = `${(start.x + dx) * 2},${(start.z + dz) * 2}`
        if (!points.has(key) || seen.has(key)) continue
        const moved = moveWithinGarden(start, { x: dx, z: dz }, navigation)
        if (Math.hypot(moved.x - start.x - dx, moved.z - start.z - dz) > 0.001) continue
        seen.add(key); queue.push(key)
      }
    }
    expect(seen.size / points.size).toBeGreaterThan(0.95)
    for (const object of world.objects) {
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
