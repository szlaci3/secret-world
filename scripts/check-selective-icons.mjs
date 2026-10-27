import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'

assert(process.argv.includes('--live'), 'Use --live for up to five Gemini requests.')
const env = loadEnv('development', process.cwd(), '')
const readEnv = name => process.env[name] || env[name]
assert(readEnv('GEMINI_API_KEY'), 'Configure the server key first.')
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const results = []
try {
  const { createHandler } = await server.ssrLoadModule('/netlify/functions/create-world.ts')
  for (const [id, prompt, expectedCalls] of [
    ['office', 'A creative office with stationery, computers, books, clocks and work tools.', 1],
    ['dutch', 'Een gezellig dorp met fietsen, huisjes, een kerk, boerderijdieren en bomen.', 2],
    ['abstract', 'A journey from burnout to balance, with spaces for rest, reconnection and renewed energy.', 2],
  ]) {
    const calls = []
    const handler = createHandler(readEnv, async (url, init) => {
      const payload = JSON.parse(init.body)
      const started = performance.now()
      const stage = payload.generationConfig.maxOutputTokens === 800 ? 'interpret' : 'generate'
      const call = { stage }
      calls.push(call)
      try {
        const response = await fetch(url, init)
        call.status = response.status
        const data = await response.clone().json().catch(() => ({}))
        call.usage = data.usageMetadata
        const text = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought && part.text).map(part => part.text).join('')
        if (text) call.output = JSON.parse(text)
        if (stage === 'generate') call.instructions = payload.systemInstruction.parts[0].text
        return response
      } catch (error) { call.error = error.name; throw error }
      finally { call.seconds = (performance.now() - started) / 1000 }
    })
    const started = performance.now()
    const response = await handler(new Request('http://localhost/api/create-world', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style: 'icons' }),
    }))
    const data = await response.json()
    const result = { id, prompt, status: response.status, seconds: (performance.now() - started) / 1000, calls,
      count: data.world?.objects.filter(object => object.type === 'icon').length,
      icons: [...new Set(data.world?.objects.filter(object => object.type === 'icon').map(object => object.icon))], error: data.error }
    results.push(result)
    await mkdir('artifacts/selective-icons', { recursive: true })
    await writeFile('artifacts/selective-icons/results.json', JSON.stringify(results, null, 2))
    console.log(JSON.stringify({ ...result, calls: calls.map(({ output, instructions, ...summary }) => summary) }))
    assert.equal(response.status, 200, `${id}: generation must pass validation`)
    assert.equal(calls.length, expectedCalls, `${id}: unexpected call count`)
  }
} finally { await server.close() }
