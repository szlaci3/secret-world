import assert from 'node:assert/strict'
import { preview } from 'vite'

// Serve the built output on a free local port, then always release the server.
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
try {
  const address = server.httpServer.address()
  assert(address && typeof address === 'object')
  const base = `http://127.0.0.1:${address.port}`
  const response = await fetch(base, { signal: AbortSignal.timeout(10000) })
  assert.equal(response.status, 200)
  const html = await response.text()
  assert.match(html, /<title>SecretWorld<\/title>/)
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)]
  assert(assets.length >= 2, 'Expected built JavaScript and CSS assets')
  for (const [, path] of assets) {
    const asset = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(10000) })
    assert.equal(asset.status, 200, path)
    assert((await asset.text()).length > 0, path)
  }
  console.log(`Production smoke check passed: HTML and ${assets.length} assets served successfully.`)
} finally {
  await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()))
}
