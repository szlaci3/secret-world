import { useLayoutEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Object3D, Quaternion, Vector3 } from 'three'
import type { WorldObject } from '../world/schema'
import { terrainHeight } from '../world/terrain'
import type { TerrainGround } from '../world/terrain'

type Path = Extract<WorldObject, { type: 'path' }>

function PathBatch({ objects, color, ground }: { objects: Path[]; color: string; ground: TerrainGround }) {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    if (!mesh.current) return
    const transform = new Object3D()
    objects.forEach((object, index) => {
      transform.position.set(object.position[0], object.position[1] + 0.045 * object.scale[1], object.position[2])
      const [x, , z] = object.position
      const normal = new Vector3(terrainHeight(ground, x - 0.1, z) - terrainHeight(ground, x + 0.1, z), 0.2,
        terrainHeight(ground, x, z - 0.1) - terrainHeight(ground, x, z + 0.1)).normalize()
      transform.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), normal)
        .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), object.rotation))
      transform.scale.set(object.size[0] * object.scale[0], 0.09 * object.scale[1], object.size[1] * object.scale[2])
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
    mesh.current.computeBoundingSphere()
  }, [objects, ground])
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, objects.length]} castShadow receiveShadow>
      <boxGeometry />
      <meshStandardMaterial color={color} roughness={1} />
    </instancedMesh>
  )
}

/** One draw per path color instead of one draw per stone; instances stay in JSON. */
export function InstancedPaths({ objects, ground }: { objects: WorldObject[]; ground: TerrainGround }) {
  const groups = useMemo(() => {
    const colors = new Map<string, Path[]>()
    objects.forEach((object) => {
      if (object.type !== 'path') return
      const group = colors.get(object.color) ?? []
      group.push(object)
      colors.set(object.color, group)
    })
    return [...colors]
  }, [objects])
  return groups.map(([color, paths]) => <PathBatch key={color} color={color} objects={paths} ground={ground} />)
}
