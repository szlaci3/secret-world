import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, CircleGeometry, Color, DoubleSide, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Object3D, SphereGeometry } from 'three'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { leafGeometry, randomSource, seedFor } from './natural-geometry'
import type { WorldObject } from '../world/schema'

type Plant = Extract<WorldObject, { type: 'plant' }>
export const plantVariant = (plant: Plant) => seedFor(plant.id) % 3

// Each cluster is one merged low-poly mesh; repeated clusters are instanced.
export function plantGeometry(plant: Plant, lowDetail: boolean, variant = plantVariant(plant)) {
  const parts: BufferGeometry[] = []
  const random = randomSource(825 + variant * 173)
  let stemX = 0, stemZ = 0, lean = 0, shade = 1
  const add = (geometry: BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, tilt = 0) => {
    const g = geometry.index ? geometry.toNonIndexed() : geometry
    if (g !== geometry) geometry.dispose()
    g.scale(sx, sy, sz).rotateZ(tilt).translate(x, y, z)
    // Bend the whole stem and its attached flowers/leaves together at the base.
    g.translate(-stemX, 0, -stemZ).rotateZ(lean).translate(stemX, 0, stemZ)
    const c = new Color(color).multiplyScalar(shade), colors = []
    for (let i = 0; i < g.getAttribute('position').count; i++) colors.push(c.r, c.g, c.b)
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    g.deleteAttribute('uv')
    parts.push(g)
  }
  for (let i = 0; i < (lowDetail ? 3 : 5); i++) {
    const angle = i * 2.4 + (random() - 0.5) * 1.1, radius = i === 0 ? 0 : 0.22 + random() * 0.2
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, h = 0.45 + random() * 0.5
    stemX = x; stemZ = z
    lean = plant.variety === 'bamboo' || plant.variety === 'cactus' ? 0 : (random() - 0.5) * 0.2
    shade = 0.88 + random() * 0.24
    switch (plant.variety) {
      case 'bamboo':
        add(new CylinderGeometry(0.045, 0.065, 2.6 + h, 5), plant.color, x, (2.6 + h) / 2, z)
        add(new IcosahedronGeometry(0.55, 0), plant.accentColor, x + 0.2, 2 + h, z, 1, 0.22, 0.6)
        break
      case 'cactus':
        if (i > 2) break
        add(new CylinderGeometry(0.16, 0.21, h * 1.8, 7), plant.color, x, h * 0.9, z)
        add(new SphereGeometry(0.16, 7, 4), plant.color, x, h * 1.8, z)
        add(new IcosahedronGeometry(0.1, 0), plant.accentColor, x, h * 1.8 + 0.15, z)
        break
      case 'flowers':
        add(new CylinderGeometry(0.018, 0.025, h, 4), plant.color, x, h / 2, z)
        for (let petal = 0; petal < (lowDetail ? 5 : 7); petal++) {
          const g = leafGeometry(0.21, 0.085, 0.045, lowDetail ? 2 : 3).rotateX(1.15).rotateY(petal * Math.PI * 2 / (lowDetail ? 5 : 7))
          add(g, plant.accentColor, x, h, z)
        }
        add(lowDetail ? new CircleGeometry(0.065, 6).rotateX(-Math.PI / 2) : new IcosahedronGeometry(0.065, 0), '#a67c31', x, h + 0.025, z, 1, 0.5, 1)
        for (let leaf = 0; leaf < (lowDetail ? 1 : 2); leaf++) add(leafGeometry(0.27, 0.065, 0.1, lowDetail ? 2 : 3).rotateZ(leaf ? 0.9 : -0.9).rotateY(i), plant.color, x, h * (0.3 + leaf * 0.25), z)
        break
      case 'mushrooms':
        add(new CylinderGeometry(0.055, 0.08, h * 0.6, 5), plant.color, x, h * 0.3, z)
        add(new SphereGeometry(0.3, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), plant.accentColor, x, h * 0.6, z, 1, 0.7, 1)
        break
      case 'reeds':
        add(new CylinderGeometry(0.025, 0.035, h * 1.6, 4), plant.color, x, h * 0.8, z)
        add(new CylinderGeometry(0.065, 0.065, 0.27, 5), plant.accentColor, x, h * 1.6, z)
        break
      case 'fern':
        for (let pair = 0; pair < 6; pair++) for (const side of [-1, 1]) {
          const g = leafGeometry(0.3 * (1 - pair / 8), 0.05, 0.05).rotateZ(side * 1.1).translate(0, pair * 0.1, pair * 0.07).rotateY(angle)
          add(g, plant.color, x, 0.05, z)
        }
        break
      case 'grass':
        for (let blade = 0; blade < (lowDetail ? 2 : 4); blade++) {
          const g = leafGeometry(h * (0.65 + blade * 0.13), 0.022 + blade * 0.004, 0.15 + blade * 0.06, lowDetail ? 2 : 3).rotateY(angle + blade * 2.4)
          add(g, blade % 2 ? plant.color : plant.accentColor, x, 0, z)
        }
        break
    }
  }
  const merged = mergeGeometries(parts)
  const result = mergeVertices(merged); merged.dispose()
  parts.forEach((part) => part.dispose())
  return result
}

function PlantBatch({ plants, lowDetail, variant }: { plants: Plant[]; lowDetail: boolean; variant: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => plantGeometry(plants[0], lowDetail, variant), [plants, lowDetail, variant])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const transform = new Object3D()
    plants.forEach((plant, index) => {
      transform.position.set(...plant.position)
      transform.rotation.set(0, plant.rotation, 0)
      transform.scale.set(...plant.scale)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
      mesh.current!.setColorAt(index, new Color().setScalar(0.8 + (seedFor(plant.id) % 100) / 250))
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [plants])
  return <instancedMesh ref={mesh} args={[geometry, undefined, plants.length]} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.92} side={DoubleSide} />
  </instancedMesh>
}

export function Plants({ objects, lowDetail }: { objects: WorldObject[]; lowDetail: boolean }) {
  const batches = useMemo(() => {
    const groups = new Map<string, Plant[]>()
    for (const object of objects) if (object.type === 'plant') {
      const key = `${object.variety}/${object.color}/${object.accentColor}/${plantVariant(object)}`
      const group = groups.get(key) ?? []
      group.push(object)
      groups.set(key, group)
    }
    return [...groups]
  }, [objects])
  return batches.map(([key, plants]) => <PlantBatch key={key} plants={plants} lowDetail={lowDetail} variant={plantVariant(plants[0])} />)
}
