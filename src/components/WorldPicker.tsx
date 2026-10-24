import { useLayoutEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import garden from '../world/garden.json'
import courtyard from '../world/maple-courtyard.json'
import { loadWorldJson, MAX_WORLD_BYTES } from '../world/load-world'
import type { WorldDefinition } from '../world/schema'

export function WorldPicker({ disabled, onSelect }: { disabled: boolean; onSelect: (world: WorldDefinition) => void }) {
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
        <p>Visit an example garden, or open your own world.</p>
        <div className="world-examples" aria-label="Example worlds">
          <button type="button" disabled={disabled || reading} onClick={() => load(JSON.stringify(garden))}>The Quiet Garden</button>
          <button type="button" disabled={disabled || reading} onClick={() => load(JSON.stringify(courtyard))}>Maple Courtyard</button>
        </div>
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
      </dialog>
    </>
  )
}
