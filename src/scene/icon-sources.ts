import type { IconName } from '../world/icon-types'

// The original world remains available without asset fetches. The wider catalog
// is same-origin static SVG, fetched only for names admitted by the world schema.
const legacy = import.meta.glob<string>('../assets/tabler/*.svg', { query: '?raw', import: 'default', eager: true })
const sources = new Map<IconName, string>()
const pending = new Map<IconName, Promise<void>>()
for (const [path, svg] of Object.entries(legacy)) sources.set(path.split('/').pop()!.replace('.svg', '') as IconName, svg)

export function preloadIcons(names: IconName[]): Promise<void> {
  return Promise.all([...new Set(names)].map(name => {
    if (sources.has(name)) return
    let promise = pending.get(name)
    if (!promise) {
      promise = fetch(`${import.meta.env.BASE_URL}tabler/${name}.svg`).then(async response => {
        if (!response.ok) throw new Error(`Could not load icon ${name}`)
        const svg = await response.text()
        if (!svg.includes('<svg')) throw new Error(`Invalid icon asset ${name}`)
        sources.set(name, svg)
      }).finally(() => pending.delete(name))
      pending.set(name, promise)
    }
    return promise
  })).then(() => undefined)
}

export function iconSource(name: IconName): string {
  const svg = sources.get(name)
  if (!svg) throw new Error(`Icon ${name} was not prepared`)
  return svg
}

// Called above Canvas so all SVGs load concurrently, and the existing loading /
// error boundary covers downloads before walking controls report readiness.
const resources = new Map<string, { promise: Promise<void>; error?: unknown; done: boolean }>()
export function readIcons(names: IconName[]) {
  if (names.every(name => sources.has(name))) return
  const key = [...new Set(names)].sort().join(',')
  let resource = resources.get(key)
  if (!resource) {
    resource = { done: false, promise: Promise.resolve() }
    const current = resource
    current.promise = preloadIcons(names).then(() => { current.done = true; resources.delete(key) }, error => { current.error = error; current.done = true })
    resources.set(key, current)
  }
  if (!resource.done) throw resource.promise
  resources.delete(key) // A retry may fetch again after a transient failure.
  if (resource.error) throw resource.error
}
