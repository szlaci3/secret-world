import assert from 'node:assert/strict'
import { resolve } from 'node:path'

const ready = (page) => page.waitForFunction(() => document.querySelector('.scene')?.getAttribute('aria-busy') === 'false'
  && !document.querySelector('.scene-notice'))

export async function checkExperience(page, browser, base) {
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: width < 760 ? 844 : 960 })
    await ready(page)
    await page.waitForTimeout(150)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`)
    const scene = await page.locator('.scene').boundingBox()
    const panel = await page.locator('.walk-panel').boundingBox()
    const title = await page.locator('.intro').boundingBox()
    assert(scene && panel && title && scene.height >= 330)
    if (width <= 760) {
      assert(title.y + title.height <= scene.y + 1, 'Title must sit above the narrow garden view')
      assert(panel.y >= scene.y + scene.height - 1, 'Narrow controls must not cover the garden')
    }
    await page.screenshot({ path: resolve(`artifacts/garden-${width}.png`), fullPage: true })
  }
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  await page.keyboard.press('Tab')
  assert.equal(await page.locator('.wordmark').evaluate((link) => link === document.activeElement), true)
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('button', { name: 'Worlds', exact: true })
    .evaluate((button) => button.matches(':focus-visible')), true, 'World selection must be reachable by keyboard')
  await page.keyboard.press('Tab')
  const enter = page.getByRole('button', { name: 'Enter world', exact: true })
  assert.equal(await enter.evaluate((button) => button.matches(':focus-visible')), true, 'Keyboard entry must have visible focus')
  await enter.press('Enter')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  assert(await page.evaluate(() => Boolean(document.pointerLockElement)), 'Resizing must preserve the walking session')
  await page.screenshot({ path: resolve('artifacts/garden-narrow-walking.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await enter.waitFor({ state: 'visible' })
  assert.equal(await enter.evaluate((button) => button === document.activeElement), true)

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const touch = await touchContext.newPage()
    await touch.goto(base, { waitUntil: 'networkidle' })
    await ready(touch)
    assert.equal(await touch.getByRole('button', { name: 'World overview', exact: true }).isDisabled(), true)
    assert(await touch.getByText('Enjoy the world overview. Walking needs a keyboard and mouse.').isVisible())
    await touch.screenshot({ path: resolve('artifacts/garden-touch.png'), fullPage: true })
  } finally { await touchContext.close() }

  // Hold the renderer chunk so loading UI can be observed deterministically.
  const loading = await page.context().newPage()
  try {
    let release
    const gate = new Promise((accept) => { release = accept })
    await loading.route(/\/assets\/GardenCanvas-.*\.js$/, async (route) => { await gate; await route.continue() })
    await loading.goto(base, { waitUntil: 'domcontentloaded' })
    await loading.getByText('Preparing the world…', { exact: true }).waitFor({ state: 'visible' })
    assert.equal(await loading.getByRole('button', { name: 'Preparing world…', exact: true }).isDisabled(), true)
    await loading.screenshot({ path: resolve('artifacts/garden-loading.png'), fullPage: true })
    release()
    await ready(loading)
    // Use an actual WebGL context loss, rather than replacing the UI state.
    const canLoseContext = await loading.locator('canvas').evaluate((canvas) => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
      extension?.loseContext()
      return Boolean(extension)
    })
    assert(canLoseContext, 'WebGL context-loss extension is required for this recovery check')
    await loading.getByRole('alert').waitFor({ state: 'visible' })
    assert.equal(await loading.getByRole('button', { name: 'Try again', exact: true })
      .evaluate((button) => button === document.activeElement), true, 'Graphics failure must focus recovery')
    await loading.screenshot({ path: resolve('artifacts/garden-error.png'), fullPage: true })
    await Promise.all([loading.waitForEvent('load'), loading.getByRole('button', { name: 'Try again', exact: true }).click()])
    await ready(loading)
    assert.equal(await loading.getByRole('button', { name: 'Enter world', exact: true }).isEnabled(), true)
  } finally { await loading.close() }

  const failed = await page.context().newPage()
  try {
    let rejected = false
    await failed.route(/\/assets\/GardenCanvas-.*\.js$/, (route) => {
      if (!rejected) { rejected = true; return route.abort('failed') }
      return route.continue()
    })
    await failed.goto(base, { waitUntil: 'networkidle' })
    await failed.getByRole('alert').waitFor({ state: 'visible' })
    await Promise.all([failed.waitForEvent('load'), failed.getByRole('button', { name: 'Try again', exact: true }).click()])
    await ready(failed)
    assert.equal(await failed.getByRole('button', { name: 'Enter world', exact: true }).isEnabled(), true)
  } finally { await failed.close() }
  await page.bringToFront()
  await page.setViewportSize({ width: 1440, height: 960 })
  console.log('Experience checks passed: 320/390/768/1440 layouts, keyboard focus, walking resize, touch overview, delayed loading, native context loss/retry, and failed renderer-download recovery.')
}
