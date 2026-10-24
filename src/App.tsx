import { Canvas } from '@react-three/fiber'
import { Component } from 'react'
import type { ReactNode } from 'react'
import { WorldScene } from './scene/WorldScene'
import gardenData from './world/garden.json'
import { parseWorld } from './world/schema'

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
  return (
    <main>
      <header className="masthead">
        <a href="#garden" className="wordmark">SecretWorld<span className="brand-dot" aria-hidden="true">.</span></a>
        <span className="stage">World study / 001</span>
      </header>
      <section className="garden" id="garden" aria-labelledby="garden-title">
        <div className="scene" role="img" aria-label="A stationary 3D preview of the garden’s square ground plane in soft daylight.">
          <SceneBoundary>
            <Canvas camera={world.camera} dpr={[1, 1.5]} frameloop="demand" fallback={<GraphicsFallback />}>
              <WorldScene world={world} />
            </Canvas>
          </SceneBoundary>
        </div>
        <div className="intro">
          <p className="eyebrow">A space to slow down</p>
          <h1 id="garden-title">{world.name}</h1>
          <p>A Japanese garden, taking shape.</p>
        </div>
        <div className="preview-note"><span aria-hidden="true">◌</span> Foundation preview · Stationary view</div>
      </section>
      <footer><span>01 / The ground beneath</span><span>Garden details and walking arrive in later tasks.</span></footer>
    </main>
  )
}
