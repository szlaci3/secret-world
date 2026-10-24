import { loadWorldJson } from './load-world'
import type { WorldDefinition } from './schema'

export const SAVED_WORLDS_KEY = 'secretworld.worlds.v1'
export const MAX_SAVED_WORLDS = 20
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

export function readSavedWorlds(storage: StorageAccess): { worlds: WorldDefinition[]; error: string | null } {
  try {
    const text = storage.getItem(SAVED_WORLDS_KEY)
    if (!text) return { worlds: [], error: null }
    if (text.length > 4 * 1024 * 1024) throw new Error('Storage limit')
    const entries: unknown = JSON.parse(text)
    if (!Array.isArray(entries) || entries.length > MAX_SAVED_WORLDS) throw new Error('Invalid library')
    const worlds: WorldDefinition[] = []
    let invalid = false
    for (const entry of entries) {
      const parsed = loadWorldJson(JSON.stringify(entry))
      if (parsed.ok && parsed.world.walking && !worlds.some(world => world.id === parsed.world.id)) worlds.push(parsed.world)
      else invalid = true
    }
    return { worlds, error: invalid ? 'Some saved worlds could not be read. Valid worlds are still available.' : null }
  } catch { return { worlds: [], error: 'Your saved worlds could not be read. Browser storage may be unavailable or damaged.' } }
}

export function writeSavedWorlds(storage: StorageAccess, worlds: WorldDefinition[]) {
  if (worlds.length > MAX_SAVED_WORLDS) throw new Error('Your collection is full (20 worlds). Delete a world before saving another.')
  const text = JSON.stringify(worlds)
  if (text.length > 4 * 1024 * 1024) throw new Error('Your collection is full. Delete a world before saving another.')
  try { storage.setItem(SAVED_WORLDS_KEY, text) }
  catch { throw new Error('Couldn’t save changes in this browser. Storage may be full or disabled. Your new world can still be explored.') }
}
