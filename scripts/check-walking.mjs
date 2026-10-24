import assert from 'node:assert/strict'
import { resolve } from 'node:path'

export async function checkWalking(page) {
  const canvas = page.locator('.scene canvas')
  const enter = page.locator('.world-card[aria-pressed="true"]')
  const bounds = await canvas.boundingBox()
  assert(bounds)
  const clip = { x: bounds.x + bounds.width * 0.3, y: bounds.y + bounds.height * 0.2,
    width: bounds.width * 0.4, height: bounds.height * 0.5 }
  const sample = () => page.screenshot({ clip })
  const waitLocked = () => page.waitForFunction(() => document.pointerLockElement === document.querySelector('.scene canvas'))
  const waitOverview = async () => {
    await page.waitForFunction(() => document.pointerLockElement === null)
    await enter.waitFor({ state: 'visible' })
    assert.equal(await enter.evaluate((button) => button === document.activeElement), true, 'Return keyboard focus to the selected thumbnail')
  }
  const enterAgain = async () => {
    // Chromium enforces a cooldown after the user releases pointer lock.
    await page.waitForTimeout(1400)
    await enter.press('Enter')
    await waitLocked()
    await page.locator('.walk-controls').waitFor({ state: 'visible' })
    await page.waitForTimeout(150)
  }

  // Enter through the keyboard, exercising the real user-activation requirement.
  await enter.press('Enter')
  await waitLocked()
  await page.locator('.walk-controls').waitFor({ state: 'visible' })
  await page.waitForTimeout(150)
  const spawn = await sample()
  await page.screenshot({ path: resolve('artifacts/garden-walking.png'), fullPage: true })
  await page.keyboard.down('w')
  await page.waitForTimeout(400)
  await page.keyboard.up('w')
  await page.waitForTimeout(150)
  const moved = await sample()
  assert(!spawn.equals(moved), 'Walking forward must change the rendered view')
  await page.mouse.move(850, 400)
  await page.mouse.move(1000, 440, { steps: 5 })
  await page.waitForTimeout(150)
  assert(!moved.equals(await sample()), 'Mouse look must change the rendered view')
  await page.keyboard.press('Escape')
  await waitOverview()

  await enterAgain()
  assert(spawn.equals(await sample()), 'Re-entry must restore the configured spawn and heading')
  await page.keyboard.press('Tab')
  await waitOverview()

  await enterAgain()
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(150)
  // Real tab focus/visibility loss, while the movement key is still held.
  const other = await page.context().newPage()
  await other.goto('about:blank')
  await other.bringToFront()
  await page.waitForFunction(() => document.pointerLockElement === null)
  await page.bringToFront()
  await waitOverview()
  await enterAgain()
  await page.waitForTimeout(400)
  assert(spawn.equals(await sample()), 'Held input must be cleared after tab-away and re-entry')
  await page.keyboard.up('ArrowUp')
  await other.close()
  await page.keyboard.press('Escape')
  await waitOverview()
  console.log('Walking browser checks passed: keyboard entry, forward movement, mouse look, Escape, Tab, tab-away/resume, cleared held input.')
}
