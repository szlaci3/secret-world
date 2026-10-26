import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { createServer, preview } from 'vite'

// Production UI -> real handler/compiler -> simulated Gemini. No live API calls.
// Optional --live-results also imports the separate live-check artifacts for QA.
const modules = await createServer({ server: { middlewareMode: true } })
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  const { createHandler } = await modules.ssrLoadModule('/netlify/functions/create-world.ts')
  const { testBlueprint, testIconBlueprint } = await modules.ssrLoadModule('/src/world/generation-fixture.ts')
  browser = await chromium.launch({ channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const base = `http://127.0.0.1:${server.httpServer.address().port}`
  await mkdir('artifacts/generation-styles', { recursive: true })
  const ready = page => page.locator('.scene[aria-busy="false"]').waitFor()
  const leave = async page => {
    await page.keyboard.press('Tab')
    await page.waitForFunction(() => !document.pointerLockElement)
    await page.waitForTimeout(1400)
  }
  for (const [requested, resolved] of [['standard', 'standard'], ['icons', 'icons'], ['auto', 'icons'], ['auto', 'standard']]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    let calls = 0
    const name = `${requested}-${resolved}`
    let plan = resolved === 'icons' ? testIconBlueprint() : { ...testBlueprint(), style: 'standard' }
    plan.name = `Generated ${name}`
    const handler = createHandler(key => key === 'GEMINI_API_KEY' ? 'browser-test-only' : undefined, async (_url, init) => {
      calls++
      const payload = JSON.parse(init.body)
      assert.equal(payload.contents[0].parts[0].text, 'A colorful office garden')
      assert.deepEqual(payload.generationConfig.responseFormat.text.schema.properties.style.enum,
        requested === 'auto' ? ['standard', 'icons'] : [requested])
      await new Promise(resolve => setTimeout(resolve, 700))
      return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(plan) }] } }] })
    })
    await page.route('**/api/create-world', async route => {
      assert.deepEqual(route.request().postDataJSON(), { prompt: 'A colorful office garden', style: requested })
      const response = await handler(new Request(`${base}/api/create-world`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', origin: base }, body: route.request().postData() }))
      await route.fulfill({ status: response.status, contentType: 'application/json', body: await response.text() })
    })
    await page.goto(base, { waitUntil: 'networkidle' }); await ready(page)
    const canvas = await page.locator('.scene canvas').elementHandle()
    await page.getByLabel('World style', { exact: true }).selectOption(requested)
    assert.equal(await page.locator('.world-card').count(), requested === 'auto' ? 10 : requested === 'icons' ? 1 : 9)
    await page.getByLabel('Title or description').fill('A colorful office garden')
    await page.getByRole('button', { name: 'Generate world', exact: true }).click()
    assert(await page.getByLabel('World style', { exact: true }).isDisabled(), 'Keep the submitted style stable while pending')
    await page.setViewportSize({ width: 390, height: 844 })
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.getByRole('button', { name: 'Save world', exact: true }).waitFor()
    const label = resolved === 'icons' ? 'Extruded icons' : 'Standard 3D objects'
    assert.match(await page.locator('.generated-style').textContent(), new RegExp(label))
    assert.equal(await page.getByLabel('World style', { exact: true }).inputValue(), requested)
    assert.equal(calls, 1, 'Auto must choose style and generate in one provider call')
    await page.screenshot({ path: `artifacts/generation-styles/${name}-result.png`, fullPage: true })
    await page.getByRole('button', { name: 'Save world', exact: true }).click()
    await page.getByRole('button', { name: 'Enter world', exact: true }).click()
    await page.waitForFunction(() => Boolean(document.pointerLockElement)); await ready(page)
    assert(await canvas.evaluate(element => element === document.querySelector('.scene canvas')))
    await page.locator('.scene canvas').screenshot({ path: `artifacts/generation-styles/${name}-walking.png` })
    const before = await page.locator('.scene canvas').screenshot()
    await page.keyboard.down('w'); await page.waitForTimeout(450); await page.keyboard.up('w')
    assert(!before.equals(await page.locator('.scene canvas').screenshot()), 'Generated world must support walking')
    await leave(page)
    await page.reload({ waitUntil: 'networkidle' }); await ready(page)
    assert.match(await page.locator('.saved-world-enter small').textContent(), new RegExp(label))
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('secretworld.worlds.v1')))
    assert.equal(saved[0].style, resolved)
    await page.getByRole('button', { name: `Enter ${plan.name}`, exact: true }).click()
    await page.waitForFunction(() => Boolean(document.pointerLockElement)); await ready(page); await leave(page)
    assert.equal(await page.locator('h1').textContent(), plan.name)
    // Rejected output must keep the active saved world and its renderer intact.
    plan = { ...plan, style: 'invalid' }
    await page.getByLabel('World style', { exact: true }).selectOption(requested)
    await page.getByLabel('Title or description').fill('A colorful office garden')
    await page.getByRole('button', { name: 'Generate world', exact: true }).click()
    await page.getByRole('alert').filter({ hasText: 'did not pass validation' }).waitFor()
    assert.equal(await page.locator('h1').textContent(), `Generated ${name}`)
    assert.equal(await page.locator('canvas').count(), 1)
    // Expected 422 is a handled API error, not a rendering/runtime failure.
    assert.deepEqual(errors.filter(error => !error.includes('422')), [])
    await page.setViewportSize({ width: 390, height: 844 })
    await page.getByRole('button', { name: 'Worlds', exact: true }).click()
    assert.equal(await page.getByLabel('World style', { exact: true }).inputValue(), requested)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `artifacts/generation-styles/${name}-mobile.png`, fullPage: true })
    await context.close()
    console.log(`Generation style ${name}: real handler/compiler, request, result, walking, save/reload/revisit, rejection and responsive state passed.`)
  }
  // A cancelled response must never replace the result or active world.
  const cancelPage = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  let heldRoute
  await cancelPage.route('**/api/create-world', route => { heldRoute = route })
  await cancelPage.goto(base); await ready(cancelPage)
  await cancelPage.getByLabel('World style', { exact: true }).selectOption('icons')
  await cancelPage.getByLabel('Title or description').fill('A colorful office garden')
  await cancelPage.getByRole('button', { name: 'Generate world', exact: true }).click()
  await cancelPage.getByRole('button', { name: 'Cancel generation', exact: true }).click()
  await cancelPage.getByRole('alert').filter({ hasText: 'Generation cancelled' }).waitFor()
  assert.equal(await cancelPage.locator('h1').textContent(), 'The Open Meadow')
  assert.equal(await cancelPage.locator('.generated-result').count(), 0)
  assert.equal(await cancelPage.getByLabel('World style', { exact: true }).isDisabled(), false)
  await heldRoute?.abort().catch(() => {})
  await cancelPage.close()

  if (process.argv.includes('--live-results')) for (const style of ['icons', 'auto']) {
    const world = JSON.parse(await readFile(`artifacts/generated-${style}-world.json`, 'utf8'))
    const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base); await ready(page)
    await page.locator('aside.world-sidebar summary').click()
    await page.getByRole('textbox', { name: 'World JSON', exact: true }).fill(JSON.stringify(world))
    await page.getByRole('button', { name: 'Load world', exact: true }).click()
    await ready(page); await page.waitForFunction(() => Boolean(document.pointerLockElement))
    await page.locator('.scene canvas').screenshot({ path: `artifacts/generation-styles/live-${style}-walking.png` })
    await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w')
    await leave(page)
    await page.screenshot({ path: `artifacts/generation-styles/live-${style}-overview.png`, fullPage: true })
    assert.deepEqual(errors, [])
    await page.close()
    console.log(`Live ${style} result imported, rendered and walked: ${world.name} (${world.style}).`)
  }
  console.log('All generation styles and cancellation passed. Provider responses simulated unless --live-results imports separately recorded live artifacts.')
} finally {
  await browser?.close()
  await modules.close()
  await new Promise(resolve => server.httpServer.close(resolve))
}
