import type { WorldDefinition } from '../world/schema'
import { GardenObject } from './GardenObject'
import { InstancedPaths } from './InstancedPaths'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

export function WorldScene({ world }: { world: WorldDefinition }) {
  const { ground, environment } = world
  const { gl, invalidate, size } = useThree()
  const small = size.width < 600
  const extent = Math.hypot(...ground.size) * 0.6
  useLayoutEffect(() => {
    // World geometry and light are static. Camera movement reuses the shadow map.
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    invalidate()
    return () => { gl.shadowMap.autoUpdate = true }
  }, [world, gl, invalidate, small])
  return (
    <>
      <color attach="background" args={[environment.background]} />
      <ambientLight intensity={environment.ambientIntensity} />
      {environment.skyLight && <hemisphereLight args={[environment.skyLight.skyColor, environment.skyLight.groundColor, environment.skyLight.intensity]} />}
      <directionalLight {...environment.sunlight} castShadow
        shadow-mapSize={[small ? 512 : 1024, small ? 512 : 1024]}
        shadow-normalBias={0.025} shadow-bias={-0.00015}>
        <orthographicCamera attach="shadow-camera" args={[-extent, extent, extent, -extent, 0.5, 120]} />
      </directionalLight>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={ground.size} />
        <meshStandardMaterial color={ground.color} roughness={1} />
      </mesh>
      <InstancedPaths objects={world.objects} />
      {world.objects.filter((object) => object.type !== 'path').map((object) => <GardenObject key={object.id} object={object} />)}
    </>
  )
}
