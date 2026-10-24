import { describe, expect, it } from 'vitest'
import { treeGeometry } from './Trees'
import type { WorldObject } from '../world/schema'

describe('instanced tree geometry', () => {
  it.each(['pine', 'maple', 'spruce', 'palm'] as const)('keeps %s renderable at both detail levels', variety => {
    const tree: Extract<WorldObject, { type: 'tree' }> = { id: 'tree', type: 'tree', variety,
      position: [0, 0, 0], rotation: 0, scale: [1, 1, 1], foliageColor: '#567856', trunkColor: '#786044' }
    const full = treeGeometry(tree), reduced = treeGeometry(tree, true)
    try {
      for (const geometry of [full, reduced]) {
        expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
        expect([...geometry.getAttribute('position').array].every(Number.isFinite)).toBe(true)
        expect([...geometry.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
        expect(geometry.boundingSphere!.radius).toBeGreaterThan(1)
        geometry.computeBoundingBox()
        expect(geometry.boundingBox!.min.y).toBeLessThan(0.1)
        expect(geometry.boundingBox!.max.y).toBeGreaterThan(3)
      }
      if (['maple', 'pine'].includes(variety)) expect(reduced.getAttribute('position').count).toBeLessThan(full.getAttribute('position').count)
    } finally { full.dispose(); reduced.dispose() }
  })
})
