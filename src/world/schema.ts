import { z } from 'zod'
import { collisionShapeSchema } from './collision-schema'
import { createNavigation, isWalkable } from '../controls/navigation'

const vector3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color')
const intensity = z.number().finite().min(0).max(10)
const dimension = z.number().finite().positive().max(20)
const identifier = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
const transform = {
  id: identifier,
  position: vector3,
  // Rotation around the Y axis, in radians. Local object origins sit on ground.
  rotation: z.number().finite(),
  scale: z.tuple([dimension, dimension, dimension]),
  collision: z.array(collisionShapeSchema).max(8).optional(),
}

export const worldObjectSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...transform, type: z.literal('path'), size: z.tuple([dimension, dimension]), color }),
  z.strictObject({ ...transform, type: z.literal('pond'), radii: z.tuple([dimension, dimension]), waterColor: color, bankColor: color }),
  z.strictObject({ ...transform, type: z.literal('rock'), color }),
  z.strictObject({ ...transform, type: z.literal('tree'), variety: z.enum(['pine', 'maple']), foliageColor: color, trunkColor: color }),
  z.strictObject({ ...transform, type: z.literal('lantern'), stoneColor: color, glowColor: color }),
  z.strictObject({ ...transform, type: z.literal('entrance'), woodColor: color, roofColor: color }),
])

/** Version 1 accepts the foundation and a closed set of garden object kinds. */
export const worldSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: identifier,
  name: z.string().trim().min(1).max(80),
  ground: z.strictObject({
    size: z.tuple([z.number().finite().positive().max(100), z.number().finite().positive().max(100)]),
    color,
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
  }),
  walking: z.strictObject({
    spawn: vector3.refine((position) => position[1] > 0 && position[1] <= 3, 'Eye height must be above ground and at most 3 meters'),
    yaw: z.number().finite(),
    speed: z.number().finite().positive().max(10),
    fov: z.number().finite().min(50).max(90),
    lookSensitivity: z.number().finite().positive().max(0.01),
    radius: z.number().finite().min(0.1).max(1).optional(),
  }).optional(),
  objects: z.array(worldObjectSchema).max(200).superRefine((objects, context) => {
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
