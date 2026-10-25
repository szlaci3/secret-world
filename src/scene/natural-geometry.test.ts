import { describe, expect, it } from 'vitest'
import { treeGeometry } from './Trees'
import { plantGeometry } from './Plants'
import { rockGeometry } from './Rocks'
import type { WorldObject } from '../world/schema'

const transform = { id: 'fixture', position: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], rotation: 0 }
describe('natural asset geometry budgets and variation', () => {
  it('builds deterministic but distinct tree variants within a bounded mesh budget', () => {
    const tree: Extract<WorldObject, { type: 'tree' }> = { ...transform, type: 'tree', variety: 'maple', trunkColor: '#785638', foliageColor: '#548637' }
    const a = treeGeometry(tree, false, 0), b = treeGeometry(tree, false, 0), c = treeGeometry(tree, false, 1), reduced = treeGeometry(tree, true, 0)
    try {
      expect(a.getAttribute('position').array).toEqual(b.getAttribute('position').array)
      expect(a.getAttribute('position').array).not.toEqual(c.getAttribute('position').array)
      expect(a.getIndex()!.count / 3).toBeLessThan(18000)
      expect(reduced.getIndex()!.count / 3).toBeLessThan(800)
    } finally { a.dispose(); b.dispose(); c.dispose(); reduced.dispose() }
  })
  it.each(['grass', 'flowers', 'fern', 'bamboo', 'cactus', 'mushrooms', 'reeds'] as const)('keeps %s finite and renderable in both modes', variety => {
    for (const low of [false, true]) {
      const g = plantGeometry({ ...transform, type: 'plant', variety, color: '#537c34', accentColor: '#ccb147' }, low)
      try {
        for (const name of ['position', 'normal', 'color']) {
          expect([...g.getAttribute(name).array].every(Number.isFinite)).toBe(true)
          expect(g.getAttribute(name).count).toBe(g.getAttribute('position').count)
        }
        expect(g.getAttribute('position').count).toBeGreaterThan(0)
      } finally { g.dispose() }
    }
  })
  it('keeps weathered rock shapes grounded and inside their original envelope', () => {
    for (let variant = 0; variant < 3; variant++) {
      const g = rockGeometry({ ...transform, type: 'rock', color: '#827e72', mossColor: '#526e38' }, variant)
      try {
        g.computeBoundingBox()
        expect(g.boundingBox!.min.y).toBeCloseTo(-0.12)
        expect(g.boundingBox!.max.y).toBeLessThan(0.95)
        expect(g.boundingBox!.max.x).toBeLessThan(0.85)
        expect([...g.getAttribute('normal').array].every(Number.isFinite)).toBe(true)
      } finally { g.dispose() }
    }
  })
})
