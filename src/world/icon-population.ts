import { MAX_ICON_OBJECTS } from './icon-limits'

export type IconPopulation = { target: number; min: number; max: number; exact: boolean; minimumRequested?: boolean }
const numberWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, sixteen: 16, twenty: 20 }

/** Recognize counts attached to object nouns, not dimensions, years or meters. */
export function iconPopulation(prompt: string): IconPopulation {
  const count = prompt.match(/\b(\d{1,6}|one|two|three|four|five|six|seven|eight|nine|ten|twelve|sixteen|twenty)\s+(?:total\s+)?(?:icon\s+)?(?:icons?|objects?|symbols?)\b/i)
  if (count) {
    const target = numberWords[count[1].toLowerCase()] ?? Number(count[1])
    const prefix = prompt.slice(0, count.index)
    if (/(?:up to|at most|no more than)\s*$/i.test(prefix)) return { target: Math.min(40, target, MAX_ICON_OBJECTS), min: Math.min(32, target, MAX_ICON_OBJECTS), max: Math.min(MAX_ICON_OBJECTS, target), exact: false }
    if (/(?:at least|minimum of)\s*$/i.test(prefix)) return { target, min: target, max: MAX_ICON_OBJECTS, exact: false, minimumRequested: true }
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
    ? `The user requests EXACTLY ${population.target} icon objects, counting every repeated copy. Choose singles, groups or a mix that meaningfully achieves this total; the application enforces it.`
    : population.minimumRequested
      ? `The user requests at least ${population.min} icon objects, up to ${population.max}. Meet that minimum while respecting each single/group decision.`
      : `Choose the population to suit the composition, up to ${population.max} icon objects. ${population.target} is a reference for a populous composition, not a quota: a handful of meaningful single symbols is valid. Never repeat a symbol merely to fill the field. The application fits the land to your authored counts.`
}
