// Shared by terrain geometry, object placement, and the walking camera.
export type TerrainGround = { size: [number, number]; hills?: { center: [number, number]; radius: number; height: number }[] }
export const terrainSegments = (ground: TerrainGround) => ground.size.map((size) => Math.ceil(size)) as [number, number]

export function hillHeight(ground: TerrainGround, x: number, z: number) {
  return (ground.hills ?? []).reduce((height, hill) => {
    const r2 = ((x - hill.center[0]) ** 2 + (z - hill.center[1]) ** 2) / hill.radius ** 2
    return height + hill.height * Math.max(0, 1 - r2) ** 2
  }, 0)
}

/** Interpolate the same triangle grid as the visible surface, including edges. */
export function terrainHeight(ground: TerrainGround, x: number, z: number) {
  if (!ground.hills?.length) return 0
  const [nx, nz] = terrainSegments(ground)
  const [width, depth] = ground.size
  const gx = Math.max(0, Math.min(nx, (x / width + 0.5) * nx))
  const gz = Math.max(0, Math.min(nz, (z / depth + 0.5) * nz))
  const ix = Math.min(nx - 1, Math.floor(gx)), iz = Math.min(nz - 1, Math.floor(gz))
  const u = gx - ix, v = gz - iz
  const sample = (dx: number, dz: number) => hillHeight(ground, (ix + dx) * width / nx - width / 2, (iz + dz) * depth / nz - depth / 2)
  const a = sample(0, 0), d = sample(1, 1)
  return u >= v ? a * (1 - u) + sample(1, 0) * (u - v) + d * v
    : a * (1 - v) + sample(0, 1) * (v - u) + d * u
}
