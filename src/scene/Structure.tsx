import { useEffect, useMemo } from 'react'
import { artifactGeometry } from './artifact-geometry'
import type { Artifact } from './artifact-geometry'
import { SurfaceMaterial } from './SurfaceMaterial'

export function Structure({ object, lowDetail = false }: { object: Artifact; lowDetail?: boolean }) {
  const geometry = useMemo(() => artifactGeometry(object), [object])
  useEffect(() => () => geometry.dispose(), [geometry])
  const wood = object.type === 'entrance' || (object.type === 'structure' && ['bench', 'cabin', 'pavilion', 'windmill', 'fallen-log', 'stump'].includes(object.variety))
  return <group>
    <mesh geometry={geometry} castShadow receiveShadow>
      {lowDetail ? <meshStandardMaterial vertexColors roughness={0.94} /> : <SurfaceMaterial vertexColors grain={0.12} finish={wood ? 'wood' : 'stone'} relief={false} />}
    </mesh>
    {object.type === 'lantern' && <mesh position-y={1.29}>
      <boxGeometry args={[0.34, 0.32, 0.34]} />
      <meshStandardMaterial color={object.glowColor} emissive={object.glowColor} emissiveIntensity={0.45} roughness={0.5} />
    </mesh>}
    {object.type === 'structure' && object.variety === 'beacon' && <mesh position-y={4.3}>
      <cylinderGeometry args={[0.76, 0.76, 0.6, 16]} />
      <meshStandardMaterial color="#ffe1a1" emissive="#ffd293" emissiveIntensity={0.7} roughness={0.4} />
    </mesh>}
  </group>
}
