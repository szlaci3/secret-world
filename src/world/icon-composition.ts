import type { z } from 'zod'
import type { iconBlueprintSchema } from './generation'
import type { WorldObject } from './schema'
import type { IconPopulation } from './icon-population'
import { ICON_FOOTPRINT } from './icon-types'
import { MAX_ICON_OBJECTS } from './icon-limits'
import { iconFootprintsSeparated } from './icon-layout'

type Plan = z.infer<typeof iconBlueprintSchema>
type Placement = Plan['placements'][number]
type Icon = Extract<WorldObject, { type: 'icon' }>
function halfExtents(icon: Icon) {
  const c = Math.abs(Math.cos(icon.rotation)), s = Math.abs(Math.sin(icon.rotation))
  const x = ICON_FOOTPRINT[0] * icon.scale[0] / 2, z = ICON_FOOTPRINT[1] * icon.scale[2] / 2
  return [c * x + s * z, s * x + c * z]
}

/** New provider generations only. Saved worlds and raw blueprint compilation keep
 * their authored layouts. Preserve selected subjects/palettes/scale and grouping,
 * but control population, walking clearance and land area deterministically. */
export function composeIconBlueprint(plan: Plan, population: IconPopulation): Plan {
  if (population.target < 1 || population.target > MAX_ICON_OBJECTS) throw new Error(`Icon layout: request 1–${MAX_ICON_OBJECTS} icon objects.`)
  const seeds = plan.placements.flatMap(placement => plan.assets[placement.asset]?.type === 'icon'
    ? Array.from({ length: placement.count ?? 1 }, () => placement) : [])
  if (!seeds.length) throw new Error('Icon layout: choose at least one relevant icon.')
  const unique = new Set(seeds.map(seed => (plan.assets[seed.asset] as { icon: string }).icon)).size
  let count = population.exact ? population.target : Math.max(population.min, Math.min(population.max, seeds.length))
  if (!population.exact && population.max <= 20 && unique < 6) count = Math.min(count, unique * 4)
  const selected = Array.from({ length: count }, (_, index) => seeds[seeds.length > count ? Math.floor(index * seeds.length / count) : index % seeds.length])
  const minX = Math.min(...seeds.map(seed => seed.position[0])), maxX = Math.max(...seeds.map(seed => seed.position[0]))
  const minZ = Math.min(...seeds.map(seed => seed.position[1])), maxZ = Math.max(...seeds.map(seed => seed.position[1]))
  const sourceX = (minX + maxX) / 2, sourceZ = (minZ + maxZ) / 2
  const sourceSpan = Math.max(12, maxX - minX, maxZ - minZ)
  const initialSide = Math.max(28, Math.ceil((Math.sqrt(count) * 5.8 + 6) / 4) * 4)
  for (let side = initialSide; side <= 128; side += 4) {
    const factor = (side - 16) / sourceSpan
    const icons: Icon[] = []
    const placements: Placement[] = []
    let fits = true
    for (const [index, seed] of selected.entries()) {
      const asset = plan.assets[seed.asset] as Extract<Plan['assets'][number], { type: 'icon' }>
      const scale = seed.scale[1]
      const icon = { ...asset, id: `packing-${index}`, position: [0, 0, 0], rotation: seed.rotation, scale: [scale, scale, scale] } as Icon
      const [hx, hz] = halfExtents(icon)
      const preferredX = (seed.position[0] - sourceX) * factor
      const preferredZ = (seed.position[1] - sourceZ) * factor - 3
      let found = false
      for (let attempt = 0; attempt < 1536; attempt++) {
        const angle = attempt * 2.399963 + index * 0.37
        const radius = side * Math.sqrt(attempt / 1535)
        const x = preferredX + Math.cos(angle) * radius, z = preferredZ + Math.sin(angle) * radius
        // Reserve a continuous central walking route, 2m boundary margins and
        // an arrival apron. Packing uses exactly the final footprint clearance.
        if (Math.abs(x) + hx > side / 2 - 2 || z - hz < -side / 2 + 2 || z + hz > side / 2 - 8 || Math.abs(x) - hx < 1.2) continue
        icon.position = [x, 0, z]
        if (!icons.every(other => iconFootprintsSeparated(icon, other))) continue
        found = true; break
      }
      if (!found) { fits = false; break }
      icons.push(icon)
      placements.push({ ...seed, position: [icon.position[0], icon.position[2]], count: 1, spread: 0 })
    }
    if (!fits) continue
    const bounds = icons.map(icon => { const [hx, hz] = halfExtents(icon); return [icon.position[0] - hx, icon.position[0] + hx, icon.position[2] - hz, icon.position[2] + hz] })
    const left = Math.min(-2, ...bounds.map(bound => bound[0] - 2)), right = Math.max(2, ...bounds.map(bound => bound[1] + 2))
    const back = Math.min(...bounds.map(bound => bound[2])) - 2, front = Math.max(...bounds.map(bound => bound[3])) + 8
    const centerX = (left + right) / 2, centerZ = (back + front) / 2
    const width = Math.max(24, Math.ceil((right - left) / 2) * 2), depth = Math.max(24, Math.ceil((front - back) / 2) * 2)
    for (const placement of placements) placement.position = [placement.position[0] - centerX, placement.position[1] - centerZ]
    const grass = plan.placements.filter(placement => plan.assets[placement.asset]?.type === 'plant').map(placement => ({ ...placement,
      position: [(placement.position[0] - sourceX) * factor - centerX, (placement.position[1] - sourceZ) * factor - 3 - centerZ] as [number, number],
      spread: Math.max((placement.count ?? 1) > 1 ? 0.5 : 0, Math.min(12, (placement.spread ?? 0) * Math.min(1, factor))),
    }))
    return { ...plan, ground: { ...plan.ground, size: [width, depth] }, arrival: [-centerX, depth / 2 - 3], placements: [...placements, ...grass] }
  }
  throw new Error('Icon layout: that population and scale need more room. Use smaller icons or fewer objects.')
}
