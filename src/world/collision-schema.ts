import { z } from 'zod'

const length = z.number().finite().min(0.01).max(40)
const point = z.tuple([z.number().finite().min(-40).max(40), z.number().finite().min(-40).max(40)])

/** Object-local X/Z footprints, transformed by the owning object's scale/yaw. */
export const collisionShapeSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('box'), center: point, size: z.tuple([length, length]) }),
  z.strictObject({ kind: z.literal('ellipse'), center: point, radii: z.tuple([length, length]) }),
])

export type CollisionShape = z.infer<typeof collisionShapeSchema>
