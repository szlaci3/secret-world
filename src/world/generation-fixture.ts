import { iconNames } from './icon-types'

export const testBlueprint = () => ({
  name: 'Moonlit glade', ground: { size: [128, 128], color: '#708060' },
  environment: { background: '#bdcfdf', ambientIntensity: 0.8, sunlight: { position: [5, 10, 5], color: '#fff0dd', intensity: 2 } },
  assets: [{ type: 'plant', variety: 'flowers', color: '#557755', accentColor: '#ddbbff' },
    { type: 'pond', radii: [2, 1.5], waterColor: '#448899', bankColor: '#999977' },
    { type: 'structure', variety: 'arch', color: '#999988', accentColor: '#777766' }],
  placements: [...Array.from({ length: 12 }, (_, i) => ({ asset: 0, position: [-8 + (i % 4) * 2, -7 + Math.floor(i / 4) * 2], rotation: i / 3, scale: [1, 1, 1] })),
    { asset: 1, position: [5, 0], rotation: 0, scale: [1, 1, 1] },
    { asset: 2, position: [0, -4], rotation: 0, scale: [1, 1, 1] }],
})

export const testIconBlueprint = () => ({
  style: 'icons', name: 'Pastel Office Garden', arrival: [0, 14],
  ground: { size: [40, 40], color: '#9bc65b' },
  environment: { background: '#85cafa', ambientIntensity: 0.8,
    sunlight: { position: [-12, 22, 14], color: '#fff3dc', intensity: 3.1 } },
  assets: [...iconNames.map((icon, i) => ({ type: 'icon', icon,
    color: ['#ad90e4', '#ff7662', '#4e87df', '#ffd252', '#efb5d3', '#6bc9b4', '#a697ed', '#ffbf69', '#70bce8', '#ef9d8c'][i] })),
    { type: 'plant', variety: 'grass', color: '#6d9e46', accentColor: '#a6c966' }],
  placements: [...iconNames.map((_, i) => ({ asset: i, position: [-9 + (i % 4) * 6, 5 - Math.floor(i / 4) * 7],
    rotation: (i % 3 - 1) * 0.25, scale: [1, 1, 1] })),
    { asset: 10, position: [-15, -4], rotation: 0, scale: [0.35, 0.35, 0.35], count: 6, spread: 2 }],
})
