import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Color, DoubleSide, InstancedMesh, Object3D, Vector3 } from 'three'
import type { WorldObject } from '../world/schema'
import { branchGeometry, geometryBuilder, leafGeometry, randomSource, seedFor } from './natural-geometry'

type Tree = Extract<WorldObject, { type: 'tree' }>

export function treeGeometry(tree: Tree, lowDetail = false, variant = 0) {
  const random = randomSource(731 + variant * 137), builder = geometryBuilder()
  const palm = tree.variety === 'palm', spruce = tree.variety === 'spruce', pine = tree.variety === 'pine'
  const trunk = [new Vector3(0, 0, 0), new Vector3(0.06, 1.15, -0.03), new Vector3(-0.12, 2.3, 0.08), new Vector3(0.1, 3.6, 0)]
  for (let i = 0; i < 3; i++) {
    // Angled ends cannot meet flush at a bend. Extend both ends inside
    // adjacent sections; at the base this also hides the cut below ground.
    const direction = trunk[i + 1].clone().sub(trunk[i]).normalize()
    const start = trunk[i].clone().addScaledVector(direction, i === 0 ? -0.009 : -0.0228)
    const end = trunk[i + 1].clone().addScaledVector(direction, 0.0228)
    builder.add(branchGeometry(start, end, 0.19 - i * 0.05, 0.14 - i * 0.055), tree.trunkColor, 0.85 + i * 0.05)
  }
  const fullBranches = palm ? 9 : spruce ? 18 : 10
  const branches = lowDetail ? Math.ceil(fullBranches * 0.6) : fullBranches
  for (let i = 0; i < branches; i++) {
    const a = i * 2.399 + random() * 0.4
    const y = palm ? 3.25 : spruce ? 0.9 + i * fullBranches / branches * 0.14 : 1.4 + i * fullBranches / branches * 0.17
    const reach = palm ? 1.7 : spruce ? (3.8 - y) * 0.48 : 0.85 + random() * 0.65
    const start = new Vector3(0, y, 0), end = new Vector3(Math.cos(a) * reach, y + (palm ? 0.25 : 0.55), Math.sin(a) * reach)
    builder.add(branchGeometry(start, end, 0.065, 0.018), tree.trunkColor)
    const twigs = lowDetail ? 1 : 5
    for (let j = 0; j < twigs; j++) {
      const t = lowDetail ? 0.8 : 0.35 + j / twigs * 0.65
      const base = start.clone().lerp(end, t)
      const tip = base.clone().add(new Vector3(Math.cos(a + j) * 0.45, palm ? -0.35 : 0.25 + random() * 0.35, Math.sin(a + j) * 0.45))
      if (!lowDetail) builder.add(branchGeometry(base, tip, 0.025, 0.006), tree.trunkColor)
      const leaves = lowDetail ? 7 : 23
      for (let k = 0; k < leaves; k++) {
        const p = base.clone().lerp(tip, random())
        const spread = spruce || palm ? 0.22 : 0.42
        p.add(new Vector3((random() - 0.5) * spread * 2, (random() - 0.3) * spread, (random() - 0.5) * spread * 2))
        const length = palm ? 0.65 : spruce || pine ? 0.3 : 0.22 + random() * 0.19
        const leaf = leafGeometry(length * (lowDetail ? 1.8 : 1), palm ? 0.045 : spruce || pine ? 0.045 : length * 0.38, palm ? 0.18 : 0.09, lowDetail ? 2 : 3)
        leaf.rotateX(random() * 2.7).rotateZ(random() * 2.5 - 1.25).rotateY(random() * Math.PI * 2).translate(...p.toArray())
        builder.add(leaf, tree.foliageColor, 0.65 + random() * 0.65)
      }
    }
  }
  return builder.finish()
}

function TreeBatch({ trees, lowDetail, variant }: { trees: Tree[]; lowDetail: boolean; variant: number }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => treeGeometry(trees[0], lowDetail, variant), [trees, lowDetail, variant])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const transform = new Object3D()
    trees.forEach((tree, index) => {
      transform.position.set(...tree.position); transform.rotation.set(0, tree.rotation, 0); transform.scale.set(...tree.scale); transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
      mesh.current!.setColorAt(index, new Color().setScalar(0.9 + (seedFor(tree.id) % 100) / 500))
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [trees])
  return <instancedMesh ref={mesh} args={[geometry, undefined, trees.length]} castShadow receiveShadow>
    <meshStandardMaterial vertexColors roughness={0.9} side={DoubleSide} />
  </instancedMesh>
}
export function Trees({ objects, lowDetail }: { objects: WorldObject[]; lowDetail: boolean }) {
  const batches = useMemo(() => {
    const groups = new Map<string, Tree[]>()
    for (const object of objects) if (object.type === 'tree') {
      const key = `${object.variety}/${object.foliageColor}/${object.trunkColor}/${seedFor(object.id) % 3}`
      const group = groups.get(key) ?? []; group.push(object); groups.set(key, group)
    }
    return [...groups]
  }, [objects])
  return batches.map(([key, trees]) => <TreeBatch key={key} trees={trees} lowDetail={lowDetail} variant={seedFor(trees[0].id) % 3} />)
}
