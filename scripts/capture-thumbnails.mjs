import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { chromium } from 'playwright'
import { preview } from 'vite'

// Capture the actual authored scenes, with no text or controls baked into images.
// Build first. Touch emulation keeps selection in overview mode.
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false } })
let browser
try {
  const address = server.httpServer.address()
  assert(address && typeof address === 'object')
  browser = await chromium.launch({
    channel: process.env.SECRET_WORLD_BROWSER_CHANNEL ?? (process.platform === 'win32' ? 'msedge' : 'chromium'),
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, hasTouch: true })
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'networkidle' })
  await page.locator('.scene[aria-busy="false"]').waitFor()
  await page.addStyleTag({ content: '.intro, .overview-hint, .entry-recovery { visibility: hidden !important; }' })
  await mkdir('public/worlds', { recursive: true })
  const only = process.argv.find(arg => arg.startsWith('--world='))?.split('=')[1]
  const filenames = ['open-meadow', 'silverwood-grove', 'amber-meadow', 'basalt-reach', 'frostlight-grove', 'garden', 'maple-courtyard', 'sandstone-oasis', 'violet-sanctuary', 'icon-world']
  assert(!only || filenames.includes(only), 'Unknown world')
  for (const filename of filenames.filter(name => !only || name === only)) {
    const world = JSON.parse(await readFile(`src/world/${filename}.json`, 'utf8'))
    await page.getByLabel('World style', { exact: true }).selectOption(world.style ?? 'standard')
    const card = page.getByRole('button', { name: world.name, exact: true })
    await card.click()
    await page.locator('.scene[aria-busy="false"]').waitFor()
    await page.waitForTimeout(350)
    const bounds = await page.locator('.scene canvas').boundingBox()
    assert(bounds)
    // Match the card's 16:9 crop, then make scene objects 70% wider within it.
    // This is a fresh scene screenshot, so no runtime CSS zoom is needed.
    const width = Math.min(bounds.width, bounds.height * 16 / 9) / 1.7
    const height = width * 9 / 16
    await page.screenshot({ path: `public/worlds/${world.id}.jpg`, type: 'jpeg', quality: 80,
      clip: { x: bounds.x + (bounds.width - width) / 2, y: bounds.y + (bounds.height - height) / 2, width, height } })
    console.log(`Captured ${world.name}`)
  }
} finally {
  await browser?.close()
  await new Promise((accept, reject) => server.httpServer.close((error) => error ? reject(error) : accept()))
}
