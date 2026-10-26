import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }))
  await page.addInitScript(() => {
    window.iconDraws = 0
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = WebGL2RenderingContext.prototype[name]
      WebGL2RenderingContext.prototype[name] = function (...args) { window.iconDraws++; return original.apply(this, args) }
    }
  })
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'networkidle' })
  const ready = () => page.locator('.scene[aria-busy="false"]').waitFor()
  await ready()
  const canvas = await page.locator('.scene canvas').elementHandle()
  const sidebar = page.locator('aside.world-sidebar')
  const base = JSON.parse(await readFile('src/world/icon-world.json', 'utf8'))
  const icon = base.objects.find(object => object.type === 'icon')
  const grass = base.objects.find(object => object.type === 'plant')
  const names = ['circle', 'settings', 'paperclip', 'clock', 'fish', 'butterfly', 'vinyl', 'building-cottage']
  const world = { ...base, id: 'lod-walk', name: 'Smooth Icon Walk', ground: { ...base.ground, size: [128, 128] },
    walking: { ...base.walking, spawn: [0, 1.65, 45], yaw: 0 },
    objects: [...Array.from({ length: 96 }, (_, index) => ({ ...icon, id: `walk-icon-${index}`, icon: names[index % names.length],
      position: [((index % 12) - 5.5) * 8, 0, (Math.floor(index / 12) - 3.5) * 8], rotation: 0, scale: [1, 1, 1] })),
      ...Array.from({ length: 96 }, (_, index) => ({ ...grass, id: `walk-grass-${index}`, position: [((index % 12) - 5.5) * 8 + 2, 0, (Math.floor(index / 12) - 3.5) * 8 + 3] }))] }
  await sidebar.locator('summary').click()
  await sidebar.getByRole('textbox', { name: 'World JSON', exact: true }).fill(JSON.stringify(world))
  await sidebar.getByRole('button', { name: 'Load world', exact: true }).click()
  await ready()
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  const leave = async () => {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.pointerLockElement)
    await page.waitForTimeout(1400)
  }
  await leave()
  await mkdir('artifacts/icon-lod', { recursive: true })
  const reports = []
  for (const ground of ['meadow', 'plain', 'meadow']) {
    await page.getByLabel('Icon ground', { exact: true }).selectOption(ground)
    await page.waitForTimeout(300)
    assert.equal(await page.getByLabel('Icon ground', { exact: true }).inputValue(), ground)
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icon-lod/ui-${ground}-overview.png` })
    // Reimport resets the authored spawn; the view preference survives selection.
    await sidebar.getByRole('button', { name: 'Load world', exact: true }).click()
    await ready(); await page.waitForFunction(() => Boolean(document.pointerLockElement))
    await page.keyboard.down('w')
    await page.waitForTimeout(5000)
    const timing = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), intervals = []
      let previous = start
      function frame(now) {
        intervals.push(now - previous); previous = now
        if (now - start < 2500) requestAnimationFrame(frame)
        else resolve({ fps: intervals.length * 1000 / (now - start) })
      }
      requestAnimationFrame(frame)
    }))
    await page.keyboard.up('w')
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icon-lod/ui-${ground}-near.png` })
    await page.keyboard.down('s'); await page.waitForTimeout(2500); await page.keyboard.up('s')
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icon-lod/ui-${ground}-return.png` })
    await leave()
    await page.waitForTimeout(300)
    const idleStart = await page.evaluate(() => window.iconDraws)
    await page.waitForTimeout(500)
    const idleDraws = await page.evaluate(start => window.iconDraws - start, idleStart)
    assert.equal(idleDraws, 0, 'LOD selection must preserve on-demand idle rendering')
    assert(await canvas.evaluate(element => element === document.querySelector('.scene canvas')), 'Ground changes must preserve the canvas')
    const report = { ground, ...timing, idleDraws, pixels: await page.locator('.scene canvas').evaluate(canvas => [canvas.width, canvas.height]) }
    reports.push(report); console.log(JSON.stringify(report))
  }
  await page.getByRole('button', { name: 'The Open Meadow', exact: true }).click()
  await ready(); await page.waitForFunction(() => Boolean(document.pointerLockElement)); await leave()
  assert.equal(await page.locator('h1').textContent(), 'The Open Meadow')
  assert.equal(await page.getByLabel('Icon ground', { exact: true }).count(), 0)
  assert.deepEqual(errors, [])
  await writeFile('artifacts/icon-lod/production-walking.json', JSON.stringify({ renderer: 'Edge SwiftShader; actual input, adaptive quality, 96 icons + 96 clumps. UI workload samples, not a controlled ground comparison.', reports, errors }, null, 2))
  console.log('Production ground controls, 96-icon forward/back walking, idle rendering and Standard return passed.')
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
