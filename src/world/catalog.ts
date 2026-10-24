import garden from './garden.json'
import oasis from './sandstone-oasis.json'
import frost from './frostlight-grove.json'
import { parseWorld } from './schema'

// Presentation metadata stays outside the versioned world contract. Every scene
// uses the same validated data boundary that future generated worlds will use.
export const worldCatalog = [
  { data: garden, theme: 'Japanese garden', description: 'Stone, water, and a little room to breathe.' },
  { data: oasis, theme: 'Sunlit desert', description: 'Warm sandstone spires around a turquoise oasis.' },
  { data: frost, theme: 'Winter woodland', description: 'Snow-laden pines and a blue pool in the quiet cold.' },
].map(({ data, ...details }) => ({ ...details, world: parseWorld(data) }))
