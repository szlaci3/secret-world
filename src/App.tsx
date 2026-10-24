import { Canvas } from '@react-three/fiber'
import { Component, useCallback, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { WorldScene } from './scene/WorldScene'
import gardenData from './world/garden.json'
import { parseWorld } from './world/schema'
import { WalkingControls } from './controls/WalkingControls'
import type { WalkActions, WalkStatus } from './controls/WalkSession'

const world = parseWorld(gardenData)

function GraphicsFallback() {
  return <p className="graphics-message">The 3D preview could not start. Try a browser with WebGL enabled.</p>
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <GraphicsFallback /> : this.props.children }
}

export default function App() {
  const [status, setStatus] = useState<WalkStatus>({ phase: 'overview', error: null })
  const [ready, setReady] = useState(false)
  const actions = useRef<WalkActions>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const focusOnReturn = useRef(false)
  const walking = status.phase === 'walking'
  const onStatus = useCallback((next: WalkStatus) => {
    setStatus(next)
    focusOnReturn.current = next.phase === 'overview'
  }, [])
  useLayoutEffect(() => {
    if (status.phase === 'overview' && focusOnReturn.current) {
      enterButton.current?.focus({ preventScroll: true })
      focusOnReturn.current = false
    }
  }, [status])

  return (
    <main>
      <header className="masthead">
        <a href="#garden" className="wordmark">SecretWorld<span className="brand-dot" aria-hidden="true">.</span></a>
        <span className="stage">World study / 001</span>
      </header>
      <section className={`garden${walking ? ' is-walking' : ''}`} id="garden" aria-labelledby="garden-title">
        <div className="scene" role="img" aria-label={`A Japanese garden with a winding stone path, still pond, rocks, pine and maple trees, stone lanterns, and a torii entrance. ${walking ? 'First-person view.' : 'Garden overview.'}`}>
          <SceneBoundary>
            <Canvas camera={world.camera} dpr={[1, 1.5]} frameloop="demand" fallback={<GraphicsFallback />}>
              <WorldScene world={world} />
              <WalkingControls world={world} ref={actions} onStatus={onStatus} onReady={setReady} />
            </Canvas>
          </SceneBoundary>
        </div>
        <div className="intro">
          <p className="eyebrow">A space to slow down</p>
          <h1 id="garden-title">{world.name}</h1>
          <p>A Japanese garden, taking shape.</p>
        </div>
        {walking && <div className="crosshair" aria-hidden="true">+</div>}
        <div className="walk-panel">
          <div className="walk-actions">
            {walking ? (
              <button type="button" onClick={() => actions.current?.exit()}>Leave walk</button>
            ) : (
              <button type="button" ref={enterButton} disabled={!ready || !world.walking || status.phase === 'requesting'}
                aria-describedby="walk-instructions" onClick={() => actions.current?.enter()}>
                {!ready ? 'Preparing garden…' : status.phase === 'requesting' ? 'Capturing mouse…' : 'Enter garden'}
              </button>
            )}
            <span className="walk-status" role="status">
              {status.error ?? (walking ? 'Walking · Mouse captured' : status.phase === 'requesting' ? 'Allow mouse capture to begin.' : 'Garden overview')}
            </span>
          </div>
          <p id="walk-instructions">WASD or arrow keys to walk · Mouse to look · Esc or Tab to leave</p>
          {!walking && <p className="device-note">Walking needs a keyboard and mouse. Each entry starts at the gate.</p>}
        </div>
      </section>
      <footer><span>03 / A walk through the garden</span><span>Movement preview · Props and garden edges do not block walking yet.</span></footer>
    </main>
  )
}
