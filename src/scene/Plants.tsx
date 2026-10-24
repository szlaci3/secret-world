import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Object3D, SphereGeometry } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { WorldObject } from '../world/schema'

type Plant = Extract<WorldObject, { type: 'plant' }>

// Each cluster is one merged low-poly mesh; repeated clusters are instanced.
function plantGeometry(plant: Plant) {
  const parts: BufferGeometry[] = []
  const add = (geometry: BufferGeometry, color: string, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, tilt = 0) => {
    const g = geometry.toNonIndexed()
    geometry.dispose()
    g.scale(sx, sy, sz).rotateZ(tilt).translate(x, y, z)
    const c = new Color(color), colors = []
    for (let i = 0; i < g.getAttribute('position').count; i++) colors.push(c.r, c.g, c.b)
    g.setAttribute('color', new Float32BufferAttribute(colors, 3))
    parts.push(g)
  }
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4, radius = i === 0 ? 0 : 0.28 + (i % 2) * 0.15
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius, h = 0.55 + (i % 3) * 0.18
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
        add(new IcosahedronGeometry(0.17, 0), plant.accentColor, x, h, z, 1, 0.45, 1)
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
        add(new IcosahedronGeometry(0.5, 0), plant.color, x, 0.28, z, 0.45, 0.6, 1, (i - 2) * 0.2)
        break
      case 'grass':
        add(new ConeGeometry(0.12, h, 3), plant.color, x, h / 2, z, 1, 1, 0.5, (i - 2) * 0.12)
        break
    }
  }
  const result = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return result
}

function PlantBatch({ plants }: { plants: Plant[] }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => plantGeometry(plants[0]), [plants])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const transform = new Object3D()
    plants.forEach((plant, index) => {
      transform.position.set(...plant.position)
      transform.rotation.set(0, plant.rotation, 0)
      transform.scale.set(...plant.scale)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [plants])
  return <instancedMesh ref={mesh} args={[geometry, undefined, plants.length]} castShadow>
    <meshStandardMaterial vertexColors roughness={1} />
  </instancedMesh>
}

export function Plants({ objects }: { objects: WorldObject[] }) {
  const batches = useMemo(() => {
    const groups = new Map<string, Plant[]>()
    for (const object of objects) if (object.type === 'plant') {
      const key = `${object.variety}/${object.color}/${object.accentColor}`
      const group = groups.get(key) ?? []
      group.push(object)
      groups.set(key, group)
    }
    return [...groups]
  }, [objects])
  return batches.map(([key, plants]) => <PlantBatch key={key} plants={plants} />)
}
