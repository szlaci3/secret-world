import { BufferGeometry, Color, CylinderGeometry, Float32BufferAttribute, Quaternion, Vector3 } from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

export function seedFor(id: string) {
  let seed = 2166136261
  for (const character of id) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  return seed >>> 0
}
export function randomSource(seed: number) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 }
}

/** Folded, tapered ribbon: silhouette and midrib without transparent overdraw. */
export function leafGeometry(length: number, width: number, bend = 0.25, segments = 3) {
  const vertices: number[] = [], indices: number[] = []
  for (let row = 0; row <= segments; row++) {
    const t = row / segments, w = Math.sin(Math.PI * t) * width
    vertices.push(-w, t * length, bend * t * t, 0, t * length, bend * t * t + w * 0.22, w, t * length, bend * t * t)
    if (row < segments) for (let side = 0; side < 2; side++) {
      const a = row * 3 + side
      if (row > 0) indices.push(a, a + 3, a + 1)
      if (row < segments - 1) indices.push(a + 1, a + 3, a + 4)
    }
  }
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(vertices, 3)); g.setIndex(indices); g.computeVertexNormals()
  return g
}
export function branchGeometry(start: Vector3, end: Vector3, bottom: number, top: number) {
  const direction = end.clone().sub(start)
  const g = new CylinderGeometry(top, bottom, direction.length(), 7, 1, true)
  g.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()))
  g.translate(...start.clone().add(end).multiplyScalar(0.5).toArray())
  return g
}
export function geometryBuilder() {
  const parts: BufferGeometry[] = []
  return {
    add(geometry: BufferGeometry, color: string, shade = 1) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry
      if (g !== geometry) geometry.dispose()
      const c = new Color(color).multiplyScalar(shade), colors: number[] = []
      for (let i = 0; i < g.getAttribute('position').count; i++) colors.push(c.r, c.g, c.b)
      g.setAttribute('color', new Float32BufferAttribute(colors, 3))
      // All source parts share the same attributes, even procedural ribbons.
      g.deleteAttribute('uv')
      parts.push(g)
    },
    finish() {
      const merged = mergeGeometries(parts)
      const result = mergeVertices(merged); merged.dispose()
      parts.forEach(part => part.dispose()); result.computeBoundingSphere()
      return result
    },
  }
}
