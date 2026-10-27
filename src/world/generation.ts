import { z } from 'zod'
import { worldObjectSchema, worldSchema } from './schema'
import type { WorldObject } from './schema'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { terrainHeight } from './terrain'
import { WORLD_SIZE, MAX_GENERATED_OBJECTS, MAX_COMPLEX_OBJECTS, EXPLORATION_GRID_WIDTH } from './limits'
import { isLevelPath } from './paths'
import { objectFitsGround } from './object-bounds'
import { ICON_FOOTPRINT } from './icon-types'
import type { GenerationStyle } from './icon-types'
import { MAX_ICON_OBJECTS, MAX_ICON_ASSETS, MAX_ICON_PLACEMENTS } from './icon-limits'
import { iconFootprintsSeparated } from './icon-layout'
import { composeIconBlueprint } from './icon-composition'
import type { IconPopulation } from './icon-population'

// Reuse the renderer's material/geometry contract; instances keep AI output compact.
const assets = worldObjectSchema.options.filter(schema => schema.shape.type.value !== 'icon')
  .map((schema) => (schema as z.ZodObject).omit({ id: true, position: true, rotation: true, scale: true, collision: true }))
export const blueprintSchema = z.strictObject({
  style: z.literal('standard').optional(),
  name: z.string().trim().min(1).max(80),
  arrival: z.tuple([z.number().min(-64).max(64), z.number().min(-64).max(64)]).optional(),
  ground: worldSchema.shape.ground.extend({ size: z.tuple([z.number().min(24).max(WORLD_SIZE), z.number().min(24).max(WORLD_SIZE)]), hills: z.array(z.strictObject({
    center: z.tuple([z.number().min(-64).max(64), z.number().min(-64).max(64)]),
    radius: z.number().min(2).max(32), height: z.number().min(0).max(6),
  })).max(8).optional() }),
  environment: worldSchema.shape.environment,
  assets: z.array(z.union(assets as [typeof assets[number], typeof assets[number], ...typeof assets[number][]])).min(1).max(14),
  placements: z.array(z.strictObject({
    asset: z.number().int().min(0).max(13),
    position: z.tuple([z.number().min(-64).max(64), z.number().min(-64).max(64)]),
    rotation: z.number().min(-6.29).max(6.29),
    scale: z.tuple([z.number().min(0.3).max(2), z.number().min(0.3).max(2), z.number().min(0.3).max(2)]),
    count: z.number().int().min(1).max(36).optional().describe('For plants use 24–36 instances per drift; for trees use 3–12 per grove; other assets use 1.'),
    spread: z.number().min(0).max(12).optional().describe('Radius in meters of a plant/tree cluster. Use 5–12 for groves across the landscape, 0 for single objects.'),
  })).min(1).max(100),
})

const iconAsset = worldObjectSchema.options[0].omit({ id: true, position: true, rotation: true, scale: true, collision: true })
const grassAsset = z.strictObject({ type: z.literal('plant'), variety: z.literal('grass'),
  color: worldSchema.shape.ground.shape.color, accentColor: worldSchema.shape.ground.shape.color })
const iconPlacements = z.array(blueprintSchema.shape.placements.element.extend({ asset: z.number().int().min(0).max(MAX_ICON_ASSETS - 1) })).min(1).max(MAX_ICON_PLACEMENTS)
const iconCompositionSchema = z.strictObject({
  mode: z.enum(['singles', 'groups', 'mixed']).describe('Choose the world composition from the meaning of the brief.'),
  kinds: z.array(z.strictObject({
    icon: iconAsset.shape.icon,
    mode: z.enum(['single', 'group']).describe('single means exactly one instance of this kind across all palettes; group means intentional repetition.'),
  })).min(1).max(MAX_ICON_ASSETS),
})
export const iconBlueprintSchema = blueprintSchema.extend({
  style: z.literal('icons').optional(),
  composition: iconCompositionSchema.optional(),
  ground: blueprintSchema.shape.ground.extend({
    size: z.tuple([z.number().min(24).max(WORLD_SIZE), z.number().min(24).max(WORLD_SIZE)]),
    hills: blueprintSchema.shape.ground.shape.hills.unwrap().max(0).optional(),
  }),
  assets: z.array(z.union([iconAsset, grassAsset])).min(1).max(MAX_ICON_ASSETS),
  placements: iconPlacements,
})
// Auto uses one provider call. The chosen style is required, then the compiler
// revalidates against that style's narrower contract before building anything.
const autoBlueprintSchema = blueprintSchema.extend({
  style: z.enum(['standard', 'icons']),
  composition: iconCompositionSchema.optional(),
  assets: z.array(z.union([iconAsset, ...assets] as [typeof iconAsset, typeof assets[number], ...typeof assets[number][]])).min(1).max(MAX_ICON_ASSETS),
  placements: iconPlacements,
})
export const blueprintForStyle = (style: GenerationStyle) => style === 'icons' ? iconBlueprintSchema : style === 'auto' ? autoBlueprintSchema : blueprintSchema

