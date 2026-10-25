import type { BufferGeometry } from 'three'
import { BoxGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, ExtrudeGeometry, RingGeometry, Shape, SphereGeometry, Vector3 } from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import type { WorldObject } from '../world/schema'
import { branchGeometry, geometryBuilder, randomSource } from './natural-geometry'

export type Artifact = Extract<WorldObject, { type: 'structure' | 'entrance' | 'lantern' }>
type Point = [number, number, number]

/** Small construction details merged into one indexed mesh, not one draw per board. */
export function artifactGeometry(object: Artifact) {
  const builder = geometryBuilder(), random = randomSource(913)
  const body = object.type === 'structure' ? object.color : object.type === 'entrance' ? object.woodColor : object.stoneColor
  const trim = object.type === 'structure' ? object.accentColor : object.type === 'entrance' ? object.roofColor : object.stoneColor
  const dark = `#${new Color(body).multiplyScalar(0.48).getHexString()}`
  const block = (position: Point, size: Point, color = body, tilt = 0, yaw = 0, bevel = true) => {
    const g = bevel ? new RoundedBoxGeometry(...size, 1, Math.min(0.035, ...size.map(v => v * 0.12))) : new BoxGeometry(...size)
    g.rotateZ(tilt).rotateY(yaw).translate(...position)
    builder.add(g, color, 0.92 + random() * 0.16)
  }
  const cylinder = (position: Point, top: number, bottom: number, height: number, color = body, segments = 16) => {
    builder.add(new CylinderGeometry(top, bottom, height, segments).translate(...position), color)
  }
  const brace = (from: Point, to: Point, radius = 0.045, color = body) => builder.add(branchGeometry(new Vector3(...from), new Vector3(...to), radius, radius), color)
  const hipRoof = (y: number, radius: number, height: number) => {
    builder.add(new ConeGeometry(radius, height, 4).rotateY(Math.PI / 4).translate(0, y, 0), trim)
    // Staggered courses interrupt the uninterrupted pyramid silhouette.
    for (let row = 0; row < 4; row++) {
      const t = row / 5, half = radius / Math.sqrt(2) * (1 - t)
      for (const side of [-1, 1]) {
        block([0, y - height / 2 + t * height, side * half], [half * 2 + 0.07, 0.055, 0.065], trim, 0, 0, false)
        block([side * half, y - height / 2 + t * height, 0], [0.065, 0.055, half * 2 + 0.07], trim, 0, 0, false)
      }
    }
  }

  if (object.type === 'lantern') {
    cylinder([0, 0.1, 0], 0.4, 0.48, 0.2)
    cylinder([0, 0.23, 0], 0.26, 0.34, 0.08)
    cylinder([0, 0.62, 0], 0.13, 0.19, 0.72)
    block([0, 1.02, 0], [0.56, 0.16, 0.56])
    for (const x of [-0.22, 0.22]) for (const z of [-0.22, 0.22]) block([x, 1.29, z], [0.075, 0.42, 0.075])
    for (const side of [-1, 1]) for (const offset of [-0.07, 0.07]) {
      block([offset, 1.29, side * 0.23], [0.025, 0.32, 0.025], dark, 0, 0, false)
      block([side * 0.23, 1.29, offset], [0.025, 0.32, 0.025], dark, 0, 0, false)
    }
    hipRoof(1.6, 0.58, 0.35)
    builder.add(new SphereGeometry(0.09, 10, 6).translate(0, 1.85, 0), body)
  } else if (object.type === 'entrance') {
    for (const side of [-1, 1]) {
      cylinder([side * 1.2, 1.55, 0], 0.14, 0.18, 3.1)
      cylinder([side * 1.2, 0.12, 0], 0.24, 0.27, 0.24, trim)
      for (const y of [0.36, 2.55]) cylinder([side * 1.2, y, 0], 0.185, 0.185, 0.09, trim)
      block([side * 1.7, 3.25, 0], [1.25, 0.2, 0.5], trim, side * 0.13)
      brace([side * 1.2, 2.15, 0], [side * 0.75, 2.6, 0], 0.055)
    }
    block([0, 2.6, 0], [3.15, 0.18, 0.23])
    block([0, 3.18, 0], [2.8, 0.22, 0.5], trim)
    block([0, 2.88, 0], [0.18, 0.6, 0.18])
  } else if (object.variety === 'fallen-log' || object.variety === 'stump') {
    const log = object.variety === 'fallen-log'
    const length = log ? 2.9 : 0.62, bottom = log ? 0.34 : 0.38, top = log ? 0.27 : 0.3
    const slope = log ? Math.atan((bottom - top) / length) : 0
    const orient = (g: BufferGeometry, end = 0) => {
      // The tapered log rests at both ends instead of hovering at its thin end.
      if (log) g.rotateZ(-Math.PI / 2 - slope).translate(end * Math.cos(slope), 0.31 - end * Math.sin(slope), 0)
      else g.translate(0, end, 0)
      return g
    }
    // Closed wood ends, with rings on the actual cut planes rather than floating
    // perpendicular branch stubs. Bark remains one merged, indexed mesh.
    builder.add(orient(new CylinderGeometry(top, bottom, length, 13), 0).translate(0, log ? 0 : length / 2, 0), body)
    for (const end of log ? [-1, 1] : [1]) {
      const radius = (end < 0 ? bottom : top) - 0.012
      const cut = end * length / (log ? 2 : 1) + end * 0.002
      const face = new CircleGeometry(radius, 32).rotateX(-Math.PI / 2)
      // Reverse the left end so its visible face points outward.
      if (end < 0) face.rotateX(Math.PI)
      builder.add(orient(face, cut), trim)
      for (let ring = 1; ring <= 6; ring++) {
        const r = radius * ring / 7
        const g = new RingGeometry(r - 0.0035, r + 0.0035, 32).rotateX(-Math.PI / 2)
        if (end < 0) g.rotateX(Math.PI)
        builder.add(orient(g, cut + end * 0.001), dark)
      }
    }
    for (let ridge = 0; ridge < 13; ridge++) {
      const angle = ridge * Math.PI * 2 / 13
      const lower = bottom * 0.95 + top * 0.05 - 0.012, upper = top * 0.95 + bottom * 0.05 - 0.012
      const g = branchGeometry(new Vector3(Math.cos(angle) * lower, -length * 0.45, Math.sin(angle) * lower),
        new Vector3(Math.cos(angle) * upper, length * 0.45, Math.sin(angle) * upper), 0.025, 0.016)
      builder.add(orient(g).translate(0, log ? 0 : length / 2, 0), ridge % 3 ? body : dark)
    }
    // A few subdued moss islands hug the upper bark; no extra meshes or colliders.
    for (let i = 0; i < (log ? 6 : 3); i++) {
      const x = log ? -0.95 + i * 0.36 : Math.cos(i * 2.4) * 0.21
      const z = log ? Math.sin(i * 2.4) * 0.12 : Math.sin(i * 2.4) * 0.21
      const radius = bottom + (top - bottom) * (x / length + 0.5)
      const y = log ? 0.31 - x * Math.sin(slope) + Math.sqrt(Math.max(0, radius ** 2 - z ** 2)) : length + 0.008
      builder.add(new SphereGeometry(0.12, 7, 4).scale(1.3, 0.18, 0.7).translate(x, y, z), '#65754b', 0.85 + i * 0.03)
    }
  } else if (object.variety === 'bench') {
    for (let slat = 0; slat < 4; slat++) block([0, 0.55, -0.24 + slat * 0.16], [1.8, 0.12, 0.14], trim)
    for (const x of [-0.6, 0.6]) {
      block([x, 0.25, 0], [0.18, 0.5, 0.5])
      block([x, 0.79, -0.26], [0.08, 0.65, 0.08])
    }
    for (const y of [0.82, 1.01]) block([0, y, -0.26], [1.8, 0.15, 0.08], trim)
    block([0, 0.23, 0], [1.35, 0.09, 0.12])
  } else if (object.variety === 'arch') {
    for (const x of [-1.4, 1.4]) {
      for (let row = 0; row < 7; row++) block([x, 0.23 + row * 0.46, 0], [0.65, 0.445, 0.8])
      block([x, 3.12, 0], [0.65, 0.18, 0.8], trim)
    }
    for (let stone = 0; stone < 7; stone++) block([-1.62 + stone * 0.54, 3.35, 0], [0.53, 0.65, 1], trim)
    block([0, 3.8, 0], [0.55, 0.4, 1.1])
  } else if (object.variety === 'column') {
    cylinder([0, 1.25, 0], 0.42, 0.55, 2.5, body, 20)
    for (const y of [0.3, 0.45, 2.3, 2.43]) cylinder([0, y, 0], y < 1 ? 0.57 : 0.46, y < 1 ? 0.57 : 0.46, 0.07, trim)
    block([0, 0.12, 0], [1.2, 0.24, 1.2], trim)
    block([0, 2.55, 0], [1.05, 0.25, 1.05], trim)
  } else if (object.variety === 'pavilion') {
    for (const x of [-1.2, 1.2]) for (const z of [-1.2, 1.2]) {
      block([x, 1.25, z], [0.18, 2.5, 0.18])
      block([x, 0.12, z], [0.22, 0.24, 0.22], trim)
      brace([x, 1.95, z], [x * 0.6, 2.48, z], 0.055)
      brace([x, 1.95, z], [x, 2.48, z * 0.6], 0.055)
    }
    for (const side of [-1, 1]) {
      block([0, 2.45, side * 1.2], [2.6, 0.18, 0.18])
      block([side * 1.2, 2.45, 0], [0.18, 0.18, 2.6])
    }
    hipRoof(2.95, 2.4, 1)
  } else if (object.variety === 'cabin') {
    block([0, 1.1, 0], [2.76, 2.2, 2.16], dark)
    const gable = new Shape().moveTo(-1.4, 0).lineTo(1.4, 0).lineTo(0, 0.86).closePath()
    builder.add(new ExtrudeGeometry(gable, { depth: 2.2, bevelEnabled: false }).translate(0, 2.2, -1.1), body)
    for (let row = 0; row < 11; row++) {
      const y = 0.1 + row * 0.2
      for (const side of [-1, 1]) {
        block([0, y, side * 1.09], [2.8, 0.188, 0.055])
        block([side * 1.39, y, 0], [0.055, 0.188, 2.2])
      }
    }
    for (const x of [-1.35, 1.35]) for (const z of [-1.07, 1.07]) block([x, 1.1, z], [0.14, 2.2, 0.14], trim)
    for (const side of [-1, 1]) {
      block([side * 0.79, 2.62, 0], [1.9, 0.12, 2.7], trim, -side * 0.55)
      for (let course = 0; course < 6; course++) {
        const x = side * (0.12 + course * 0.29)
        block([x, 3.15 - Math.abs(x) * 0.61, 0], [0.06, 0.055, 2.73], trim, -side * 0.55, 0, false)
      }
    }
    block([0, 3.15, 0], [0.14, 0.12, 2.8], trim)
    block([0, 0.8, 1.13], [0.65, 1.6, 0.05], dark)
    for (let board = 0; board < 5; board++) block([-0.26 + board * 0.13, 0.8, 1.165], [0.12, 1.54, 0.025], trim, 0, 0, false)
    block([0.22, 0.82, 1.2], [0.04, 0.07, 0.04], '#a79564')
    for (const x of [-0.85, 0.85]) {
      block([x, 1.45, 1.13], [0.52, 0.57, 0.05], '#52696d')
      for (const side of [-1, 1]) {
        block([x + side * 0.29, 1.45, 1.18], [0.06, 0.69, 0.08], trim)
        block([x, 1.45 + side * 0.31, 1.18], [0.62, 0.06, 0.08], trim)
      }
      block([x, 1.45, 1.18], [0.035, 0.57, 0.05], trim)
      block([x, 1.45, 1.18], [0.52, 0.035, 0.05], trim)
    }
    for (let course = 0; course < 6; course++) block([0.8, 2.61 + course * 0.19, -0.4], [0.35, 0.18, 0.4], '#666a73')
    block([0.8, 3.7, -0.4], [0.4, 0.08, 0.45], '#4d5057')
  } else {
    cylinder([0, 2.3, 0], 0.7, 1.15, 4.6, body, 20)
    // Raised stone courses, shallow enough to retain the original footprint.
    for (let row = 0; row < 12; row++) {
      const y = 0.16 + row * 0.37, radius = 1.15 - y / 4.6 * 0.45
      cylinder([0, y, 0], radius + 0.012, radius + 0.012, 0.035, trim, 20)
    }
    builder.add(new ConeGeometry(1.15, 0.8, 16).translate(0, 4.85, 0), trim)
    block([0, 0.65, 1.08], [0.5, 1.3, 0.08], dark)
    for (const x of [-0.29, 0.29]) block([x, 0.675, 1.09], [0.06, 1.35, 0.1], trim)
    if (object.variety === 'beacon') {
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4
        cylinder([Math.cos(angle) * 0.78, 4.3, Math.sin(angle) * 0.78], 0.035, 0.035, 0.68, trim, 6)
      }
      for (const y of [3.96, 4.64]) cylinder([0, y, 0], 0.86, 0.86, 0.09, trim)
    } else {
      for (let arm = 0; arm < 4; arm++) {
        const angle = 0.45 + arm * Math.PI / 2
        const sail = (x: number, y: number, w: number, h: number, color: string) => {
          const g = new BoxGeometry(w, h, 0.065).translate(x, y, 0).rotateZ(angle).translate(0, 3.2, 0.99)
          builder.add(g, color)
        }
        sail(0, 1.4, 0.12, 3, trim)
        sail(0.25, 1.8, 0.48, 1.9, '#d4c4a3')
        for (let rib = 0; rib < 8; rib++) sail(0.25, 0.9 + rib * 0.25, 0.55, 0.035, trim)
        sail(0.49, 1.8, 0.045, 1.95, trim)
      }
      builder.add(new CylinderGeometry(0.18, 0.18, 0.22, 12).rotateX(Math.PI / 2).translate(0, 3.2, 1.1), trim)
    }
  }
  return builder.finish()
}
