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
  const errors = [], reports = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
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
  await sidebar.locator('summary').click()
  await mkdir('artifacts/icon-themes', { recursive: true })
  const worlds = []
  for (const name of ['underwater', 'village', 'zoo', 'festival', 'office', 'auto-icons', 'large', 'compact16', 'population75']) {
    try { worlds.push([name, JSON.parse(await readFile(`artifacts/icon-themes/${name}.json`, 'utf8'))]) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const base = JSON.parse(await readFile('src/world/icon-world.json', 'utf8'))
  const names = [...new Set(worlds.flatMap(([, world]) => world.objects.filter(object => object.type === 'icon').map(object => object.icon)))].slice(0, 48)
  assert(names.length >= 20, 'Run the live theme check first to supply varied silhouettes.')
  for (const count of [24, 96, 192]) {
    const columns = count === 192 ? 16 : 12, rows = Math.ceil(count / columns)
    worlds.push([`benchmark-${count}`, { ...base, id: `benchmark-${count}`, name: `Benchmark ${count}`, ground: { ...base.ground, size: [128, 128] },
      walking: { ...base.walking, spawn: [0, 1.65, 57], yaw: 0 }, camera: { ...base.camera, position: [80, 90, 110], target: [0, 0, 0] },
      objects: Array.from({ length: count }, (_, index) => ({ ...base.objects[0], id: `icon-${index}`, icon: names[index % names.length], color: ['#ad90e4', '#ff7662', '#4e87df', '#ffd252'][index % 4],
        position: [(index % columns - (columns - 1) / 2) * 7, 0, (Math.floor(index / columns) - (rows - 1) / 2) * 7], scale: [1, 1, 1], rotation: (index % 3 - 1) * 0.2 })) }])
  }
  const only = process.argv.find(argument => argument.startsWith('--only='))?.slice(7).split(',')
  for (const [name, world] of worlds.filter(([name]) => !only || only.includes(name))) {
    await sidebar.getByRole('textbox', { name: 'World JSON', exact: true }).fill(JSON.stringify(world))
    const started = Date.now()
    await sidebar.getByRole('button', { name: 'Load world', exact: true }).click()
    await ready()
    await page.waitForFunction(() => Boolean(document.pointerLockElement))
    const loadMs = Date.now() - started
    await page.waitForTimeout(500)
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icon-themes/${name}-walking.png` })
    await page.keyboard.down('w')
    await page.waitForTimeout(2000) // Let the existing frame-budget fallback settle.
    const active = await page.evaluate(() => new Promise(resolve => {
      const start = performance.now(), intervals = [], draws = window.iconDraws
      let previous = start
      function frame(now) {
        intervals.push(now - previous); previous = now
        if (now - start < 2500) requestAnimationFrame(frame)
        else { const sorted = intervals.sort((a, b) => a - b); resolve({ fps: intervals.length * 1000 / (now - start), p95Ms: sorted[Math.floor(sorted.length * 0.95)], draws: window.iconDraws - draws }) }
      }
      requestAnimationFrame(frame)
    }))
    await page.keyboard.up('w')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.pointerLockElement)
    await page.waitForTimeout(1400)
    const idleStart = await page.evaluate(() => window.iconDraws)
    await page.waitForTimeout(500)
    const idleDraws = await page.evaluate(start => window.iconDraws - start, idleStart)
    await page.locator('.scene canvas').screenshot({ path: `artifacts/icon-themes/${name}-overview.png` })
    assert.equal(idleDraws, 0, `${name} must render on demand`)
    assert(await canvas.evaluate(element => element === document.querySelector('.scene canvas')), 'Preserve the existing canvas across async icon loading')
    const canvasPixels = await page.locator('.scene canvas').evaluate(canvas => [canvas.width, canvas.height])
    const report = { name, count: world.objects.filter(object => object.type === 'icon').length, distinct: new Set(world.objects.filter(object => object.type === 'icon').map(object => object.icon)).size, loadMs, canvasPixels, active, idleDraws }
    reports.push(report); console.log(JSON.stringify(report))
  }
  await writeFile('artifacts/icon-themes/render-performance.json', JSON.stringify({ rendering: 'Headless Edge, software SwiftShader; 1440x960, adaptive rendering. Hardware/mobile not measured.', reports, errors }, null, 2))
  assert.deepEqual(errors, [])
} finally { await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)) }
