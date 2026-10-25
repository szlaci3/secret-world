import meadow from './open-meadow.json'
import silverwood from './silverwood-grove.json'
import amberMeadow from './amber-meadow.json'
import basaltReach from './basalt-reach.json'
import frostlightGrove from './frostlight-grove.json'
import garden from './garden.json'
import mapleCourtyard from './maple-courtyard.json'
import sandstoneOasis from './sandstone-oasis.json'
import violetSanctuary from './violet-sanctuary.json'
import { parseWorld } from './schema'

// Presentation metadata stays outside the versioned world contract. Every scene
// uses the same validated data boundary that future generated worlds will use.
export const worldCatalog = [
  { data: meadow, theme: '128 × 128 m · Open landscape', description: 'Follow long meadow trails between a hilltop windmill, quiet lakes, and distant woodland groves.' },
  { data: silverwood, theme: '128 × 128 m · Frosted woodland', description: 'Wander through blue-green spruce groves, silver grass, and white flowers to a quiet cabin and distant windmill.' },
  { data: amberMeadow, theme: '24 × 22 m · Flowering meadow', description: 'Explore a sunny meadow of flowering plants, rolling hills, and quiet garden landmarks.' },
  { data: basaltReach, theme: '26 × 24 m · Rocky highlands', description: 'Follow a rugged highland path among dark stone, hardy plants, and distant peaks.' },
  { data: frostlightGrove, theme: '24 × 22 m · Snowy grove', description: 'Wander a frosted grove of pale trees, snow, and a sheltered clearing.' },
  { data: garden, theme: '18 × 18 m · Quiet garden', description: 'Take a winding stone path past a pond, bamboo screen, and peaceful tea pavilion.' },
  { data: mapleCourtyard, theme: '14 × 12 m · Maple courtyard', description: 'Step into a small courtyard framed by maple trees, stonework, and a quiet seat.' },
  { data: sandstoneOasis, theme: '24 × 22 m · Desert oasis', description: 'Cross warm dunes between turquoise pools, palms, and weathered gateway ruins.' },
  { data: violetSanctuary, theme: '24 × 22 m · Moonlit sanctuary', description: 'Discover a quiet violet-toned refuge among sculpted stone, water, and sheltering trees.' },
].map(({ data, ...details }) => ({ ...details, world: parseWorld(data) }))
