import { DataTexture, LinearFilter, LinearMipmapLinearFilter, RGBAFormat } from 'three'
import type { WorldObject } from '../world/schema'

const RESOLUTION = 256
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
const smooth = (t: number) => t * t * (3 - 2 * t)
const lattice = (x: number, z: number) => {
  const seed = Math.imul(x, 374761393) ^ Math.imul(z, 668265263)
  const mixed = Math.imul(seed ^ (seed >>> 13), 1274126177)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 4294967295
}

function noise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z), u = smooth(x - ix), v = smooth(z - iz)
  const a = lattice(ix, iz), b = lattice(ix + 1, iz), c = lattice(ix, iz + 1), d = lattice(ix + 1, iz + 1)
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
}

/** One baked, palette-neutral map per world: no per-frame object/noise sampling. */
export function groundCoverTexture(size: [number, number], objects: WorldObject[]) {
  const shades = new Float32Array(RESOLUTION * RESOLUTION)
  for (let row = 0; row < RESOLUTION; row++) for (let column = 0; column < RESOLUTION; column++) {
    const x = ((column + 0.5) / RESOLUTION - 0.5) * size[0]
    const z = ((row + 0.5) / RESOLUTION - 0.5) * size[1]
    // Broad, soft cover and smaller mottling stay measured in world meters.
    shades[row * RESOLUTION + column] = 0.78 + noise(x / 7 + 41, z / 7 + 23) * 0.14
      + noise(x / 1.6 - 17, z / 1.6 + 59) * 0.06
      + noise(x / 0.35 + 83, z / 0.35 - 31) * 0.02
  }
  for (const object of objects) {
    let rx: number, rz: number, strength: number
    switch (object.type) {
      case 'tree': rx = rz = 1.8; strength = 0.18; break
      case 'rock': rx = 0.95; rz = 0.85; strength = 0.16; break
      case 'plant': rx = rz = 0.65; strength = 0.055; break
      case 'pond': rx = object.radii[0] * 1.42; rz = object.radii[1] * 1.42; strength = 0.24; break
      case 'structure':
        if (object.variety === 'fallen-log') { rx = 1.8; rz = 0.7; strength = 0.12; break }
        if (object.variety === 'stump') { rx = rz = 0.75; strength = 0.12; break }
        continue
      default: continue
    }
    rx *= object.scale[0]; rz *= object.scale[2]
    const cos = Math.cos(object.rotation), sin = Math.sin(object.rotation)
    const reach = Math.max(rx, rz), [cx, , cz] = object.position
    const pixelX = (x: number) => (x / size[0] + 0.5) * RESOLUTION - 0.5
    const pixelZ = (z: number) => (z / size[1] + 0.5) * RESOLUTION - 0.5
    const minX = clamp(Math.floor(pixelX(cx - reach)), 0, RESOLUTION - 1), maxX = clamp(Math.ceil(pixelX(cx + reach)), 0, RESOLUTION - 1)
    const minZ = clamp(Math.floor(pixelZ(cz - reach)), 0, RESOLUTION - 1), maxZ = clamp(Math.ceil(pixelZ(cz + reach)), 0, RESOLUTION - 1)
    for (let row = minZ; row <= maxZ; row++) for (let column = minX; column <= maxX; column++) {
      const dx = ((column + 0.5) / RESOLUTION - 0.5) * size[0] - cx
      const dz = ((row + 0.5) / RESOLUTION - 0.5) * size[1] - cz
      const r2 = ((cos * dx - sin * dz) / rx) ** 2 + ((sin * dx + cos * dz) / rz) ** 2
      if (r2 >= 1) continue
      const weight = object.type === 'pond' ? 1 - r2 : (1 - r2) ** 2
      // Take the strongest contact mark rather than blackening dense groves.
      const index = row * RESOLUTION + column
      shades[index] = Math.min(shades[index], 0.94 - strength * weight)
    }
  }
  const pixels = new Uint8Array(RESOLUTION * RESOLUTION * 4)
  shades.forEach((shade, index) => {
    const value = Math.round(clamp(shade, 0.72, 1) * 255)
    pixels[index * 4] = pixels[index * 4 + 1] = pixels[index * 4 + 2] = value
    pixels[index * 4 + 3] = 255
  })
  const texture = new DataTexture(pixels, RESOLUTION, RESOLUTION, RGBAFormat)
  texture.magFilter = LinearFilter; texture.minFilter = LinearMipmapLinearFilter
  texture.generateMipmaps = true; texture.needsUpdate = true
  return texture
}
