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
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 900px)').matches)
  const [pickerOpen, setPickerOpen] = useState(false)
  const ready = sceneState === 'ready'
  const actions = useRef<WalkActions>(null)
  const worldsButton = useRef<HTMLButtonElement>(null)
  const retryButton = useRef<HTMLButtonElement>(null)
  const recoveryButton = useRef<HTMLButtonElement>(null)
  const focusOnReturn = useRef(false)
  const walking = status.phase === 'walking'
  const engaged = walking || status.phase === 'requesting'
  const pickerDisabled = engaged || !ready
  const worldDetails = useMemo(() => worldCatalog.find((entry) => entry.world === world ||
    JSON.stringify(entry.world) === JSON.stringify(world)), [world])
  const closePicker = useCallback(() => setPickerOpen(false), [])
  const onStatus = useCallback((next: WalkStatus) => {
    setStatus(next)
    focusOnReturn.current = next.phase === 'overview'
  }, [])
  const onReady = useCallback((value: boolean) => {
    setSceneState((previous) => previous === 'error' ? previous : value ? 'ready' : 'loading')
  }, [])
  const onFailure = useCallback(() => {
    actions.current?.exit()
    setPickerOpen(false)
    setSceneState('error')
  }, [])
  const retry = () => window.location.reload()
  const selectWorld = (next: WorldDefinition) => {
    if (!ready) return
    // Request capture in the click, before any asynchronous rendering work.
    if (!touchOnly && next.walking) actions.current?.enter(next)
    else {
      actions.current?.exit()
      setStatus({ phase: 'overview', error: null })
    }
    if (next !== world) {
      setSceneState('loading')
      setWorld(next)
    }
  }
  useEffect(() => {
    const touchQuery = window.matchMedia('(hover: none) and (pointer: coarse)')
    const narrowQuery = window.matchMedia('(max-width: 900px)')
    const updateTouch = () => { setTouchOnly(touchQuery.matches); if (touchQuery.matches) actions.current?.exit() }
    const updateNarrow = () => { setNarrow(narrowQuery.matches); setPickerOpen(false) }
    touchQuery.addEventListener('change', updateTouch)
    narrowQuery.addEventListener('change', updateNarrow)
    return () => {
      touchQuery.removeEventListener('change', updateTouch)
      narrowQuery.removeEventListener('change', updateNarrow)
    }
  }, [])
  useLayoutEffect(() => {
    if (sceneState === 'error') retryButton.current?.focus({ preventScroll: true })
  }, [sceneState])
  useLayoutEffect(() => {
    if (status.phase === 'overview' && focusOnReturn.current && ready) {
      if (status.error) recoveryButton.current?.focus({ preventScroll: true })
      else if (narrow) worldsButton.current?.focus({ preventScroll: true })
      else (document.querySelector<HTMLElement>('.world-card[aria-pressed="true"]') ??
        document.querySelector<HTMLElement>('.world-import summary'))?.focus({ preventScroll: true })
      focusOnReturn.current = false
    }
  }, [status, ready, narrow])

  return (
    <main>
      <header className="masthead">
        <a href="#garden" className="wordmark">SecretWorld<span className="brand-dot" aria-hidden="true">.</span></a>
        <div className="header-actions">
          <span className="stage">{engaged ? 'A little further from everywhere' : 'Six places to wander'}</span>
          {narrow && <button type="button" ref={worldsButton} className="worlds-toggle" disabled={pickerDisabled}
            aria-haspopup="dialog" aria-controls="world-picker-mobile" aria-expanded={pickerOpen}
            onClick={() => setPickerOpen(true)}>Worlds</button>}
        </div>
      </header>
      <div className={`workspace${engaged || !ready ? ' sidebar-hidden' : ''}`}>
        <WorldPicker currentWorldId={worldDetails?.world.id} disabled={pickerDisabled} narrow={narrow}
          open={pickerOpen} onClose={closePicker} onSelect={selectWorld} />
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
          {ready && !engaged && !status.error && <p className="overview-hint">{!world.walking ? 'An overview to enjoy at your own pace.' : touchOnly ? 'Enjoy the overview. Walking needs a keyboard and mouse.' : narrow ? 'Open Worlds and choose a thumbnail to step inside.' : 'Choose a thumbnail to step inside.'}</p>}
          {status.phase === 'requesting' && ready && <p className="overview-hint" role="status">Allow mouse capture to begin.</p>}
          {status.error && ready && <div className="entry-recovery" role="alert">
            <p>{status.error}</p>
            {!touchOnly && world.walking && <button ref={recoveryButton} type="button" onClick={() => actions.current?.enter()}>Click to begin</button>}
          </div>}
          {walking && <div className="walk-controls">
            <p>WASD / arrows to walk · Mouse to look · Esc or Tab to leave</p>
          </div>}
        </section>
      </div>
      <footer><span>Small worlds, unhurried moments.</span><span>{walking ? 'Esc to return to your worlds' : 'Choose a world. Find your own path.'}</span></footer>
    </main>
  )
}
