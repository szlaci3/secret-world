import type { WorldDefinition } from '../world/schema'
import { GardenObject } from './GardenObject'

export function WorldScene({ world }: { world: WorldDefinition }) {
  const { ground, environment } = world
  return (
    <>
      <color attach="background" args={[environment.background]} />
      <ambientLight intensity={environment.ambientIntensity} />
      <directionalLight {...environment.sunlight} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={ground.size} />
        <meshStandardMaterial color={ground.color} roughness={1} />
      </mesh>
      {world.objects.map((object) => <GardenObject key={object.id} object={object} />)}
    </>
  )
}
