import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

/** Position near each target through the real import UI, then use real input. */
export async function checkCollisions(page) {
  const world = JSON.parse(await readFile('src/world/open-meadow.json', 'utf8'))
  const canvas = page.locator('.scene canvas')
  const originalCanvas = await canvas.elementHandle()
  const enterAt = async (spawn, yaw = 0) => {
    await page.waitForTimeout(1400)
    const details = page.locator('.world-import')
    if (!await details.evaluate(element => element.open)) await details.locator('summary').click()
    await page.getByLabel('World JSON', { exact: true }).fill(JSON.stringify({ ...world, walking: { ...world.walking, spawn, yaw } }))
    await page.getByRole('button', { name: 'Load world', exact: true }).click()
    await page.waitForFunction(() => document.pointerLockElement === document.querySelector('.scene canvas'))
    await page.locator('.scene[aria-busy="false"]').waitFor()
    await page.waitForTimeout(150)
  }
  const leave = async () => {
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.pointerLockElement === null)
    await page.locator('aside.world-sidebar').waitFor({ state: 'visible' })
  }
  const hold = async (key, milliseconds) => {
    await page.keyboard.down(key)
    await page.waitForTimeout(milliseconds)
    await page.keyboard.up(key)
    await page.waitForTimeout(150)
  }
  await enterAt([0, 1.65, 62.5])
  const spawn = await canvas.screenshot()
  await hold('s', 2500)
  const atEdge = await canvas.screenshot()
  assert(!spawn.equals(atEdge), 'Movement reaches the 64-meter boundary')
  await hold('s', 700)
  assert(atEdge.equals(await canvas.screenshot()), 'Repeated input stops at the large-world edge')
  await hold('w', 400)
  assert(!atEdge.equals(await canvas.screenshot()), 'The player can retreat from the boundary')
  await page.screenshot({ path: resolve('artifacts/meadow-boundary.png'), fullPage: true })
  await leave()
  await enterAt([0, 1.65, 48])
  const beforeArch = await canvas.screenshot()
  await hold('w', 2500)
  assert(!beforeArch.equals(await canvas.screenshot()), 'The enlarged arch opening allows traversal')
  await leave()
  // Approach the middle of one polygon face along its normal. Driving at an
  // ellipse vertex intentionally slides sideways, so it cannot prove a stop.
  const pond = world.objects.find(object => object.type === 'pond')
  const padding = 1 / Math.cos(Math.PI / 32)
  const rx = pond.collision[0].radii[0] * padding, rz = pond.collision[0].radii[1] * padding
  const ax = 0, az = rz, bx = Math.cos(Math.PI / 2 + Math.PI / 16) * rx, bz = Math.sin(Math.PI / 2 + Math.PI / 16) * rz
  const length = Math.hypot(bx - ax, bz - az), nx = (bz - az) / length, nz = -(bx - ax) / length
  await enterAt([pond.position[0] + (ax + bx) / 2 + nx * 1.8, 1.65, pond.position[2] + (az + bz) / 2 + nz * 1.8], Math.atan2(nx, nz))
  await hold('w', 2500)
  const bank = await canvas.screenshot()
  await hold('w', 700)
  assert(bank.equals(await canvas.screenshot()), 'The large pond bank blocks entry into water')
  await hold('s', 500)
  assert(!bank.equals(await canvas.screenshot()), 'The player can retreat from the shore')
  await leave()
  assert(await originalCanvas.evaluate(element => element === document.querySelector('.scene canvas')))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.scene[aria-busy="false"]').waitFor()
  console.log('Large-world collision checks passed: 64m boundary, recovery, arch traversal, large pond approach/retreat, one reused canvas.')
}
