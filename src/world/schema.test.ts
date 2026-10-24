import { describe, expect, it } from 'vitest'
import garden from './garden.json'
import { parseWorld, worldObjectSchema } from './schema'

describe('world data boundary', () => {
  it('accepts the JSON garden fixture and preserves its scene settings', () => {
    expect(parseWorld(JSON.parse(JSON.stringify(garden)))).toEqual(garden)
  })

  it.each([
    ['unsupported version', { ...garden, schemaVersion: 2 }],
    ['unsupported prop', { ...garden, objects: [{ ...garden.objects[0], type: 'script' }] }],
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

  it('still accepts an empty foundation world', () => {
    const { walking: _, ...foundation } = garden
    expect(parseWorld({ ...foundation, objects: [] }).objects).toEqual([])
  })

  it.each([
    ['underground eye height', { ...garden.walking, spawn: [0, -1, 0] }],
    ['non-finite heading', { ...garden.walking, yaw: Infinity }],
    ['negative speed', { ...garden.walking, speed: -1 }],
    ['excessive field of view', { ...garden.walking, fov: 180 }],
    ['zero sensitivity', { ...garden.walking, lookSensitivity: 0 }],
    ['too-small player radius', { ...garden.walking, radius: 0.01 }],
    ['outside the ground', { ...garden.walking, spawn: [20, 1.65, 0] }],
    ['insufficient edge clearance', { ...garden.walking, spawn: [8.9, 1.65, 0] }],
    ['inside water', { ...garden.walking, spawn: [3.1, 1.65, 0.1] }],
    ['inside a gate post', { ...garden.walking, spawn: [-3, 1.65, 6.5] }],
  ])('rejects walking settings with %s', (_, walking) => {
    expect(() => parseWorld({ ...garden, walking })).toThrow()
  })

  it('rejects invalid collision footprints before constructing navigation', () => {
    const object = { ...garden.objects[0], collision: [{ kind: 'ellipse', center: [0, 0], radii: [-1, 2] }] }
    expect(worldObjectSchema.safeParse(object).success).toBe(false)
  })

  it('rejects a garden too small for the player', () => {
    expect(() => parseWorld({ ...garden, ground: { ...garden.ground, size: [0.3, 0.3] },
      walking: { ...garden.walking, spawn: [0, 1.65, 0] }, objects: [] })).toThrow()
  })

  it('covers every supported garden kind and both tree varieties in the fixture', () => {
    const world = parseWorld(garden)
    expect(new Set(world.objects.map((object) => object.type)))
      .toEqual(new Set(['path', 'pond', 'rock', 'tree', 'lantern', 'entrance']))
    expect(new Set(world.objects.filter((object) => object.type === 'tree').map((tree) => tree.variety)))
      .toEqual(new Set(['pine', 'maple']))
  })

  it('rejects duplicate IDs rather than aliasing rendered objects', () => {
    expect(() => parseWorld({ ...garden, objects: [garden.objects[0], garden.objects[0]] }))
      .toThrow('Object IDs must be unique')
  })

  it('caps the number of objects in generated worlds', () => {
    const objects = Array.from({ length: 201 }, (_, index) => ({ ...garden.objects[0], id: `stone-${index}` }))
    expect(() => parseWorld({ ...garden, objects })).toThrow()
  })

  it.each([
    ['missing type-specific field', { ...garden.objects[0], size: undefined }],
    ['negative scale', { ...garden.objects[0], scale: [1, -1, 1] }],
    ['zero scale', { ...garden.objects[0], scale: [0, 1, 1] }],
    ['non-finite position', { ...garden.objects[0], position: [0, NaN, 1] }],
    ['non-finite rotation', { ...garden.objects[0], rotation: Infinity }],
    ['unknown property', { ...garden.objects[0], url: 'https://example.com/model.glb' }],
    ['invalid pond radius', { ...garden.objects.find((object) => object.type === 'pond'), radii: [0, 2] }],
    ['unknown tree variety', { ...garden.objects.find((object) => object.type === 'tree'), variety: 'unknown' }],
    ['invalid lantern color', { ...garden.objects.find((object) => object.type === 'lantern'), glowColor: 'orange' }],
    ['missing entrance material', { ...garden.objects.find((object) => object.type === 'entrance'), woodColor: undefined }],
    ['invalid rock color', { ...garden.objects.find((object) => object.type === 'rock'), color: '#fff' }],
  ])('rejects object with %s', (_, object) => {
    expect(worldObjectSchema.safeParse(object).success).toBe(false)
  })
})
