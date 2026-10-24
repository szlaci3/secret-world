const forwardKeys = ['KeyW', 'ArrowUp']
const backwardKeys = ['KeyS', 'ArrowDown']
const leftKeys = ['KeyA', 'ArrowLeft']
const rightKeys = ['KeyD', 'ArrowRight']

export const movementKeys = new Set([...forwardKeys, ...backwardKeys, ...leftKeys, ...rightKeys])

/** Ground-plane motion, normalized so diagonals and duplicate bindings are equal. */
export function movementStep(keys: ReadonlySet<string>, yaw: number, speed: number, delta: number) {
  const pressed = (bindings: string[]) => Number(bindings.some((key) => keys.has(key)))
  const forward = pressed(forwardKeys) - pressed(backwardKeys)
  const right = pressed(rightKeys) - pressed(leftKeys)
  const length = Math.hypot(forward, right)
  // Drop accumulated time after a stalled/background frame instead of teleporting.
  const distance = speed * Math.max(0, Math.min(delta, 0.05)) / (length || 1)
  return {
    x: (right * Math.cos(yaw) - forward * Math.sin(yaw)) * distance,
    z: (-right * Math.sin(yaw) - forward * Math.cos(yaw)) * distance,
  }
}
