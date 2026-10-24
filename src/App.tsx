import { Component, lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { worldCatalog } from './world/catalog'
import type { WalkActions, WalkStatus } from './controls/WalkSession'
import { WorldPicker } from './components/WorldPicker'
import type { WorldDefinition } from './world/schema'

const initialWorld = worldCatalog[0].world
const GardenCanvas = lazy(() => import('./scene/GardenCanvas'))

class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onFailure() }
  render() { return this.state.failed ? null : this.props.children }
}

export default function App() {
  const [world, setWorld] = useState(initialWorld)
  const [status, setStatus] = useState<WalkStatus>({ phase: 'overview', error: null })
  const [sceneState, setSceneState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [touchOnly, setTouchOnly] = useState(() => window.matchMedia('(hover: none) and (pointer: coarse)').matches)
  const ready = sceneState === 'ready'
  const actions = useRef<WalkActions>(null)
  const enterButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const focusOnReturn = useRef(false)
  const walking = status.phase === 'walking'
  const worldDetails = useMemo(() => worldCatalog.find((entry) => entry.world === world ||
    JSON.stringify(entry.world) === JSON.stringify(world)), [world])
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
  const selectWorld = (next: WorldDefinition) => {
    // Called only after the loader accepts the complete replacement.
    actions.current?.exit()
    setStatus({ phase: 'overview', error: null })
    setSceneState('loading')
    setWorld(next)
  }
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
        <div className="header-actions">
          <span className="stage">World study</span>
          <WorldPicker currentWorldId={worldDetails?.world.id} disabled={walking || status.phase === 'requesting' || sceneState === 'error'} onSelect={selectWorld} />
        </div>
      </header>
      <section className={`garden${walking ? ' is-walking' : ''}`} id="garden" aria-labelledby="garden-title" style={{ background: world.environment.background }}>
        <div className="scene" role="region" aria-label={`${world.name}. ${walking ? 'First-person view.' : 'World overview.'}`} aria-busy={sceneState === 'loading'}>
          <SceneBoundary onFailure={onFailure}>
            <Suspense fallback={null}>
              <GardenCanvas world={world} actions={actions} onStatus={onStatus} onReady={onReady} onFailure={onFailure} walking={walking} />
            </Suspense>
          </SceneBoundary>
          {sceneState === 'loading' && <div className="scene-notice" role="status"><span className="loading-mark" aria-hidden="true">◌</span><p>Preparing the world…</p></div>}
          {sceneState === 'error' && <div className="scene-notice graphics-message" role="alert">
            <h2>The world couldn’t open</h2>
            <p>Check your connection and that WebGL is enabled, then try again.</p>
            <button type="button" ref={retryButton} onClick={retry}>Try again</button>
          </div>}
          {walking && <div className="crosshair" aria-hidden="true">+</div>}
        </div>
        <div className="intro">
          <p className="eyebrow">{worldDetails?.theme ?? 'A world of your own'}</p>
          <h1 id="garden-title">{world.name}</h1>
          <p>{worldDetails?.description ?? 'A new place to explore at your own pace.'}</p>
        </div>
        <div className="walk-panel" hidden={sceneState === 'error'}>
          <div className="walk-actions">
            {walking ? (
              <button type="button" onClick={() => actions.current?.exit()}>Leave walk</button>
            ) : (
              <button type="button" ref={enterButton} disabled={!ready || !world.walking || touchOnly || status.phase === 'requesting'}
                aria-describedby="walk-instructions" onClick={() => actions.current?.enter()}>
                {!ready ? 'Preparing world…' : touchOnly || !world.walking ? 'World overview' : status.phase === 'requesting' ? 'Capturing mouse…' : 'Enter world'}
              </button>
            )}
            <span className="walk-status" role="status">
              {status.error ?? (walking ? 'Walking · Mouse captured' : status.phase === 'requesting' ? 'Allow mouse capture to begin.' : 'World overview')}
            </span>
          </div>
          <p id="walk-instructions">{!world.walking ? 'This world is an overview. Choose another world to take a walk.' : touchOnly ? 'Enjoy the world overview. Walking needs a keyboard and mouse.' : 'WASD or arrow keys to walk · Mouse to look · Esc or Tab to leave'}</p>
          {!walking && !touchOnly && world.walking && <p className="device-note">Each entry starts at the world’s starting point. Explore at your own pace.</p>}
        </div>
      </section>
      <footer><span>Six places to wander</span><span>Choose a world. Find your own path.</span></footer>
    </main>
  )
}
