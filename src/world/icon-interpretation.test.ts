import { describe, expect, it, vi } from 'vitest'
import { createHandler } from '../../netlify/functions/create-world'
import { needsIconInterpretation, selectIcons } from './icon-selection'

const weakBrief = 'Een gezellig dorp met fietsen, huisjes, een kerk, boerderijdieren en bomen.'
const env = (name: string) => name === 'GEMINI_API_KEY' ? 'test-key' : name === 'GEMINI_MODEL' ? 'gemini-test-model' : undefined
const request = (prompt = weakBrief, style = 'icons', signal?: AbortSignal) => new Request('https://world.test/api/create-world', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style }), signal,
})
const interpreted = (value: unknown) => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(value) }] } }] })

describe('selective icon interpretation', () => {
  it.each([
    ['A creative office with stationery, computers, books, clocks and work tools.', false],
    ['A quiet Belgian countryside on a Sunday morning.', false],
    ['An underwater world', false],
    [weakBrief, true],
    ['A journey from burnout to balance, with spaces for rest, reconnection and renewed energy.', true],
    ['静かな村と自転車', true],
  ])('detects retrieval coverage for %s', (prompt, expected) => {
    expect(needsIconInterpretation(prompt)).toBe(expected)
  })

  it('maps bicycle synonyms into the actual catalog', () => {
    expect(selectIcons('bicycles')).toContain('bike')
    expect(selectIcons('bicycles')).toEqual(selectIcons('bike'))
  })

  it.each(['icons', 'auto'])('enriches a weak %s brief with the same model and keeps the original generation brief', async style => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(interpreted({ searchTerms: ['bicycle', 'cottage', 'church', 'tree'] }))
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    const response = await createHandler(env, fetcher)(request(weakBrief, style))
    expect(response.status).toBe(502)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls.every(([url]) => String(url).includes('gemini-test-model:generateContent'))).toBe(true)
    const payload = JSON.parse(fetcher.mock.calls[1][1]!.body as string)
    expect(payload.contents[0].parts[0].text).toBe(weakBrief)
    const expected = selectIcons(`${weakBrief} bicycle cottage church tree`)
    const enums: string[][] = []
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return
      if (node.properties?.icon?.enum) enums.push(node.properties.icon.enum)
      Object.values(node).forEach(visit)
    }
    visit(payload.generationConfig.responseFormat.text.schema)
    expect(enums.length).toBeGreaterThan(0)
    enums.forEach(names => expect(names).toEqual(expected))
    expect(expected).toContain('bike')
  })

  it.each([
    () => new Response('', { status: 429 }),
    () => interpreted({ searchTerms: ['bike'], code: 'untrusted extra field' }),
    () => interpreted({ searchTerms: Array(17).fill('bike') }),
    () => interpreted({ searchTerms: [42] }),
    () => Response.json({ candidates: [{ finishReason: 'MAX_TOKENS' }] }),
    () => { throw new DOMException('interpretation timed out', 'TimeoutError') },
  ])('falls back to the original shortlist if optional enrichment fails %#', async failure => {
    const fetcher = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => failure())
      .mockResolvedValueOnce(new Response('', { status: 503 }))
    await createHandler(env, fetcher)(request())
    expect(fetcher).toHaveBeenCalledTimes(2)
    const payload = JSON.parse(fetcher.mock.calls[1][1]!.body as string)
    expect(payload.systemInstruction.parts[0].text).toContain(selectIcons(weakBrief).join(', '))
  })

  it.each([['An office', 'icons'], [weakBrief, 'standard']])('skips enrichment for %s in %s style', async (prompt, style) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 503 }))
    await createHandler(env, fetcher)(request(prompt, style))
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not continue to generation after cancellation', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => {
      controller.abort()
      throw new DOMException('cancelled', 'AbortError')
    })
    const response = await createHandler(env, fetcher)(request(weakBrief, 'icons', controller.signal))
    expect(response.status).toBe(499)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
