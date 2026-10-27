import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'

assert(process.argv.includes('--live'), 'Use --live for real Gemini generation.')
const env = loadEnv('development', process.cwd(), '')
const readEnv = name => process.env[name] || env[name]
assert(readEnv('GEMINI_API_KEY'), 'Configure the existing server key first.')
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const results = []
const directory = `artifacts/icon-composition/${new Date().toISOString().replace(/[:.]/g, '-')}`
const only = process.argv.find(arg => arg.startsWith('--only='))?.slice(7)
try {
  const { createHandler } = await server.ssrLoadModule('/netlify/functions/create-world.ts')
  for (const [id, prompt] of [
    ['singles', 'A symbolic journey through rest, hope and renewal, with one distinct icon for each idea. No repeated kinds.'],
    ['groups', 'An underwater aquarium of schooling fish and plentiful marine creatures.'],
    ['mixed', 'A welcoming village with a landmark church, a sun above the houses, and trees.'],
  ]) {
    if (only && id !== only) continue
    const calls = []
    let blueprint
    const handler = createHandler(readEnv, async (url, init) => {
      const payload = JSON.parse(init.body)
      const started = performance.now()
      const response = await fetch(url, init)
      const data = await response.clone().json().catch(() => ({}))
      calls.push({ status: response.status, seconds: (performance.now() - started) / 1000, usage: data.usageMetadata })
      if (payload.generationConfig.maxOutputTokens === 10000) {
        const text = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought && part.text).map(part => part.text).join('')
        if (text) blueprint = JSON.parse(text)
      }
      return response
    })
    const response = await handler(new Request('http://localhost/api/create-world', { method: 'POST',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style: 'icons' }) }))
    const data = await response.json()
    const counts = {}
    data.world?.objects.filter(object => object.type === 'icon').forEach(object => { counts[object.icon] = (counts[object.icon] || 0) + 1 })
    const result = { id, prompt, status: response.status, composition: blueprint?.composition, counts, calls, error: data.error }
    results.push(result)
    await mkdir(directory, { recursive: true })
    await writeFile(`${directory}/results.json`, JSON.stringify(results, null, 2))
    if (blueprint) await writeFile(`${directory}/${id}-blueprint.json`, JSON.stringify(blueprint, null, 2))
    if (data.world) await writeFile(`${directory}/${id}-world.json`, JSON.stringify(data.world))
    console.log(JSON.stringify(result))
    assert.equal(response.status, 200, `${id}: live generation failed validation`)
    assert(blueprint?.composition, 'Gemini must make an explicit composition decision')
    for (const kind of blueprint.composition.kinds) {
      assert(kind.mode === 'single' ? counts[kind.icon] === 1 : counts[kind.icon] >= 2)
    }
  }
} finally { await server.close() }
