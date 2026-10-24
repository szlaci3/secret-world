import type { WorldObject } from '../world/schema'

type StructureObject = Extract<WorldObject, { type: 'structure' }>
function Block({ position, size, color, rotation = 0 }: { position: [number, number, number]; size: [number, number, number]; color: string; rotation?: number }) {
  return <mesh position={position} rotation-z={rotation} castShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={0.95} /></mesh>
}

export function Structure({ object: { variety, color, accentColor } }: { object: StructureObject }) {
  if (variety === 'bench') return <group>
    <Block position={[0, 0.55, 0]} size={[1.8, 0.18, 0.65]} color={accentColor} />
    {[-0.6, 0.6].map((x) => <Block key={x} position={[x, 0.25, 0]} size={[0.18, 0.5, 0.5]} color={color} />)}
  </group>
  if (variety === 'arch') return <group>
    {[-1.4, 1.4].map((x) => <Block key={x} position={[x, 1.65, 0]} size={[0.65, 3.3, 0.8]} color={color} />)}
    <Block position={[0, 3.35, 0]} size={[3.8, 0.65, 1]} color={accentColor} />
    <Block position={[0, 3.8, 0]} size={[0.55, 0.4, 1.1]} color={color} />
  </group>
  if (variety === 'column') return <group>
    <mesh castShadow position-y={1.25}><cylinderGeometry args={[0.42, 0.55, 2.5, 8]} /><meshStandardMaterial color={color} roughness={1} /></mesh>
    <Block position={[0, 0.12, 0]} size={[1.2, 0.24, 1.2]} color={accentColor} />
    <Block position={[0, 2.55, 0]} size={[1.05, 0.25, 1.05]} color={accentColor} />
  </group>
  if (variety === 'pavilion') return <group>
    {[-1.2, 1.2].flatMap((x) => [-1.2, 1.2].map((z) => <Block key={`${x}/${z}`} position={[x, 1.25, z]} size={[0.18, 2.5, 0.18]} color={color} />))}
    <mesh castShadow position-y={2.95} rotation-y={Math.PI / 4}><coneGeometry args={[2.4, 1, 4]} /><meshStandardMaterial color={accentColor} /></mesh>
  </group>
  if (variety === 'cabin') return <group>
    <Block position={[0, 1.1, 0]} size={[2.8, 2.2, 2.2]} color={color} />
    <mesh castShadow position-y={2.65} rotation-y={Math.PI / 4}><coneGeometry args={[2.4, 1.2, 4]} /><meshStandardMaterial color={accentColor} /></mesh>
    <Block position={[0, 0.8, 1.11]} size={[0.65, 1.6, 0.04]} color="#473c39" />
    <Block position={[0.85, 1.45, 1.13]} size={[0.5, 0.55, 0.04]} color="#f3c979" />
    <Block position={[0.8, 3.1, -0.4]} size={[0.35, 1.2, 0.4]} color="#666a73" />
  </group>
  return <group>
    <mesh castShadow position-y={2.3}><cylinderGeometry args={[0.7, 1.15, 4.6, 10]} /><meshStandardMaterial color={color} roughness={0.9} /></mesh>
    <mesh castShadow position-y={4.85}><coneGeometry args={[1.15, 0.8, 10]} /><meshStandardMaterial color={accentColor} /></mesh>
    {variety === 'beacon' ? <>
      <mesh position-y={4.3}><cylinderGeometry args={[0.76, 0.76, 0.6, 10]} /><meshStandardMaterial color="#ffe1a1" emissive="#ffd293" emissiveIntensity={0.7} /></mesh>
      <Block position={[0, 0.65, 1.05]} size={[0.5, 1.3, 0.08]} color={accentColor} />
    </> : <group position={[0, 3.2, 0.95]} rotation-z={0.45}>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((angle) => <group key={angle} rotation-z={angle}>
        <Block position={[0, 1.4, 0]} size={[0.12, 3, 0.14]} color={accentColor} />
        <Block position={[0.25, 1.8, 0.05]} size={[0.5, 1.9, 0.08]} color="#f1dfb7" />
      </group>)}
    </group>}
  </group>
}
