import { describe, expect, it } from 'vitest'
import { movementStep } from './movement'

describe('walking motion', () => {
  it('walks forward and sideways in the camera heading on the ground plane', () => {
    expect(movementStep(new Set(['KeyW']), 0, 2, 0.02)).toEqual({ x: 0, z: -0.04 })
    const leftFacing = movementStep(new Set(['KeyW']), Math.PI / 2, 2, 0.02)
    expect(leftFacing.x).toBeCloseTo(-0.04)
    expect(leftFacing.z).toBeCloseTo(0)
    const sideways = movementStep(new Set(['KeyD']), 0, 2, 0.02)
    expect(sideways.x).toBeCloseTo(0.04)
    expect(sideways.z).toBeCloseTo(0)
  })

  it('keeps diagonal walking at the same speed', () => {
    const step = movementStep(new Set(['KeyW', 'KeyD']), 0.7, 2.4, 0.02)
    expect(Math.hypot(step.x, step.z)).toBeCloseTo(2.4 * 0.02)
  })

  it('does not double speed when both bindings are held', () => {
    expect(movementStep(new Set(['KeyW', 'ArrowUp']), 0, 2, 0.02))
      .toEqual(movementStep(new Set(['KeyW']), 0, 2, 0.02))
  })

  it('cancels opposite keys and remains still without input', () => {
    for (const keys of [new Set(['KeyW', 'KeyS', 'KeyA', 'KeyD']), new Set<string>()]) {
      const step = movementStep(keys, 0, 2, 0.02)
      expect(step.x).toBeCloseTo(0)
      expect(step.z).toBeCloseTo(0)
    }
  })

  it('covers equal distances at different normal frame rates', () => {
    const at60 = movementStep(new Set(['KeyW']), 0, 2.4, 1 / 60)
    const at30 = movementStep(new Set(['KeyW']), 0, 2.4, 1 / 30)
    expect(at60.z * 60).toBeCloseTo(at30.z * 30)
  })

  it('caps movement after a long stalled frame', () => {
    expect(movementStep(new Set(['KeyW']), 0, 2.4, 10).z).toBeCloseTo(-0.12)
  })
})
