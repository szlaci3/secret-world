export const testBlueprint = () => ({
  name: 'Moonlit glade', ground: { size: [24, 24], color: '#708060' },
  environment: { background: '#bdcfdf', ambientIntensity: 0.8, sunlight: { position: [5, 10, 5], color: '#fff0dd', intensity: 2 } },
  assets: [{ type: 'plant', variety: 'flowers', color: '#557755', accentColor: '#ddbbff' },
    { type: 'pond', radii: [2, 1.5], waterColor: '#448899', bankColor: '#999977' },
    { type: 'structure', variety: 'arch', color: '#999988', accentColor: '#777766' }],
  placements: [...Array.from({ length: 12 }, (_, i) => ({ asset: 0, position: [-8 + (i % 4) * 2, -7 + Math.floor(i / 4) * 2], rotation: i / 3, scale: [1, 1, 1] })),
    { asset: 1, position: [5, 0], rotation: 0, scale: [1, 1, 1] },
    { asset: 2, position: [0, -4], rotation: 0, scale: [1, 1, 1] }],
})
