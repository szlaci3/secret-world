import { useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { worldCatalog } from '../world/catalog'
import { loadWorldJson, MAX_WORLD_BYTES } from '../world/load-world'
import type { WorldDefinition } from '../world/schema'
import { useWorldCreator } from './CreateWorld'

export function WorldPicker({ disabled, currentWorldId, onSelect, narrow, open, onClose }: {
  disabled: boolean
  currentWorldId?: string
  onSelect: (world: WorldDefinition) => void
  narrow: boolean
  open: boolean
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const readSequence = useRef(0)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const reject = (message: string) => setError(`${message}\nThe current world is unchanged.`)

  useLayoutEffect(() => {
    if (narrow && open && !disabled) dialog.current?.showModal()
    else dialog.current?.close()
  }, [narrow, open, disabled])
  useLayoutEffect(() => {
    if (disabled || (narrow && !open)) {
      readSequence.current++
      setReading(false)
    }
  }, [disabled, narrow, open])

  const choose = (world: WorldDefinition) => {
    if (disabled || reading) return
    // Close before requesting pointer lock; both remain within this user gesture.
    dialog.current?.close()
    onClose()
    onSelect(world)
    setError(null)
  }
  const load = (text: string) => {
    if (disabled || reading) return
    const result = loadWorldJson(text)
    if (!result.ok) { reject(result.message); return }
    choose(result.world)
  }
  const creator = useWorldCreator({ disabled: disabled || reading, onSelect: choose })
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    const sequence = ++readSequence.current
    setReading(false)
    setError(null)
    setDraft('')
    if (file.size > MAX_WORLD_BYTES) { reject('World JSON must be no larger than 1 MiB.'); return }
    setReading(true)
    try {
      const text = await file.text()
      if (sequence === readSequence.current) setDraft(text)
    } catch {
      if (sequence === readSequence.current) reject('Couldn’t read that file. Try another JSON file.')
    } finally {
      if (sequence === readSequence.current) setReading(false)
    }
  }

  const contents = <>
    <div className="picker-heading">
      <div><p className="eyebrow">Find your own path</p><h2 id="world-picker-title">Choose a world</h2></div>
      {narrow && <button type="button" className="quiet-button" onClick={() => dialog.current?.close()}>Close</button>}
    </div>
    <p className="picker-note">Explore compact gardens and wide landscapes. Sizes are shown below.</p>
    {creator}
    <div className="world-examples" aria-label="Worlds">
      {worldCatalog.map(({ world, theme, description }, index) => (
        <button className="world-card" type="button" key={world.id} disabled={disabled || reading}
          aria-label={world.name} aria-describedby={`world-description-${world.id}`} aria-pressed={currentWorldId === world.id}
          onClick={() => choose(world)}>
          <span className="world-image">
            <img src={`/worlds/${world.id}.jpg`} alt="" width="480" height="300" loading={index < 2 ? 'eager' : 'lazy'} />
            <span className="world-description" id={`world-description-${world.id}`}>{description}</span>
            {currentWorldId === world.id && <span className="world-current">Selected</span>}
          </span>
          <span className="world-caption"><span><span className="world-theme">{theme}</span><strong>{world.name}</strong></span><span className="world-arrow" aria-hidden="true">↗</span></span>
        </button>
      ))}
    </div>
    <details className="world-import" onToggle={(event) => {
      if (!event.currentTarget.open) return
      const sidebar = event.currentTarget.closest('.world-sidebar')
      sidebar?.scrollTo({ top: sidebar.scrollHeight, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
    }}>
      <summary>Open your own world JSON</summary>
      <form onSubmit={(event) => { event.preventDefault(); load(draft) }}>
        <label className="file-label">Open JSON file
          <input type="file" accept=".json,application/json" disabled={disabled || reading} onChange={chooseFile} />
        </label>
        <label htmlFor="world-json">World JSON</label>
        <textarea id="world-json" value={draft} onChange={(event) => setDraft(event.target.value)}
          disabled={disabled || reading} rows={8} maxLength={MAX_WORLD_BYTES} spellCheck={false} autoCapitalize="off"
          placeholder="Choose a JSON file, or paste a world here." aria-describedby="world-import-note" />
        <p id="world-import-note" className="import-note">Up to 1 MiB. Imports last until reload. Invalid input keeps your current world.</p>
        {reading && <p role="status">Reading world file…</p>}
        {error && <p className="import-error" role="alert">{error}</p>}
        <button className="load-world" type="submit" disabled={disabled || reading || !draft.trim()}>Load world</button>
      </form>
    </details>
  </>

  return narrow ? (
    <dialog id="world-picker-mobile" className="world-sidebar world-drawer" ref={dialog} aria-labelledby="world-picker-title"
      onClose={onClose} onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const bounds = event.currentTarget.getBoundingClientRect()
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.current?.close()
      }}>
      {contents}
    </dialog>
  ) : <aside className="world-sidebar" aria-labelledby="world-picker-title" hidden={disabled}>{contents}</aside>
}
