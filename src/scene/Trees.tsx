import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BufferGeometry, Color, ConeGeometry, CylinderGeometry, Float32BufferAttribute, IcosahedronGeometry, InstancedMesh, Object3D } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import type { WorldObject } from '../world/schema'

type Tree = Extract<WorldObject, { type: 'tree' }>

// The same primitive shapes as the original trees, merged into one geometry per
// species/palette. A distant grove now shares one draw instead of dozens.
export function treeGeometry(tree: Tree, lowDetail = false) {
  const parts: BufferGeometry[] = []
  const add = (geometry: BufferGeometry, color: string, position: number[], scale = [1, 1, 1], tilt = 0, yaw = 0) => {
    const part = geometry.toNonIndexed()
    geometry.dispose()
    part.scale(scale[0], scale[1], scale[2]).rotateZ(tilt).translate(position[0], position[1], position[2]).rotateY(yaw)
    const c = new Color(color), colors = []
    for (let i = 0; i < part.getAttribute('position').count; i++) colors.push(c.r, c.g, c.b)
    part.setAttribute('color', new Float32BufferAttribute(colors, 3))
    parts.push(part)
  }
  if (tree.variety === 'spruce') {
    add(new CylinderGeometry(0.1, 0.22, 3, 6), tree.trunkColor, [0, 1.5, 0])
    for (let tier = 0; tier < 3; tier++) add(new ConeGeometry(1.25 - tier * 0.28, 1.9, 7), tree.foliageColor, [0, 1.5 + tier * 0.8, 0])
  } else if (tree.variety === 'palm') {
    add(new CylinderGeometry(0.1, 0.22, 3.3, 7), tree.trunkColor, [0, 1.65, 0], [1, 1, 1], 0.12)
    for (let leaf = 0; leaf < 6; leaf++) add(new IcosahedronGeometry(1, 0), tree.foliageColor, [0.6, 3.2, 0], [1.25, 0.12, 0.35], -0.25, leaf * Math.PI / 3)
  } else {
    add(new CylinderGeometry(0.09, 0.2, 2.7, 7), tree.trunkColor, [0.1, 1.35, 0], [1, 1, 1], -0.1)
    add(new CylinderGeometry(0.045, 0.09, 1.3, 6), tree.trunkColor, [-0.35, 1.9, 0], [1, 1, 1], 0.8)
    const crowns = tree.variety === 'pine'
      ? [[-0.65, 2.05, 0, 1.05, 0.38], [0.6, 2.65, 0.12, 1.1, 0.4], [-0.1, 3.25, 0, 0.9, 0.42]]
      : [[-0.85, 2.45, 0.1, 1.2, 0.8], [0.8, 2.55, 0, 1.25, 0.85], [0, 3.1, -0.25, 1.3, 0.8], [0.05, 2.35, 0.8, 1, 0.6]]
    for (const [x, y, z, width, height] of crowns) add(new IcosahedronGeometry(1, lowDetail ? 0 : 1), tree.foliageColor, [x, y, z], [width, height, width * 0.85])
  }
  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  geometry.computeBoundingSphere()
  return geometry
}

function TreeBatch({ trees, lowDetail }: { trees: Tree[]; lowDetail: boolean }) {
  const mesh = useRef<InstancedMesh>(null)
  const geometry = useMemo(() => treeGeometry(trees[0], lowDetail), [trees, lowDetail])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const transform = new Object3D()
    trees.forEach((tree, index) => {
      transform.position.set(...tree.position)
      transform.rotation.set(0, tree.rotation, 0)
      transform.scale.set(...tree.scale)
      transform.updateMatrix()
      mesh.current!.setMatrixAt(index, transform.matrix)
    })
    mesh.current!.instanceMatrix.needsUpdate = true
    mesh.current!.computeBoundingSphere()
  }, [trees])
  return <instancedMesh ref={mesh} args={[geometry, undefined, trees.length]} castShadow>
    <meshStandardMaterial vertexColors roughness={1} flatShading />
  </instancedMesh>
}

export function Trees({ objects, lowDetail }: { objects: WorldObject[]; lowDetail: boolean }) {
  const batches = useMemo(() => {
    const groups = new Map<string, Tree[]>()
    for (const object of objects) if (object.type === 'tree') {
      const key = `${object.variety}/${object.foliageColor}/${object.trunkColor}`
      const group = groups.get(key) ?? []
      group.push(object)
      groups.set(key, group)
    }
    return [...groups]
  }, [objects])
  return batches.map(([key, trees]) => <TreeBatch key={key} trees={trees} lowDetail={lowDetail} />)
}
