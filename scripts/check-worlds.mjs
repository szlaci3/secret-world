import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ready = (page) => page.waitForFunction(() => document.querySelector('.scene')?.getAttribute('aria-busy') === 'false'
  && !document.querySelector('.scene-notice'))
const locked = (page) => page.waitForFunction(() => document.pointerLockElement === document.querySelector('.scene canvas'))
const leave = async (page) => {
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.pointerLockElement)
  await page.getByRole('complementary', { name: 'Choose a world', exact: true }).waitFor()
  await page.waitForTimeout(1400) // Browser cooldown after an explicit unlock.
}

export async function checkWorlds(page) {
  const garden = JSON.parse(await readFile('src/world/garden.json', 'utf8'))
  const courtyard = JSON.parse(await readFile('src/world/maple-courtyard.json', 'utf8'))
  const sidebar = page.getByRole('complementary', { name: 'Choose a world', exact: true })
  const draft = sidebar.getByRole('textbox', { name: 'World JSON', exact: true })
  const load = sidebar.getByRole('button', { name: 'Load world', exact: true })
  const loaded = async (name) => {
    await page.waitForFunction((expected) => document.querySelector('h1')?.textContent === expected, name)
    await ready(page)
  }
  const originalCanvas = await page.locator('.scene canvas').elementHandle()
  assert.equal(await page.locator('canvas').count(), 1, 'Thumbnails must not create extra canvases')
  for (const image of await sidebar.locator('img').all()) {
    await image.scrollIntoViewIfNeeded()
    await image.evaluate((element) => element.decode())
    assert(await image.evaluate((element) => element.naturalWidth > 0), 'Each screenshot must load')
  }
  await sidebar.evaluate((element) => { element.scrollTop = element.scrollHeight })
  await sidebar.locator('summary').click()
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('aside.world-sidebar')
    return Math.abs(sidebar.scrollHeight - sidebar.clientHeight - sidebar.scrollTop) < 2
  })
  assert(await load.evaluate((element) => element.getBoundingClientRect().bottom <= element.closest('.world-sidebar').getBoundingClientRect().bottom + 1), 'Expanding imports from the bottom must reveal the form without another scroll')
  const invalid = [
    ['{broken', /not valid JSON/],
    [JSON.stringify({ ...garden, schemaVersion: 2 }), /Only schema version 1/],
    [JSON.stringify({ ...garden, walking: { ...garden.walking, spawn: [3.1, 1.65, 0.1] } }), /walking.spawn/],
    [JSON.stringify({ ...garden, script: 'untrusted code' }), /Unrecognized key/],
  ]
  for (const [text, expected] of invalid) {
    await draft.fill(text)
    await load.click()
    assert.match(await sidebar.getByRole('alert').textContent(), expected)
    assert.match(await sidebar.getByRole('alert').textContent(), /current world is unchanged/)
    assert.equal(await page.locator('h1').textContent(), garden.name)
    assert(await originalCanvas.evaluate((canvas) => canvas === document.querySelector('.scene canvas')))
    assert.equal(await page.evaluate(() => document.pointerLockElement), null, 'Rejected input must not capture the mouse')
  }
  await page.screenshot({ path: resolve('artifacts/world-import-error.png'), fullPage: true })
  await sidebar.locator('input[type="file"]').setInputFiles({ name: 'too-large.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 1, ' ') })
  assert.match(await sidebar.getByRole('alert').textContent(), /no larger than 1 MiB/)
  assert.equal(await draft.inputValue(), '')
  assert.equal(await load.isDisabled(), true)
  await sidebar.locator('input[type="file"]').setInputFiles({
    name: 'maple-courtyard.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(courtyard)),
  })
  await load.click()
  await loaded(courtyard.name)
  await locked(page)
  assert(await originalCanvas.evaluate((canvas) => canvas === document.querySelector('.scene canvas')), 'Import must reuse the renderer')
  const spawn = await page.locator('.scene canvas').screenshot()
  await page.keyboard.down('w')
  await page.waitForTimeout(400)
  await page.keyboard.up('w')
  await page.waitForTimeout(150)
  assert(!spawn.equals(await page.locator('.scene canvas').screenshot()), 'An imported world must be immediately walkable')
  await leave(page)
  assert(await sidebar.locator('summary').evaluate((element) => element === document.activeElement), 'Imported worlds return focus to import controls')
  await draft.fill(JSON.stringify({ ...courtyard, name: 'Courtyard from JSON' }))
  await load.click()
  await loaded('Courtyard from JSON')
  await locked(page)
  await leave(page)
  await draft.fill('{still broken')
  await load.click()
  assert.equal(await page.locator('h1').textContent(), 'Courtyard from JSON')

  for (const filename of ['garden', 'sandstone-oasis', 'frostlight-grove', 'amber-meadow', 'basalt-reach', 'violet-sanctuary', 'garden', 'sandstone-oasis']) {
    const fixture = JSON.parse(await readFile(`src/world/${filename}.json`, 'utf8'))
    const card = sidebar.getByRole('button', { name: fixture.name, exact: true })
    await card.click()
    await loaded(fixture.name)
    await locked(page)
    assert(await originalCanvas.evaluate((element) => element === document.querySelector('.scene canvas')), 'Switching must preserve the canvas and capture')
    assert.equal(await sidebar.isVisible(), false, 'Sidebar collapses during walking')
    assert.equal(await page.locator('.walk-panel').count(), 0, 'The pre-entry panel is removed')
    assert.equal(await page.getByRole('button', { name: 'Leave walk', exact: true }).count(), 0, 'Walking has keyboard exit hints without an unreachable button')
    const start = await page.locator('.scene canvas').screenshot()
    await page.screenshot({ path: resolve(`artifacts/walking-${fixture.id}.png`), fullPage: true })
    await page.keyboard.down('w')
    await page.waitForTimeout(400)
    await page.keyboard.up('w')
    await page.waitForTimeout(150)
    assert(!start.equals(await page.locator('.scene canvas').screenshot()), `${fixture.name} must be walkable from one thumbnail click`)
    await leave(page)
    assert.equal(await card.getAttribute('aria-pressed'), 'true')
    assert(await card.evaluate((element) => element === document.activeElement), 'Escape restores selected-card focus')
    await page.screenshot({ path: resolve(`artifacts/world-${fixture.id}.png`), fullPage: true })
  }
  const { walking: _, ...overview } = courtyard
  await draft.fill(JSON.stringify({ ...overview, name: 'Overview World' }))
  await load.click()
  await loaded('Overview World')
  assert.equal(await page.evaluate(() => document.pointerLockElement), null, 'Overview-only imports must not capture the mouse')
  assert(await page.getByText('An overview to enjoy at your own pace.').isVisible())
  await originalCanvas.dispose()
  // Restore the initial world for any following inspections.
  await page.reload({ waitUntil: 'networkidle' })
  await ready(page)
  console.log('World checks passed: six screenshot images and one canvas, invalid/oversized imports preserve the scene, file/paste imports enter directly, all six thumbnails enter with real pointer lock, repeated switches, focus return, and overview-only imports.')
}
