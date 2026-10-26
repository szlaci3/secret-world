import { Color, InstancedMesh, Object3D } from 'three'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { WorldObject } from '../world/schema'
import { ICON_SIZE } from '../world/icon-types'
import { iconGeometry } from './icon-geometry'
import { iconLod } from './icon-lod'
import type { IconLod } from './icon-lod'

type Icon = Extract<WorldObject, { type: 'icon' }>
function LodBatch({ objects }: { objects: Icon[] }) {
  const { camera, gl, invalidate } = useThree()
  const meshes = useRef(new Map<string, InstancedMesh>())
  const previous = useRef<IconLod[]>([])
  const transform = useMemo(() => new Object3D(), [])
  const color = useMemo(() => new Color(), [])
  const levels = useMemo(() => (['full', 'medium', 'far'] as const).map(detail => iconGeometry(objects[0].icon, detail)), [objects])
  const update = (force = false) => {
    const groups: Icon[][] = [[], [], []]
    let changed = force
    objects.forEach((object, index) => {
      const scale = Math.max(...object.scale)
      const distance = Math.hypot(camera.position.x - object.position[0],
        camera.position.y - object.position[1] - ICON_SIZE * object.scale[1] / 2,
        camera.position.z - object.position[2]) / scale
      const next = iconLod(distance, force ? undefined : previous.current[index])
      changed ||= next !== previous.current[index]
      previous.current[index] = next
      groups[next].push(object)
    })
    if (!changed) return
    levels.forEach((parts, level) => parts.forEach(part => {
      const mesh = meshes.current.get(`${level}-${part.slot}`)!
      mesh.count = groups[level].length
      mesh.visible = mesh.count > 0
      groups[level].forEach((object, index) => {
        transform.position.fromArray(object.position)
        transform.rotation.set(0, object.rotation, 0)
        transform.scale.fromArray(object.scale)
        transform.updateMatrix()
        mesh.setMatrixAt(index, transform.matrix)
        mesh.setColorAt(index, color.set(object[part.slot] ?? (part.slot === 'accentColor' ? '#fff0d5' : part.slot === 'detailColor' ? '#314a6b' : object.color)))
      })
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }))
    // Cached shadows must follow a changed silhouette.
    gl.shadowMap.needsUpdate = true
  }
  useLayoutEffect(() => { update(true); invalidate() }, [objects, levels, camera, invalidate])
  useFrame(() => update())
  return levels.flatMap((parts, level) => parts.map(part => <instancedMesh key={`${level}-${part.slot}`}
    name={`icon-lod-${level}-${objects[0].icon}-${part.slot}`}
    ref={mesh => { if (mesh) meshes.current.set(`${level}-${part.slot}`, mesh); else meshes.current.delete(`${level}-${part.slot}`) }}
    args={[undefined, undefined, objects.length]} castShadow receiveShadow>
    <primitive object={part.geometry} attach="geometry" />
    <meshStandardMaterial roughness={0.32} metalness={0} />
  </instancedMesh>))
}

export function Icons({ objects }: { objects: WorldObject[] }) {
  const groups = useMemo(() => {
    const grouped = new Map<string, Icon[]>()
    for (const object of objects) if (object.type === 'icon') {
      const key = `${object.icon}:${Math.floor(object.position[0] / 24)}:${Math.floor(object.position[2] / 24)}`
      const group = grouped.get(key) ?? []
      group.push(object)
      grouped.set(key, group)
    }
    return [...grouped]
  }, [objects])
  return groups.map(([key, icons]) => <LodBatch key={key} objects={icons} />)
}