function validateIconLayout(objects: WorldObject[]) {
  const icons = objects.filter(object => object.type === 'icon')
  if (!icons.length || icons.length > MAX_ICON_OBJECTS) throw new Error(`Icon layout: use 1–${MAX_ICON_OBJECTS} icon objects.`)
  if (objects.length - icons.length > 96) throw new Error('Icon layout: use at most 96 small grass clumps.')
  // Separating axes of both rotated footprints, with 1.2m of walking clearance.
  // This is deliberately conservative near diagonal corners.
  for (let i = 0; i < icons.length; i++) for (let j = i + 1; j < icons.length; j++) {
    if (!iconFootprintsSeparated(icons[i], icons[j])) throw new Error('Icon layout: leave at least 1.2m between the full rotated icon footprints.')
  }
}

function collisions(object: WorldObject): WorldObject['collision'] {
  const box = (size: [number, number], center: [number, number] = [0, 0]) => ({ kind: 'box' as const, size, center })
  const ellipse = (radii: [number, number], center: [number, number] = [0, 0]) => ({ kind: 'ellipse' as const, radii, center })
  switch (object.type) {
    case 'icon': return [box([...ICON_FOOTPRINT])]
    case 'pond': return [ellipse([object.radii[0] * 1.15, object.radii[1] * 1.15])]
    case 'tree': return [ellipse([0.32, 0.32])]
    case 'rock': return [ellipse([0.7, 0.65])]
    case 'lantern': return [ellipse([0.5, 0.5])]
    case 'entrance': return [ellipse([0.3, 0.3], [-1.2, 0]), ellipse([0.3, 0.3], [1.2, 0])]
    case 'plant': return ['cactus', 'bamboo'].includes(object.variety) ? [ellipse([0.65, 0.65])] : []
    case 'structure':
      if (object.variety === 'fallen-log') return [box([3.1, 0.9])]
      if (object.variety === 'stump') return [ellipse([0.42, 0.42])]
      if (object.variety === 'arch') return [box([0.7, 1], [-1.4, 0]), box([0.7, 1], [1.4, 0])]
      if (object.variety === 'pavilion') return [-1.2, 1.2].flatMap(x => [-1.2, 1.2].map(z => box([0.25, 0.25], [x, z])))
      return [box(object.variety === 'cabin' ? [3, 2.5] : object.variety === 'column' ? [1.2, 1.2] : object.variety === 'bench' ? [1.9, 0.7] : [2.4, 2.4])]
    default: return []
  }
}

