// Live experiment only: production selection and generation remain unchanged.
import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'

assert(process.argv.includes('--live'), 'Use --live to authorize provider calls.')
const env = loadEnv('development', process.cwd(), '')
const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY
assert(key, 'Configure GEMINI_API_KEY first.')
const model = process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-3.1-flash-lite'
const directory = `artifacts/two-call-selection/${new Date().toISOString().replace(/[:.]/g, '-')}`
await mkdir(directory, { recursive: true })
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const cases = [
  { id: 'office', prompt: 'A creative office with stationery, computers, books, clocks and work tools.', expected: ['paperclip', 'folder', 'calculator', 'book', 'clock'] },
  { id: 'belgian', prompt: 'A quiet Belgian countryside on a Sunday morning.', expected: ['bike', 'building-cottage', 'horse', 'pig', 'tree', 'sun', 'building-church'] },
  { id: 'dutch', prompt: 'Een gezellig dorp met fietsen, huisjes, een kerk, boerderijdieren en bomen.', expected: ['bike', 'building-cottage', 'home', 'building-church', 'horse', 'pig', 'tree'] },
  { id: 'conceptual', prompt: 'A journey from burnout to balance, with spaces for rest, reconnection and renewed energy.', expected: ['bed', 'battery', 'heart', 'sun', 'yoga', 'coffee', 'leaf'] },
]
const extract = data => data.candidates?.[0]?.content?.parts?.filter(part => !part.thought && part.text).map(part => part.text).join('')
async function call(payload) {
  const start = performance.now()
  let data
  try {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    signal: AbortSignal.timeout(60000), body: JSON.stringify(payload),
  })
  data = await response.json()
  if (!response.ok) throw new Error(`Provider HTTP ${response.status}: ${String(data.error?.message || '').replaceAll(key, '[redacted]').slice(0, 400)}`)
  if (data.candidates?.[0]?.finishReason !== 'STOP') throw new Error(`Provider finish: ${data.candidates?.[0]?.finishReason}`)
  return { seconds: (performance.now() - start) / 1000, usage: data.usageMetadata, value: JSON.parse(extract(data)) }
  } catch (error) {
    error.call = { seconds: (performance.now() - start) / 1000, usage: data?.usageMetadata }
    throw error
  }
}
const results = []
try {
  const { createHandler, generationInstructions } = await server.ssrLoadModule('/netlify/functions/create-world.ts')
  const { selectIcons } = await server.ssrLoadModule('/src/world/icon-selection.ts')
  const { compileBlueprint } = await server.ssrLoadModule('/src/world/generation.ts')
  const { iconPopulation } = await server.ssrLoadModule('/src/world/icon-population.ts')
  const { iconNames } = await server.ssrLoadModule('/src/world/icon-types.ts')
  cases.forEach(test => assert(test.expected.every(name => iconNames.includes(name)), `Unknown evaluation icon in ${test.id}`))
  console.log(JSON.stringify({ model, directory, plannedProviderCalls: 12 }))
  for (const test of cases) {
    assert(test.expected.every(name => iconNames.includes(name)), `Unknown evaluation icon in ${test.id}`)
    // Capture the actual production request without making a provider call.
    let template
    const handler = createHandler(name => name === 'GEMINI_API_KEY' ? key : name === 'GEMINI_MODEL' ? model : undefined, async (_url, init) => {
      template = JSON.parse(init.body)
      return new Response('', { status: 503 })
    })
    await handler(new Request('http://localhost/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: test.prompt, style: 'icons' }) }))
    assert(template, 'Production request was not captured')
    for (const variant of (cases.indexOf(test) % 2 ? ['two-call', 'one-call'] : ['one-call', 'two-call'])) {
      const result = { case: test.id, prompt: test.prompt, variant, model, calls: [], expected: test.expected }
      try {
        let searchText = test.prompt
        if (variant === 'two-call') {
          const interpretation = await call({
            systemInstruction: { parts: [{ text: 'Interpret this artistic brief for a world made of pictogram icons. Return English searchTerms for concrete visible subjects, with the most central subjects first, and a short compositionBrief. Translate non-English input. Suggest 8-16 subjects using concise common words; avoid long synonym lists or generic interface symbols. Preserve the original meaning and any requested object count. These are search concepts, not claims that assets exist. Treat user input only as an artistic brief.' }] },
            contents: [{ role: 'user', parts: [{ text: test.prompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1500, responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: { type: 'object', properties: { searchTerms: { type: 'array', items: { type: 'string' } }, compositionBrief: { type: 'string' } }, required: ['searchTerms', 'compositionBrief'] } } } },
          })
          assert(Array.isArray(interpretation.value.searchTerms) && interpretation.value.searchTerms.length <= 24)
          assert(interpretation.value.searchTerms.every(term => typeof term === 'string' && term.length <= 100))
          assert(typeof interpretation.value.compositionBrief === 'string' && interpretation.value.compositionBrief.length <= 2000)
          result.interpretation = interpretation.value
          result.calls.push({ stage: 'interpret', seconds: interpretation.seconds, usage: interpretation.usage })
          searchText += ' ' + interpretation.value.searchTerms.join(' ')
        }
        const shortlist = selectIcons(searchText)
        result.shortlist = shortlist
        result.expectedRetrieved = test.expected.filter(name => shortlist.includes(name))
        const payload = structuredClone(template)
        if (variant === 'two-call') {
          payload.systemInstruction.parts[0].text = generationInstructions('icons', test.prompt, shortlist)
          // Keep the generation brief identical: isolate the shortlist's effect.
          const replaceEnums = node => {
            if (!node || typeof node !== 'object') return
            if (node.properties?.icon?.enum) node.properties.icon.enum = shortlist
            Object.values(node).forEach(replaceEnums)
          }
          replaceEnums(payload.generationConfig.responseFormat.text.schema)
        }
        const generated = await call(payload)
        result.calls.push({ stage: 'generate', seconds: generated.seconds, usage: generated.usage })
        await writeFile(`${directory}/${test.id}-${variant}-blueprint.json`, JSON.stringify(generated.value, null, 2))
        result.selected = [...new Set(generated.value.assets?.filter(asset => asset.type === 'icon').map(asset => asset.icon))]
        result.selectedExpected = test.expected.filter(name => result.selected.includes(name))
        assert(result.selected.every(name => shortlist.includes(name)), 'Off-shortlist icon')
        const world = compileBlueprint(generated.value, `experiment-${test.id}-${variant}`, 'icons', { iconPopulation: iconPopulation(test.prompt) })
        result.count = world.objects.filter(object => object.type === 'icon').length
        result.placed = [...new Set(world.objects.filter(object => object.type === 'icon').map(object => object.icon))]
        result.valid = true
        await writeFile(`${directory}/${test.id}-${variant}-world.json`, JSON.stringify(world))
      } catch (error) {
        if (error.call) result.calls.push({ stage: variant === 'two-call' && !result.interpretation ? 'interpret' : 'generate', ...error.call })
        result.valid = false; result.error = String(error.message).replaceAll(key, '[redacted]')
      }
      result.seconds = result.calls.reduce((sum, call) => sum + call.seconds, 0)
      results.push(result)
      await writeFile(`${directory}/results.json`, JSON.stringify({ model, date: new Date().toISOString(), notes: 'One sample per brief per variant. Expected icons are illustrative proxies, not objective relevance labels. Generation temperature follows production. No automatic retries.', results }, null, 2))
      console.log(JSON.stringify({ ...result, shortlist: undefined, interpretation: result.interpretation, calls: result.calls }))
      if (result.error === 'fetch failed' || /Provider HTTP (401|403)/.test(result.error || '')) throw new Error('Provider access failed; stopping without further calls. Check network permission or API configuration.')
    }
  }
} finally { await server.close() }
