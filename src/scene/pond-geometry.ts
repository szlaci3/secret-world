import { BufferGeometry, Float32BufferAttribute } from 'three'
import { randomSource, seedFor } from './natural-geometry'

/** A shared bank/water contour, always INSIDE the original elliptical envelope. */
export function pondGeometry(id: string) {
  const random = randomSource(seedFor(id)), phases = [random(), random(), random()].map(value => value * Math.PI * 2)
  const shore = (angle: number) => {
    const waves = Math.sin(angle * 3 + phases[0]) * 0.5 + Math.sin(angle * 5 + phases[1]) * 0.3 + Math.sin(angle * 7 + phases[2]) * 0.2
    return 0.96 + 0.04 * Math.tanh(waves * 2) / Math.tanh(2)
  }
  const segments = 64, stride = segments
  const profile = [[0.98, 0.055], [1.01, 0.13], [1.07, 0.12], [1.13, 0.06], [1.15, -0.006]]
  const positions: number[] = [], indices: number[] = []
  profile.forEach(([radius, height], ring) => {
    for (let sector = 0; sector < segments; sector++) {
      const angle = sector * Math.PI * 2 / segments, contour = shore(angle)
      // Keep the outer ground contact on the authored collision boundary. Only
      // the waterline and inner bank wander, so there is no invisible stop line.
      const t = (radius - 0.98) / (1.15 - 0.98), blend = t * t * (3 - 2 * t)
      const r = radius * (contour + (1 - contour) * blend)
      const y = height + (ring === 0 || ring === profile.length - 1 ? 0 : Math.sin(angle * 4 + phases[0]) * 0.008)
      positions.push(Math.cos(angle) * r, y, Math.sin(angle) * r)
      if (ring < profile.length - 1) {
        const a = ring * stride + sector, b = a + stride
        const next = ring * stride + (sector + 1) % segments
        indices.push(a, next, b, b, next, next + stride)
      }
    }
  })
  const bank = new BufferGeometry()
  bank.setAttribute('position', new Float32BufferAttribute(positions, 3)); bank.setIndex(indices)
  bank.computeVertexNormals(); bank.computeBoundingSphere()

  // Match the previous cylinder's visible top (0.115 center + 0.0125 half-height).
  // A hidden deeper skirt overlaps the varied inner bank without an air gap.
  const waterVertices = [0, 0.1275, 0], waterIndices: number[] = []
  for (const y of [0.1275, 0.085]) for (let sector = 0; sector < segments; sector++) {
    const angle = sector * Math.PI * 2 / segments, r = shore(angle)
    waterVertices.push(Math.cos(angle) * r, y, Math.sin(angle) * r)
  }
  for (let sector = 0; sector < segments; sector++) {
    const a = 1 + sector, b = a + stride
    const next = 1 + (sector + 1) % segments
    waterIndices.push(0, next, a, a, next, b, b, next, next + stride)
  }
  const water = new BufferGeometry()
  water.setAttribute('position', new Float32BufferAttribute(waterVertices, 3)); water.setIndex(waterIndices)
  water.computeVertexNormals(); water.computeBoundingSphere()
  return { bank, water }
}
