import { describe, expect, it } from 'vitest'
import { worldCatalog } from './catalog'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'

describe('walkable world catalog', () => {
  it('offers exactly three distinct worlds', () => {
    expect(worldCatalog).toHaveLength(3)
    expect(new Set(worldCatalog.map(({ world }) => world.id)).size).toBe(3)
  })

  it.each(worldCatalog.slice(1))('$world.name has a clear trail and blocking scenery', ({ world }) => {
    const navigation = createNavigation(world)
    const spawn = { x: world.walking!.spawn[0], z: world.walking!.spawn[2] }
    // Follow the full central trail from the entry to the far clearing.
    expect(moveWithinGarden(spawn, { x: 0, z: -12 }, navigation)).toEqual({ x: 0, z: -5 })
    const pool = world.objects.find((object) => object.type === 'pond')!
    expect(isWalkable({ x: pool.position[0], z: pool.position[2] }, navigation)).toBe(false)
    const bank = moveWithinGarden({ x: 0, z: 0 }, { x: 8, z: 0 }, navigation)
    expect(bank.x).toBeGreaterThan(0)
    expect(bank.x).toBeLessThan(pool.position[0])
    expect(isWalkable(bank, navigation)).toBe(true)
    for (const object of world.objects.filter((object) => object.type !== 'path')) {
      expect(object.collision?.length).toBeGreaterThan(0)
    }
  })
})
