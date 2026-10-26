import { useEffect, useRef, useState } from 'react'
import { loadWorldJson } from '../world/load-world'
import type { WorldDefinition } from '../world/schema'
import { readSavedWorlds, writeSavedWorlds, SAVED_WORLDS_KEY } from '../world/saved-worlds'
import { worldStyleLabels } from '../world/icon-types'
import type { GenerationStyle } from '../world/icon-types'

// State belongs to WorldPicker so switching its sidebar/drawer shell preserves
// in-flight generation, unsaved results, and the user's description.
export function useWorldCreator({ disabled, onSelect, style }: { disabled: boolean; onSelect: (world: WorldDefinition) => void; style: GenerationStyle }) {
  const [prompt, setPrompt] = useState('')
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [result, setResult] = useState<WorldDefinition | null>(null)
  const [worlds, setWorlds] = useState<WorldDefinition[]>([])
  const [storageError, setStorageError] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const active = useRef<AbortController | null>(null)
  const lastRequest = useRef(0)
  const resultHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const refresh = () => {
      try {
        const saved = readSavedWorlds(window.localStorage)
        setWorlds(saved.worlds); setStorageError(saved.error)
      } catch { setStorageError('Browser storage is disabled. You can still generate and explore worlds.') }
    }
    refresh()
    const changed = (event: StorageEvent) => { if (!event.key || event.key === SAVED_WORLDS_KEY) refresh() }
    window.addEventListener('storage', changed)
    return () => { active.current?.abort(); window.removeEventListener('storage', changed) }
  }, [])
  useEffect(() => { if (result && !disabled) resultHeading.current?.focus() }, [result, disabled])

  const generate = async () => {
    if (pending || disabled || active.current) return
    if (Date.now() - lastRequest.current < 10000) { setMessage('Please wait a few seconds before generating another world.'); return }
    const controller = new AbortController()
    active.current = controller
    lastRequest.current = Date.now()
    setPending(true); setMessage(null)
    const timeout = window.setTimeout(() => controller.abort('timeout'), 55000)
    try {
      const response = await fetch('/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), style }), signal: controller.signal })
      if (response.status === 429) throw new Error('Generation is busy or its usage limit was reached. Wait a few minutes before trying again.')
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('World creation is unavailable. Please try again later.')
      const data = await response.json()
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'World creation failed. Please try again later.')
      const parsed = loadWorldJson(JSON.stringify(data.world))
      if (!parsed.ok || !parsed.world.walking) throw new Error('The returned world could not be opened. Please try again.')
      const resolvedStyle = parsed.world.style ?? 'standard'
      if (style === 'auto' ? !parsed.world.style : resolvedStyle !== style) throw new Error('The returned world did not match the selected style. Please try again.')
      if (active.current === controller && !controller.signal.aborted) setResult(parsed.world)
    } catch (error) {
      if (active.current === controller) setMessage(controller.signal.aborted
        ? controller.signal.reason === 'timeout' ? 'Generation took too long. Please try again.' : 'Generation cancelled. You can try another description.'
        : error instanceof Error ? error.message : 'Couldn’t connect. Please try again.')
    } finally {
      window.clearTimeout(timeout)
      if (active.current === controller) { active.current = null; setPending(false) }
    }
  }
  const persist = (change: (current: WorldDefinition[]) => WorldDefinition[]) => {
    try {
      // Re-read before edits so another tab's collection is preserved.
      const current = readSavedWorlds(window.localStorage)
      if (current.error) { setStorageError(`${current.error} Changes were not saved to protect the existing data.`); return }
      const next = change(current.worlds)
      writeSavedWorlds(window.localStorage, next)
      setWorlds(next); setStorageError(null); setDeleteId(null)
    } catch (error) { setStorageError(error instanceof Error ? error.message : 'Couldn’t save changes in this browser.') }
  }
  const saved = result && worlds.some(world => world.id === result.id)

  const content = <section className="create-world" aria-labelledby="create-world-title">
    <h3 id="create-world-title">Create World</h3>
    <p className="import-note">Imagine a place. Let Gemini shape it. Write in any language.</p>
    <form onSubmit={event => { event.preventDefault(); void generate() }}>
      <label htmlFor="world-description">Title or description</label>
      <textarea id="world-description" rows={3} minLength={3} maxLength={600} required value={prompt}
        disabled={disabled || pending} onChange={event => setPrompt(event.target.value)}
        placeholder={style === 'icons' ? 'An underwater world with colorful fish, shells and sailing boats…' : 'A misty woodland with violet flowers, quiet pools and ancient arches…'} aria-describedby="generation-note" />
      <p id="generation-note" className="import-note">Sent to Google Gemini. Usually takes 10–45 seconds. Save favorites on this browser.</p>
      <button className="load-world" disabled={disabled || pending || prompt.trim().length < 3} type="submit">{pending ? 'Creating…' : 'Generate world'}</button>
      {pending && <><p role="status" className="import-note">Composing your world and checking its walking routes…</p>
        <button type="button" className="quiet-button" onClick={() => active.current?.abort()}>Cancel generation</button></>}
      {message && <p role="alert" className="import-error">{message}</p>}
    </form>
    {result && <div className="generated-result">
      <h4 ref={resultHeading} tabIndex={-1}>{result.name}</h4>
      <p className="import-note generated-style">{worldStyleLabels[result.style ?? 'standard']} · {result.ground.size.join(' × ')} m{result.style === 'icons' && ` · ${result.objects.filter(object => object.type === 'icon').length} icons`}</p>
      <p className="import-note">{saved ? 'Saved in this browser.' : 'Ready to explore. Save it to keep it after a reload.'}</p>
      <div className="world-actions">
        <button className="load-world" type="button" disabled={disabled} onClick={() => onSelect(result)}>Enter world</button>
        <button className="quiet-button" type="button" disabled={disabled || !!saved} onClick={() => persist(current => current.some(w => w.id === result.id) ? current : [result, ...current])}>{saved ? 'Saved' : 'Save world'}</button>
      </div>
    </div>}
    {storageError && <p role="alert" className="import-error">{storageError}</p>}
    {worlds.length > 0 && <div className="saved-worlds">
      <h3>Your worlds <span>({worlds.length}/20)</span></h3>
      <p className="import-note">Stored only in this browser. Clearing site data removes them.</p>
      {worlds.map(world => <div className="saved-world" key={world.id}>
        <button type="button" className="saved-world-enter" disabled={disabled} onClick={() => onSelect(world)} aria-label={`Enter ${world.name}`}>{world.name}<span aria-hidden="true"> ↗</span><small>{worldStyleLabels[world.style ?? 'standard']}</small></button>
        {deleteId === world.id ? <div className="world-actions">
          <button type="button" className="quiet-button" disabled={disabled} onClick={() => {
            persist(current => current.filter(w => w.id !== world.id))
          }}>Confirm delete</button>
          <button type="button" className="quiet-button" onClick={() => setDeleteId(null)}>Keep</button>
        </div> : <button type="button" className="delete-world" disabled={disabled} aria-label={`Delete ${world.name}`} onClick={() => setDeleteId(world.id)}>Delete</button>}
      </div>)}
    </div>}
  </section>
  return { content, pending }
}
