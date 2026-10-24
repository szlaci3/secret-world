import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { WalkingControls } from '../controls/WalkingControls'
import type { WalkActions, WalkStatus } from '../controls/WalkSession'
import type { WorldDefinition } from '../world/schema'
import { WorldScene } from './WorldScene'

function ContextHealth({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree((state) => state.gl.domElement)
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure() }
    canvas.addEventListener('webglcontextlost', lost)
    return () => canvas.removeEventListener('webglcontextlost', lost)
  }, [canvas, onFailure])
  return null
}

function RenderBudget({ walking, light, onReduce, actions }: {
  walking: boolean; light: boolean; onReduce: () => void; actions: RefObject<WalkActions | null>
}) {
  const sample = useRef({ seconds: 0, frames: 0 })
  useEffect(() => { sample.current = { seconds: 0, frames: 0 } }, [walking])
  useFrame((_, delta) => {
    if (!walking || light) return
    if (!actions.current?.isMoving()) { sample.current = { seconds: 0, frames: 0 }; return }
    // Idle on-demand frames are not evidence of a slow device.
    if (delta > 0.25) { sample.current = { seconds: 0, frames: 0 }; return }
    sample.current.seconds += delta
    sample.current.frames++
    if (sample.current.seconds >= 1.5) {
      if (sample.current.frames / sample.current.seconds < 30) onReduce()
      sample.current = { seconds: 0, frames: 0 }
    }
  })
  return null
}

export default function GardenCanvas({ world, actions, onStatus, onReady, onFailure, walking }: {
  world: WorldDefinition
  actions: RefObject<WalkActions | null>
  onStatus: (status: WalkStatus) => void
  onReady: (ready: boolean) => void
  onFailure: () => void
  walking: boolean
}) {
  const [light, setLight] = useState(false)
  const reduce = useCallback(() => setLight(true), [])
  return (
    <Canvas camera={world.camera} dpr={light ? 0.6 : [1, 1.5]} frameloop="demand" shadows={light ? false : 'basic'}
      gl={{ antialias: true, powerPreference: 'low-power' }}
      fallback={<p className="graphics-message">The world needs a browser with WebGL support.</p>}>
      <WorldScene world={world} walking={walking} lowDetail={light} />
      <WalkingControls world={world} ref={actions} onStatus={onStatus} onReady={onReady} />
      <ContextHealth onFailure={onFailure} />
      <RenderBudget walking={walking} light={light} onReduce={reduce} actions={actions} />
    </Canvas>
  )
}
