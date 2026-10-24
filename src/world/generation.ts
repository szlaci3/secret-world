import { z } from 'zod'
import { worldObjectSchema, worldSchema } from './schema'
import type { WorldObject } from './schema'
import { createNavigation, isWalkable, moveWithinGarden } from '../controls/navigation'
import { terrainHeight } from './terrain'

// Reuse the renderer's material/geometry contract; instances keep AI output compact.
const assets = worldObjectSchema.options.map((schema) => (schema as z.ZodObject).omit({ id: true, position: true, rotation: true, scale: true, collision: true }))
export const blueprintSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  ground: worldSchema.shape.ground.extend({ hills: z.array(z.strictObject({
    center: z.tuple([z.number().min(-18).max(18), z.number().min(-18).max(18)]),
    radius: z.number().min(2).max(12), height: z.number().min(0).max(3),
  })).max(8).optional() }),
  environment: worldSchema.shape.environment,
  assets: z.array(z.union(assets as [typeof assets[number], typeof assets[number], ...typeof assets[number][]])).min(1).max(14),
  placements: z.array(z.strictObject({
    asset: z.number().int().min(0).max(13),
    position: z.tuple([z.number().min(-20).max(20), z.number().min(-20).max(20)]),
    rotation: z.number().min(-6.29).max(6.29),
    scale: z.tuple([z.number().min(0.3).max(2), z.number().min(0.3).max(2), z.number().min(0.3).max(2)]),
    count: z.number().int().min(1).max(12).optional().describe('For plant/tree groves: number of instances in this deliberately placed cluster; otherwise 1.'),
    spread: z.number().min(0).max(4).optional().describe('Radius in meters of a plant/tree cluster. Use 2–4 for groves, 0 for single objects.'),
  })).min(12).max(100),
})

function collisions(object: WorldObject): WorldObject['collision'] {
  const box = (size: [number, number], center: [number, number] = [0, 0]) => ({ kind: 'box' as const, size, center })
  const ellipse = (radii: [number, number], center: [number, number] = [0, 0]) => ({ kind: 'ellipse' as const, radii, center })
  switch (object.type) {
    case 'pond': return [ellipse([object.radii[0] * 1.15, object.radii[1] * 1.15])]
    case 'tree': return [ellipse([0.32, 0.32])]
    case 'rock': return [ellipse([0.7, 0.65])]
    case 'lantern': return [ellipse([0.5, 0.5])]
    case 'entrance': return [ellipse([0.3, 0.3], [-1.2, 0]), ellipse([0.3, 0.3], [1.2, 0])]
    case 'plant': return ['cactus', 'bamboo'].includes(object.variety) ? [ellipse([0.65, 0.65])] : []
    case 'structure':
      if (object.variety === 'arch') return [box([0.7, 1], [-1.4, 0]), box([0.7, 1], [1.4, 0])]
      if (object.variety === 'pavilion') return [-1.2, 1.2].flatMap(x => [-1.2, 1.2].map(z => box([0.25, 0.25], [x, z])))
      return [box(object.variety === 'cabin' ? [3, 2.5] : object.variety === 'column' ? [1.2, 1.2] : object.variety === 'bench' ? [1.9, 0.7] : [2.4, 2.4])]
    default: return []
  }
}

