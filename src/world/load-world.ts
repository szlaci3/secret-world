import { worldSchema } from './schema'
import type { WorldDefinition } from './schema'

export const MAX_WORLD_BYTES = 1024 * 1024
export type WorldLoadResult = { ok: true; world: WorldDefinition } | { ok: false; message: string }

/** A single admission boundary for file contents, pasted JSON, and examples. */
export function loadWorldJson(text: string): WorldLoadResult {
  if (text.length > MAX_WORLD_BYTES || new TextEncoder().encode(text).byteLength > MAX_WORLD_BYTES) {
    return { ok: false, message: 'World JSON must be no larger than 1 MiB.' }
  }
  let input: unknown
  try {
    input = JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    return { ok: false, message: 'This is not valid JSON. Check the quotes, commas, and brackets.' }
  }
  const result = worldSchema.safeParse(input)
  if (!result.success) {
    const issues = result.error.issues.slice(0, 3).map((issue) => {
      const path = issue.path.join('.') || 'world'
      const message = path === 'schemaVersion' ? 'Only schema version 1 is supported.' : issue.message
      return `${path}: ${message}`.slice(0, 200)
    })
    return { ok: false, message: issues.join('\n') }
  }
  return { ok: true, world: result.data }
}
