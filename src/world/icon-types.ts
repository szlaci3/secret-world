// A finite local asset catalog: world JSON never supplies SVG markup or URLs.
import { catalogNames } from '../icons/names'

export type IconName = typeof catalogNames[number]
export const iconNames = catalogNames
export const legacyIconNames = ['settings', 'paperclip', 'clock', 'folder', 'briefcase', 'calculator', 'device-floppy', 'bulb', 'bell', 'book'] as const
export type WorldStyle = 'standard' | 'icons'
export type IconGround = 'meadow' | 'plain'
export const generationStyles = ['standard', 'icons', 'auto'] as const
export type GenerationStyle = typeof generationStyles[number]
export const worldStyleLabels: Record<WorldStyle, string> = { standard: 'Standard 3D objects', icons: 'Extruded icons' }

// Canonical geometry envelope, shared with navigation and ground bounds.
export const ICON_SIZE = 3.2
export const ICON_DEPTH = 0.64
export const ICON_BEVEL = 0.05
export const ICON_FOOTPRINT: [number, number] = [ICON_SIZE, ICON_DEPTH + ICON_BEVEL * 2]
