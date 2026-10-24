import { describe, expect, it } from 'vitest'
import { readSavedWorlds, writeSavedWorlds } from './saved-worlds'
import { worldCatalog } from './catalog'

const memory = (initial: string | null = null) => {
  let value = initial
  return { getItem: () => value, setItem: (_key: string, next: string) => { value = next } }
}
describe('local world collection', () => {
  it('round trips, revisits and deletes worlds', () => {
    const storage = memory()
    writeSavedWorlds(storage, [worldCatalog[0].world])
    expect(readSavedWorlds(storage).worlds).toEqual([worldCatalog[0].world])
    writeSavedWorlds(storage, [])
    expect(readSavedWorlds(storage)).toEqual({ worlds: [], error: null })
  })
  it('contains corrupted data and storage failures', () => {
    expect(readSavedWorlds(memory('{broken')).error).toBeTruthy()
    expect(readSavedWorlds(memory(JSON.stringify([{}, worldCatalog[0].world]))).worlds).toHaveLength(1)
    const blocked = { getItem: () => { throw new Error() }, setItem: () => { throw new Error() } }
    expect(readSavedWorlds(blocked).error).toBeTruthy()
    expect(() => writeSavedWorlds(blocked, [])).toThrow('Couldn’t save')
    expect(() => writeSavedWorlds(memory(), Array(21).fill(worldCatalog[0].world))).toThrow('20 worlds')
  })
})
