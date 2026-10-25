import { SurfaceMaterial } from './SurfaceMaterial'
import { useEffect, useMemo } from 'react'
import { hillHeight, terrainHeight, terrainSegments } from '../world/terrain'
import type { WorldDefinition, WorldObject } from '../world/schema'
import { groundCoverTexture } from './ground-cover'

export function Terrain({ ground, objects, lowDetail = false }: { ground: WorldDefinition['ground']; objects: WorldObject[]; lowDetail?: boolean }) {
  const cover = useMemo(() => groundCoverTexture(ground.size, objects), [ground, objects])
  useEffect(() => () => cover.dispose(), [cover])
  const { positions, indices, uvs } = useMemo(() => {
    const [nx, nz] = terrainSegments(ground)
    const vertices: number[] = [], indices: number[] = [], uvs: number[] = []
    for (let z = 0; z <= nz; z++) for (let x = 0; x <= nx; x++) {
      const px = (x / nx - 0.5) * ground.size[0], pz = (z / nz - 0.5) * ground.size[1]
      vertices.push(px, hillHeight(ground, px, pz), pz)
      uvs.push(x / nx, z / nz)
    }
    for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
      const a = z * (nx + 1) + x, b = a + 1, c = a + nx + 1, d = c + 1
      indices.push(a, d, b, a, c, d)
    }
    return { positions: new Float32Array(vertices), indices, uvs: new Float32Array(uvs) }
  }, [ground])
  return <mesh receiveShadow>
    <bufferGeometry key={JSON.stringify(ground)} onUpdate={(geometry) => geometry.computeVertexNormals()}>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      <bufferAttribute attach="attributes-uv" args={[uvs, 2]} />
      <bufferAttribute attach="index" args={[new Uint32Array(indices), 1]} />
    </bufferGeometry>
    {lowDetail ? <meshStandardMaterial color={ground.color} map={cover} roughness={1} /> : <SurfaceMaterial color={ground.color} map={cover} grain={0.07} />}
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
