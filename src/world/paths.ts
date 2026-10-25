import type { WorldObject } from './schema'
import { terrainHeight } from './terrain'
import type { TerrainGround } from './terrain'

/** Pavement belongs on level ground. Check the whole rotated footprint, not
 * just its anchor: a long slab can begin on the flat and end on a hillside. */
export function isLevelPath(ground: TerrainGround, path: Extract<WorldObject, { type: 'path' }>): boolean {
  if (!ground.hills?.some(hill => hill.height > 0)) return true
  const width = path.size[0] * path.scale[0], depth = path.size[1] * path.scale[2]
  const nx = Math.min(64, Math.max(2, Math.ceil(width))), nz = Math.min(64, Math.max(2, Math.ceil(depth)))
  const cos = Math.cos(path.rotation), sin = Math.sin(path.rotation)
  let lowest = Infinity, highest = -Infinity
  for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
    const x = (ix / nx - 0.5) * width, z = (iz / nz - 0.5) * depth
    const height = terrainHeight(ground, path.position[0] + cos * x + sin * z, path.position[2] - sin * x + cos * z)
    lowest = Math.min(lowest, height); highest = Math.max(highest, height)
    if (highest - lowest > 0.02) return false
  }
  return true
}
