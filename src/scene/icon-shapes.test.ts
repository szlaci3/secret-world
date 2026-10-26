import { describe, expect, it } from 'vitest'
import { ExtrudeGeometry, Vector2 } from 'three'
import { closedStroke } from './icon-shapes'

describe('SVG stroke expansion', () => {
  it('creates a closed round-capped silhouette with true extruded sidewalls', () => {
    const shape = closedStroke([new Vector2(0, 0), new Vector2(0, 0), new Vector2(0, 4)], 2)
    const geometry = new ExtrudeGeometry(shape, { depth: 0.64, bevelEnabled: false })
    try {
      geometry.computeBoundingBox()
      expect(geometry.boundingBox!.min.toArray()).toEqual([-1, -1, 0])
      expect(geometry.boundingBox!.max.x).toBe(1)
      expect(geometry.boundingBox!.max.y).toBe(5)
      expect(geometry.boundingBox!.max.z).toBeCloseTo(0.64)
    } finally { geometry.dispose() }
  })
  it('refuses degenerate paths', () => {
    expect(() => closedStroke([new Vector2()], 2)).toThrow()
    expect(() => closedStroke([new Vector2(), new Vector2(1, 0)], 0)).toThrow()
  })
})
