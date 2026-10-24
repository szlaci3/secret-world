import { describe, expect, it } from 'vitest'
import { hillHeight, terrainHeight, terrainSegments } from './terrain'
import { parseWorld } from './schema'
import garden from './garden.json'

describe('bounded terrain and atmosphere', () => {
  it('supports distant hills on bounded 128-meter terrain', () => {
    const large = { size: [128, 128] as [number, number], hills: [{ center: [42, -38] as [number, number], radius: 24, height: 6 }] }
    expect(terrainSegments(large)).toEqual([32, 32])
    // The center lies between grid vertices: walking must use the actual mesh.
    expect(terrainHeight(large, 42, -38)).toBeLessThan(6)
    expect(terrainHeight(large, 42, -38)).toBeGreaterThan(5.7)
    expect(terrainHeight(large, -63, 63)).toBe(0)
    expect(() => parseWorld({ ...garden, ground: { ...large, color: '#889977' }, objects: [] })).not.toThrow()
    expect(() => parseWorld({ ...garden, ground: { ...large, size: [129, 128], color: '#889977' }, objects: [] })).toThrow()
  })
  const ground = { size: [20, 18] as [number, number], hills: [{ center: [0, 0] as [number, number], radius: 5, height: 1.5 }] }
  it('preserves flat legacy worlds and compact hill boundaries', () => {
    expect(terrainHeight({ size: [18, 18] }, 2, 3)).toBe(0)
    expect(terrainHeight(ground, 0, 0)).toBe(1.5)
    expect(terrainHeight(ground, 6, 0)).toBe(0)
    expect(terrainSegments(ground)).toEqual([20, 18])
  })
  it('matches both triangles of the rendered mesh rather than an approximate height curve', () => {
    const a = hillHeight(ground, 1, 1), b = hillHeight(ground, 2, 1)
    const c = hillHeight(ground, 1, 2), d = hillHeight(ground, 2, 2)
    expect(terrainHeight(ground, 1.8, 1.2)).toBeCloseTo(a * 0.2 + b * 0.6 + d * 0.2, 10)
    expect(terrainHeight(ground, 1.2, 1.8)).toBeCloseTo(a * 0.2 + c * 0.6 + d * 0.2, 10)
  })
  it('rejects steep hills, excessive terrain data, and reversed fog ranges', () => {
    expect(() => parseWorld({ ...garden, ground: { ...garden.ground, hills: [{ center: [0, 0], radius: 2, height: 3 }] } })).toThrow()
    expect(() => parseWorld({ ...garden, ground: { ...garden.ground, hills: Array(9).fill(ground.hills[0]) } })).toThrow()
    expect(() => parseWorld({ ...garden, environment: { ...garden.environment, fog: { color: '#aabbcc', near: 30, far: 20 } } })).toThrow()
  })
})
