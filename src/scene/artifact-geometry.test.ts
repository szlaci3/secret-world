import { describe, expect, it } from 'vitest'
import { artifactGeometry } from './artifact-geometry'
import type { Artifact } from './artifact-geometry'
const transform = { id: 'fixture', position: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], rotation: 0 }
const artifacts: Artifact[] = [
  ...(['arch', 'pavilion', 'cabin', 'beacon', 'windmill', 'column', 'bench', 'fallen-log', 'stump'] as const).map(variety => ({ ...transform, type: 'structure' as const, variety, color: '#786447', accentColor: '#6b7665' })),
  { ...transform, type: 'entrance', woodColor: '#786447', roofColor: '#6b7665' },
  { ...transform, type: 'lantern', stoneColor: '#786447', glowColor: '#ffeeaa' },
]
describe('detailed artifact meshes', () => {
  it.each(artifacts)('builds a bounded indexed mesh for $type $variety', object => {
    const geometry = artifactGeometry(object)
    try {
      for (const name of ['position', 'normal', 'color']) expect([...geometry.getAttribute(name).array].every(Number.isFinite)).toBe(true)
      expect(geometry.getIndex()!.count / 3).toBeLessThan(20000)
      expect(geometry.getAttribute('color').count).toBe(geometry.getAttribute('position').count)
      geometry.computeBoundingBox()
      expect(geometry.boundingBox!.min.y).toBeGreaterThanOrEqual(-0.01)
      expect(geometry.boundingBox!.max.y).toBeGreaterThan(0.5)
    } finally { geometry.dispose() }
  })
  it('leaves the arch walking opening clear below the lintel', () => {
    const geometry = artifactGeometry(artifacts[0]), vertices = geometry.getAttribute('position')
    try {
      for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) < 2.9) expect(Math.abs(vertices.getX(i))).toBeGreaterThanOrEqual(1.07)
    } finally { geometry.dispose() }
  })
})
