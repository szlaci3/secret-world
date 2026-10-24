import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'
import type { WorldDefinition } from '../world/schema'

function CameraTarget({ target }: { target: WorldDefinition['camera']['target'] }) {
  const camera = useThree((state) => state.camera)
  useLayoutEffect(() => {
    camera.lookAt(...target)
    camera.updateMatrixWorld()
  }, [camera, target])
  return null
}

export function WorldScene({ world }: { world: WorldDefinition }) {
  const { ground, environment } = world
  return (
    <>
      <CameraTarget target={world.camera.target} />
      <color attach="background" args={[environment.background]} />
      <ambientLight intensity={environment.ambientIntensity} />
      <directionalLight {...environment.sunlight} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={ground.size} />
        <meshStandardMaterial color={ground.color} roughness={1} />
      </mesh>
    </>
  )
}
