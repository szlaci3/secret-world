import type { WorldDefinition } from '../world/schema'
import { GardenObject } from './GardenObject'
import { InstancedPaths } from './InstancedPaths'
import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo } from 'react'
import { terrainHeight } from '../world/terrain'
import { Terrain, GroundPatch } from './Terrain'
import { Plants } from './Plants'
import { Trees } from './Trees'
import { Rocks } from './Rocks'
import { Icons } from './Icons'
import { pavementClearPlants } from './vegetation-clearance'
import type { IconGround } from '../world/icon-types'

export function WorldScene({ world, walking, lowDetail, iconGround = 'meadow' }: { world: WorldDefinition; walking: boolean; lowDetail: boolean; iconGround?: IconGround }) {
  const { ground, environment } = world
  const { gl, invalidate, size, camera } = useThree()
  const small = size.width < 600
  const plain = world.style === 'icons' && iconGround === 'plain'
  const extent = Math.hypot(...ground.size) * 0.6
  const limitedView = lowDetail && walking && world.style === 'icons' && world.objects.filter(object => object.type === 'icon').length > 24
  const fog = limitedView ? { color: environment.fog?.color ?? environment.background,
    near: Math.min(environment.fog?.near ?? 24, 24), far: Math.min(environment.fog?.far ?? 48, 48) } : environment.fog
  useLayoutEffect(() => {
    if (!limitedView) return
    const previous = camera.far
    camera.far = 48
    camera.updateProjectionMatrix()
    invalidate()
    return () => { camera.far = previous; camera.updateProjectionMatrix(); invalidate() }
  }, [camera, limitedView, invalidate])
  // Overview starts well outside the world. Preserve local atmospheric depth
  // without obscuring the entire diorama from its distant overview camera.
  const fogOffset = walking ? 0 : Math.max(0, Math.hypot(...world.camera.position.map((value, axis) => value - world.camera.target[axis])) - 12)
  const objects = useMemo(() => world.objects.map((object) => ({ ...object,
    position: [object.position[0], object.position[1] + terrainHeight(ground, object.position[0], object.position[2]), object.position[2]] as [number, number, number],
  })), [world, ground])
  const plants = useMemo(() => plain ? [] : pavementClearPlants(objects, ground), [objects, ground, plain])
  useLayoutEffect(() => {
    // World geometry and light are static. Camera movement reuses the shadow map.
    gl.shadowMap.autoUpdate = false
    gl.shadowMap.needsUpdate = true
    invalidate()
    return () => { gl.shadowMap.autoUpdate = true }
  }, [world, gl, invalidate, small, lowDetail, plain])
  return (
    <>
      <color attach="background" args={[environment.background]} />
      {fog && <fog attach="fog" args={[fog.color, fog.near + fogOffset, fog.far + fogOffset]} />}
      <ambientLight intensity={environment.ambientIntensity} />
      {environment.skyLight && <hemisphereLight args={[environment.skyLight.skyColor, environment.skyLight.groundColor, environment.skyLight.intensity]} />}
      <directionalLight {...environment.sunlight} castShadow={!lowDetail}
        shadow-mapSize={[small ? 512 : 2048, small ? 512 : 2048]}
        shadow-normalBias={0.025} shadow-bias={-0.00015}>
        <orthographicCamera attach="shadow-camera" args={[-extent, extent, extent, -extent, 0.5, Math.max(120, Math.hypot(...environment.sunlight.position) + extent * 2)]} />
      </directionalLight>
      {plain ? <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={ground.size} />
        <meshStandardMaterial color={ground.color} roughness={1} />
      </mesh> : <Terrain ground={ground} objects={world.objects} lowDetail={lowDetail} />}
      <InstancedPaths objects={objects} ground={ground} lowDetail={lowDetail} />
      <Plants objects={plants} lowDetail={lowDetail} />
      <Trees objects={objects} lowDetail={lowDetail} />
      <Rocks objects={objects} lowDetail={lowDetail} />
      <Icons objects={objects} />
      {!plain && world.objects.filter((object) => object.type === 'patch').map((object) => <GroundPatch key={object.id} object={object} ground={ground} />)}
      {objects.filter((object) => !['icon', 'path', 'plant', 'patch', 'tree', 'rock'].includes(object.type)).map((object) => <GardenObject key={object.id} object={object} lowDetail={lowDetail} />)}
    </>
  )
}
