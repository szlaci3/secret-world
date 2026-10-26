import { describe, expect, it } from 'vitest'
import { selectIcons } from './icon-selection'
import { iconNames, legacyIconNames } from './icon-types'
import { generationInstructions, createHandler } from '../../netlify/functions/create-world'
import { testIconBlueprint } from './generation-fixture'
import { compileBlueprint } from './generation'
import { MAX_ICON_OBJECTS } from './icon-limits'

describe('topic-driven icons', () => {
  it.each([
    ['An underwater world', ['fish', 'scuba-diving', 'submarine']],
    ['A village', ['building-cottage', 'home', 'building-store']],
    ['A zoo', ['paw', 'cat', 'horse']],
    ['A music festival', ['music', 'microphone', 'guitar-pick']],
    ['An office', ['paperclip', 'folder', 'calculator']],
  ])('retrieves relevant validated choices for %s', (prompt, expected) => {
    const shortlist = selectIcons(prompt)
    expect(shortlist.length).toBeLessThanOrEqual(80)
    expect(new Set(shortlist).size).toBe(shortlist.length)
    expected.forEach(name => expect(shortlist).toContain(name))
    shortlist.forEach(name => expect(iconNames).toContain(name))
  })
  it('keeps the office fixture and removes office restrictions from generation', () => {
    legacyIconNames.forEach(name => expect(selectIcons('office')).toContain(name))
    const instruction = generationInstructions('icons', 'underwater')
    expect(instruction).toContain('fish')
    expect(instruction).not.toContain('available office symbols')
    expect(instruction).not.toContain('never more than 24')
    expect(iconNames.length).toBeGreaterThan(2000)
  })
  it('sends only shortlisted names in the schema and rejects an invented choice', async () => {
    let payload: { generationConfig: { responseFormat: { text: { schema: { properties: { assets: { items: { anyOf: { properties: { icon?: { enum: string[] } } }[] } } } } } } } } | undefined
    const plan = testIconBlueprint() // Valid names, but unrelated to underwater.
    const handler = createHandler(name => name === 'GEMINI_API_KEY' ? 'test-key' : undefined, async (_url, init) => {
      payload = JSON.parse(init!.body as string)
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] })
    })
    const response = await handler(new Request('https://world.test/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'An underwater world', style: 'icons' }) }))
    const names = payload!.generationConfig.responseFormat.text.schema.properties.assets.items.anyOf[0].properties.icon!.enum
    expect(names).toEqual(selectIcons('An underwater world'))
    expect(response.status).toBe(422)
  })
  it('admits the configured icon budget without the standard 64-object budget', () => {
    const plan = testIconBlueprint()
    const world = compileBlueprint({ ...plan, arrival: [0, 57], ground: { ...plan.ground, size: [128, 128] },
      placements: Array.from({ length: MAX_ICON_OBJECTS }, (_, i) => ({ asset: i % 10, position: [-52.5 + (i % 16) * 7, -52.5 + Math.floor(i / 16) * 7], rotation: 0.2, scale: [1, 1, 1] })) }, 'large', 'icons')
    expect(world.objects).toHaveLength(MAX_ICON_OBJECTS)
  })
  it('packs dense repeated groups deterministically instead of losing copies', () => {
    const plan = testIconBlueprint()
    const input = { ...plan, ground: { ...plan.ground, size: [128, 128] }, arrival: [0, 57],
      placements: Array.from({ length: 12 }, (_, index) => ({ asset: index % 10, position: [-40 + (index % 3) * 40, -45 + Math.floor(index / 3) * 30],
        rotation: 0.5, scale: [1, 1, 1], count: 8, spread: 10 })) }
    if (MAX_ICON_OBJECTS < 96) return
    const first = compileBlueprint(input, 'dense', 'icons')
    expect(first.objects).toHaveLength(96)
    expect(compileBlueprint(input, 'dense', 'icons')).toEqual(first)
  })
  it('expands repeated icon groups while preserving collisions and budget checks', () => {
    const plan = testIconBlueprint()
    const world = compileBlueprint({ ...plan, ground: { ...plan.ground, size: [64, 64] }, arrival: [0, 27],
      placements: [{ ...plan.placements[0], position: [0, 0], count: 6, spread: 12 }] }, 'group', 'icons')
    expect(world.objects).toHaveLength(6)
    expect(new Set(world.objects.filter(object => object.type === 'icon').map(object => object.icon)).size).toBe(1)
  })
})
