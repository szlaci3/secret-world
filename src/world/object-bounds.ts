import type { WorldObject } from './schema'
import { ICON_FOOTPRINT } from './icon-types'

// Conservative local X/Z envelopes of the reusable geometry, including roofs,
// sails, leaves and both detail levels, rather than collision-only footprints.
// Geometry tests keep these envelopes in sync without loading meshes server-side.
function localHalfSize(object: WorldObject): [number, number] {
  switch (object.type) {
    case 'icon': return [ICON_FOOTPRINT[0] / 2, ICON_FOOTPRINT[1] / 2]
    case 'path': return [object.size[0] / 2, object.size[1] / 2]
    case 'pond': return [object.radii[0] * 1.15, object.radii[1] * 1.15]
    case 'patch': return object.radii
    case 'tree': return [3.5, 3.5]
    case 'plant': return [1.2, 1.2]
    case 'rock': return [0.84, 0.76]
    case 'lantern': return [0.5, 0.5]
    case 'entrance': return [2.35, 0.3]
    case 'structure':
      switch (object.variety) {
        case 'fallen-log': return [1.55, 0.45]
        case 'stump': return [0.42, 0.42]
        case 'arch': return [1.9, 0.55]
        case 'bench': return [0.9, 0.31]
        case 'cabin': return [1.85, 1.4]
        case 'column': return [0.6, 0.6]
        case 'pavilion': return [1.75, 1.75]
        case 'beacon': return [1.2, 1.2]
        case 'windmill': return [3.1, 1.25]
      }
  }
}

export function objectFitsGround(object: WorldObject, size: [number, number]): boolean {
  const [halfX, halfZ] = localHalfSize(object)
  const x = halfX * object.scale[0], z = halfZ * object.scale[2]
  const cos = Math.cos(object.rotation), sin = Math.sin(object.rotation)
  const elliptical = object.type === 'pond' || object.type === 'patch'
  const extentX = elliptical ? Math.hypot(cos * x, sin * z) : Math.abs(cos) * x + Math.abs(sin) * z
  const extentZ = elliptical ? Math.hypot(sin * x, cos * z) : Math.abs(sin) * x + Math.abs(cos) * z
  return Math.abs(object.position[0]) + extentX <= size[0] / 2 + 1e-8
    && Math.abs(object.position[2]) + extentZ <= size[1] / 2 + 1e-8
}
