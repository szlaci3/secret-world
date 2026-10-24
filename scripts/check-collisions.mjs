import assert from 'node:assert/strict'
import { resolve } from 'node:path'

/** Real input traversal complements the exact geometry assertions in Vitest. */
export async function checkCollisions(page) {
  const enter = page.getByRole('button', { name: 'Enter world', exact: true })
  const canvas = page.locator('.scene canvas')
  const enterGarden = async () => {
    await page.waitForTimeout(1400) // Chromium's user-exit pointer-lock cooldown.
    await enter.press('Enter')
    await page.waitForFunction(() => document.pointerLockElement === document.querySelector('.scene canvas'))
    await page.getByRole('button', { name: 'Leave walk', exact: true }).waitFor({ state: 'visible' })
    await page.waitForTimeout(150)
  }
  const leave = async () => {
    await page.keyboard.press('Escape')
    await enter.waitFor({ state: 'visible' })
    await page.waitForFunction(() => document.pointerLockElement === null)
  }
  const hold = async (key, milliseconds) => {
    await page.keyboard.down(key)
    await page.waitForTimeout(milliseconds)
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }

  await enterGarden()
  const spawn = await canvas.screenshot()
  // The direct route behind the spawn is clear up to the south garden edge.
  await hold('s', 2000)
  const atEdge = await canvas.screenshot()
  assert(!spawn.equals(atEdge), 'Walking backward must move before reaching the edge')
  await hold('s', 800)
  assert(atEdge.equals(await canvas.screenshot()), 'Repeated outward input must stop at the south edge')
  await page.screenshot({ path: resolve('artifacts/garden-boundary.png'), fullPage: true })
  await hold('w', 400)
  assert(!atEdge.equals(await canvas.screenshot()), 'The player must be able to retreat from a boundary')
  await leave()

  await enterGarden()
  await hold('w', 2800)
  const throughGate = await canvas.screenshot()
  assert(!spawn.equals(throughGate), 'The gate opening must allow forward traversal')
  await hold('d', 1000)
  assert(!throughGate.equals(await canvas.screenshot()), 'The player must be able to approach the pond')
  await page.screenshot({ path: resolve('artifacts/garden-pond-approach.png'), fullPage: true })
  const nearPond = await canvas.screenshot()
  await hold('a', 1000)
  await hold('s', 500)
  assert(!nearPond.equals(await canvas.screenshot()), 'The player must be able to retreat from the pond area')
  await leave()
  console.log('Collision traversal passed: south-edge stop/recovery, gate passage, pond approach/retreat. Exact clearance, water, and prop collision assertions are covered by the navigation unit tests.')
}
