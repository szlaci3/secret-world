import { describe, expect, it } from 'vitest'
import garden from './garden.json'
import courtyard from './maple-courtyard.json'
import oasis from './sandstone-oasis.json'
import frost from './frostlight-grove.json'
import { loadWorldJson, MAX_WORLD_BYTES } from './load-world'
import { createNavigation, isWalkable } from '../controls/navigation'

describe('world JSON loading', () => {
  it.each([garden, courtyard, oasis, frost])('accepts and validates the $id fixture', (fixture) => {
    const result = loadWorldJson(JSON.stringify(fixture))
    expect(result).toEqual({ ok: true, world: fixture })
    if (!result.ok) throw new Error(result.message)
    const [x, , z] = result.world.walking!.spawn
    expect(isWalkable({ x, z }, createNavigation(result.world))).toBe(true)
  })

  it('accepts a UTF-8 BOM and surrounding whitespace', () => {
    expect(loadWorldJson('\uFEFF  ' + JSON.stringify(courtyard) + '\n').ok).toBe(true)
  })

  it('accepts an overview world without walking settings', () => {
    const { walking: _, ...overview } = courtyard
    const result = loadWorldJson(JSON.stringify(overview))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.world.walking).toBeUndefined()
  })

  it.each(['', '{', '```json\n{}\n```', '/* comment */ {}', 'null', '[]', '"world"'])('rejects malformed or non-world input: %s', (text) => {
    expect(loadWorldJson(text).ok).toBe(false)
  })

  it('explains unsupported versions', () => {
    const result = loadWorldJson(JSON.stringify({ ...garden, schemaVersion: 2 }))
    expect(result).toEqual({ ok: false, message: 'schemaVersion: Only schema version 1 is supported.' })
  })

  it('rejects oversized input before parsing', () => {
    expect(loadWorldJson(' '.repeat(MAX_WORLD_BYTES + 1)))
      .toEqual({ ok: false, message: 'World JSON must be no larger than 1 MiB.' })
  })

  it('counts UTF-8 bytes, not just JavaScript string characters', () => {
    const text = JSON.stringify({ name: '庭'.repeat(400000) })
    expect(text.length).toBeLessThan(MAX_WORLD_BYTES)
    expect(loadWorldJson(text)).toEqual({ ok: false, message: 'World JSON must be no larger than 1 MiB.' })
  })

  it('accepts a valid document padded to the byte limit', () => {
    expect(loadWorldJson(JSON.stringify(garden).padEnd(MAX_WORLD_BYTES, ' ')).ok).toBe(true)
  })

  it.each([
    ['unknown external asset', { ...garden, assetUrl: 'https://example.com/world.glb' }],
    ['embedded code', { ...garden, script: 'alert(1)' }],
    ['overflowing number', { ...garden, camera: { ...garden.camera, position: [Infinity, 2, 3] } }],
    ['extreme coordinates', { ...garden, camera: { ...garden.camera, position: [1e300, 2, 3] } }],
    ['degenerate scale', { ...garden, objects: [{ ...garden.objects[0], scale: [1e-200, 1, 1] }] }],
    ['degenerate ground', { ...garden, ground: { ...garden.ground, size: [1e-200, 18] } }],
    ['blocked spawn', { ...garden, walking: { ...garden.walking, spawn: [3.1, 1.65, 0.1] } }],
    ['duplicate object ID', { ...garden, objects: [garden.objects[0], garden.objects[0]] }],
    ['unsupported object kind', { ...garden, objects: [{ ...garden.objects[0], type: 'model' }] }],
  ])('rejects %s', (_, input) => {
    expect(loadWorldJson(JSON.stringify(input)).ok).toBe(false)
  })

  it('bounds validation messages and reports field paths', () => {
    const result = loadWorldJson(JSON.stringify({ ...garden,
      id: '', name: '', ground: { size: [-1, -1], color: 'green' },
    }))
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('Expected rejected input')
    expect(result.message).toContain('id:')
    expect(result.message.split('\n').length).toBeLessThanOrEqual(3)
    expect(result.message.length).toBeLessThanOrEqual(602)
  })
})
