import { describe, expect, it } from 'vitest'
import { objectFitsGround } from './object-bounds'
import type { WorldObject } from './schema'
import { treeGeometry } from '../scene/Trees'
import { plantGeometry } from '../scene/Plants'
import { rockGeometry } from '../scene/Rocks'
import { artifactGeometry } from '../scene/artifact-geometry'

const transform = { id: 'boundary-test', position: [0, 0, 0] as [number, number, number], rotation: 0, scale: [1, 1, 1] as [number, number, number] }
const path = { ...transform, type: 'path' as const, size: [2, 10] as [number, number], color: '#aaaaaa' }

describe('generated object boundaries', () => {
  it('checks path ends, all four edges, rotation and nonuniform scale on rectangular terrain', () => {
    for (const [x, z] of [[0, 6], [0, -6], [10, 0], [-10, 0]]) {
      const object = { ...path, position: [x, 0, z] as [number, number, number] }
      expect(objectFitsGround(object, [20, 20])).toBe(false)
    }
    expect(objectFitsGround({ ...path, position: [0, 0, 6] }, [20, 20])).toBe(false)
    expect(objectFitsGround({ ...path, position: [0, 0, 5] }, [20, 20])).toBe(true)
    expect(objectFitsGround({ ...path, position: [0, 0, 5], scale: [1, 1, 2] }, [20, 20])).toBe(false)
    expect(objectFitsGround({ ...path, position: [7, 0, 0], rotation: Math.PI / 4 }, [20, 30])).toBe(false)
    expect(objectFitsGround({ ...path, position: [7, 0, 0] }, [20, 30])).toBe(true)
  })

  it('includes rotated elliptical banks and patches without using an oversized circular shore', () => {
    const pond = { ...transform, type: 'pond' as const, radii: [8, 2] as [number, number], waterColor: '#448899', bankColor: '#998877' }
    expect(objectFitsGround({ ...pond, position: [0, 0, 8] }, [24, 24])).toBe(true)
    expect(objectFitsGround({ ...pond, position: [0, 0, 8], rotation: Math.PI / 2 }, [24, 24])).toBe(false)
    expect(objectFitsGround({ ...transform, type: 'patch', radii: [5, 2], color: '#998877', position: [8, 0, 0] }, [24, 24])).toBe(false)
  })

  it('bounds actual reusable geometry, including canopy variants, roofs and both vegetation detail levels', () => {
    const objects: WorldObject[] = [
      ...(['pine', 'maple', 'spruce', 'palm'] as const).map(variety => ({ ...transform, type: 'tree' as const, variety, foliageColor: '#557755', trunkColor: '#665544' })),
      ...(['grass', 'flowers', 'reeds', 'bamboo', 'cactus', 'fern', 'mushrooms'] as const).map(variety => ({ ...transform, type: 'plant' as const, variety, color: '#557755', accentColor: '#ccaaaa' })),
      ...(['arch', 'bench', 'cabin', 'column', 'pavilion', 'beacon', 'windmill', 'fallen-log', 'stump'] as const).map(variety => ({ ...transform, type: 'structure' as const, variety, color: '#998877', accentColor: '#ccaaaa' })),
      { ...transform, type: 'entrance', woodColor: '#998877', roofColor: '#665544' },
      { ...transform, type: 'lantern', stoneColor: '#998877', glowColor: '#ccaaaa' },
      { ...transform, type: 'rock', color: '#998877' },
    ]
    for (const object of objects) for (const lowDetail of [false, true]) for (const variant of [0, 1, 2]) {
      const geometry = object.type === 'tree' ? treeGeometry(object, lowDetail, variant)
        : object.type === 'plant' ? plantGeometry(object, lowDetail, variant)
        : object.type === 'rock' ? rockGeometry(object, variant)
        : artifactGeometry(object as Extract<WorldObject, { type: 'structure' | 'entrance' | 'lantern' }>)
      try {
        const placed = { ...object, rotation: 0.61, scale: [1.6, 1, 1.3] as [number, number, number] }
        // Find the furthest admitted anchor, then check the actual mesh at it.
        let inside = 0, outside = 12
        for (let i = 0; i < 30; i++) {
          const x = (inside + outside) / 2
          if (objectFitsGround({ ...placed, position: [x, 0, 0] }, [24, 32])) inside = x
          else outside = x
        }
        geometry.scale(...placed.scale).rotateY(placed.rotation).translate(inside, 0, 0)
        geometry.computeBoundingBox()
        const bounds = geometry.boundingBox!
        expect(bounds.max.x, `${object.type} visible geometry exceeds admitted footprint`).toBeLessThanOrEqual(12.00001)
        expect(bounds.min.x).toBeGreaterThanOrEqual(-12.00001)
        expect(bounds.max.z).toBeLessThanOrEqual(16.00001)
        expect(bounds.min.z).toBeGreaterThanOrEqual(-16.00001)
      } finally { geometry.dispose() }
    }
  })
})
