import { describe, expect, it } from 'vitest'
import { isLevelPath } from './paths'
import type { WorldObject } from './schema'

const path: Extract<WorldObject, { type: 'path' }> = { id: 'path', type: 'path', position: [0, 0, 0], rotation: 0,
  scale: [1, 1, 1], size: [2, 8], color: '#aaaaaa' }
const ground = { size: [128, 128] as [number, number], hills: [{ center: [10, 0] as [number, number], radius: 8, height: 2 }] }

describe('level pavement', () => {
  it('keeps genuinely flat paths and rejects uphill slabs', () => {
    expect(isLevelPath({ size: [128, 128] }, path)).toBe(true)
    expect(isLevelPath(ground, { ...path, position: [-20, 0, 0] })).toBe(true)
    expect(isLevelPath(ground, { ...path, position: [7, 0, 0] })).toBe(false)
  })
  it('checks rotated and scaled footprints even when the anchor is flat', () => {
    expect(isLevelPath(ground, { ...path, rotation: Math.PI / 2, scale: [1, 1, 3] })).toBe(false)
    // Checking only the center slope would also miss the crown of a hill.
    expect(isLevelPath(ground, { ...path, position: [10, 0, 0], size: [8, 8] })).toBe(false)
  })
})
