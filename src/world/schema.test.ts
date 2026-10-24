import { describe, expect, it } from 'vitest'
import garden from './garden.json'
import { parseWorld } from './schema'

describe('world data boundary', () => {
  it('accepts the JSON garden fixture and preserves its scene settings', () => {
    expect(parseWorld(JSON.parse(JSON.stringify(garden)))).toEqual(garden)
  })

  it.each([
    ['unsupported version', { ...garden, schemaVersion: 2 }],
    ['unsupported prop', { ...garden, objects: [{ type: 'tree' }] }],
    ['unknown field', { ...garden, script: 'untrusted code' }],
    ['negative ground size', { ...garden, ground: { ...garden.ground, size: [-1, 18] } }],
    ['unbounded ground size', { ...garden, ground: { ...garden.ground, size: [1000, 18] } }],
    ['invalid color', { ...garden, ground: { ...garden.ground, color: 'url(example)' } }],
    ['non-finite camera', { ...garden, camera: { ...garden.camera, position: [Infinity, 2, 3] } }],
    ['degenerate camera', { ...garden, camera: { ...garden.camera, position: garden.camera.target } }],
    ['invalid light intensity', { ...garden, environment: { ...garden.environment, ambientIntensity: -1 } }],
    ['missing required field', { ...garden, camera: undefined }],
    ['null input', null],
  ])('rejects %s', (_, input) => {
    expect(() => parseWorld(input)).toThrow()
  })
})
