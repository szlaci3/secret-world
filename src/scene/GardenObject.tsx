import type { WorldObject } from '../world/schema'

type ObjectOf<T extends WorldObject['type']> = Extract<WorldObject, { type: T }>

function Path({ object }: { object: ObjectOf<'path'> }) {
  return (
    <mesh position-y={0.045}>
      <boxGeometry args={[object.size[0], 0.09, object.size[1]]} />
      <meshStandardMaterial color={object.color} roughness={1} />
    </mesh>
  )
}

function Pond({ object }: { object: ObjectOf<'pond'> }) {
  return (
    <group scale={[object.radii[0], 1, object.radii[1]]}>
      <mesh position-y={0.055}>
        <cylinderGeometry args={[1.12, 1.15, 0.11, 48]} />
        <meshStandardMaterial color={object.bankColor} roughness={1} />
      </mesh>
      <mesh position-y={0.115}>
        <cylinderGeometry args={[1, 1, 0.025, 48]} />
        <meshStandardMaterial color={object.waterColor} roughness={0.24} metalness={0.25} />
      </mesh>
    </group>
  )
}

function Rock({ object }: { object: ObjectOf<'rock'> }) {
  return (
    <mesh position-y={0.32} rotation={[0.15, 0.3, 0.1]} scale={[0.85, 0.65, 0.72]}>
      <dodecahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial color={object.color} roughness={1} flatShading />
    </mesh>
  )
}

function Tree({ object }: { object: ObjectOf<'tree'> }) {
  const pine = object.variety === 'pine'
  const crowns: [number, number, number, number, number][] = pine
    ? [[-0.65, 2.05, 0, 1.05, 0.38], [0.6, 2.65, 0.12, 1.1, 0.4], [-0.1, 3.25, 0, 0.9, 0.42]]
    : [[-0.85, 2.45, 0.1, 1.2, 0.8], [0.8, 2.55, 0, 1.25, 0.85], [0, 3.1, -0.25, 1.3, 0.8], [0.05, 2.35, 0.8, 1, 0.6]]
  return (
    <group>
      <mesh position={[0.1, 1.35, 0]} rotation={[0, 0, -0.1]}>
        <cylinderGeometry args={[0.09, 0.2, 2.7, 7]} />
        <meshStandardMaterial color={object.trunkColor} roughness={1} />
      </mesh>
      <mesh position={[-0.35, 1.9, 0]} rotation={[0, 0, 0.8]}>
        <cylinderGeometry args={[0.045, 0.09, 1.3, 6]} />
        <meshStandardMaterial color={object.trunkColor} roughness={1} />
      </mesh>
      {crowns.map(([x, y, z, width, height], index) => (
        <mesh key={index} position={[x, y, z]} scale={[width, height, width * 0.85]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color={object.foliageColor} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Lantern({ object }: { object: ObjectOf<'lantern'> }) {
  return (
    <group>
      <mesh position-y={0.1}>
        <cylinderGeometry args={[0.4, 0.48, 0.2, 6]} />
        <meshStandardMaterial color={object.stoneColor} roughness={1} />
      </mesh>
      <mesh position-y={0.55}>
        <cylinderGeometry args={[0.13, 0.19, 0.8, 6]} />
        <meshStandardMaterial color={object.stoneColor} roughness={1} />
      </mesh>
      <mesh position-y={1.02}>
        <boxGeometry args={[0.56, 0.16, 0.56]} />
        <meshStandardMaterial color={object.stoneColor} roughness={1} />
      </mesh>
      <mesh position-y={1.29}>
        <boxGeometry args={[0.35, 0.38, 0.35]} />
        <meshStandardMaterial color={object.glowColor} emissive={object.glowColor} emissiveIntensity={0.45} />
      </mesh>
      {[-1, 1].flatMap((x) => [-1, 1].map((z) => (
        <mesh key={`${x}-${z}`} position={[x * 0.22, 1.29, z * 0.22]}>
          <boxGeometry args={[0.09, 0.42, 0.09]} />
          <meshStandardMaterial color={object.stoneColor} roughness={1} />
        </mesh>
      )))}
      <mesh position-y={1.6} rotation-y={Math.PI / 4}>
        <coneGeometry args={[0.58, 0.35, 4]} />
        <meshStandardMaterial color={object.stoneColor} roughness={1} />
      </mesh>
      <mesh position-y={1.85}>
        <sphereGeometry args={[0.1, 8, 6]} />
        <meshStandardMaterial color={object.stoneColor} roughness={1} />
      </mesh>
    </group>
  )
}

function Entrance({ object }: { object: ObjectOf<'entrance'> }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <group key={side} position-x={side * 1.2}>
          <mesh position-y={1.55} rotation-z={side * 0.035}>
            <cylinderGeometry args={[0.14, 0.18, 3.1, 10]} />
            <meshStandardMaterial color={object.woodColor} roughness={0.8} />
          </mesh>
          <mesh position-y={0.12}>
            <cylinderGeometry args={[0.24, 0.27, 0.24, 8]} />
            <meshStandardMaterial color={object.roofColor} roughness={1} />
          </mesh>
          <mesh position={[side * 0.5, 3.25, 0]} rotation-z={side * 0.13}>
            <boxGeometry args={[1.25, 0.2, 0.5]} />
            <meshStandardMaterial color={object.roofColor} roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position-y={2.6}>
        <boxGeometry args={[3.15, 0.18, 0.23]} />
        <meshStandardMaterial color={object.woodColor} roughness={0.8} />
      </mesh>
      <mesh position-y={3.18}>
        <boxGeometry args={[2.8, 0.22, 0.5]} />
        <meshStandardMaterial color={object.roofColor} roughness={0.8} />
      </mesh>
      <mesh position-y={2.88}>
        <boxGeometry args={[0.18, 0.6, 0.18]} />
        <meshStandardMaterial color={object.woodColor} roughness={0.8} />
      </mesh>
    </group>
  )
}

function ObjectShape({ object }: { object: WorldObject }) {
  switch (object.type) {
    case 'path': return <Path object={object} />
    case 'pond': return <Pond object={object} />
    case 'rock': return <Rock object={object} />
    case 'tree': return <Tree object={object} />
    case 'lantern': return <Lantern object={object} />
    case 'entrance': return <Entrance object={object} />
    default: {
      const unsupported: never = object
      throw new Error(`Unsupported garden object: ${unsupported}`)
    }
  }
}

/** Local shapes are reusable; every world instance gets its transform from data. */
export function GardenObject({ object }: { object: WorldObject }) {
  return (
    <group name={object.id} position={object.position} rotation={[0, object.rotation, 0]} scale={object.scale}>
      <ObjectShape object={object} />
    </group>
  )
}
