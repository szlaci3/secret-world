import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer, preview } from 'vite'

// Validate real SVGLoader output in a browser (DOMParser), then exercise the
// production app without runtime debug hooks or another renderer in the app.
const dev = await createServer({ server: { host: '127.0.0.1', port: 0 },
  optimizeDeps: { noDiscovery: true, include: ['three', 'three/addons/loaders/SVGLoader.js', 'three/addons/utils/BufferGeometryUtils.js'] },
  plugins: [{ name: 'icon-geometry-inspection', configureServer(server) {
    server.middlewares.use('/__icon-test', (_request, response) => { response.setHeader('Content-Type', 'text/html'); response.end('<!doctype html><title>SVG geometry checks</title>') })
  } }] })
await dev.listen()
let server, browser
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const geometryPage = await browser.newPage()
  await geometryPage.goto(`http://127.0.0.1:${dev.httpServer.address().port}/__icon-test`)
  const geometryResults = await geometryPage.evaluate(async () => {
    const { iconGeometry } = await import('/src/scene/icon-geometry.ts')
    const { iconNames, ICON_SIZE, ICON_DEPTH, ICON_BEVEL } = await import('/src/world/icon-types.ts')
    const { Box3, Vector3, Mesh, MeshBasicMaterial, Raycaster, DoubleSide } = await import('/node_modules/.vite/deps/three.js')
    const results = []
    for (const name of iconNames) {
      const parts = iconGeometry(name), bounds = new Box3()
      let finite = true, vertices = 0, planarCaps = true
      for (const { geometry } of parts) {
        bounds.union(geometry.boundingBox)
        vertices += geometry.attributes.position.count
        finite &&= [...geometry.attributes.position.array, ...geometry.attributes.normal.array].every(Number.isFinite)
        const normals = geometry.attributes.normal
        for (const group of geometry.groups) if (group.materialIndex === 0) {
          for (let i = group.start; i < group.start + group.count; i++) planarCaps &&= normals.getX(i) === 0 && normals.getY(i) === 0 && Math.abs(normals.getZ(i)) === 1
        }
      }
      const size = bounds.getSize(new Vector3())
      // Cross sections of the straight walls must match from front and back.
      // A rotated 90-degree ray must also hit the thick sidewall of every icon.
      const material = new MeshBasicMaterial({ side: DoubleSide })
      const meshes = parts.map(({ geometry }) => new Mesh(geometry, material))
      const raycaster = new Raycaster()
      let solidSamples = 0, mismatches = 0, sideHits = 0
      for (let y = bounds.min.y + 0.12; y < bounds.max.y; y += 0.13) {
        raycaster.set(new Vector3(5, y, 0), new Vector3(-1, 0, 0))
        if (raycaster.intersectObjects(meshes).length) sideHits++
        for (let x = bounds.min.x + 0.08; x < bounds.max.x; x += 0.13) {
          raycaster.set(new Vector3(x, y, 2), new Vector3(0, 0, -1))
          const front = raycaster.intersectObjects(meshes).length > 0
          raycaster.set(new Vector3(x, y, -2), new Vector3(0, 0, 1))
          const back = raycaster.intersectObjects(meshes).length > 0
          solidSamples += Number(front)
          if (front !== back) mismatches++
        }
      }
      // Gear's central hole must remain open through the entire extrusion.
      raycaster.set(new Vector3(0, size.y / 2, 2), new Vector3(0, 0, -1))
      const centerOpen = raycaster.intersectObjects(meshes).length === 0
      results.push({ name, finite, vertices, width: size.x, height: size.y, depth: size.z, bottom: bounds.min.y,
        sizeLimit: ICON_SIZE, depthTarget: ICON_DEPTH + 2 * ICON_BEVEL, cached: parts === iconGeometry(name), planarCaps, solidSamples, mismatches, sideHits, centerOpen })
      material.dispose()
    }
    return results
  })
  for (const result of geometryResults) {
    assert(result.finite && result.vertices > 100 && result.cached && result.planarCaps, JSON.stringify(result))
    assert(result.width <= result.sizeLimit + 0.01 && result.height <= result.sizeLimit + 0.01, JSON.stringify(result))
    assert(Math.abs(result.bottom) < 0.012 && Math.abs(result.depth - result.depthTarget) < 0.001, JSON.stringify(result))
    assert(result.solidSamples > 10 && result.mismatches === 0 && result.sideHits > 0, JSON.stringify(result))
    if (result.name === 'settings') assert(result.centerOpen, 'Gear hole must stay open')
  }
  console.log('SVG extrusion, holes, front/back silhouettes, sidewalls, planar caps, bounds and cache passed for all ten icons.')
  await geometryPage.close()
  await dev.close()

  server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
  const url = `http://127.0.0.1:${server.httpServer.address().port}`
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = [], requests = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  page.on('request', request => { if (request.url().includes('/api/create-world')) requests.push(request.url()) })
  const ready = () => page.locator('.scene[aria-busy="false"]').waitFor()
  const leave = async () => {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.pointerLockElement)
    await page.waitForTimeout(1400)
  }
  await mkdir('artifacts/icons', { recursive: true })
  await page.goto(url, { waitUntil: 'networkidle' })
  await ready()
  const canvas = await page.locator('.scene canvas').elementHandle()
  assert.equal(await page.locator('.world-card').count(), 9)
  await page.getByLabel('World style', { exact: true }).selectOption('icons')
  assert.equal(await page.locator('h1').textContent(), 'The Open Meadow', 'Browsing style must preserve the current world')
  assert.equal(await page.locator('.world-card').count(), 1)
  assert.equal(await page.getByRole('button', { name: 'Generate world', exact: true }).isVisible(), true)
  assert.equal(await page.locator('option[value="auto"]').isDisabled(), false)
  await page.getByRole('button', { name: 'Icon World', exact: true }).click()
  await ready()
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  await page.waitForTimeout(500)
  await page.locator('.scene canvas').screenshot({ path: 'artifacts/icons/front.png' })
  const before = await page.locator('.scene canvas').screenshot()
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w')
  assert(!before.equals(await page.locator('.scene canvas').screenshot()), 'Existing controls must move through Icon World')
  await leave()
  assert.equal(await page.locator('h1').textContent(), 'Icon World')
  await page.screenshot({ path: 'artifacts/icons/overview.png' })
  assert(await canvas.evaluate(element => element === document.querySelector('.scene canvas')), 'Style change must reuse the canvas')

  const world = JSON.parse(await readFile('src/world/icon-world.json', 'utf8'))
  const sidebar = page.locator('aside.world-sidebar')
  await sidebar.locator('summary').click()
  for (const [name, spawn, yaw] of [
    ['gear-close', [-6.24, 1.65, 9.42], 0.22],
    ['gear-side', [-11, 1.65, 6], -Math.PI / 2],
    ['back', [0, 1.65, -2], Math.PI],
  ]) {
    await sidebar.getByRole('textbox', { name: 'World JSON', exact: true }).fill(JSON.stringify({ ...world, walking: { ...world.walking, spawn, yaw } }))
    await sidebar.getByRole('button', { name: 'Load world', exact: true }).click()
    await ready()
    await page.waitForFunction(() => Boolean(document.pointerLockElement))
    await page.waitForTimeout(350)
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icons/${name}.png` })
    await leave()
  }
  await page.getByLabel('World style', { exact: true }).selectOption('standard')
  await page.getByRole('button', { name: 'The Open Meadow', exact: true }).click()
  await ready(); await page.waitForFunction(() => Boolean(document.pointerLockElement)); await leave()
  assert(await canvas.evaluate(element => element === document.querySelector('.scene canvas')), 'Returning to Standard must reuse the renderer')
  assert.equal(await page.locator('canvas').count(), 1)
  assert.deepEqual(requests, [], 'Icon MVP must not call Gemini')
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  mobile.on('pageerror', error => errors.push(error.message))
  await mobile.goto(url, { waitUntil: 'networkidle' })
  await mobile.locator('.scene[aria-busy="false"]').waitFor()
  await mobile.getByRole('button', { name: 'Worlds', exact: true }).click()
  await mobile.getByLabel('World style', { exact: true }).selectOption('icons')
  await mobile.getByRole('button', { name: 'Icon World', exact: true }).click()
  await mobile.locator('.scene[aria-busy="false"]').waitFor()
  assert.equal(await mobile.locator('h1').textContent(), 'Icon World')
  assert(await mobile.getByText('Enjoy the overview. Walking needs a keyboard and mouse.').isVisible())
  assert(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await mobile.screenshot({ path: 'artifacts/icons/mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('Production Icon World: style UI, walking, front/side/back, switching, single canvas, no Gemini requests and mobile passed.')
} finally {
  await browser?.close()
  await dev.close()
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
}
