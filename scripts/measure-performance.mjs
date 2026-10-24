import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'

const worldName = process.argv.find((argument) => argument.startsWith('--world='))?.slice('--world='.length)
const output = worldName ? `performance-${worldName.toLowerCase().replaceAll(' ', '-')}.json`
  : process.argv.includes('--baseline') ? 'performance-before.json' : 'performance.json'
const channel = process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium')
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
let browser
try {
  const address = server.httpServer.address()
  assert(address && typeof address === 'object')
  browser = await chromium.launch({ channel, headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }))
  await page.addInitScript(() => {
    // Test-side instrumentation only: count actual WebGL draw calls without
    // exposing renderer internals or adding a permanent application game loop.
    window.gardenMeasurement = { draws: 0, clears: 0, firstDrawMs: null }
    const clear = WebGL2RenderingContext.prototype.clear
    WebGL2RenderingContext.prototype.clear = function (...args) {
      window.gardenMeasurement.clears++
      return clear.apply(this, args)
    }
    for (const name of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      const original = WebGL2RenderingContext.prototype[name]
      WebGL2RenderingContext.prototype[name] = function (...args) {
        window.gardenMeasurement.draws++
        window.gardenMeasurement.firstDrawMs ??= performance.now()
        return original.apply(this, args)
      }
    }
  })
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.gardenMeasurement.draws > 0)
  if (worldName) {
    await page.getByRole('button', { name: 'Worlds', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: worldName, exact: true }).click()
    await page.locator('.scene[aria-busy="false"]').waitFor()
    assert.equal(await page.locator('h1').textContent(), worldName)
  }
  await page.waitForTimeout(500)
  const idleStart = await page.evaluate(() => window.gardenMeasurement.draws)
  await page.waitForTimeout(1000)
  const idleDrawCalls = await page.evaluate((start) => window.gardenMeasurement.draws - start, idleStart)
  assert.equal(idleDrawCalls, 0, 'The settled overview should render on demand')
  await page.getByRole('button', { name: 'Enter world', exact: true }).press('Enter')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  await page.waitForTimeout(250)
  await page.keyboard.down('w')
  // Allow the one-way frame-budget fallback and shader warmup to settle.
  await page.waitForTimeout(2000)
  const active = await page.evaluate(() => new Promise((accept) => {
    const start = performance.now()
    const draws = window.gardenMeasurement.draws
    const clears = window.gardenMeasurement.clears
    let previous = start
    const intervals = []
    function frame(now) {
      intervals.push(now - previous)
      previous = now
      if (now - start < 2000) requestAnimationFrame(frame)
      else {
        const sorted = [...intervals].sort((a, b) => a - b)
        accept({ sampleMs: now - start, frames: intervals.length,
          rafFps: intervals.length * 1000 / (now - start),
          p95FrameMs: sorted[Math.floor((sorted.length - 1) * 0.95)],
          drawCalls: window.gardenMeasurement.draws - draws,
          renderedFrames: window.gardenMeasurement.clears - clears })
      }
    }
    requestAnimationFrame(frame)
  }))
  await page.keyboard.up('w')
  await page.waitForTimeout(300)
  const stillStart = await page.evaluate(() => window.gardenMeasurement.draws)
  await page.waitForTimeout(500)
  const idleWalkingDrawCalls = await page.evaluate((start) => window.gardenMeasurement.draws - start, stillStart)
  assert.equal(idleWalkingDrawCalls, 0, 'Standing still should also render on demand')
  await page.keyboard.press('Escape')
  const firstDrawMs = await page.evaluate(() => window.gardenMeasurement.firstDrawMs)
  const report = { world: await page.locator('h1').textContent(), measuredAt: new Date().toISOString(), browser: browser.version(), channel,
    rendering: 'Headless software WebGL2 (SwiftShader), local production server; not a hardware GPU benchmark',
    viewport: { width: 1440, height: 960, dpr: 1 }, firstDrawMs, idleDrawCalls, idleWalkingDrawCalls,
    canvasPixels: await page.locator('.scene canvas').evaluate((canvas) => [canvas.width, canvas.height]),
    warmupMs: 2000, active, approximateDrawCallsPerRender: active.drawCalls / active.renderedFrames }
  await mkdir('artifacts', { recursive: true })
  const path = resolve('artifacts', output)
  await writeFile(path, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report, null, 2))
  console.log(`Recorded ${path}`)
} finally {
  if (browser) await browser.close()
  await new Promise((accept, reject) => server.httpServer.close((error) => error ? reject(error) : accept()))
}
