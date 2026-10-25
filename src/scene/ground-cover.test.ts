import { describe, expect, it } from 'vitest'
import { groundCoverTexture } from './ground-cover'
import type { WorldObject } from '../world/schema'

const tree: WorldObject = { id: 'tree', type: 'tree', variety: 'maple', position: [0, 0, 0], rotation: 0,
  scale: [1, 1, 1], foliageColor: '#557755', trunkColor: '#665544' }
const pixel = (data: Uint8Array, x: number, z: number) => data[(Math.floor((z / 24 + 0.5) * 256) * 256 + Math.floor((x / 24 + 0.5) * 256)) * 4]

describe('baked natural ground cover', () => {
  it('is deterministic, palette-neutral, opaque and bounded', () => {
    const a = groundCoverTexture([24, 24], []), b = groundCoverTexture([24, 24], [])
    try {
      const data = a.image.data as Uint8Array
      expect(data).toEqual(b.image.data)
      const shades = new Set<number>()
      for (let i = 0; i < data.length; i += 4) {
        shades.add(data[i]); expect(data[i]).toBeGreaterThanOrEqual(184)
        expect(data[i]).toBe(data[i + 1]); expect(data[i]).toBe(data[i + 2]); expect(data[i + 3]).toBe(255)
      }
      expect(shades.size).toBeGreaterThan(12)
    } finally { a.dispose(); b.dispose() }
  })
  it('grounds tree contact without darkening distant ground or accumulating black marks', () => {
    const bare = groundCoverTexture([24, 24], []), one = groundCoverTexture([24, 24], [tree])
    const dense = groundCoverTexture([24, 24], Array(100).fill(tree))
    try {
      expect(pixel(one.image.data as Uint8Array, 0, 0)).toBeLessThan(pixel(bare.image.data as Uint8Array, 0, 0))
      expect(pixel(one.image.data as Uint8Array, 10, 10)).toBe(pixel(bare.image.data as Uint8Array, 10, 10))
      expect(one.image.data).toEqual(dense.image.data)
    } finally { bare.dispose(); one.dispose(); dense.dispose() }
  })
  it('follows pond rotation and nonuniform shoreline dimensions', () => {
    const pond: WorldObject = { id: 'pond', type: 'pond', position: [0, 0, 0], rotation: Math.PI / 2,
      scale: [1, 1, 1], radii: [4, 1], waterColor: '#448899', bankColor: '#998877' }
    const bare = groundCoverTexture([24, 24], []), wet = groundCoverTexture([24, 24], [pond])
    try {
      expect(pixel(wet.image.data as Uint8Array, 0, 4)).toBeLessThan(pixel(bare.image.data as Uint8Array, 0, 4))
      expect(pixel(wet.image.data as Uint8Array, 4, 0)).toBe(pixel(bare.image.data as Uint8Array, 4, 0))
    } finally { bare.dispose(); wet.dispose() }
  })
})
