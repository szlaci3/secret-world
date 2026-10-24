import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

// Same authored geometry, eye height, heading, FOV and viewport on both builds.
// Only the walking spawn changes in an imported copy; no runtime debug hooks.
const baseline = process.argv.includes('--baseline')
const world = JSON.parse(await readFile('src/world/open-meadow.json', 'utf8'))
if (baseline) world.environment = JSON.parse(execFileSync('git', ['show', '14cda4e:src/world/open-meadow.json'], { encoding: 'utf8' })).environment
const views = [ ['entrance', [0, 1.65, 40]], ['grove', [-42, 1.65, -14]], ['stone', [-32, 1.65, 5.5]] ]
const server = await preview({ build: { outDir: baseline ? 'artifacts/baseline-dist' : 'dist' }, preview: { host: '127.0.0.1', port: 0, open: false } })
let browser
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'), headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  await mkdir('artifacts/fidelity', { recursive: true })
  for (const [name, spawn] of views) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 })
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ body: '', contentType: 'text/css' }))
    await page.goto(`http://127.0.0.1:${server.httpServer.address().port}`, { waitUntil: 'networkidle' })
    await page.locator('.scene[aria-busy="false"]').waitFor()
    const sidebar = page.getByRole('complementary', { name: 'Choose a world', exact: true })
    await sidebar.locator('summary').click()
    await sidebar.getByRole('textbox', { name: 'World JSON', exact: true }).fill(JSON.stringify({ ...world, walking: { ...world.walking, spawn, yaw: 0 } }))
    await sidebar.getByRole('button', { name: 'Load world', exact: true }).click()
    await page.waitForFunction(() => Boolean(document.pointerLockElement))
    await page.waitForTimeout(700)
    await page.locator('.scene canvas').screenshot({ path: `artifacts/fidelity/${baseline ? 'before' : 'after'}-${name}.png` })
    assert.deepEqual(errors, [])
    console.log(`Captured ${baseline ? 'before' : 'after'} ${name}: ${spawn}`)
    await page.close()
  }
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
