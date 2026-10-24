import assert from 'node:assert/strict'
import { readFile, mkdir } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

const world = JSON.parse(await readFile(new URL('../artifacts/generated-large-world.json', import.meta.url), 'utf8').catch(() => readFile(new URL('../src/world/open-meadow.json', import.meta.url), 'utf8')))
world.id = 'generated-browser-test'
world.name = 'Browser Test Woodland'
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
  const page = await context.newPage()
  page.setDefaultTimeout(20000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let calls = 0
  let fail = false
  await page.route('**/api/create-world', async route => {
    calls++
    assert.equal(route.request().postDataJSON().prompt, 'A violet woodland')
    await new Promise(resolve => setTimeout(resolve, 300))
    await route.fulfill(fail ? { status: 429, body: 'Rate limited' } : { json: { world } })
  })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await page.goto(base)
  await page.locator('.scene[aria-busy="false"]').waitFor()
  assert.equal(await page.locator('.world-card').count(), 1)
  await page.getByLabel('Title or description').fill('A violet woodland')
  await page.getByRole('button', { name: 'Generate world', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: 'Creating…' }).isDisabled(), true)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'Save world', exact: true }).click()
  assert.equal(calls, 1)
  assert.equal(await page.getByRole('button', { name: 'Saved', exact: true }).isDisabled(), true)
  await page.getByRole('button', { name: 'Enter world', exact: true }).click()
  await page.locator('.garden.is-walking').waitFor()
  await page.keyboard.press('w')
  await page.keyboard.press('Tab')
  await page.locator('.world-sidebar:visible').waitFor()
  assert.equal(await page.locator('h1').textContent(), world.name)
  await mkdir('artifacts', { recursive: true })
  await page.screenshot({ path: 'artifacts/generation-desktop.png', fullPage: true })
  await page.reload()
  await page.locator('.scene[aria-busy="false"]').waitFor()
  await page.getByRole('button', { name: `Enter ${world.name}`, exact: true }).click()
  await page.locator('.garden.is-walking').waitFor()
  await page.keyboard.press('Tab')
  await page.getByRole('button', { name: `Delete ${world.name}`, exact: true }).click()
  await page.getByRole('button', { name: 'Confirm delete', exact: true }).click()
  await page.reload()
  await page.locator('.scene[aria-busy="false"]').waitFor()
  assert.equal(await page.locator('.saved-world').count(), 0)
  fail = true
  await page.getByLabel('Title or description').fill('A violet woodland')
  await page.getByRole('button', { name: 'Generate world', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'usage limit' }).waitFor()
  assert.equal(await page.locator('h1').textContent(), 'The Open Meadow')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Worlds', exact: true }).click()
  await page.getByLabel('Title or description').waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  await page.screenshot({ path: 'artifacts/generation-mobile.png', fullPage: true })
  assert.deepEqual(errors, [])
  console.log('Generation browser checks passed: pending, enter/walk, save, reload/revisit, delete, quota error, large built-in world, mobile drawer. API response mocked; scene and storage real.')
} finally {
  await browser?.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
