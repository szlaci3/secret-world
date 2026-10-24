import { useMemo } from 'react'
import { hillHeight, terrainHeight, terrainSegments } from '../world/terrain'
import type { WorldDefinition, WorldObject } from '../world/schema'

export function Terrain({ ground }: { ground: WorldDefinition['ground'] }) {
  const { positions, indices } = useMemo(() => {
    const [nx, nz] = terrainSegments(ground)
    const vertices: number[] = [], indices: number[] = []
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
      const px = (x / nx - 0.5) * ground.size[0], pz = (z / nz - 0.5) * ground.size[1]
      vertices.push(px, hillHeight(ground, px, pz), pz)
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const a = z * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1
      indices.push(a, d, b, a, c, d)
    }
    return { positions: new Float32Array(vertices), indices }
  }, [ground])
  return <mesh receiveShadow>
    <bufferGeometry key={JSON.stringify(ground)} onUpdate={(geometry) => geometry.computeVertexNormals()}>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      <bufferAttribute attach="index" args={[new Uint32Array(indices), 1]} />
    </bufferGeometry>
    <meshStandardMaterial color={ground.color} roughness={1} />
  </mesh>
}

export function GroundPatch({ ground, object }: { ground: WorldDefinition['ground']; object: Extract<WorldObject, { type: 'patch' }> }) {
  const positions = useMemo(() => {
    const vertices: number[] = []
    const point = (radius: number, angle: number) => {
      const lx = Math.cos(angle) * radius * object.radii[0] * object.scale[0]
      const lz = Math.sin(angle) * radius * object.radii[1] * object.scale[2]
      const x = object.position[0] + lx * Math.cos(object.rotation) + lz * Math.sin(object.rotation)
      const z = object.position[2] - lx * Math.sin(object.rotation) + lz * Math.cos(object.rotation)
      return [x, terrainHeight(ground, x, z) + object.position[1] + 0.025, z]
    }
    for (let ring = 0; ring < 4; ring++) for (let sector = 0; sector < 32; sector++) {
      const a = sector * Math.PI / 16, b = (sector + 1) * Math.PI / 16
      vertices.push(...point(ring / 4, a), ...point((ring + 1) / 4, b), ...point((ring + 1) / 4, a))
      vertices.push(...point(ring / 4, a), ...point(ring / 4, b), ...point((ring + 1) / 4, b))
    }
    return new Float32Array(vertices)
  }, [ground, object])
  return <mesh receiveShadow>
    <bufferGeometry onUpdate={(geometry) => geometry.computeVertexNormals()}>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <meshStandardMaterial color={object.color} roughness={1} polygonOffset polygonOffsetFactor={-2} />
  </mesh>
}
