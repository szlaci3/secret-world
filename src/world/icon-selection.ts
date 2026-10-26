import catalog from '../icons/catalog.json'
import { iconNames, legacyIconNames } from './icon-types'
import type { IconName } from './icon-types'

// Search upstream tags locally; only the shortlist goes into the prompt AND enum.
// Related terms bridge common briefs to catalog vocabulary without a second call.
const concepts = [
  'underwater ocean sea marine aquarium reef fish diving beach water',
  'zoo safari animal animals wildlife pet pets jungle',
  'village town rural countryside cottage house building buildings farm home',
  'music musical festival concert band sound instrument melody audio party performance',
  'office work productivity stationery document business computer',
  'space astronomy planet rocket universe moon star astronaut',
  'garden forest woodland nature tree flower plant botanical',
  'food restaurant kitchen cooking meal bakery fruit vegetable',
  'travel transport vehicle car train airplane boat ship journey',
  'sport sports fitness exercise ball game stadium',
  'hospital medical medicine health doctor nurse',
  'school education learning study book library science',
  'fantasy magic fairy castle crown sword dragon',
  'winter snow ice christmas skiing cold',
  'city urban street architecture building shop store',
]
const stop = new Set('a an the of with and in on at to for world icons icon extruded colorful colourful playful make create many lots large small'.split(' '))
const words = (text: string) => text.toLowerCase().match(/[a-z0-9]+/g)?.filter(word => !stop.has(word)) ?? []
const stem = (word: string) => word.length > 4 ? word.replace(/s$/, '') : word

export function selectIcons(prompt: string, limit = 80): IconName[] {
  const direct = new Set(words(prompt).map(stem))
  const related = new Set<string>()
  for (const concept of concepts) {
    const terms = words(concept).map(stem)
    if (terms.some(term => direct.has(term))) terms.forEach(term => related.add(term))
  }
  const ranked = iconNames.map(name => {
    const entry = catalog[name]
    const nameWords = words(name).map(stem), tags = words(entry.tags.join(' ')).map(stem)
    const category = words(entry.category).map(stem)
    const score = nameWords.reduce((sum, word) => sum + (direct.has(word) ? 12 : related.has(word) ? 4 : 0), 0)
      + tags.reduce((sum, word) => sum + (direct.has(word) ? 3 : related.has(word) ? 1 : 0), 0)
      + category.reduce((sum, word) => sum + (direct.has(word) || related.has(word) ? 4 : 0), 0)
    // Prefer a recognizable base symbol over multiple numbered/boxed variants.
    return { name, score: score / (1 + Math.max(0, nameWords.length - 1) * 0.3) }
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  const result = new Set<IconName>(/office|stationery|productivity/i.test(prompt) ? legacyIconNames : [])
  ranked.slice(0, limit).forEach(entry => result.add(entry.name))
  // Preserve the original office palette when relevant, and give unknown briefs
  // a diverse fallback rather than a fixed alphabetic slice of the catalog.
  if (result.size < 24) {
    const categories = new Set<string>()
    for (const name of iconNames) {
      if (!categories.has(catalog[name].category)) { result.add(name); categories.add(catalog[name].category) }
    }
  }
  return [...result].slice(0, limit)
}
