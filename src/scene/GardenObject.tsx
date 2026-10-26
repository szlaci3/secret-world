import type { WorldObject } from '../world/schema'
import { Structure } from './Structure'
import { SurfaceMaterial } from './SurfaceMaterial'
import { useEffect, useMemo } from 'react'
import { pondGeometry } from './pond-geometry'
import { ExtrudedIcon } from './ExtrudedIcon'

type ObjectOf<T extends WorldObject['type']> = Extract<WorldObject, { type: T }>

function Path({ object }: { object: ObjectOf<'path'> }) {
  return (
    <mesh castShadow position-y={0.045}>
      <boxGeometry args={[object.size[0], 0.09, object.size[1]]} />
      <meshStandardMaterial color={object.color} roughness={1} />
    </mesh>
  )
}

function Pond({ object, lowDetail }: { object: ObjectOf<'pond'>; lowDetail: boolean }) {
  const geometry = useMemo(() => pondGeometry(object.id), [object.id])
  useEffect(() => () => { geometry.bank.dispose(); geometry.water.dispose() }, [geometry])
  return (
    <group scale={[object.radii[0], 1, object.radii[1]]}>
      <mesh geometry={geometry.bank} castShadow receiveShadow>
        {lowDetail ? <meshStandardMaterial color={object.bankColor} roughness={1} /> : <SurfaceMaterial color={object.bankColor} grain={0.18} />}
      </mesh>
      <mesh geometry={geometry.water} receiveShadow>
        {lowDetail ? <meshStandardMaterial color={object.waterColor} roughness={0.28} metalness={0.15} /> : <SurfaceMaterial color={object.waterColor} finish="water" grain={0.04} />}
      </mesh>
      {object.lilyPads?.map((pad, index) => (
        <mesh castShadow key={index} position={[pad.position[0], 0.133, pad.position[1]]} rotation={[-Math.PI / 2, 0, index * 0.8]}>
          <circleGeometry args={[pad.radius, 16, 0.12, Math.PI * 1.92]} />
          <meshStandardMaterial color={pad.color} roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function ObjectShape({ object, lowDetail }: { object: WorldObject; lowDetail: boolean }) {
  switch (object.type) {
    case 'icon': return <ExtrudedIcon object={object} />
    case 'path': return <Path object={object} />
    case 'pond': return <Pond object={object} lowDetail={lowDetail} />
    case 'rock': return null // Batched by Rocks.
    case 'tree': return null // Batched by Trees.
    case 'lantern': return <Structure object={object} lowDetail={lowDetail} />
    case 'entrance': return <Structure object={object} lowDetail={lowDetail} />
    case 'structure': return <Structure object={object} lowDetail={lowDetail} />
    case 'plant': return null // Batched by Plants.
    case 'patch': return null // GroundPatch conforms to the terrain.
    default: {
      const unsupported: never = object
      throw new Error(`Unsupported garden object: ${unsupported}`)
    }
  }
}

/** Local shapes are reusable; every world instance gets its transform from data. */
export function GardenObject({ object, lowDetail = false }: { object: WorldObject; lowDetail?: boolean }) {
  return (
    <group name={object.id} position={object.position} rotation={[0, object.rotation, 0]} scale={object.scale}>
      <ObjectShape object={object} lowDetail={lowDetail} />
    </group>
  )
}
