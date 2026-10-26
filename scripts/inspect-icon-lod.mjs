import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer } from 'vite'

const server = await createServer({ cacheDir: 'node_modules/.vite-lod-check',
  server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: { noDiscovery: true, include: ['react', 'react/jsx-runtime', 'react-dom/client', '@react-three/fiber', 'three', 'clipper-lib', 'three/addons/loaders/SVGLoader.js', 'three/addons/utils/BufferGeometryUtils.js'] },
  plugins: [{ name: 'lod-harness', configureServer(server) {
    server.middlewares.use('/__lod-test', async (_request, response) => {
      response.setHeader('Content-Type', 'text/html')
      response.end(await server.transformIndexHtml('/__lod-test', '<!doctype html><style>body{margin:0}#root{height:100vh}</style><div id="root"></div><script type="module" src="/scripts/icon-lod-harness.tsx"></script>'))
    })
  } }] })
await server.listen()
let browser
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/__lod-test`)
  await page.waitForFunction(() => window.lodTest?.ready, undefined, { timeout: 90000 })
  await mkdir('artifacts/icon-lod', { recursive: true })
  const snapshot = async () => page.evaluate(() => window.lodTest.read())
  const move = async z => {
    await page.evaluate(z => window.lodTest.camera(z), z)
    await page.waitForTimeout(150)
    return snapshot()
  }
  const lod = result => result.meshes.map(mesh => Number(mesh.name.split('-')[2]))
  const transitions = []
  for (const reduced of [false, true]) {
    await page.evaluate(reduced => window.lodTest.configure({ reduced, plain: true }), reduced)
    await page.waitForTimeout(250)
    for (const [z, expected] of [[60, 2], [25, 1], [5, 0], [25, 1], [60, 2], [5, 0]]) {
      const result = await move(z)
      assert.deepEqual(lod(result), [expected], JSON.stringify({ reduced, z, result }))
      transitions.push({ reduced, z, ...result })
      await page.screenshot({ path: `artifacts/icon-lod/${reduced ? 'reduced' : 'normal'}-${z}-${expected}.png` })
    }
  }
  const fullCounts = transitions.filter(entry => entry.z === 5).map(entry => entry.meshes[0].vertices)
  assert(fullCounts.every(count => count === fullCounts[0]), 'Nearby geometry must be identical under both performance settings')
  // Walk toward and away from the circle, checking exclusive membership at each
  // step. No duplicate ghost meshes, missing icons or global quality downgrade.
  for (const z of [...Array.from({ length: 30 }, (_, i) => 60 - i * 2), ...Array.from({ length: 30 }, (_, i) => 2 + i * 2)]) {
    const result = await move(z)
    assert.equal(result.meshes.reduce((sum, mesh) => sum + mesh.count, 0), 1)
    if (z <= 10) assert.deepEqual(lod(result), [0])
  }
  const benchmark = async plain => {
    await page.evaluate(plain => { window.lodTest.configure({ crowd: true, reduced: true, plain }) }, plain)
    await page.waitForTimeout(800)
    await page.evaluate(() => window.lodTest.loop(true))
    await page.waitForTimeout(2000)
    const timing = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), intervals = []
      let previous = start
      function frame(now) {
        intervals.push(now - previous); previous = now
        if (now - start < 5000) requestAnimationFrame(frame)
        else { const sorted = intervals.sort((a, b) => a - b); resolve({ fps: intervals.length * 1000 / (now - start), p95Ms: sorted[Math.floor(sorted.length * 0.95)] }) }
      }
      requestAnimationFrame(frame)
    }))
    await page.evaluate(() => window.lodTest.loop(false))
    await page.screenshot({ path: `artifacts/icon-lod/crowd-${plain ? 'plain' : 'meadow'}.png` })
    const result = { ground: plain ? 'plain' : 'meadow', ...timing, ...await snapshot() }
    console.log(JSON.stringify({ ...result, meshes: undefined }))
    return result
  }
  // Alternate order to expose warmup/order noise in this short software sample.
  const reports = []
  for (const plain of [false, true, true, false]) reports.push(await benchmark(plain))
  const report = { renderer: 'Headless Edge SwiftShader; fixed reduced shading/resolution, distance LOD enabled, 96 icons + 96 grass clumps in meadow; no hardware GPU claims', transitions, reports, errors }
  await writeFile('artifacts/icon-lod/results.json', JSON.stringify(report, null, 2))
  assert.deepEqual(errors, [])
  console.log('Near/full, middle, far, return transitions and nearby quality invariance passed; paired ground benchmark recorded.')
} finally { await browser?.close(); await server.close() }
