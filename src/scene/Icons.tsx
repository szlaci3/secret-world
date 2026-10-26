import { Color, InstancedMesh, Object3D } from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { WorldObject } from '../world/schema'
import { iconGeometry } from './icon-geometry'

type Icon = Extract<WorldObject, { type: 'icon' }>
function Batch({ objects, part }: { objects: Icon[]; part: ReturnType<typeof iconGeometry>[number] }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const target = mesh.current!, transform = new Object3D(), color = new Color()
    objects.forEach((object, index) => {
      transform.position.fromArray(object.position)
      transform.rotation.set(0, object.rotation, 0)
      transform.scale.fromArray(object.scale)
      transform.updateMatrix()
      target.setMatrixAt(index, transform.matrix)
      target.setColorAt(index, color.set(object[part.slot] ?? (part.slot === 'accentColor' ? '#fff0d5' : part.slot === 'detailColor' ? '#314a6b' : object.color)))
    })
    target.instanceMatrix.needsUpdate = true
    if (target.instanceColor) target.instanceColor.needsUpdate = true
    target.computeBoundingSphere()
  }, [objects, part])
  return <instancedMesh ref={mesh} args={[undefined, undefined, objects.length]} castShadow receiveShadow>
    <primitive object={part.geometry} attach="geometry" />
    <meshStandardMaterial roughness={0.32} metalness={0} />
  </instancedMesh>
}

export function Icons({ objects, lowDetail }: { objects: WorldObject[]; lowDetail: boolean }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, Icon[]>()
    for (const object of objects) if (object.type === 'icon') {
      // Smaller spatial batches let the camera cull distant/behind-camera icons
      // instead of submitting every copy of a symbol across the entire world.
      const key = `${object.icon}:${Math.floor(object.position[0] / 24)}:${Math.floor(object.position[2] / 24)}`
      const group = grouped.get(key) ?? []
      group.push(object)
      grouped.set(key, group)
    }
    return [...grouped]
  }, [objects])
  return groups.flatMap(([key, icons]) => iconGeometry(icons[0].icon, lowDetail).map(part => <Batch key={`${key}-${part.slot}`} objects={icons} part={part} />))
}
