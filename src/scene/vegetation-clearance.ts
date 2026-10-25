import type { WorldObject } from '../world/schema'
import type { TerrainGround } from '../world/terrain'
import { isLevelPath } from '../world/paths'
import { plantGeometry } from './Plants'

type Plant = Extract<WorldObject, { type: 'plant' }>
type Path = Extract<WorldObject, { type: 'path' }>
type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number }
const footprintCache = new Map<Plant['variety'], Bounds>()

/** Use the union of both quality levels so the verge never pops during fallback. */
export function plantFootprint(plant: Plant): Bounds {
  let bounds = footprintCache.get(plant.variety)
  if (!bounds) {
    bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }
    for (const lowDetail of [false, true]) for (const variant of [0, 1, 2]) {
      const geometry = plantGeometry(plant, lowDetail, variant)
      geometry.computeBoundingBox()
      const box = geometry.boundingBox!
      bounds.minX = Math.min(bounds.minX, box.min.x); bounds.maxX = Math.max(bounds.maxX, box.max.x)
      bounds.minZ = Math.min(bounds.minZ, box.min.z); bounds.maxZ = Math.max(bounds.maxZ, box.max.z)
      geometry.dispose()
    }
    footprintCache.set(plant.variety, bounds)
  }
  return bounds
}

/** Separating-axis test between transformed cluster bounds and a paved slab. */
export function plantOverlapsPath(plant: Plant, path: Path, clearance = 0.12): boolean {
  const bounds = plantFootprint(plant)
  const pc = Math.cos(plant.rotation), ps = Math.sin(plant.rotation)
  const localX = (bounds.minX + bounds.maxX) / 2 * plant.scale[0]
  const localZ = (bounds.minZ + bounds.maxZ) / 2 * plant.scale[2]
  const dx = plant.position[0] + pc * localX + ps * localZ - path.position[0]
  const dz = plant.position[2] - ps * localX + pc * localZ - path.position[2]
  const c = Math.cos(path.rotation), s = Math.sin(path.rotation)
  const plantAxes = [[pc, -ps], [ps, pc]], pathAxes = [[c, -s], [s, c]]
  const plantHalf = [(bounds.maxX - bounds.minX) / 2 * plant.scale[0], (bounds.maxZ - bounds.minZ) / 2 * plant.scale[2]]
  const pathHalf = [path.size[0] * path.scale[0] / 2 + clearance, path.size[1] * path.scale[2] / 2 + clearance]
  for (const axis of [...plantAxes, ...pathAxes]) {
    const projected = Math.abs(dx * axis[0] + dz * axis[1])
    const radius = (axes: number[][], half: number[]) => axes.reduce((sum, a, i) => sum + Math.abs(a[0] * axis[0] + a[1] * axis[1]) * half[i], 0)
    if (projected > radius(plantAxes, plantHalf) + radius(pathAxes, pathHalf)) return false
  }
  return true
}

export function pavementClearPlants(objects: WorldObject[], ground: TerrainGround): Plant[] {
  const paths = objects.filter((object): object is Path => object.type === 'path' && isLevelPath(ground, object))
  return objects.filter((object): object is Plant => object.type === 'plant' && !paths.some(path => plantOverlapsPath(object, path)))
}