export function compileBlueprint(input: unknown, id: string) {
  const plan = blueprintSchema.parse(input)
  // Preserve hill placement while gently reducing any over-steep AI elevation.
  plan.ground.hills = plan.ground.hills?.map(hill => ({ ...hill, height: Math.min(hill.height, hill.radius * 0.39) }))
  // Night palettes remain atmospheric, but geometry must stay visible for walking.
  plan.environment.ambientIntensity = Math.max(0.75, plan.environment.ambientIntensity)
  plan.environment.sunlight.intensity = Math.max(1.4, plan.environment.sunlight.intensity)
  const [width, depth] = plan.ground.size
  if (width < 16 || depth < 16 || width > 36 || depth > 36) throw new Error('World dimensions must be 16–36 meters.')
  const placements = plan.placements.flatMap(placement => {
    const asset = plan.assets[placement.asset]
    const count = placement.count ?? 1
    const spread = placement.spread ?? 0
    if (count > 1 && (!asset || !['tree', 'plant'].includes(String(asset.type)) || spread < 0.5)) throw new Error('Only vegetation can form spaced clusters.')
    return Array.from({ length: count }, (_, index) => {
      const angle = index * 2.399963 + placement.rotation
      const radius = count === 1 ? 0 : spread * Math.sqrt(index / (count - 1))
      return { ...placement, position: [placement.position[0] + Math.cos(angle) * radius,
        placement.position[1] + Math.sin(angle) * radius] }
    })
  })
  if (placements.length > 100) throw new Error('Too many total instances.')
  let objects = placements.map((placement, index) => {
    const asset = plan.assets[placement.asset]
    if (!asset) throw new Error('Unknown asset reference.')
    const [x, z] = placement.position
    if (Math.abs(x) > width / 2 - 1 || Math.abs(z) > depth / 2 - 1) throw new Error('Object outside the world.')
    const object = { ...asset, id: `object-${index}`, position: [x, 0, z], rotation: placement.rotation, scale: placement.scale } as WorldObject
    object.collision = collisions(object)
    if (object.type === 'pond') {
      const reach = Math.max(object.radii[0] * object.scale[0], object.radii[1] * object.scale[2]) * 1.15
      if (Math.abs(x) + reach > width / 2 || Math.abs(z) + reach > depth / 2) throw new Error('Water extends beyond the shore.')
      // Water is level geometry: reserve a flat shore by dropping intersecting
      // hills rather than spending a second provider request to repair terrain.
      plan.ground.hills = plan.ground.hills?.filter(h => Math.hypot(h.center[0] - x, h.center[1] - z) >= h.radius + reach)
    }
    return object
  })
  // Clip soft planting and tree groves around authored water/structure footprints.
  const solidNavigation = createNavigation({ ground: plan.ground, objects: objects.filter(o => ['pond', 'structure', 'entrance', 'rock'].includes(o.type)) })
  objects = objects.filter(object => !['plant', 'tree'].includes(object.type) || isWalkable({ x: object.position[0], z: object.position[2] }, solidNavigation))
  if (objects.filter(o => !['plant', 'path', 'patch'].includes(o.type)).length > 40) throw new Error('Too many complex objects.')
  if (objects.filter(o => o.type === 'pond').length > 4) throw new Error('Too many water features.')
  const walking = { spawn: [0, 1.65, 0] as [number, number, number], yaw: 0, speed: 2.4, fov: 65, lookSensitivity: 0.002, radius: 0.28 }
  const navigation = createNavigation({ ground: plan.ground, objects, walking })
  // Find the largest connected half-meter walking region, using swept collision.
  const points = new Map<string, { x: number; z: number }>()
  for (let x = Math.ceil(navigation.bounds.minX * 2); x <= navigation.bounds.maxX * 2; x++) {
    for (let z = Math.ceil(navigation.bounds.minZ * 2); z <= navigation.bounds.maxZ * 2; z++) {
      if (isWalkable({ x: x / 2, z: z / 2 }, navigation)) points.set(`${x},${z}`, { x: x / 2, z: z / 2 })
    }
  }
  const unseen = new Set(points.keys())
  let largest: string[] = []
  while (unseen.size) {
    const queue = [unseen.values().next().value!]
    unseen.delete(queue[0])
    for (let i = 0; i < queue.length; i++) {
      const start = points.get(queue[i])!
      for (const [dx, dz] of [[0.5, 0], [-0.5, 0], [0, 0.5], [0, -0.5]]) {
        const key = `${(start.x + dx) * 2},${(start.z + dz) * 2}`
        if (!unseen.has(key)) continue
        const moved = moveWithinGarden(start, { x: dx, z: dz }, navigation)
        if (Math.hypot(moved.x - start.x - dx, moved.z - start.z - dz) > 0.001) continue
        unseen.delete(key); queue.push(key)
      }
    }
    if (queue.length > largest.length) largest = queue
  }
  if (largest.length < width * depth || largest.length < points.size * 0.7) throw new Error('Not enough connected walking space.')
  const candidates = largest.map(key => points.get(key)!).filter(p =>
    [[0, -1], [1, 0], [-1, 0], [0, 1]].every(([dx, dz]) => {
      const moved = moveWithinGarden(p, { x: dx, z: dz }, navigation)
      return Math.hypot(moved.x - p.x - dx, moved.z - p.z - dz) < 0.001
    }))
  candidates.sort((a, b) => Math.hypot(a.x, a.z - depth * 0.32) - Math.hypot(b.x, b.z - depth * 0.32))
  const spawn = candidates[0]
  if (!spawn) throw new Error('No clear arrival space.')
  walking.spawn = [spawn.x, 1.65, spawn.z]
  const elevation = terrainHeight(plan.ground, 0, 0)
  return worldSchema.parse({ schemaVersion: 1, id, name: plan.name, ground: plan.ground, environment: plan.environment,
    camera: { position: [width * 0.85, Math.max(width, depth) * 0.8, depth * 0.95], target: [0, elevation, 0], fov: 45 }, walking, objects })
}
