import { describe, expect, it, vi } from 'vitest'
import { compileBlueprint } from './generation'
import { testBlueprint, testIconBlueprint } from './generation-fixture'
import { iconPopulation } from './icon-population'
import { iconFootprintsSeparated } from './icon-layout'
import { objectFitsGround } from './object-bounds'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { createHandler } from '../../netlify/functions/create-world'
import { MAX_ICON_OBJECTS } from './icon-limits'

const compact = (prompt: string, input: unknown = testIconBlueprint()) => compileBlueprint(input, 'compact', 'icons', { iconPopulation: iconPopulation(prompt) })
describe('icon population policy', () => {
  it('distinguishes population from field dimensions and other numbers', () => {
    expect(iconPopulation('An office on 96 by 96 meters')).toMatchObject({ min: 32, max: 48, exact: false })
    expect(iconPopulation('A music festival with 75 icon objects')).toMatchObject({ target: 75, exact: true })
    expect(iconPopulation('A zoo with exactly 96 icons')).toMatchObject({ target: 96, exact: true })
    expect(iconPopulation('A small village')).toMatchObject({ target: 16, exact: false })
    expect(iconPopulation('One icon of a fish')).toMatchObject({ target: 1, exact: true })
    expect(iconPopulation('An office with up to 48 objects')).toMatchObject({ min: 32, max: 48, exact: false })
    expect(iconPopulation('A zoo with at least 75 icons')).toMatchObject({ min: 75, max: MAX_ICON_OBJECTS, exact: false })
  })
})

describe('compact generated icon worlds', () => {
  it('turns a sparse provider result into a compact default, retaining only selected subjects', () => {
    const plan = testIconBlueprint()
    const world = compact('An office', { ...plan, ground: { ...plan.ground, size: [128, 128] } })
    const icons = world.objects.filter(object => object.type === 'icon')
    expect(icons.length).toBeGreaterThanOrEqual(32)
    expect(icons.length).toBeLessThanOrEqual(48)
    expect(Math.max(...world.ground.size)).toBeLessThanOrEqual(52)
    expect(new Set(icons.map(icon => icon.icon))).toEqual(new Set(plan.assets.filter(asset => 'icon' in asset).map(asset => asset.icon)))
    expect(world).toEqual(compact('An office', { ...plan, ground: { ...plan.ground, size: [128, 128] } }))
  })
  it.each([16, 75, 96])('enforces %i actual icons, fits the land and preserves exact walking gaps', count => {
    const world = compact(`A colorful office with exactly ${count} icons`)
    const icons = world.objects.filter(object => object.type === 'icon')
    expect(icons).toHaveLength(count)
    expect(Math.max(...world.ground.size)).toBeLessThanOrEqual(count <= 20 ? 36 : 76)
    icons.forEach(icon => expect(objectFitsGround(icon, world.ground.size)).toBe(true))
    for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++) expect(iconFootprintsSeparated(icons[i], icons[j])).toBe(true)
    const navigation = createNavigation(world), spawn = { x: world.walking!.spawn[0], z: world.walking!.spawn[2] }
    expect(isWalkable(spawn, navigation)).toBe(true)
    expect(world.walking!.yaw).toBe(0)
    expect(moveWithinGarden(spawn, { x: 0, z: -3 }, navigation).z).toBeCloseTo(spawn.z - 3)
    expect(moveWithinGarden(spawn, { x: 0, z: -world.ground.size[1] + 7 }, navigation).z).toBeCloseTo(spawn.z - world.ground.size[1] + 7)
  })
  it('compacts widely scattered or overlapping seeds, rather than just trimming empty margins', () => {
    const plan = testIconBlueprint()
    const scattered = { ...plan, ground: { ...plan.ground, size: [128, 128] }, placements: plan.placements.slice(0, 10).map((placement, index) => ({ ...placement, position: [index % 2 ? 50 : -50, index % 3 ? 50 : -50] })) }
    const world = compact('An office with 16 icons', scattered)
    expect(Math.max(...world.ground.size)).toBeLessThanOrEqual(36)
    expect(world.objects).toHaveLength(16)
    const overlapping = { ...plan, placements: plan.placements.slice(0, 10).map(placement => ({ ...placement, position: [0, 0] })) }
    expect(compact('An office with 16 icons', overlapping).objects).toHaveLength(16)
  })
  it('keeps limited subjects small, while explicit repetition and rich briefs remain possible', () => {
    const plan = testIconBlueprint(), single = { ...plan, placements: [plan.placements[0]] }
    expect(compact('A minimal gear world', single).objects).toHaveLength(4)
    expect(compact('A gear world', single).objects).toHaveLength(32)
    expect(compact('A world with 75 icons', single).objects).toHaveLength(75)
    expect(compact('A rich world of gears', single).objects.length).toBeGreaterThanOrEqual(72)
  })
  it('preserves large icon scales and grows the packing area when necessary', () => {
    const plan = testIconBlueprint()
    const world = compact('An office with 96 icons', { ...plan, placements: plan.placements.slice(0, 10).map(placement => ({ ...placement, scale: [2, 2, 2] })) })
    expect(world.objects).toHaveLength(96)
    expect(Math.max(...world.ground.size)).toBeLessThanOrEqual(128)
    world.objects.forEach(object => {
      expect(object.scale).toEqual([2, 2, 2])
      expect(objectFitsGround(object, world.ground.size)).toBe(true)
    })
  })
  it('leaves standard generation and legacy blueprint layouts unchanged', () => {
    const plan = testBlueprint()
    expect(compileBlueprint(plan, 'standard', 'standard', { iconPopulation: iconPopulation('96 icons') })).toEqual(compileBlueprint(plan, 'standard'))
    expect(compileBlueprint(testIconBlueprint(), 'authored', 'icons').ground.size).toEqual([40, 40])
  })
  it('does not make a paid request for an impossible explicit icon population', async () => {
    const fetcher = vi.fn()
    const handler = createHandler(name => name === 'GEMINI_API_KEY' ? 'test-key' : undefined, fetcher)
    for (const count of [0, MAX_ICON_OBJECTS + 1]) {
      const response = await handler(new Request('https://world.test/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: `An office with ${count} icons`, style: 'icons' }) }))
      expect(response.status).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('enforces population through the real handler even when Gemini returns too few objects', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(testIconBlueprint()) }] } }] }))
    const handler = createHandler(name => name === 'GEMINI_API_KEY' ? 'test-key' : undefined, fetcher)
    const response = await handler(new Request('https://world.test/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'An office with exactly 75 icons', style: 'icons' }) }))
    expect(response.status).toBe(200)
    const { world } = await response.json()
    expect(world.objects.filter((object: { type: string }) => object.type === 'icon')).toHaveLength(75)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string).systemInstruction.parts[0].text).toContain('EXACTLY 75')
  })
})
