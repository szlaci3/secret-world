import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const ready = (page) => page.waitForFunction(() => document.querySelector('.scene')?.getAttribute('aria-busy') === 'false'
  && !document.querySelector('.scene-notice'))

export async function checkWorlds(page) {
  const garden = JSON.parse(await readFile('src/world/garden.json', 'utf8'))
  const courtyard = JSON.parse(await readFile('src/world/maple-courtyard.json', 'utf8'))
  const worlds = page.getByRole('button', { name: 'Worlds', exact: true })
  const dialog = page.getByRole('dialog', { name: 'Choose a world', exact: true })
  const draft = dialog.getByRole('textbox', { name: 'World JSON', exact: true })
  const load = dialog.getByRole('button', { name: 'Load world', exact: true })
  const open = async () => { await worlds.click(); await dialog.waitFor({ state: 'visible' }) }
  const loaded = async (name) => {
    await dialog.waitFor({ state: 'hidden' })
    await page.waitForFunction((expected) => document.querySelector('h1')?.textContent === expected, name)
    await ready(page)
  }

  await open()
  await dialog.locator('summary').click()
  for (let index = 0; index < 12; index++) {
    await page.keyboard.press('Tab')
    // A native dialog can hand focus to browser chrome at the page boundary;
    // background application controls must remain unreachable/inert.
    assert(await dialog.evaluate((element) => element.contains(document.activeElement) || document.activeElement === document.body),
      'Modal keyboard focus must not enter background application controls')
  }
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'hidden' })
  assert(await worlds.evaluate((button) => button === document.activeElement), 'Closing picker must restore trigger focus')

  const originalCanvas = await page.locator('.scene canvas').elementHandle()
  await open()
  const invalid = [
    ['{broken', /not valid JSON/],
    [JSON.stringify({ ...garden, schemaVersion: 2 }), /Only schema version 1/],
    [JSON.stringify({ ...garden, walking: { ...garden.walking, spawn: [3.1, 1.65, 0.1] } }), /walking.spawn/],
    [JSON.stringify({ ...garden, script: 'untrusted code' }), /Unrecognized key/],
  ]
  for (const [text, expected] of invalid) {
    await draft.fill(text)
    await load.click()
    assert.match(await dialog.getByRole('alert').textContent(), expected)
    assert.match(await dialog.getByRole('alert').textContent(), /current world is unchanged/)
    assert.equal(await page.locator('h1').textContent(), garden.name)
    assert(await originalCanvas.evaluate((canvas) => canvas === document.querySelector('.scene canvas')), 'Rejected input must preserve the live canvas')
  }
  await page.screenshot({ path: resolve('artifacts/world-import-error.png'), fullPage: true })
  await dialog.locator('input[type="file"]').setInputFiles({ name: 'too-large.json', mimeType: 'application/json', buffer: Buffer.alloc(1024 * 1024 + 1, ' ') })
  assert.match(await dialog.getByRole('alert').textContent(), /no larger than 1 MiB/)
  assert.equal(await draft.inputValue(), '')
  assert.equal(await load.isDisabled(), true)

  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'maple-courtyard.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(courtyard)),
  })
  await load.click()
  await loaded(courtyard.name)
  assert.equal(await originalCanvas.evaluate((canvas) => canvas === document.querySelector('.scene canvas')), true,
    'Accepted worlds should reuse the renderer while replacing scene data and the walking session')
  await originalCanvas.dispose()
  await page.screenshot({ path: resolve('artifacts/world-maple-courtyard.png'), fullPage: true })

  const enter = page.getByRole('button', { name: 'Enter world', exact: true })
  // Native modal tab cycling can activate browser chrome in headless Edge.
  await page.bringToFront()
  await page.waitForTimeout(1400)
  await enter.press('Enter')
  await page.waitForFunction(() => Boolean(document.pointerLockElement))
  const spawn = await page.locator('.scene canvas').screenshot()
  await page.keyboard.down('w')
  await page.waitForTimeout(400)
  await page.keyboard.up('w')
  await page.waitForTimeout(150)
  assert(!spawn.equals(await page.locator('.scene canvas').screenshot()), 'The imported world must support walking from its own spawn')
  assert.equal(await worlds.isDisabled(), true, 'World replacement requires leaving the walk first')
  await page.keyboard.press('Escape')
  await enter.waitFor({ state: 'visible' })

  await open()
  await draft.fill(JSON.stringify({ ...courtyard, name: 'Courtyard from JSON' }))
  await load.click()
  await loaded('Courtyard from JSON')
  await open()
  await draft.fill('{still broken')
  await load.click()
  assert.equal(await page.locator('h1').textContent(), 'Courtyard from JSON', 'Rejection must keep an imported world too')
  await dialog.getByRole('button', { name: 'The Quiet Garden', exact: true }).click()
  await loaded(garden.name)
  await open()
  for (const filename of ['sandstone-oasis', 'frostlight-grove', 'amber-meadow', 'basalt-reach', 'violet-sanctuary', 'garden', 'sandstone-oasis']) {
    const fixture = JSON.parse(await readFile(`src/world/${filename}.json`, 'utf8'))
    const canvas = await page.locator('.scene canvas').elementHandle()
    await dialog.getByRole('button', { name: fixture.name, exact: true }).click()
    await loaded(fixture.name)
    assert(await canvas.evaluate((element) => element === document.querySelector('.scene canvas')), 'Switching must reuse the WebGL canvas')
    await canvas.dispose()
    await page.screenshot({ path: resolve(`artifacts/world-${fixture.id}.png`), fullPage: true })
    await page.bringToFront()
    await page.waitForTimeout(1400)
    await enter.press('Enter')
    await page.waitForFunction(() => Boolean(document.pointerLockElement))
    const start = await page.locator('.scene canvas').screenshot()
    await page.screenshot({ path: resolve(`artifacts/walking-${fixture.id}.png`), fullPage: true })
    await page.keyboard.down('w')
    await page.waitForTimeout(400)
    await page.keyboard.up('w')
    await page.waitForTimeout(150)
    assert(!start.equals(await page.locator('.scene canvas').screenshot()), `${fixture.name} must be walkable`)
    assert(await worlds.isDisabled(), 'Picker must stay disabled while walking')
    await page.keyboard.press('Escape')
    await open()
    assert.equal(await dialog.getByRole('button', { name: fixture.name, exact: true }).getAttribute('aria-pressed'), 'true')
    await page.setViewportSize({ width: 320, height: 844 })
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'World cards must fit at 320px')
    await page.screenshot({ path: resolve(`artifacts/world-picker-${fixture.id}-320.png`), fullPage: true })
    await page.setViewportSize({ width: 1440, height: 960 })
  }
  await dialog.getByRole('button', { name: 'Close', exact: true }).click()
  await open()
  const { walking: _, ...overview } = courtyard
  await draft.fill(JSON.stringify({ ...overview, name: 'Overview World' }))
  await load.click()
  await loaded('Overview World')
  assert.equal(await page.getByRole('button', { name: 'World overview', exact: true }).isDisabled(), true)

  await page.setViewportSize({ width: 320, height: 844 })
  await open()
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow world picker must not overflow')
  await page.screenshot({ path: resolve('artifacts/world-picker-320.png'), fullPage: true })
  await dialog.getByRole('button', { name: 'The Quiet Garden', exact: true }).click()
  await loaded(garden.name)
  await page.setViewportSize({ width: 1440, height: 960 })
  await open()
  await page.locator('.scene canvas').evaluate((canvas) => canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext())
  await dialog.waitFor({ state: 'hidden' })
  const retry = page.getByRole('button', { name: 'Try again', exact: true })
  await retry.waitFor({ state: 'visible' })
  assert(await retry.evaluate((button) => button === document.activeElement), 'A graphics failure must dismiss the modal and focus recovery')
  await Promise.all([page.waitForEvent('load'), retry.click()])
  await ready(page)
  console.log('World import checks passed: modal focus/Escape, malformed/version/spawn/unknown-field rejection without canvas replacement, oversized files, valid file/paste replacement, imported-world walking, all six world buttons and repeat switches, overview-only worlds, and narrow layout.')
}
