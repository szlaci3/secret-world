import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gardenData from './world/garden.json'
import { parseWorld } from './world/schema'
import type { WalkActions, WalkStatus } from './controls/WalkSession'

const world = parseWorld(gardenData)
const GardenCanvas = lazy(() => import('./scene/GardenCanvas'))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function App() {
  const [status, setStatus] = useState<WalkStatus>({ phase: 'overview', error: null })
  const [sceneState, setSceneState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [touchOnly, setTouchOnly] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  const ready = sceneState === 'ready'
  const actions = useRef<WalkActions>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const focusOnReturn = useRef(false)
  const walking = status.phase === 'walking'
  const onStatus = useCallback((next: WalkStatus) => {
    setStatus(next)
    focusOnReturn.current = next.phase === 'overview'
  }, [])
  const onReady = useCallback((value: boolean) => {
    setSceneState((previous) => previous === 'error' ? previous : value ? 'ready' : 'loading')
  }, [])
  const onFailure = useCallback(() => {
    actions.current?.exit()
    setSceneState('error')
  }, [])
  // A reload also clears the browser's cached failure for a rejected module URL.
  const retry = () => window.location.reload()
  useEffect(() => {
    const query = window.matchMedia('(hover: none) and (pointer: coarse)')
    const update = () => setTouchOnly(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useLayoutEffect(() => {
    if (sceneState === 'error') retryButton.current?.focus({ preventScroll: true })
  }, [sceneState])
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
        <div className="scene" role="region" aria-label={`A Japanese garden with a winding stone path, still pond, rocks, pine and maple trees, stone lanterns, and a torii entrance. ${walking ? 'First-person view.' : 'Garden overview.'}`} aria-busy={sceneState === 'loading'}>
          <SceneBoundary onFailure={onFailure}>
            <Suspense fallback={null}>
              <GardenCanvas world={world} actions={actions} onStatus={onStatus} onReady={onReady} onFailure={onFailure} walking={walking} />
            </Suspense>
          </SceneBoundary>
          {sceneState === 'loading' && <div className="scene-notice" role="status"><span className="loading-mark" aria-hidden="true">◌</span><p>Preparing the garden…</p></div>}
          {sceneState === 'error' && <div className="scene-notice graphics-message" role="alert">
            <h2>The garden couldn’t open</h2>
            <p>Check your connection and that WebGL is enabled, then try again.</p>
            <button type="button" ref={retryButton} onClick={retry}>Try again</button>
          </div>}
          {walking && <div className="crosshair" aria-hidden="true">+</div>}
        </div>
        <div className="intro">
          <p className="eyebrow">A space to slow down</p>
          <h1 id="garden-title">{world.name}</h1>
          <p>Stone, water, and a little room to breathe.</p>
        </div>
        <div className="walk-panel" hidden={sceneState === 'error'}>
          <div className="walk-actions">
            {walking ? (
              <button type="button" onClick={() => actions.current?.exit()}>Leave walk</button>
            ) : (
              <button type="button" ref={enterButton} disabled={!ready || !world.walking || touchOnly || status.phase === 'requesting'}
                aria-describedby="walk-instructions" onClick={() => actions.current?.enter()}>
                {!ready ? 'Preparing garden…' : touchOnly ? 'Garden overview' : status.phase === 'requesting' ? 'Capturing mouse…' : 'Enter garden'}
              </button>
            )}
            <span className="walk-status" role="status">
              {status.error ?? (walking ? 'Walking · Mouse captured' : status.phase === 'requesting' ? 'Allow mouse capture to begin.' : 'Garden overview')}
            </span>
          </div>
          <p id="walk-instructions">{touchOnly ? 'Enjoy the garden overview. Walking needs a keyboard and mouse.' : 'WASD or arrow keys to walk · Mouse to look · Esc or Tab to leave'}</p>
          {!walking && !touchOnly && <p className="device-note">Each entry starts at the gate. Explore at your own pace.</p>}
        </div>
      </section>
      <footer><span>05 / Light through the leaves</span><span>Follow the stones, or explore the grass. Stay a while.</span></footer>
    </main>
  )
}
