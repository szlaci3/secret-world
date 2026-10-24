import { z } from 'zod'

const vector3 = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()])
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color')
const intensity = z.number().finite().min(0).max(10)

/** Version 1 covers the foundation only. Add supported prop kinds in Task 2. */
export const worldSchema = z.strictObject({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
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
  // No prop types are implemented yet; reject rather than silently drop them.
  objects: z.array(z.never()).max(0),
})

export type WorldDefinition = z.infer<typeof worldSchema>

/** All untrusted world data must cross this boundary before rendering. */
export function parseWorld(input: unknown): WorldDefinition {
  return worldSchema.parse(input)
}
