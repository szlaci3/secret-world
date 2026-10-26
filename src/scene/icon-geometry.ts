import { Box3, ExtrudeGeometry, Path, Shape, Vector3 } from 'three'
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { ICON_BEVEL, ICON_DEPTH, ICON_SIZE } from '../world/icon-types'
import type { IconName } from '../world/icon-types'
import { closedStroke } from './icon-shapes'

// Vite bundles these ten trusted SVGs as text. No CDN, user SVGs or extra canvas.
const sources = import.meta.glob<string>('../assets/tabler/*.svg', { query: '?raw', import: 'default', eager: true })
type ColorSlot = 'color' | 'accentColor' | 'detailColor'
type IconPart = { geometry: ReturnType<typeof toCreasedNormals>; slot: ColorSlot }
const cache = new Map<IconName, IconPart[]>()

function circle(radius: number) {
  const shape = new Shape()
  shape.absarc(12, 12, radius, 0, Math.PI * 2, false)
  return shape
}

function silhouettes(icon: IconName): { shapes: Shape[]; slot: ColorSlot }[] {
  // The mesh supplies color. Resolve CSS currentColor before SVGLoader parses it.
  const { paths } = new SVGLoader().parse(sources[`../assets/tabler/${icon}.svg`].replaceAll('currentColor', '#000000'))
  const shapes = paths.flatMap(path => {
    const style = path.userData?.style as { fill?: string; strokeWidth?: number } | undefined
    if (style?.fill !== 'none') return path.toShapes()
    return path.subPaths.map(subpath => closedStroke(subpath.getPoints(32), Number(style.strokeWidth ?? 2)))
  })
  if (icon !== 'clock') return [{ shapes, slot: 'color' }]

  // Partition Tabler's filled clock into rim, cream face and its original hand
  // cutout. All three are extruded through the SAME depth, visible on both sides.
  const rim = new Shape()
  rim.curves = shapes[0].curves
  rim.holes = [new Path(circle(8.1).getPoints(64))]
  const face = circle(8.1)
  face.holes = shapes[0].holes
  const hands = shapes[0].holes.map(hole => { const shape = new Shape(); shape.curves = hole.curves; return shape })
  return [{ shapes: [rim], slot: 'color' }, { shapes: [face], slot: 'accentColor' }, { shapes: hands, slot: 'detailColor' }]
}

/** One bounded, session-long cache keyed by silhouette, independent of transforms
 * and colors. R3F primitives do not dispose these shared geometries on unmount.
 */
export function iconGeometry(icon: IconName): IconPart[] {
  const found = cache.get(icon)
  if (found) return found
  const profiles = silhouettes(icon)
  const parts = profiles.map(({ shapes, slot }) => {
    const geometry = new ExtrudeGeometry(shapes, {
      depth: 1, bevelEnabled: false, steps: 1, curveSegments: 32,
    })
    return { geometry, slot }
  })
  // Normalize the combined SVG silhouette once, keeping its original proportions.
  const bounds = new Box3()
  for (const { geometry } of parts) {
    geometry.rotateX(Math.PI) // SVG Y points down; a rotation preserves winding.
    if (icon === 'paperclip') geometry.rotateZ(Math.PI / 4)
    geometry.computeBoundingBox()
    bounds.union(geometry.boundingBox!)
  }
  const size = bounds.getSize(new Vector3()), center = bounds.getCenter(new Vector3())
  const factor = ICON_SIZE / Math.max(size.x, size.y)
  // Rebuild with bevels in SVG units so extrusion depth/bevels stay consistent
  // across differently sized source paths. Z is always measured in meters.
  const result = profiles.map(({ shapes, slot }) => {
    const raw = new ExtrudeGeometry(shapes, {
      depth: ICON_DEPTH / factor, bevelEnabled: true,
      bevelThickness: ICON_BEVEL / factor, bevelSize: ICON_BEVEL / factor,
      // Round inward from the silhouette: adjoining clock colors never overlap.
      bevelOffset: -ICON_BEVEL / factor,
      bevelSegments: 4, steps: 1, curveSegments: 32,
    })
    raw.rotateX(Math.PI)
    if (icon === 'paperclip') raw.rotateZ(Math.PI / 4)
    raw.scale(factor, factor, factor)
    raw.translate(-center.x * factor, -bounds.min.y * factor, ICON_DEPTH / 2)
    const geometry = toCreasedNormals(raw, Math.PI / 3)
    // Smooth bevels/sidewalls, but keep broad cap triangles perfectly planar.
    // Averaging edge normals onto caps produces visible diagonal shading fans.
    const normals = geometry.getAttribute('normal'), positions = geometry.getAttribute('position')
    for (const group of geometry.groups) if (group.materialIndex === 0) {
      for (let i = group.start; i < group.start + group.count; i++) normals.setXYZ(i, 0, 0, Math.sign(positions.getZ(i)))
    }
    if (geometry !== raw) raw.dispose()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    return { geometry, slot }
  })
  for (const { geometry } of parts) geometry.dispose()
  cache.set(icon, result)
  return result
}

if (import.meta.hot) import.meta.hot.dispose(() => {
  for (const parts of cache.values()) for (const { geometry } of parts) geometry.dispose()
  cache.clear()
})
