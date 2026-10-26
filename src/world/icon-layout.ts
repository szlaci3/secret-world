import type { WorldObject } from './schema'
import { ICON_FOOTPRINT } from './icon-types'

type Footprint = Pick<WorldObject, 'position' | 'rotation' | 'scale'>
export function iconFootprintsSeparated(first: Footprint, second: Footprint): boolean {
  const rectangle = (object: Footprint) => ({ object,
    axes: [[Math.cos(object.rotation), -Math.sin(object.rotation)], [Math.sin(object.rotation), Math.cos(object.rotation)]],
    half: [ICON_FOOTPRINT[0] * object.scale[0] / 2, ICON_FOOTPRINT[1] * object.scale[2] / 2] })
  const a = rectangle(first), b = rectangle(second)
  const dx = b.object.position[0] - a.object.position[0], dz = b.object.position[2] - a.object.position[2]
  return [...a.axes, ...b.axes].some(([x, z]) => {
    const radius = (rect: typeof a) => rect.axes.reduce((sum, axis, k) => sum + rect.half[k] * Math.abs(axis[0] * x + axis[1] * z), 0)
    return Math.abs(dx * x + dz * z) >= radius(a) + radius(b) + 1.2 - 1e-8
  })
}
