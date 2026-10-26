export type IconLod = 0 | 1 | 2
export const ICON_LOD_DISTANCES = [14, 36] as const

/** Distances are divided by icon scale: large silhouettes stay smooth farther
 * away. Ten-percent hysteresis prevents flicker when hovering at a boundary. */
export function iconLod(distance: number, previous?: IconLod): IconLod {
  const [near, far] = ICON_LOD_DISTANCES
  if (previous === undefined) return distance < near ? 0 : distance < far ? 1 : 2
  if (previous === 0 && distance <= near * 1.1) return 0
  if (previous === 2 && distance >= far * 0.9) return 2
  return distance < near * 0.9 ? 0 : distance > far * 1.1 ? 2 : 1
}

export type QualitySample = { seconds: number; frames: number; recovering: number; cooldown: number }
export const emptyQualitySample = (): QualitySample => ({ seconds: 0, frames: 0, recovering: 0, cooldown: 0 })

/** Evaluate moving frames only. Recovery needs two fast windows, and uses a
 * wider threshold than reduction so the controller does not oscillate. */
export function sampleIconQuality(sample: QualitySample, delta: number, reduced: boolean): boolean {
  if (delta <= 0 || delta > 5) { Object.assign(sample, emptyQualitySample()); return reduced }
  sample.seconds += delta
  sample.cooldown = Math.max(0, sample.cooldown - delta)
  sample.frames++
  if (sample.seconds < 2) return reduced
  const fps = sample.frames / sample.seconds
  sample.seconds = 0; sample.frames = 0
  if (!reduced) { sample.recovering = 0; if (fps < 28) sample.cooldown = 8; return fps < 28 }
  sample.recovering = fps > 48 && sample.cooldown === 0 ? sample.recovering + 1 : 0
  if (sample.recovering < 2) return true
  sample.recovering = 0
  return false
}
