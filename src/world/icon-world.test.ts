import { describe, expect, it } from 'vitest'
import iconWorld from './icon-world.json'
import { parseWorld } from './schema'
import { iconNames, ICON_FOOTPRINT } from './icon-types'
import { blueprintSchema } from './generation'
import { testBlueprint } from './generation-fixture'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { objectFitsGround } from './object-bounds'

describe('Icon World admission and walking', () => {
  const world = parseWorld(iconWorld)
  const icons = world.objects.filter(object => object.type === 'icon')
  it('has exactly ten different local icons that fit the grass and block walking', () => {
    expect(icons.map(object => object.icon).sort()).toEqual([...iconNames].sort())
    const navigation = createNavigation(world)
    for (const object of icons) {
      expect(objectFitsGround(object, world.ground.size)).toBe(true)
      expect(isWalkable({ x: object.position[0], z: object.position[2] }, navigation)).toBe(false)
      // Approach each rotated/scaled extrusion along its local front normal.
      const sin = Math.sin(object.rotation), cos = Math.cos(object.rotation)
      const start = { x: object.position[0] + sin * 3, z: object.position[2] + cos * 3 }
      expect(isWalkable(start, navigation)).toBe(true)
      const stopped = moveWithinGarden(start, { x: -sin * 3, z: -cos * 3 }, navigation)
      expect(Math.hypot(stopped.x - object.position[0], stopped.z - object.position[2]))
        .toBeGreaterThan(ICON_FOOTPRINT[1] * object.scale[2] / 2 + 0.27)
    }
  })
  it('round-trips without accumulating collision defaults', () => {
    expect(parseWorld(JSON.parse(JSON.stringify(world)))).toEqual(world)
  })
  it('rejects arbitrary SVGs, unknown names and undersized collision overrides', () => {
    for (const change of [{ icon: 'remote-icon' }, { svg: '<svg/>' }, { url: 'https://example.com/icon.svg' }, { collision: [] },
      { collision: [{ kind: 'box', center: [0, 0], size: [0.1, 0.1] }] }]) {
      expect(() => parseWorld({ ...iconWorld, objects: [{ ...iconWorld.objects[0], ...change }] })).toThrow()
    }
  })
  it('rejects an icon placed over the walking spawn', () => {
    expect(() => parseWorld({ ...iconWorld, objects: [{ ...iconWorld.objects[0], position: [0, 0, 16] }] })).toThrow(/Walking spawn/)
  })
  it('keeps icons out of the Gemini blueprint contract for this MVP', () => {
    expect(blueprintSchema.safeParse({ ...testBlueprint(), assets: [{ type: 'icon', icon: 'folder', color: '#ffcc55' }] }).success).toBe(false)
  })
})
