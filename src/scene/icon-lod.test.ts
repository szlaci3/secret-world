import { describe, expect, it } from 'vitest'
import { emptyQualitySample, iconLod, sampleIconQuality } from './icon-lod'

describe('icon distance detail', () => {
  it('restores full detail when approaching and simplifies in two stages when leaving', () => {
    let level = iconLod(60)
    expect(level).toBe(2)
    level = iconLod(28, level)
    expect(level).toBe(1)
    level = iconLod(8, level)
    expect(level).toBe(0)
    level = iconLod(24, level)
    expect(level).toBe(1)
    expect(iconLod(60, level)).toBe(2)
  })
  it('holds its level around both boundaries instead of flickering', () => {
    for (const distance of [13.9, 14.1, 15.3]) expect(iconLod(distance, 0)).toBe(0)
    for (const distance of [12.7, 14, 15]) expect(iconLod(distance, 1)).toBe(1)
    for (const distance of [35, 36, 38]) expect(iconLod(distance, 2)).toBe(2)
    expect(iconLod(12, 2)).toBe(0)
  })
})

describe('recoverable icon rendering budget', () => {
  it('reduces slow moving scenes, then restores quality after sustained recovery', () => {
    const sample = emptyQualitySample()
    let reduced = false
    for (let i = 0; i < 50; i++) reduced = sampleIconQuality(sample, 1 / 20, reduced)
    expect(reduced).toBe(true)
    for (let i = 0; i < 120; i++) reduced = sampleIconQuality(sample, 1 / 60, reduced)
    expect(reduced).toBe(true) // No immediate quality oscillation.
    for (let i = 0; i < 900; i++) reduced = sampleIconQuality(sample, 1 / 60, reduced)
    expect(reduced).toBe(false)
  })
  it('does not treat a suspended tab or a short spike as sustained poor performance', () => {
    const sample = emptyQualitySample()
    expect(sampleIconQuality(sample, 8, false)).toBe(false)
    expect(sampleIconQuality(sample, 0.3, false)).toBe(false)
    let reduced = false
    for (let i = 0; i < 150; i++) reduced = sampleIconQuality(sample, 1 / 60, reduced)
    expect(reduced).toBe(false)
  })
})
