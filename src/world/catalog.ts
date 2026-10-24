import meadow from './open-meadow.json'
import silverwood from './silverwood-grove.json'
import { parseWorld } from './schema'

// Presentation metadata stays outside the versioned world contract. Every scene
// uses the same validated data boundary that future generated worlds will use.
export const worldCatalog = [
  { data: meadow, theme: '128 × 128 m · Open landscape', description: 'Follow long meadow trails between a hilltop windmill, quiet lakes, and distant woodland groves.' },
  { data: silverwood, theme: '128 × 128 m · Frosted woodland', description: 'Wander through blue-green spruce groves, silver grass, and white flowers to a quiet cabin and distant windmill.' },
].map(({ data, ...details }) => ({ ...details, world: parseWorld(data) }))
