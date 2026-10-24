import assert from 'node:assert/strict'
import { resolve } from 'node:path'

const ready = (page) => page.waitForFunction(() => document.querySelector('.scene')?.getAttribute('aria-busy') === 'false'
  && !document.querySelector('.scene-notice'))

export async function checkExperience(page, browser, base) {
  for (const width of [320, 390, 768, 900, 901, 1440]) {
    await page.setViewportSize({ width, height: width < 900 ? 844 : 960 })
    await ready(page)
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${width}px`)
    const scene = await page.locator('.scene').boundingBox()
    assert(scene && scene.height >= 330)
    assert.equal(await page.locator('.walk-panel').count(), 0)
    if (width <= 900) {
      const trigger = page.getByRole('button', { name: 'Worlds', exact: true })
      const drawer = page.getByRole('dialog', { name: 'Choose a world', exact: true })
      await trigger.click()
      await drawer.waitFor()
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('Tab')
        assert(await drawer.evaluate((element) => element.contains(document.activeElement) || document.activeElement === document.body), 'Drawer focus must stay out of the background')
      }
      await page.screenshot({ path: resolve(`artifacts/world-drawer-${width}.png`), fullPage: true })
      await page.keyboard.press('Escape')
      await drawer.waitFor({ state: 'hidden' })
      assert(await trigger.evaluate((element) => element === document.activeElement), 'Escape returns focus to Worlds')
      await trigger.click()
      await page.mouse.click(width - 4, 400)
      await drawer.waitFor({ state: 'hidden' })
      assert(await trigger.evaluate((element) => element === document.activeElement), 'Backdrop dismissal returns focus')
    } else assert(await page.getByRole('complementary', { name: 'Choose a world' }).isVisible())
    await page.screenshot({ path: resolve(`artifacts/garden-${width}.png`), fullPage: true })
  }
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  await page.bringToFront()
  await page.keyboard.press('Tab')
  assert(await page.locator('.wordmark').evaluate((element) => element === document.activeElement))
  await page.keyboard.press('Tab')
  const card = page.locator('.world-card[aria-pressed="true"]')
  assert(await card.evaluate((element) => element.matches(':focus-visible')), 'Thumbnail must be reachable with visible keyboard focus')
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.world-card[aria-pressed="true"] .world-description')).opacity === '1')
  await page.waitForTimeout(1400)
  await card.press('Enter')
  await page.waitForFunction(() => Boolean(document.pointerLockElement) || Boolean(document.querySelector('.entry-recovery')))
  assert(await page.evaluate(() => Boolean(document.pointerLockElement)), 'Keyboard thumbnail selection must capture the mouse')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(200)
  assert(await page.evaluate(() => Boolean(document.pointerLockElement)), 'Resizing preserves walking')
  await page.screenshot({ path: resolve('artifacts/garden-narrow-walking.png'), fullPage: true })
  await page.keyboard.press('Escape')
  const worlds = page.getByRole('button', { name: 'Worlds', exact: true })
  await worlds.waitFor()
  assert(await worlds.evaluate((element) => element === document.activeElement))
  await page.waitForTimeout(1400)
  await worlds.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Sandstone Oasis', exact: true }).click()
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  assert.equal(await page.locator('h1').textContent(), 'Sandstone Oasis', 'Drawer selection enters directly too')
  await page.keyboard.press('Escape')

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const touch = await touchContext.newPage()
    await touch.goto(base, { waitUntil: 'networkidle' })
    await ready(touch)
    await touch.getByRole('button', { name: 'Worlds', exact: true }).click()
    await touch.getByRole('dialog').getByRole('button', { name: 'Amber Meadow', exact: true }).tap()
    await ready(touch)
    assert.equal(await touch.locator('h1').textContent(), 'Amber Meadow')
    assert.equal(await touch.evaluate(() => document.pointerLockElement), null)
    assert(await touch.getByText('Enjoy the overview. Walking needs a keyboard and mouse.').isVisible())
    assert(await touch.locator('.intro > p:last-child').isVisible(), 'Touch users can read the selected description without hovering')
    assert.equal(await touch.getByRole('dialog').count(), 0, 'Touch selection closes the drawer')
    await touch.screenshot({ path: resolve('artifacts/garden-touch.png'), fullPage: true })
    await touch.getByRole('button', { name: 'Worlds', exact: true }).tap()
    await touch.getByRole('dialog').locator('summary').tap()
    await touch.waitForFunction(() => {
      const drawer = document.querySelector('.world-drawer')
      return Math.abs(drawer.scrollHeight - drawer.clientHeight - drawer.scrollTop) < 2
    })
    await touch.screenshot({ path: resolve('artifacts/world-import-touch.png'), fullPage: true })
  } finally { await touchContext.close() }

  const loading = await page.context().newPage()
  try {
    let release
    const gate = new Promise((accept) => { release = accept })
    await loading.route(/\/assets\/GardenCanvas-.*\.js$/, async (route) => { await gate; await route.continue() })
    await loading.goto(base, { waitUntil: 'domcontentloaded' })
    await loading.getByText('Preparing the world…', { exact: true }).waitFor()
    assert.equal(await loading.locator('.world-card:visible').count(), 0, 'Loading cannot trigger a premature entry')
    await loading.screenshot({ path: resolve('artifacts/garden-loading.png'), fullPage: true })
    release()
    await ready(loading)
    await loading.setViewportSize({ width: 390, height: 844 })
    await loading.getByRole('button', { name: 'Worlds', exact: true }).click()
    await loading.getByRole('dialog').waitFor()
    const canLoseContext = await loading.locator('canvas').evaluate((canvas) => {
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')
      extension?.loseContext()
      return Boolean(extension)
    })
    assert(canLoseContext)
    await loading.getByRole('alert').waitFor()
    await loading.getByRole('dialog').waitFor({ state: 'hidden' })
    const retry = loading.getByRole('button', { name: 'Try again', exact: true })
    assert(await retry.evaluate((element) => element === document.activeElement), 'Graphics failure dismisses drawer and focuses recovery')
    await loading.screenshot({ path: resolve('artifacts/garden-error.png'), fullPage: true })
    await Promise.all([loading.waitForEvent('load'), retry.click()])
    await ready(loading)
  } finally { await loading.close() }

  const failed = await page.context().newPage()
  try {
    let rejected = false
    await failed.route(/\/assets\/GardenCanvas-.*\.js$/, (route) => {
      if (!rejected) { rejected = true; return route.abort('failed') }
      return route.continue()
    })
    await failed.goto(base, { waitUntil: 'networkidle' })
    await failed.getByRole('alert').waitFor()
    await Promise.all([failed.waitForEvent('load'), failed.getByRole('button', { name: 'Try again', exact: true }).click()])
    await ready(failed)
  } finally { await failed.close() }

  // A browser that refuses pointer lock must offer a visible, focused retry.
  const declined = await page.context().newPage()
  try {
    await declined.addInitScript(() => { HTMLCanvasElement.prototype.requestPointerLock = () => Promise.reject(new Error('Declined for inspection')) })
    await declined.goto(base, { waitUntil: 'networkidle' })
    await ready(declined)
    await declined.getByRole('button', { name: 'Sandstone Oasis', exact: true }).click()
    await ready(declined)
    const retry = declined.getByRole('button', { name: 'Click to begin', exact: true })
    await retry.waitFor()
    assert.equal(await declined.locator('h1').textContent(), 'Sandstone Oasis')
    assert(await retry.evaluate((element) => element === document.activeElement), 'Declined capture focuses the retry')
    await declined.screenshot({ path: resolve('artifacts/world-capture-declined.png'), fullPage: true })
  } finally { await declined.close() }
  await page.bringToFront()
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  console.log('Experience checks passed: responsive sidebar/drawer at 320–1440px, modal focus/Escape/backdrop, keyboard descriptions and entry, walking resize, direct drawer entry, touch selection, delayed loading, context-loss/download recovery, and declined-capture retry.')
}
