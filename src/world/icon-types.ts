// A finite local asset catalog: world JSON never supplies SVG markup or URLs.
export const iconNames = ['settings', 'paperclip', 'clock', 'folder', 'briefcase', 'calculator', 'device-floppy', 'bulb', 'bell', 'book'] as const
export type IconName = typeof iconNames[number]
export type WorldStyle = 'standard' | 'icons'

// Canonical geometry envelope, shared with navigation and ground bounds.
export const ICON_SIZE = 3.2
export const ICON_DEPTH = 0.64
export const ICON_BEVEL = 0.05
export const ICON_FOOTPRINT: [number, number] = [ICON_SIZE, ICON_DEPTH + ICON_BEVEL * 2]
