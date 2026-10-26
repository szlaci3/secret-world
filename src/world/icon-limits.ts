import config from '../icons/config.json'

// One build-time setting for both the browser and Netlify compiler. Changing
// src/icons/config.json and rebuilding avoids different client/server budgets.
const configured = Number(config.maxObjects)
export const MAX_ICON_OBJECTS = Number.isInteger(configured) && configured >= 25 && configured <= 256 ? configured : 96
export const MAX_ICON_ASSETS = 48
export const MAX_ICON_PLACEMENTS = Math.max(100, MAX_ICON_OBJECTS + 16)
