import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'

const recorded = process.argv.includes('--recorded')
assert(recorded || process.argv.includes('--live'), 'Use --live for Gemini, or --recorded to recompile saved provider blueprints locally.')
const env = loadEnv('development', process.cwd(), '')
assert(recorded || env.GEMINI_API_KEY || process.env.GEMINI_API_KEY, 'Configure the server key first.')
const server = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] } })
const cases = [
  ['underwater', 'icons', 'An underwater world of marine life, fish, shells, diving and ocean discoveries.'],
  ['village', 'icons', 'A welcoming village with cottages, shops, a church, windmill and rural life.'],
  ['zoo', 'icons', 'A lively zoo with many different animals, wildlife and playful creatures.'],
  ['festival', 'icons', 'A music festival with instruments, microphones, performers, dancing and celebration.'],
  ['office', 'icons', 'A creative office with stationery, computers, books, clocks and work tools.'],
  ['auto-icons', 'auto', 'A playful symbolic underwater world made of colorful extruded icons of fish, boats and divers.'],
  ['auto-standard', 'auto', 'A small natural garden with five realistic maple trees around an open grassy path. Keep every tree within 10 meters of the origin on a 48 by 48 meter field.'],
  ['large', 'icons', 'A large music festival with exactly 96 icon objects in a 128 by 128 meter field. Repeat musical instruments, speakers and microphones in spacious groups.'],
  ['compact16', 'icons', 'A small welcoming village with exactly 16 icons of cottages, shops, rural life and a church.'],
  ['population75', 'icons', 'An underwater world with exactly 75 icon objects of marine life, fish, shells, boats and divers.'],
]
try {
  console.log('Loading the real generation handler…')
  const { createHandler } = await server.ssrLoadModule('/netlify/functions/create-world.ts')
  await mkdir('artifacts/icon-themes', { recursive: true })
  const results = []
  const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7).split(',')
  for (const [name, style, prompt] of cases.filter(([name]) => !only || only.includes(name))) {
    const handler = createHandler(name => recorded && name === 'GEMINI_API_KEY' ? 'recorded-provider-only' : process.env[name] || env[name], async (...args) => {
      if (recorded) return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: await readFile(`artifacts/icon-themes/${name}-blueprint.json`, 'utf8') }] } }] })
      const response = await fetch(...args)
      if (response.ok) {
        const data = await response.clone().json()
        const text = data.candidates?.[0]?.content?.parts?.filter(part => !part.thought && part.text).map(part => part.text).join('')
        if (text) await writeFile(`artifacts/icon-themes/${name}-blueprint.json`, text)
      } else {
        const data = await response.clone().json().catch(() => ({}))
        const key = process.env.GEMINI_API_KEY || env.GEMINI_API_KEY
        console.log(JSON.stringify({ name, providerStatus: response.status, message: String(data.error?.message || '').replaceAll(key, '[redacted]').slice(0, 600) }))
      }
      return response
    })
    const start = Date.now()
    const response = await handler(new Request('http://localhost/api/create-world', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, style }) }))
    const data = await response.json()
    const summary = { name, style, status: response.status, seconds: (Date.now() - start) / 1000, resolved: data.world?.style,
      count: data.world?.objects.filter(object => object.type === 'icon').length, size: data.world?.ground.size,
      names: [...new Set(data.world?.objects.filter(object => object.type === 'icon').map(object => object.icon))], error: data.error }
    results.push(summary)
    console.log(JSON.stringify(summary))
    if (data.world) await writeFile(`artifacts/icon-themes/${name}.json`, JSON.stringify(data.world))
  }
  await writeFile(`artifacts/icon-themes/results${only ? '-' + only.join('-') : ''}.json`, JSON.stringify(results, null, 2))
  assert(results.every(result => result.status === 200), 'One or more live designs failed admission; inspect results.json.')
  if (results.some(result => result.name === 'large')) assert.equal(results.find(result => result.name === 'large').count, 96, 'The large brief explicitly asks for 96 objects.')
  for (const [name, count] of [['compact16', 16], ['population75', 75]]) {
    if (results.some(result => result.name === name)) assert.equal(results.find(result => result.name === name).count, count)
  }
  for (const result of results.filter(result => result.resolved === 'icons')) {
    assert(Math.max(...result.size) <= (result.count <= 20 ? 40 : result.count <= 48 ? 56 : 80), `${result.name} should fit compact ground`)
    if (['underwater', 'village', 'zoo', 'festival', 'office', 'auto-icons'].includes(result.name)) assert(result.count >= 32 && result.count <= 48, 'Normal briefs must produce 32–48 actual objects')
  }
  for (const [name, style] of [['auto-icons', 'icons'], ['auto-standard', 'standard']]) {
    if (results.some(result => result.name === name)) assert.equal(results.find(result => result.name === name).resolved, style)
  }
} finally { await server.close() }
