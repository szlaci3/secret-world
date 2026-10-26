import ClipperLib from 'clipper-lib'
import { Path, Shape, Vector2 } from 'three'
import type { ShapePath } from 'three'

const precision = 10000
const integerPath = (points: Vector2[]) => points.map(point => ({ X: Math.round(point.x * precision), Y: Math.round(point.y * precision) }))
const vectors = (points: ClipperLib.Path) => points.map(point => new Vector2(point.X / precision, point.Y / precision))

/** Trusted Tabler fills and round strokes only. Union intersecting strokes before
 * extrusion so crossings do not leave internal walls or overlapping caps. */
export function iconContours(paths: ShapePath[], detail: boolean | 'medium' = false): Shape[] {
  const divisions = detail === 'medium' ? 12 : detail ? 6 : 32
  const contours: ClipperLib.Paths = []
  for (const path of paths) {
    const style = path.userData?.style as { fill?: string; stroke?: string; strokeWidth?: number } | undefined
    if (style?.fill !== 'none') {
      for (const shape of path.toShapes()) {
        const outer = integerPath(shape.getPoints(divisions))
        if (!ClipperLib.Clipper.Orientation(outer)) outer.reverse()
        contours.push(outer)
        for (const hole of shape.holes) {
          const ring = integerPath(hole.getPoints(divisions))
          if (ClipperLib.Clipper.Orientation(ring)) ring.reverse()
          contours.push(ring)
        }
      }
    }
    if (style?.fill === 'none' && style.stroke && style.stroke !== 'none') {
      for (const subpath of path.subPaths) {
        const points = subpath.getPoints(divisions).filter((point, index, all) => !index || point.distanceToSquared(all[index - 1]) > 1e-10)
        if (points.length < 2) continue // Tabler's empty bounding path.
        const closed = subpath.autoClose || points[0].distanceToSquared(points[points.length - 1]) < 1e-8
        if (closed && points[0].distanceToSquared(points[points.length - 1]) < 1e-8) points.pop()
        const offset = new ClipperLib.ClipperOffset(2, precision * (detail === 'medium' ? 0.045 : detail ? 0.12 : 0.015))
        offset.AddPath(integerPath(points), ClipperLib.JoinType.jtRound, closed ? ClipperLib.EndType.etClosedLine : ClipperLib.EndType.etOpenRound)
        const expanded: ClipperLib.Paths = []
        offset.Execute(expanded, Number(style.strokeWidth ?? 2) * precision / 2)
        contours.push(...expanded)
      }
    }
  }
  const clipper = new ClipperLib.Clipper()
  clipper.AddPaths(detail ? ClipperLib.Clipper.CleanPolygons(contours, precision * (detail === 'medium' ? 0.025 : 0.08)) : contours, ClipperLib.PolyType.ptSubject, true)
  const tree = new ClipperLib.PolyTree()
  clipper.Execute(ClipperLib.ClipType.ctUnion, tree, ClipperLib.PolyFillType.pftNonZero, ClipperLib.PolyFillType.pftNonZero)
  const shapes: Shape[] = []
  const visit = (node: ClipperLib.PolyNode) => {
    if (!node.IsHole() && node.Contour().length >= 3) {
      const shape = new Shape(vectors(node.Contour()))
      shape.holes = node.Childs().filter(child => child.IsHole()).map(child => new Path(vectors(child.Contour())))
      shapes.push(shape)
    }
    node.Childs().forEach(visit)
  }
  visit(tree)
  if (!shapes.length) throw new Error('Icon has no supported contours')
  return shapes
}
