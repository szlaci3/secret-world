import { z } from 'zod'
import { collisionShapeSchema } from './collision-schema'
import { createNavigation, isWalkable } from '../controls/navigation'
import { WORLD_SIZE, MAX_GENERATED_OBJECTS } from './limits'

const coordinate = z.number().finite().min(-1000).max(1000)
const vector3 = z.tuple([coordinate, coordinate, coordinate])
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color')
const intensity = z.number().finite().min(0).max(10)
const dimension = z.number().finite().min(0.01).max(20)
const pathDimension = z.number().finite().min(0.01).max(WORLD_SIZE)
const identifier = z.string().max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const transform = {
  id: identifier,
  position: vector3,
  // Rotation around the Y axis, in radians. Local object origins sit on ground.
  rotation: z.number().finite(),
  scale: z.tuple([dimension, dimension, dimension]),
  collision: z.array(collisionShapeSchema).max(8).optional(),
}

export const worldObjectSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...transform, type: z.literal('path'), size: z.tuple([pathDimension, pathDimension]), color }),
  z.strictObject({ ...transform, type: z.literal('pond'), radii: z.tuple([dimension, dimension]), waterColor: color, bankColor: color,
    lilyPads: z.array(z.strictObject({
      position: z.tuple([z.number().finite().min(-0.8).max(0.8), z.number().finite().min(-0.8).max(0.8)]),
      radius: z.number().finite().min(0.03).max(0.15), color,
    }).refine((pad) => Math.hypot(...pad.position) + pad.radius <= 0.9, 'Lily pads must remain inside the pond')).max(12).optional(),
  }),
  z.strictObject({ ...transform, type: z.literal('rock'), color, mossColor: color.optional() }),
  z.strictObject({ ...transform, type: z.literal('tree'), variety: z.enum(['pine', 'maple', 'spruce', 'palm']), foliageColor: color, trunkColor: color }),
  z.strictObject({ ...transform, type: z.literal('plant'), variety: z.enum(['grass', 'flowers', 'reeds', 'bamboo', 'cactus', 'fern', 'mushrooms']), color, accentColor: color }),
  z.strictObject({ ...transform, type: z.literal('structure'), variety: z.enum(['arch', 'pavilion', 'cabin', 'beacon', 'windmill', 'column', 'bench', 'fallen-log', 'stump']), color, accentColor: color }),
  z.strictObject({ ...transform, type: z.literal('patch'), radii: z.tuple([dimension, dimension]), color }),
  z.strictObject({ ...transform, type: z.literal('lantern'), stoneColor: color, glowColor: color }),
  z.strictObject({ ...transform, type: z.literal('entrance'), woodColor: color, roofColor: color }),
])

/** Version 1 accepts the foundation and a closed set of garden object kinds. */
export const worldSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: identifier,
  name: z.string().trim().min(1).max(80),
  ground: z.strictObject({
    size: z.tuple([z.number().finite().min(0.1).max(WORLD_SIZE), z.number().finite().min(0.1).max(WORLD_SIZE)]),
    color,
    hills: z.array(z.strictObject({ center: z.tuple([coordinate, coordinate]), radius: z.number().min(2).max(32), height: z.number().min(0).max(6) })
      .refine((hill) => hill.height / hill.radius <= 0.4, 'Hills must have gentle slopes')).max(8).optional(),
  }),
  camera: z.strictObject({
    position: vector3,
    target: vector3,
    fov: z.number().finite().min(20).max(100),
  }).refine(({ position, target }) => position.some((value, axis) => value !== target[axis]), {
    message: 'Camera position and target must differ',
  }),
  environment: z.strictObject({
    background: color,
    ambientIntensity: intensity,
    sunlight: z.strictObject({ position: vector3, color, intensity }),
    skyLight: z.strictObject({ skyColor: color, groundColor: color, intensity }).optional(),
    fog: z.strictObject({ color, near: z.number().min(5).max(100), far: z.number().min(10).max(200) })
      .refine((fog) => fog.far > fog.near, 'Fog far must exceed near').optional(),
  }),
  walking: z.strictObject({
    spawn: vector3.refine((position) => position[1] > 0 && position[1] <= 3, 'Eye height must be above ground and at most 3 meters'),
    yaw: z.number().finite(),
    speed: z.number().finite().positive().max(10),
    fov: z.number().finite().min(50).max(90),
    lookSensitivity: z.number().finite().positive().max(0.01),
    radius: z.number().finite().min(0.1).max(1).optional(),
  }).optional(),
  objects: z.array(worldObjectSchema).max(MAX_GENERATED_OBJECTS).superRefine((objects, context) => {
    const ids = new Set<string>()
    objects.forEach((object, index) => {
      if (ids.has(object.id)) {
        context.addIssue({ code: 'custom', path: [index, 'id'], message: 'Object IDs must be unique' })
      }
      ids.add(object.id)
    })
  }),
}).superRefine((world, context) => {
  if (!world.walking) return
  const [x, , z] = world.walking.spawn
  if (!isWalkable({ x, z }, createNavigation(world))) {
    context.addIssue({ code: 'custom', path: ['walking', 'spawn'],
      message: 'Walking spawn must fit inside the ground and clear all collision footprints' })
  }
})

export type WorldDefinition = z.infer<typeof worldSchema>
export type WorldObject = z.infer<typeof worldObjectSchema>

/** All untrusted world data must cross this boundary before rendering. */
export function parseWorld(input: unknown): WorldDefinition {
  return worldSchema.parse(input)
}
