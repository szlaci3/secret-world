import { useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { worldCatalog } from '../world/catalog'
import { loadWorldJson, MAX_WORLD_BYTES } from '../world/load-world'
import type { WorldDefinition } from '../world/schema'

export function WorldPicker({ disabled, currentWorldId, onSelect }: { disabled: boolean; currentWorldId?: string; onSelect: (world: WorldDefinition) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const readSequence = useRef(0)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const reject = (message: string) => setError(`${message}\nThe current world is unchanged.`)
  useLayoutEffect(() => {
    if (disabled) dialog.current?.close()
  }, [disabled])

  const load = (text: string) => {
    if (disabled) return
    const result = loadWorldJson(text)
    if (!result.ok) { reject(result.message); return }
    onSelect(result.world)
    setError(null)
    dialog.current?.close()
  }
  const chooseFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setError(null)
    setDraft('')
    if (file.size > MAX_WORLD_BYTES) { reject('World JSON must be no larger than 1 MiB.'); return }
    const sequence = ++readSequence.current
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

  return (
    <>
      <button type="button" className="world-button" disabled={disabled}
        onClick={() => { setError(null); dialog.current?.showModal() }}>Worlds</button>
      <dialog className="world-dialog" ref={dialog} aria-labelledby="world-picker-title"
        onClose={() => { readSequence.current++; setReading(false) }}>
        <div className="dialog-heading">
          <h2 id="world-picker-title">Choose a world</h2>
          <button type="button" className="quiet-button" onClick={() => dialog.current?.close()}>Close</button>
        </div>
        <p>Six places to explore. Choose one, then enter to walk.</p>
        <div className="world-examples" aria-label="Example worlds">
          {worldCatalog.map(({ world, theme, description }) => (
            <button type="button" key={world.id} disabled={disabled || reading}
              aria-label={world.name} aria-pressed={currentWorldId === world.id}
              onClick={() => load(JSON.stringify(world))}>
              <span className="world-swatch" style={{ background: world.ground.color, borderColor: world.environment.background }} aria-hidden="true" />
              <strong>{world.name}</strong><span className="world-theme">{theme}</span><span>{description}</span>
              {currentWorldId === world.id && <span className="world-current">Current world</span>}
            </button>
          ))}
        </div>
        <details className="world-import">
          <summary>Open your own world JSON</summary>
          <form onSubmit={(event) => { event.preventDefault(); load(draft) }}>
            <label className="file-label">Open JSON file
              <input type="file" accept=".json,application/json" disabled={disabled || reading} onChange={chooseFile} />
            </label>
            <label htmlFor="world-json">World JSON</label>
            <textarea id="world-json" value={draft} onChange={(event) => setDraft(event.target.value)}
              disabled={disabled || reading} rows={8} maxLength={MAX_WORLD_BYTES} spellCheck={false} autoCapitalize="off"
              placeholder="Choose a JSON file above, or paste a world here." aria-describedby="world-import-note" />
            <p id="world-import-note" className="import-note">Up to 1 MiB. Loading replaces this view until reload. Invalid input keeps your current world.</p>
            {reading && <p role="status">Reading world file…</p>}
            {error && <p className="import-error" role="alert">{error}</p>}
            <button className="load-world" type="submit" disabled={disabled || reading || !draft.trim()}>Load world</button>
          </form>
        </details>
      </dialog>
    </>
  )
}