export function compileBlueprint(input: unknown, id: string, requestedStyle: GenerationStyle = 'standard', options: { iconPopulation?: IconPopulation } = {}) {
  const style = requestedStyle === 'auto' ? autoBlueprintSchema.parse(input).style : requestedStyle
  let plan = (style === 'icons' ? iconBlueprintSchema : blueprintSchema).parse(input)
  if (style === 'icons' && options.iconPopulation) plan = composeIconBlueprint(iconBlueprintSchema.parse(plan), options.iconPopulation)
  // Preserve hill placement while gently reducing any over-steep AI elevation.
  plan.ground.hills = plan.ground.hills?.map(hill => ({ ...hill, height: Math.min(hill.height, hill.radius * 0.39) }))
  // Night palettes remain atmospheric, but geometry must stay visible for walking.
  plan.environment.ambientIntensity = Math.max(0.75, plan.environment.ambientIntensity)
  plan.environment.sunlight.intensity = Math.max(1.4, plan.environment.sunlight.intensity)
  if (style === 'icons') plan.environment.skyLight ??= { skyColor: '#dbecff', groundColor: '#849a53', intensity: 1.5 }
  const [width, depth] = plan.ground.size
  if (plan.ground.hills?.some(h => Math.abs(h.center[0]) > width / 2 || Math.abs(h.center[1]) > depth / 2)) {
    throw new Error('Hill center outside the world.')
  }
  if (plan.placements.reduce((sum, placement) => sum + (placement.count ?? 1), 0) > MAX_GENERATED_OBJECTS) throw new Error('Too many total instances.')
  const iconCount = plan.placements.reduce((sum, placement) => sum + (plan.assets[placement.asset]?.type === 'icon' ? placement.count ?? 1 : 0), 0)
  if (style === 'icons' && (!iconCount || iconCount > MAX_ICON_OBJECTS)) throw new Error(`Icon layout: use 1–${MAX_ICON_OBJECTS} icon objects.`)
  const packedIcons: WorldObject[] = []
  const placements = plan.placements.flatMap(placement => {
    const asset = plan.assets[placement.asset]
    const count = placement.count ?? 1
    const spread = placement.spread ?? 0
    const iconCluster = style === 'icons' && asset?.type === 'icon'
    if (count > 1 && (!asset || (!iconCluster && !['tree', 'plant'].includes(String(asset.type))) || spread < 0.5)) throw new Error('Only vegetation or icon-world icons can form spaced clusters.')
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963 + placement.rotation
      const radius = count === 1 ? 0 : spread * Math.sqrt(index / (count - 1))
      let position = [placement.position[0] + Math.cos(angle) * radius, placement.position[1] + Math.sin(angle) * radius]
      if (iconCluster) {
        const object = { ...asset, id: 'packing', position: [position[0], 0, position[1]], rotation: placement.rotation, scale: [placement.scale[1], placement.scale[1], placement.scale[1]] } as WorldObject
        if (count > 1) {
          // Search only inside the authored group. Preserve counts, silhouettes,
          // colors and group centers, with exactly the final admission clearance.
          let found = false
          for (let attempt = 0; attempt < 256; attempt++) {
            const a = attempt * 2.399963 + placement.rotation, r = spread * Math.sqrt(attempt / 255)
            object.position = [placement.position[0] + Math.cos(a) * r, 0, placement.position[1] + Math.sin(a) * r]
            if (objectFitsGround(object, plan.ground.size) && packedIcons.every(other => iconFootprintsSeparated(object, other))) { found = true; break }
          }
          if (!found) throw new Error('Icon layout: a repeated group needs more space. Use fewer copies per group or a larger spread.')
        }
        packedIcons.push(object)
        position = [object.position[0], object.position[2]]
      }
      return { ...placement, position }
    })
  })
  if (placements.length > MAX_GENERATED_OBJECTS) throw new Error('Too many total instances.')
  let objects = placements.map((placement, index) => {
    const asset = plan.assets[placement.asset]
    if (!asset) throw new Error('Unknown asset reference.')
    const [x, z] = placement.position
    // Keep icon proportions and bevels uniform; the supplied Y scale controls size.
    const scale = asset.type === 'icon' ? placement.scale.map(() => placement.scale[1]) : placement.scale
    const object = { ...asset, id: `object-${index}`, position: [x, 0, z], rotation: placement.rotation, scale } as WorldObject
    object.collision = collisions(object)
    if (!objectFitsGround(object, plan.ground.size)) {
      // Decorative icon-world grass can be cropped at the edge. The authored
      // icons and every standard-world object still require full bounds checks.
      if (style === 'icons' && object.type === 'plant') return null
      throw new Error(`Object outside the world: ${object.id} (${object.type}) exceeds the ${width} × ${depth}m terrain after size, scale and rotation.`)
    }
    if (object.type === 'pond') {
      const reach = Math.max(object.radii[0] * object.scale[0], object.radii[1] * object.scale[2]) * 1.15
      // Water is level geometry: reserve a flat shore by dropping intersecting
      // hills rather than spending a second provider request to repair terrain.
      plan.ground.hills = plan.ground.hills?.filter(h => Math.hypot(h.center[0] - x, h.center[1] - z) >= h.radius + reach)
    }
    return object
  }).filter((object): object is WorldObject => object !== null)
  if (style === 'icons') validateIconLayout(objects)
  // Remove hillside slabs instead of tilting pavement or flattening the hills.
  objects = objects.filter(object => object.type !== 'path' || isLevelPath(plan.ground, object))
  // Clip soft planting and tree groves around authored water/structure footprints.
  const solidNavigation = createNavigation({ ground: plan.ground, objects: objects.filter(o => ['pond', 'structure', 'entrance', 'rock', 'icon'].includes(o.type)) })
  objects = objects.filter(object => !['plant', 'tree'].includes(object.type) || isWalkable({ x: object.position[0], z: object.position[2] }, solidNavigation))
  const walkingRadius = 0.28
  // Preserve narrow paved routes below overlapping crowns. Gemini may center
  // a grove on a route: move only conflicting trunks to its nearest verge.
  const paths = objects.filter((o): o is Extract<WorldObject, { type: 'path' }> => o.type === 'path')
  const routeOverlap = (tree: WorldObject, path: typeof paths[number]) => {
    const cos = Math.cos(path.rotation), sin = Math.sin(path.rotation)
    const dx = tree.position[0] - path.position[0], dz = tree.position[2] - path.position[2]
    const x = cos * dx - sin * dz, z = sin * dx + cos * dz
    // Trunk plus player clearance; overhead foliage intentionally does not block.
    const radius = 0.32 * Math.max(tree.scale[0], tree.scale[2]) + walkingRadius
    const halfX = path.size[0] * path.scale[0] / 2 + radius
    const halfZ = path.size[1] * path.scale[2] / 2 + radius
    return { x, z, halfX, halfZ, cos, sin, overlaps: Math.abs(x) < halfX && Math.abs(z) < halfZ }
  }
  objects = objects.filter(object => {
    if (object.type !== 'tree') return true
    for (let pass = 0; pass < 8; pass++) {
      const path = paths.find(path => routeOverlap(object, path).overlaps)
      if (!path) return true
      const { x, z, halfX, halfZ, cos, sin } = routeOverlap(object, path)
      const newX = halfX - Math.abs(x) <= halfZ - Math.abs(z) ? (x < 0 ? -1 : 1) * (halfX + 0.02) : x
      const newZ = newX === x ? (z < 0 ? -1 : 1) * (halfZ + 0.02) : z
      object.position = [path.position[0] + cos * newX + sin * newZ, 0, path.position[2] - sin * newX + cos * newZ]
      if (!objectFitsGround(object, plan.ground.size)
        || !isWalkable({ x: object.position[0], z: object.position[2] }, solidNavigation)) return false
    }
    // Intersecting paths can leave no stable verge; omit rather than block them.
    return !paths.some(path => routeOverlap(object, path).overlaps)
  })
  if (style !== 'icons' && objects.filter(o => !['plant', 'path', 'patch'].includes(o.type) || !!o.collision?.length).length > MAX_COMPLEX_OBJECTS) throw new Error('Too many complex objects.')
  if (objects.filter(o => o.type === 'pond').length > 4) throw new Error('Too many water features.')
  const walking = { spawn: [0, 1.65, 0] as [number, number, number], yaw: 0, speed: style === 'icons' ? 3 : 3.6, fov: 65, lookSensitivity: 0.002, radius: 0.28 }
  const navigation = createNavigation({ ground: plan.ground, objects, walking })
  // Bound admission-time work to roughly 4096 samples even at 128m. Every edge
  // still uses exact swept collision, so a coarse grid cannot cross a thin wall.
  const step = Math.max(0.5, Math.max(width, depth) / EXPLORATION_GRID_WIDTH)
  const keyFor = (x: number, z: number) => `${Math.round(x / step)},${Math.round(z / step)}`
  const points = new Map<string, { x: number; z: number }>()
  for (let x = Math.ceil(navigation.bounds.minX / step); x <= navigation.bounds.maxX / step; x++) {
    for (let z = Math.ceil(navigation.bounds.minZ / step); z <= navigation.bounds.maxZ / step; z++) {
      if (isWalkable({ x: x * step, z: z * step }, navigation)) points.set(`${x},${z}`, { x: x * step, z: z * step })
    }
  }
  const unseen = new Set(points.keys())
  let largest: string[] = []
  while (unseen.size) {
    const queue = [unseen.values().next().value!]
    unseen.delete(queue[0])
    for (let i = 0; i < queue.length; i++) {
      const start = points.get(queue[i])!
      for (const [dx, dz] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const key = keyFor(start.x + dx, start.z + dz)
        if (!unseen.has(key)) continue
        const moved = moveWithinGarden(start, { x: dx, z: dz }, navigation)
        if (Math.hypot(moved.x - start.x - dx, moved.z - start.z - dz) > 0.001) continue
        unseen.delete(key); queue.push(key)
      }
    }
    if (queue.length > largest.length) largest = queue
  }
  if (largest.length * step ** 2 < width * depth * 0.25 || largest.length < points.size * 0.7) throw new Error('Not enough connected walking space.')
  const candidates = largest.map(key => points.get(key)!).filter(p =>
    [[0, -1], [1, 0], [-1, 0], [0, 1]].every(([dx, dz]) => {
      const moved = moveWithinGarden(p, { x: dx, z: dz }, navigation)
      return Math.hypot(moved.x - p.x - dx, moved.z - p.z - dz) < 0.001
    }))
  const [arrivalX, arrivalZ] = plan.arrival ?? [0, depth * 0.32]
  if (Math.abs(arrivalX) > width / 2 || Math.abs(arrivalZ) > depth / 2) throw new Error('No clear arrival space: arrival outside the world.')
  candidates.sort((a, b) => Math.hypot(a.x - arrivalX, a.z - arrivalZ) - Math.hypot(b.x - arrivalX, b.z - arrivalZ))
  const spawn = candidates[0]
  if (!spawn) throw new Error('No clear arrival space.')
  walking.spawn = [spawn.x, 1.65, spawn.z]
  if (plan.arrival || style === 'icons') {
    // An authored arrival may be on any edge. Face into the composed route
    // rather than always looking north, which can face out of a forest.
    const focus = style === 'icons' ? objects.filter(o => o.type === 'icon') : paths.length ? paths : objects.filter(o => o.type === 'tree')
    const targetX = focus.length ? focus.reduce((sum, o) => sum + o.position[0], 0) / focus.length : 0
    const targetZ = focus.length ? focus.reduce((sum, o) => sum + o.position[2], 0) / focus.length : 0
    if (Math.hypot(spawn.x - targetX, spawn.z - targetZ) > 0.5) walking.yaw = Math.atan2(spawn.x - targetX, spawn.z - targetZ)
    // Composed icon worlds reserve a straight northbound route from arrival.
    if (style === 'icons' && options.iconPopulation) walking.yaw = 0
  }
  // Move the sun away from the origin so its shadow frustum covers a large land.
  const sunlight = plan.environment.sunlight.position
  const sunDistance = Math.hypot(...sunlight)
  const lightScale = Math.max(width, depth) / Math.max(1, sunDistance)
  if (sunDistance < 1) plan.environment.sunlight.position = [-64, 100, 48]
  else if (lightScale > 1) plan.environment.sunlight.position = sunlight.map(value => value * lightScale) as [number, number, number]
  const elevation = terrainHeight(plan.ground, 0, 0)
  const camera = style === 'icons'
    ? { position: [width * 0.4, Math.max(width, depth) * 0.36, depth * 0.65], target: [0, 1, 0], fov: 45 }
    : { position: [width * 0.85, Math.max(width, depth) * 0.8, depth * 0.95], target: [0, elevation, 0], fov: 45 }
  return worldSchema.parse({ schemaVersion: 1, id, name: plan.name, style, ground: plan.ground, environment: plan.environment, camera, walking, objects })
}
