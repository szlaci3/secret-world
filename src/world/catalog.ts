import meadow from './open-meadow.json'
import { parseWorld } from './schema'

// Presentation metadata stays outside the versioned world contract. Every scene
// uses the same validated data boundary that future generated worlds will use.
export const worldCatalog = [
  { data: meadow, theme: '128 × 128 m · Open landscape', description: 'Follow long meadow trails between a hilltop windmill, quiet lakes, and distant woodland groves.' },
].map(({ data, ...details }) => ({ ...details, world: parseWorld(data) }))
