import { Shape, Vector2 } from 'three'

/** Expand a smooth open SVG stroke into one closed, round-capped silhouette.
 * Used for Tabler's paperclip, which has no filled version. No ribbons/tubes or
 * overlapping stroke triangles: ExtrudeGeometry receives a real closed shape.
 */
export function closedStroke(points: Vector2[], width: number): Shape {
  const clean = points.filter((point, index) => index === 0 || point.distanceToSquared(points[index - 1]) > 1e-10)
  if (clean.length < 2 || width <= 0) throw new Error('A stroke needs two distinct points and a positive width')
  const half = width / 2
  const tangents = clean.map((_, index) => clean[Math.min(index + 1, clean.length - 1)].clone()
    .sub(clean[Math.max(0, index - 1)]).normalize())
  const left = clean.map((point, index) => point.clone().add(new Vector2(-tangents[index].y, tangents[index].x).multiplyScalar(half)))
  const right = clean.map((point, index) => point.clone().add(new Vector2(tangents[index].y, -tangents[index].x).multiplyScalar(half)))
  const outline = [...left]
  const cap = (point: Vector2, angle: number) => {
    for (let step = 1; step <= 12; step++) {
      const a = angle - Math.PI * step / 12
      outline.push(point.clone().add(new Vector2(Math.cos(a), Math.sin(a)).multiplyScalar(half)))
    }
  }
  const end = tangents[tangents.length - 1]
  cap(clean[clean.length - 1], Math.atan2(end.y, end.x) + Math.PI / 2)
  outline.push(...right.reverse())
  cap(clean[0], Math.atan2(tangents[0].y, tangents[0].x) - Math.PI / 2)
  const shape = new Shape(outline)
  shape.closePath()
  return shape
}
