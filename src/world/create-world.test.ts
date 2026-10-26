import { describe, expect, it, vi } from 'vitest'
import { createHandler, config, biomeGuidance } from '../../netlify/functions/create-world'
import { testBlueprint, testIconBlueprint } from './generation-fixture'

const request = (body: unknown = { prompt: 'A moonlit glade' }, headers = {}) => new Request('https://world.test/api/create-world', {
  method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://world.test', ...headers }, body: JSON.stringify(body),
})
const env = (name: string) => name === 'GEMINI_API_KEY' ? 'test-secret' : undefined
const success = () => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(testBlueprint()) }] } }] })

describe('create-world endpoint', () => {
  it('focuses guidance on the biome while preserving creative dimensions', () => {
    expect(biomeGuidance('Open Meadow')).toContain('128x128m')
    expect(biomeGuidance('A misty woodland')).toContain('40 trees')
    expect(biomeGuidance('Dense forest with a narrow path and soft fog')).toContain('48–56 trees')
    expect(biomeGuidance('Small garden')).toContain('48x48m')
  })
  it('reports invalid fields and layout failures without exposing provider text', async () => {
    for (const [plan, message] of [[{ ...testBlueprint(), ground: { size: [256, 256], color: '#708060' } }, 'ground.size'],
      [{ ...testBlueprint(), placements: [{ ...testBlueprint().placements[0], asset: 13 }, ...testBlueprint().placements] }, 'Unknown asset reference'],
      [{ ...testBlueprint(), assets: [{ type: 'path', size: [2, 20], color: '#999988' }],
        placements: [{ asset: 0, position: [0, 60], rotation: 0, scale: [1, 1, 1] }] }, 'Object outside the world: object-0 (path)']] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }))
      const response = await createHandler(env, fetcher)(request())
      expect(response.status).toBe(422)
      expect((await response.json()).error).toContain(message)
    }
  })
  it('validates requests before making any paid call', async () => {
    const fetcher = vi.fn()
    const handler = createHandler(env, fetcher)
    expect((await handler(new Request('https://world.test/api/create-world'))).status).toBe(405)
    expect((await handler(request({}, { origin: 'https://evil.test' }))).status).toBe(403)
    expect((await handler(request({ prompt: 'x'.repeat(601) }))).status).toBe(400)
    expect((await handler(request({ prompt: 'x'.repeat(9000) }))).status).toBe(413)
    for (const style of ['invalid', '', null, 7, { style: 'icons' }]) {
      expect((await handler(request({ prompt: 'A pastel office', style }))).status).toBe(400)
    }
    expect((await handler(request({}, { 'Content-Type': 'text/plain' }))).status).toBe(415)
    expect(fetcher).not.toHaveBeenCalled()
  })
  it.each([
    ['standard', 'standard'], ['icons', 'icons'], ['auto', 'standard'], ['auto', 'icons'],
  ] as const)('honors %s selection with a %s result in exactly one provider call', async (style, resolved) => {
    const plan = resolved === 'icons' ? testIconBlueprint() : { ...testBlueprint(), style: 'standard' }
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }))
    const response = await createHandler(env, fetcher)(request({ prompt: 'A colorful office garden', style }))
    expect(response.status).toBe(200)
    expect((await response.json()).world.style).toBe(resolved)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const payload = JSON.parse(fetcher.mock.calls[0][1]!.body as string)
    const schema = payload.generationConfig.responseFormat.text.schema
    expect(schema.properties.style.enum).toEqual(style === 'auto' ? ['standard', 'icons'] : [style])
    expect(schema.properties.placements.items.properties.scale).toMatchObject({ minItems: 3, maxItems: 3 })
    const assetTypes = schema.properties.assets.items.anyOf.map((asset: { properties: { type: { enum: string[] } } }) => asset.properties.type.enum[0])
    if (style === 'standard') expect(assetTypes).not.toContain('icon')
    if (style === 'icons') expect(assetTypes).toEqual(['icon', 'plant'])
    if (style === 'auto') {
      expect(schema.required).toContain('style')
      expect(payload.systemInstruction.parts[0].text).toContain('single response')
    }
  })
  it('rejects provider style mismatches and invalid icon layouts without retrying', async () => {
    for (const [style, plan] of [
      ['icons', { ...testBlueprint(), style: 'standard' }],
      ['standard', testIconBlueprint()],
      ['auto', testBlueprint()],
      ['auto', { ...testIconBlueprint(), style: 'standard' }],
      ['icons', { ...testIconBlueprint(), placements: Array(2).fill(testIconBlueprint().placements[0]) }],
    ] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] }))
      const response = await createHandler(env, fetcher)(request({ prompt: 'A pastel office', style }))
      expect(response.status).toBe(422)
      expect((await response.json()).error).toContain('did not pass validation')
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
  })
  it('keeps the key server-side and returns a validated walkable world', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(success())
    const response = await createHandler(env, fetcher)(request())
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).not.toContain('test-secret')
    expect(JSON.parse(text).world.walking).toBeDefined()
    const [url, init] = fetcher.mock.calls[0]
    expect(url).not.toContain('test-secret')
    expect(init?.headers).toHaveProperty('x-goog-api-key', 'test-secret')
    expect(JSON.parse(init!.body as string).generationConfig.responseFormat.text.schema).toBeDefined()
    expect(JSON.parse(init!.body as string).systemInstruction.parts[0].text).toContain('Focused guidance for this brief')
    expect(JSON.parse(init!.body as string).generationConfig.responseFormat.text.schema.properties.placements.items.properties.scale).toMatchObject({ minItems: 3, maxItems: 3 })
    expect(config.rateLimit.windowLimit).toBe(3)
  })
  it('handles missing configuration, quota, upstream failure, malformed and truncated output without retries', async () => {
    expect((await createHandler(() => undefined)(request())).status).toBe(503)
    for (const [response, expected] of [[new Response('', { status: 429 }), 429], [new Response('', { status: 500 }), 502],
      [Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }), 422],
      [Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{}' }] } }] }), 422]] as const) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response)
      expect((await createHandler(env, fetcher)(request())).status).toBe(expected)
      expect(fetcher).toHaveBeenCalledTimes(1)
    }
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new DOMException('timeout', 'TimeoutError'))
    expect((await createHandler(env, fetcher)(request())).status).toBe(504)
  })
})
