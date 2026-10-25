import { describe, expect, it } from 'vitest'
import type { WorldDefinition, WorldObject } from '../world/schema'
import { pavementClearPlants, plantOverlapsPath } from './vegetation-clearance'
import { plantGeometry } from './Plants'
import { isLevelPath } from '../world/paths'

const transform = { id: 'fixture', position: [0, 0, 0] as [number, number, number], scale: [1, 1, 1] as [number, number, number], rotation: 0 }
const plant: Extract<WorldObject, { type: 'plant' }> = { ...transform, type: 'plant', variety: 'grass', color: '#527d42', accentColor: '#798e4c' }
const path: Extract<WorldObject, { type: 'path' }> = { ...transform, id: 'path', type: 'path', size: [2, 8], color: '#aaaaaa' }
const ground = { size: [128, 128] as [number, number] }

describe('pavement clearance', () => {
  it('excludes clusters whose blades reach the paving even with an off-path anchor', () => {
    expect(plantOverlapsPath({ ...plant, position: [1.1, 0, 0] }, path)).toBe(true)
    expect(plantOverlapsPath({ ...plant, position: [3, 0, 0] }, path)).toBe(false)
  })
  it('respects slab rotation, nonuniform scale and translated plant footprints', () => {
    const rotated = { ...path, position: [10, 0, 5] as [number, number, number], rotation: Math.PI / 2, scale: [1, 1, 2] as [number, number, number] }
    expect(plantOverlapsPath({ ...plant, position: [16, 0, 5], rotation: 0.7, scale: [2, 1, 0.5] }, rotated)).toBe(true)
    expect(plantOverlapsPath({ ...plant, position: [10, 0, 9] }, rotated)).toBe(false)
  })
  it('does not clear vegetation around rejected uphill pavement and does not mutate source data', () => {
    const objects = [plant, path], before = JSON.stringify(objects)
    expect(pavementClearPlants(objects, ground)).toHaveLength(0)
    expect(pavementClearPlants(objects, { ...ground, hills: [{ center: [0, 0], radius: 8, height: 2 }] })).toEqual([plant])
    expect(JSON.stringify(objects)).toBe(before)
  })
  const worlds = import.meta.glob<WorldDefinition>('../world/*.json', { eager: true, import: 'default' })
  it.each(Object.entries(worlds))('keeps rendered vegetation vertices off pavement in %s', (_, world) => {
    const retained = pavementClearPlants(world.objects, world.ground)
    const paths = world.objects.filter((o): o is typeof path => o.type === 'path' && isLevelPath(world.ground, o))
    // Tree canopies may overhang routes, but roots/trunks must stay off paving.
    for (const tree of world.objects.filter(o => o.type === 'tree')) for (const slab of paths) {
      const dx = tree.position[0] - slab.position[0], dz = tree.position[2] - slab.position[2]
      const lx = dx * Math.cos(slab.rotation) - dz * Math.sin(slab.rotation)
      const lz = dx * Math.sin(slab.rotation) + dz * Math.cos(slab.rotation)
      const distance = Math.hypot(Math.max(0, Math.abs(lx) - slab.size[0] * slab.scale[0] / 2), Math.max(0, Math.abs(lz) - slab.size[1] * slab.scale[2] / 2))
      expect(distance, `${world.id}/${tree.id} roots on ${slab.id}`).toBeGreaterThan(0.4 * Math.max(tree.scale[0], tree.scale[2]))
    }
    const sourceCount = world.objects.filter(o => o.type === 'plant').length
    console.log(`${world.id}: retained ${retained.length}/${sourceCount} plant clusters`)
    // Verify actual transformed vertices independently of the footprint/SAT code.
    for (const lowDetail of [false, true]) for (const p of retained) {
      const g = plantGeometry(p, lowDetail), vertices = g.getAttribute('position')
      for (let i = 0; i < vertices.count; i++) {
        const x = vertices.getX(i) * p.scale[0], z = vertices.getZ(i) * p.scale[2]
        const wx = p.position[0] + x * Math.cos(p.rotation) + z * Math.sin(p.rotation)
        const wz = p.position[2] - x * Math.sin(p.rotation) + z * Math.cos(p.rotation)
        for (const slab of paths) {
          const dx = wx - slab.position[0], dz = wz - slab.position[2]
          const lx = dx * Math.cos(slab.rotation) - dz * Math.sin(slab.rotation)
          const lz = dx * Math.sin(slab.rotation) + dz * Math.cos(slab.rotation)
          const inside = Math.abs(lx) <= slab.size[0] * slab.scale[0] / 2 && Math.abs(lz) <= slab.size[1] * slab.scale[2] / 2
          if (inside) throw new Error(`${world.id}/${p.id} intersects ${slab.id}`)
        }
      }
      g.dispose()
    }
    if (sourceCount) expect(retained.length).toBeGreaterThan(0)
  })
})
