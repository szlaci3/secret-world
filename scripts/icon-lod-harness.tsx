// Test-only scene instrumentation, served by inspect-icon-lod.mjs, never bundled
// into the product. It observes the actual renderer and production components.
import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { WorldScene } from '../src/scene/WorldScene'
import { preloadIcons } from '../src/scene/icon-sources'
import { retainIconGeometries } from '../src/scene/icon-geometry'
import fixture from '../src/world/icon-world.json'

const names = ['settings', 'clock', 'paperclip', 'fish', 'butterfly', 'vinyl', 'circle', 'building-cottage']
await preloadIcons(names)
retainIconGeometries(names)
const icon = fixture.objects.find(object => object.type === 'icon')!
const grass = fixture.objects.find(object => object.type === 'plant')!
const crowd = { ...fixture, ground: { ...fixture.ground, size: [128, 128] }, objects: [
  ...Array.from({ length: 96 }, (_, index) => ({ ...icon, id: `test-icon-${index}`, icon: names[index % names.length],
    position: [(index % 12 - 5.5) * 8, 0, (Math.floor(index / 12) - 3.5) * 8], scale: [1, 1, 1], rotation: 0 })),
  ...Array.from({ length: 96 }, (_, index) => ({ ...grass, id: `test-grass-${index}`,
    position: [(index % 12 - 5.5) * 8 + 3, 0, (Math.floor(index / 12) - 3.5) * 8 + 3], scale: [0.4, 0.4, 0.4] })),
] }
const solo = { ...fixture, ground: { ...fixture.ground, size: [128, 128] }, objects: [{ ...icon, icon: 'circle', position: [0, 0, 0], scale: [1, 1, 1], rotation: 0 }] }
let looping = false, loopStart = 0
function Probe() {
  const { camera, gl, scene, invalidate } = useThree()
  useEffect(() => {
    window.lodTest.camera = z => { camera.position.set(0, 1.65, z); camera.rotation.set(0, 0, 0); invalidate() }
    window.lodTest.read = () => {
      const meshes = []
      scene.traverse(object => {
        if (object.name.startsWith('icon-lod-') && object.visible && object.count) meshes.push({ name: object.name, count: object.count, vertices: object.geometry.attributes.position.count })
      })
      return { meshes, calls: gl.info.render.calls, triangles: gl.info.render.triangles, shadowsEnabled: gl.shadowMap.enabled, pixels: [gl.domElement.width, gl.domElement.height] }
    }
    window.lodTest.loop = enabled => { looping = enabled; loopStart = performance.now(); invalidate() }
    window.lodTest.ready = true
  }, [camera, gl, scene, invalidate])
  useFrame(() => {
    if (!looping) return
    camera.position.set(0, 1.65, 38 - Math.sin((performance.now() - loopStart) / 2000) * 4)
    camera.rotation.set(0, 0, 0)
    invalidate()
  }, -1) // Move before production LOD selection.
  return null
}
function Harness() {
  const [state, setState] = useState({ crowd: false, plain: false, reduced: false })
  useEffect(() => { window.lodTest.configure = changes => { setState(current => ({ ...current, ...changes })) } }, [])
  return <Canvas camera={{ position: [0, 1.65, 60], fov: 65 }} dpr={state.reduced ? 0.85 : 1} shadows={state.reduced ? false : 'soft'} frameloop="demand">
    <WorldScene world={state.crowd ? crowd : solo} walking lowDetail={state.reduced} iconGround={state.plain ? 'plain' : 'meadow'} />
    <Probe />
  </Canvas>
}
window.lodTest = {}
createRoot(document.getElementById('root')!).render(<Harness />)
