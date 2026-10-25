import { describe, expect, it } from 'vitest'
import { pondGeometry } from './pond-geometry'

describe('natural pond contours', () => {
  it('varies contours by ID and reproduces them deterministically', () => {
    const a = pondGeometry('still-pond'), b = pondGeometry('still-pond'), c = pondGeometry('other-pond')
    try {
      expect(a.bank.getAttribute('position').array).toEqual(b.bank.getAttribute('position').array)
      expect(a.bank.getAttribute('position').array).not.toEqual(c.bank.getAttribute('position').array)
    } finally { for (const g of [a, b, c]) { g.bank.dispose(); g.water.dispose() } }
  })
  it.each(['still-pond', 'courtyard-pond', 'object-1', 'object-99'])('keeps %s water level, shores connected and geometry within the collision envelope', id => {
    const { bank, water } = pondGeometry(id)
    try {
      for (const geometry of [bank, water]) {
        for (const attribute of ['position', 'normal']) expect([...geometry.getAttribute(attribute).array].every(Number.isFinite)).toBe(true)
        const vertices = geometry.getAttribute('position')
        for (let i = 0; i < vertices.count; i++) expect(Math.hypot(vertices.getX(i), vertices.getZ(i))).toBeLessThanOrEqual(1.150001)
        expect(geometry.getIndex()!.count / 3).toBeLessThanOrEqual(512)
      }
      const b = bank.getAttribute('position'), w = water.getAttribute('position')
      for (let sector = 0; sector < 64; sector++) {
        const radius = Math.hypot(w.getX(sector + 1), w.getZ(sector + 1))
        expect(radius).toBeGreaterThanOrEqual(0.919999) // lily-pad envelope ends at 0.9
        expect(radius).toBeLessThanOrEqual(1.000001)
        expect(w.getY(sector + 1)).toBeCloseTo(0.1275)
        expect(b.getX(sector)).toBeCloseTo(w.getX(sector + 1) * 0.98)
        expect(b.getZ(sector)).toBeCloseTo(w.getZ(sector + 1) * 0.98)
        expect(Math.hypot(b.getX(4 * 64 + sector), b.getZ(4 * 64 + sector))).toBeCloseTo(1.15)
      }
      expect(water.getAttribute('normal').getY(0)).toBeGreaterThan(0.99)
    } finally { bank.dispose(); water.dispose() }
  })
})
