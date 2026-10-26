import { MAX_ICON_OBJECTS } from './icon-limits'

export type IconPopulation = { target: number; min: number; max: number; exact: boolean }
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, sixteen: 16, twenty: 20 }

/** Recognize counts attached to object nouns, not dimensions, years or meters. */
export function iconPopulation(prompt: string): IconPopulation {
  const count = prompt.match(/\b(\d{1,6}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|sixteen|twenty)\s+(?:total\s+)?(?:icon\s+)?(?:icons?|objects?|symbols?)\b/i)
  if (count) {
    const target = numberWords[count[1].toLowerCase()] ?? Number(count[1])
    const prefix = prompt.slice(0, count.index)
    if (/(?:up to|at most|no more than)\s*$/i.test(prefix)) return { target: Math.min(40, target, MAX_ICON_OBJECTS), min: Math.min(32, target, MAX_ICON_OBJECTS), max: Math.min(MAX_ICON_OBJECTS, target), exact: false }
    if (/(?:at least|minimum of)\s*$/i.test(prefix)) return { target, min: target, max: MAX_ICON_OBJECTS, exact: false }
    return { target, min: target, max: target, exact: true }
  }
  if (/\b(small|tiny|miniature|minimal|minimalist|few)\b/i.test(prompt)) return { target: 16, min: 12, max: 20, exact: false }
  if (/\b(rich|populous|crowded|bustling)\b|\b(?:large|big|vast)\s+(?:icon\s+)?world\b|\b(?:many|lots of|a lot of)\s+(?:icons|objects|symbols)\b/i.test(prompt)) {
    return { target: Math.min(80, MAX_ICON_OBJECTS), min: Math.min(72, MAX_ICON_OBJECTS), max: MAX_ICON_OBJECTS, exact: false }
  }
  return { target: Math.min(40, MAX_ICON_OBJECTS), min: Math.min(32, MAX_ICON_OBJECTS), max: Math.min(48, MAX_ICON_OBJECTS), exact: false }
}

export function iconPopulationGuidance(population: IconPopulation): string {
  return population.exact
    ? `The user requests EXACTLY ${population.target} icon objects, counting every repeated copy. Select relevant symbols and groups for that total; the application enforces it.`
    : `Target ${population.target} actual icon objects (${population.min}–${population.max}), not just asset definitions. Select 12–24 relevant symbols where the topic permits, then repeat them in meaningful groups. Small/minimal briefs with fewer than six different symbols may use fewer objects on smaller ground. The application enforces the population and fits the land to the composition.`
}
