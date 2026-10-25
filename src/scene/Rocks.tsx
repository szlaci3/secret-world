import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Object3D } from 'three'
import type { WorldObject } from '../world/schema'
import { seedFor } from './natural-geometry'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { SurfaceMaterial } from './SurfaceMaterial'
type Rock = Extract<WorldObject, { type: 'rock' }>

export function rockGeometry(rock: Rock, variant = 0) {
  const g = new IcosahedronGeometry(1, 3), positions = g.getAttribute('position'), colors: number[] = []
  const stone = new Color(rock.color), moss = new Color(rock.mossColor ?? rock.color)
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
    // Continuous deformation keeps duplicated seam vertices coincident.
    const n = Math.sin(x * 5 + variant) * Math.cos(z * 4 - y * 3) * 0.13 + Math.sin(z * 9 + y * 5) * 0.055
    positions.setXYZ(i, x * (0.65 + n), Math.max(-0.12, y * (0.49 + n) + 0.34), z * (0.57 + n))
    const coverage = rock.mossColor ? Math.max(0, Math.min(1, (y - 0.35 + n * 3) * 2)) : 0
    const c = stone.clone().lerp(moss, coverage).multiplyScalar(0.82 + n + y * 0.12)
    colors.push(c.r, c.g, c.b)
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3))
  g.deleteAttribute('normal'); g.deleteAttribute('uv')
  const smooth = mergeVertices(g); g.dispose()
  smooth.computeVertexNormals(); smooth.computeBoundingSphere()
  return smooth
}
function RockBatch({ rocks, variant, lowDetail }: { rocks: Rock[]; variant: number; lowDetail: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => rockGeometry(rocks[0], variant), [rocks, variant])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const transform = new Object3D()
    rocks.forEach((rock, i) => {
      transform.position.set(...rock.position); transform.rotation.set(0, rock.rotation, 0); transform.scale.set(...rock.scale); transform.updateMatrix()
      mesh.current!.setMatrixAt(i, transform.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true; mesh.current!.computeBoundingSphere()
  }, [rocks])
  return <instancedMesh ref={mesh} args={[geometry, undefined, rocks.length]} castShadow receiveShadow>{lowDetail ? <meshStandardMaterial vertexColors roughness={1} /> : <SurfaceMaterial vertexColors grain={0.16} />}</instancedMesh>
}
export function Rocks({ objects, lowDetail }: { objects: WorldObject[]; lowDetail: boolean }) {
  const batches = useMemo(() => {
    const groups = new Map<string, Rock[]>()
    for (const object of objects) if (object.type === 'rock') {
      const key = `${object.color}/${object.mossColor}/${seedFor(object.id) % 3}`
      const group = groups.get(key) ?? []; group.push(object); groups.set(key, group)
    }
    return [...groups]
  }, [objects])
  return batches.map(([key, rocks]) => <RockBatch key={key} rocks={rocks} lowDetail={lowDetail} variant={seedFor(rocks[0].id) % 3} />)
}
