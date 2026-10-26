import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ server: { host: '127.0.0.1', port: 0 },
  cacheDir: 'node_modules/.vite-icon-check',
  optimizeDeps: { noDiscovery: true, include: ['three', 'clipper-lib', 'three/addons/loaders/SVGLoader.js', 'three/addons/utils/BufferGeometryUtils.js'] },
  plugins: [{ name: 'catalog-test', configureServer(server) { server.middlewares.use('/__catalog-test', (_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><title>Catalog check</title>') }) } }] })
await server.listen()
let browser
const lowDetail = process.argv.includes('--low')
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true })
  const page = await browser.newPage()
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__catalog-test`)
  const names = await page.evaluate(async () => (await import('/src/world/icon-types.ts')).iconNames)
  const results = []
  for (let start = 0; start < names.length; start += 32) {
    const batch = await page.evaluate(async ({ names, lowDetail }) => {
      const { preloadIcons } = await import('/src/scene/icon-sources.ts')
      const { iconGeometry, retainIconGeometries } = await import('/src/scene/icon-geometry.ts')
      await preloadIcons(names)
      return names.map(name => {
        try {
          retainIconGeometries([name])
          const parts = iconGeometry(name, lowDetail)
          const vertices = parts.reduce((sum, part) => sum + part.geometry.attributes.position.count, 0)
          const finite = parts.every(part => [...part.geometry.attributes.position.array, ...part.geometry.attributes.normal.array].every(Number.isFinite))
          const bounded = parts.every(part => {
            const bounds = part.geometry.boundingBox
            return bounds.min.y > -0.06 && bounds.max.y < 3.26 && bounds.max.x - bounds.min.x < 3.26 && bounds.max.z - bounds.min.z < 0.75
          })
          return { name, vertices, finite, bounded, cached: parts === iconGeometry(name, lowDetail) }
        } catch (error) { return { name, error: error.message } }
      })
    }, { names: names.slice(start, start + 32), lowDetail })
    results.push(...batch)
    if (start % 256 === 0) console.log(`Checked ${Math.min(start + 32, names.length)}/${names.length}`)
  }
  await mkdir('artifacts/icons', { recursive: true })
  await writeFile(`artifacts/icons/catalog-check${lowDetail ? '-low' : ''}.json`, JSON.stringify(results))
  const failed = results.filter(result => result.error || !result.finite || !result.bounded || !result.cached || result.vertices < 30)
  console.log(JSON.stringify({ checked: results.length, failed, maxVertices: Math.max(...results.map(result => result.vertices || 0)) }))
  assert.deepEqual(failed, [])
} finally { await browser?.close(); await server.close() }
