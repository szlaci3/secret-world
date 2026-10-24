import { writeFile } from 'node:fs/promises'
import { createServer } from 'vite'

// Reproducible authored landscape. No provider request or downloaded assets.
const assets = [
  { type: 'path', size: [3, 10], color: '#b8b59b' },
  { type: 'pond', radii: [9, 7], waterColor: '#578c96', bankColor: '#b6b298' },
  { type: 'pond', radii: [5, 7], waterColor: '#6a9fa0', bankColor: '#b6b298' },
  { type: 'tree', variety: 'maple', foliageColor: '#b67c4e', trunkColor: '#715943' },
  { type: 'tree', variety: 'pine', foliageColor: '#547359', trunkColor: '#715943' },
  { type: 'plant', variety: 'flowers', color: '#73845a', accentColor: '#e6be76' },
  { type: 'plant', variety: 'grass', color: '#8c9c70', accentColor: '#c8bd86' },
  { type: 'plant', variety: 'reeds', color: '#718768', accentColor: '#d4c79b' },
  { type: 'structure', variety: 'windmill', color: '#c3b69b', accentColor: '#795d42' },
  { type: 'structure', variety: 'cabin', color: '#8b7455', accentColor: '#58684d' },
  { type: 'structure', variety: 'arch', color: '#b5b39b', accentColor: '#d3caad' },
  { type: 'structure', variety: 'pavilion', color: '#806448', accentColor: '#606e50' },
  { type: 'structure', variety: 'beacon', color: '#a6a58f', accentColor: '#e3c58c' },
  { type: 'rock', color: '#8c9487', mossColor: '#71835d' },
]
const placements = []
const place = (asset, x, z, options = {}) => placements.push({ asset, position: [x, z], rotation: 0, scale: [1, 1, 1], ...options })
// Broad routes connect the arrival, lake overlook, windmill and woodland cabin.
const route = points => {
  for (let i = 1; i < points.length; i++) {
    const [ax, az] = points[i - 1], [bx, bz] = points[i]
    const length = Math.hypot(bx - ax, bz - az), count = Math.ceil(length / 9.5)
    for (let j = 0; j < count; j++) {
      const t = (j + 0.5) / count
      place(0, ax + (bx - ax) * t, az + (bz - az) * t, { rotation: Math.atan2(bx - ax, bz - az), scale: [1, 1, length / count / 10] })
    }
  }
}
route([[0, 52], [0, 32], [-5, 14], [0, -4], [0, -24], [6, -44]])
route([[0, -22], [-18, -23], [-35, -29], [-42, -33]])
route([[0, -24], [20, -29], [38, -37]])
route([[0, 32], [18, 40], [35, 40], [43, 36]])
route([[-5, 14], [-18, 17], [-34, 16]])
place(1, -25, -5)
place(2, 35, 18)
place(8, -43, -34, { scale: [1.5, 1.5, 1.5] })
place(9, 45, 35, { rotation: -0.4, scale: [1.4, 1.4, 1.4] })
place(10, 0, 44, { scale: [1.4, 1.4, 1.4] })
place(10, 0, -4, { rotation: -0.2 })
place(11, -36, 17, { scale: [1.4, 1.4, 1.4] })
place(12, 39, -39, { scale: [1.4, 1.4, 1.4] })
for (const [asset, x, z, count, spread] of [[3,-43,-25,10,11],[4,39,-43,10,12],[4,47,39,8,10],[3,-43,37,8,12],[3,22,48,6,7]]) {
  place(asset, x, z, { count, spread, scale: [1.3, 1.3, 1.3] })
}
for (const [x, z, asset, spread] of [[-17,35,5,10],[18,10,5,11],[-38,-47,6,10],[40,-18,6,12],[-46,5,6,11],[26,45,5,10]]) {
  place(asset, x, z, { count: 36, spread, scale: [1.7, 1.3, 1.7] })
}
place(7, -25, 4, { count: 30, spread: 5 })
place(7, 42, 18, { count: 24, spread: 4 })
place(5, 16, 0, { scale: [1.7, 1.3, 1.7] })
for (const [x, z] of [[-36,-7],[-32,2],[-18,-12],[28,12],[41,26],[-49,-37],[33,-45],[49,43]]) {
  place(13, x, z, { rotation: x / 10, scale: [1.7, 1.3, 1.7] })
}
const blueprint = {
  name: 'The Open Meadow',
  ground: { size: [128, 128], color: '#93a27c', hills: [
    { center: [-43, -34], radius: 24, height: 6 }, { center: [39, -39], radius: 25, height: 5 },
    { center: [-43, 37], radius: 22, height: 4.5 }, { center: [45, 43], radius: 14, height: 3.5 },
  ] },
  environment: { background: '#dce4da', ambientIntensity: 0.85,
    sunlight: { position: [-75, 110, 60], color: '#fff0d6', intensity: 2.4 },
    skyLight: { skyColor: '#dce8ec', groundColor: '#9eaa82', intensity: 0.7 },
    fog: { color: '#dce4da', near: 65, far: 170 } },
  assets, placements,
}
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { compileBlueprint } = await server.ssrLoadModule('/src/world/generation.ts')
  const start = performance.now()
  const world = compileBlueprint(blueprint, 'open-meadow')
  await writeFile('src/world/open-meadow.json', JSON.stringify(world, null, 2) + '\n')
  console.log(`Built ${world.name}: ${world.ground.size.join(' × ')}m, ${world.objects.length} objects, ${(performance.now() - start).toFixed(0)}ms compile.`)
} finally { await server.close() }
