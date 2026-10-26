import type { WorldObject } from '../world/schema'
import { iconGeometry } from './icon-geometry'

export function ExtrudedIcon({ object }: { object: Extract<WorldObject, { type: 'icon' }> }) {
  return iconGeometry(object.icon).map(({ geometry, slot }) => (
    <mesh key={slot} castShadow receiveShadow name={`${object.id}-${slot}`}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial color={object[slot] ?? (slot === 'accentColor' ? '#fff0d5' : slot === 'detailColor' ? '#314a6b' : object.color)}
        roughness={0.32} metalness={0} />
    </mesh>
  ))
}
