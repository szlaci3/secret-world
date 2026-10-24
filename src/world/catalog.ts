import garden from './garden.json'
import oasis from './sandstone-oasis.json'
import frost from './frostlight-grove.json'
import meadow from './amber-meadow.json'
import coast from './basalt-reach.json'
import ruins from './violet-sanctuary.json'
import { parseWorld } from './schema'

// Presentation metadata stays outside the versioned world contract. Every scene
// uses the same validated data boundary that future generated worlds will use.
export const worldCatalog = [
  { data: garden, theme: 'Japanese garden', description: 'A pond-side path, bamboo screens, and a sheltered tea pavilion.' },
  { data: oasis, theme: 'Sunlit desert', description: 'Follow dune-side ruins between palm groves and turquoise pools.' },
  { data: frost, theme: 'Winter woodland', description: 'A snowy cabin clearing and a trail up to the woodland lookout.' },
  { data: meadow, theme: 'Golden grassland', description: 'Flower drifts and a winding loop around a hilltop windmill.' },
  { data: coast, theme: 'Basalt lakeshore', description: 'A vast still lake, a crescent shore, and a weathered beacon.' },
  { data: ruins, theme: 'Twilight ruins', description: 'Walk beneath pale arches to secluded reflecting pools.' },
].map(({ data, ...details }) => ({ ...details, world: parseWorld(data) }))
