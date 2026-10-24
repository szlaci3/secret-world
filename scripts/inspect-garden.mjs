import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { chromium } from 'playwright'
import { preview } from 'vite'
import { checkWalking } from './check-walking.mjs'
import { checkCollisions } from './check-collisions.mjs'

// Inspect production output using an installed Edge on Windows, or Playwright's
// Chromium elsewhere. Override with SECRET_WORLD_BROWSER_CHANNEL when needed.
const channel = process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium')
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
let browser
try {
  const address = server.httpServer.address()
  assert(address && typeof address === 'object')
  browser = await chromium.launch({
    channel,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  // Font availability must not determine whether the world renders correctly.
  await page.route('https://fonts.googleapis.com/**', (route) => route.fulfill({ body: '', contentType: 'text/css' }))
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
  await page.locator('.scene canvas').waitFor({ state: 'visible' })
  const graphics = await page.locator('.scene canvas').evaluate((canvas) => {
    const gl = canvas.getContext('webgl2')
    return { width: canvas.width, height: canvas.height, webgl2: Boolean(gl), error: gl?.getError() }
  })
  assert(graphics.webgl2 && graphics.width > 0 && graphics.height > 0, 'Expected an active WebGL2 canvas')
  assert.equal(graphics.error, 0, 'Unexpected WebGL error')
  assert.equal(await page.locator('.graphics-message:visible').count(), 0, 'Graphics fallback was shown')
  assert.equal(await page.locator('h1').textContent(), 'The Quiet Garden')
  assert.deepEqual(errors, [], 'Unexpected browser errors')
  await mkdir('artifacts', { recursive: true })
  const screenshot = resolve('artifacts/garden-desktop.png')
  await page.screenshot({ path: screenshot, fullPage: true })
  console.log(`Garden browser check passed (${channel}, software WebGL2). Screenshot: ${screenshot}`)
  if (process.argv.includes('--walk')) await checkWalking(page)
  if (process.argv.includes('--collisions')) await checkCollisions(page)
  assert.deepEqual(errors, [], 'Unexpected browser errors during inspection')
} finally {
  if (browser) await browser.close()
  await new Promise((accept, reject) => server.httpServer.close((error) => error ? reject(error) : accept()))
}
