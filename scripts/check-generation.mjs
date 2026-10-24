import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createServer, loadEnv } from 'vite'

// Explicit opt-in: one paid provider call, never print credentials or provider errors.
assert(process.argv.includes('--live'), 'Use --live to make one Gemini request using the local server-only key.')
const env = loadEnv('development', process.cwd(), '')
assert(env.GEMINI_API_KEY || process.env.GEMINI_API_KEY, 'Set GEMINI_API_KEY in .env first.')
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { createHandler } = await server.ssrLoadModule('/netlify/functions/create-world.ts')
  const { compileBlueprint } = await server.ssrLoadModule('/src/world/generation.ts')
  const started = Date.now()
  const handler = createHandler(name => process.env[name] || env[name], async (...args) => {
    const response = await fetch(...args)
    if (!response.ok) {
      const data = await response.clone().json().catch(() => ({}))
      const message = String(data.error?.message || '').replaceAll(process.env.GEMINI_API_KEY || env.GEMINI_API_KEY, '[redacted]')
      console.log(JSON.stringify({ providerStatus: response.status, message: message.slice(0, 1200) }))
    } else {
      const data = await response.clone().json()
      const text = data.candidates?.[0]?.content?.parts?.filter(p => !p.thought && p.text).map(p => p.text).join('')
      if (text) {
        await mkdir('artifacts', { recursive: true })
        await writeFile('artifacts/generated-blueprint.json', text)
        try { compileBlueprint(JSON.parse(text), 'diagnostic') }
        catch (error) { console.log('Layout validation:', error.message.slice(0, 2000)) }
      }
    }
    return response
  })
  const response = await handler(new Request('http://localhost/api/create-world', {
    method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'http://localhost' },
    body: JSON.stringify({ prompt: process.argv[3] || 'A moonlit violet woodland with a quiet pool, ancient arches and a winding path. Gentle hills behind the trees.' }),
  }))
  const data = await response.json()
  console.log(JSON.stringify({ status: response.status, seconds: (Date.now() - started) / 1000,
    name: data.world?.name, objects: data.world?.objects.length, error: data.error }))
  assert.equal(response.status, 200, 'Live generation failed; see the safe error above.')
  await mkdir('artifacts', { recursive: true })
  await writeFile('artifacts/generated-world.json', JSON.stringify(data.world, null, 2))
} finally { await server.close() }
