import type { WorldDefinition } from '../world/schema'
import { GardenObject } from './GardenObject'
import { InstancedPaths } from './InstancedPaths'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { terrainHeight } from '../world/terrain'
import { Terrain, GroundPatch } from './Terrain'
import { Plants } from './Plants'
import { Trees } from './Trees'

export function WorldScene({ world, walking, lowDetail }: { world: WorldDefinition; walking: boolean; lowDetail: boolean }) {
  const { ground, environment } = world
  const { gl, invalidate, size } = useThree()
  const small = size.width < 600
  const extent = Math.hypot(...ground.size) * 0.6
  // Overview starts well outside the world. Preserve local atmospheric depth
  // without obscuring the entire diorama from its distant overview camera.
  const fogOffset = walking ? 0 : Math.max(0, Math.hypot(...world.camera.position.map((value, axis) => value - world.camera.target[axis])) - 12)
  const objects = useMemo(() => world.objects.map((object) => ({ ...object,
    position: [object.position[0], object.position[1] + terrainHeight(ground, object.position[0], object.position[2]), object.position[2]] as [number, number, number],
  })), [world, ground])
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
      {environment.fog && <fog attach="fog" args={[environment.fog.color, environment.fog.near + fogOffset, environment.fog.far + fogOffset]} />}
      <ambientLight intensity={environment.ambientIntensity} />
      {environment.skyLight && <hemisphereLight args={[environment.skyLight.skyColor, environment.skyLight.groundColor, environment.skyLight.intensity]} />}
      <directionalLight {...environment.sunlight} castShadow
        shadow-mapSize={[small ? 512 : 1024, small ? 512 : 1024]}
        shadow-normalBias={0.025} shadow-bias={-0.00015}>
        <orthographicCamera attach="shadow-camera" args={[-extent, extent, extent, -extent, 0.5, Math.max(120, Math.hypot(...environment.sunlight.position) + extent * 2)]} />
      </directionalLight>
      <Terrain ground={ground} />
      <InstancedPaths objects={objects} ground={ground} />
      <Plants objects={objects} lowDetail={lowDetail} />
      <Trees objects={objects} lowDetail={lowDetail} />
      {world.objects.filter((object) => object.type === 'patch').map((object) => <GroundPatch key={object.id} object={object} ground={ground} />)}
      {objects.filter((object) => !['path', 'plant', 'patch', 'tree'].includes(object.type)).map((object) => <GardenObject key={object.id} object={object} />)}
    </>
  )
}
