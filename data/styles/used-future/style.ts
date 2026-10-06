import type { StyleManifest } from '../../../src/render/style';

/** Gritty used-future space war: Star Wars hulls, Aliens light, realistic sound underneath. */
export const manifest: StyleManifest = {
  id: 'used-future',
  name: 'Used Future',
  intent:
    'Gritty used-future space war: weathered grey and white hulls with red and orange markings, panel lines, soot and asymmetric greebles (Star Wars), dim sodium-lit industrial blues, hard shadows, planet glare and grain (Aliens), blaster bolts, orange-white fireballs and slow burning debris.',
  parent: 'realistic',
  references: [
    {
      title:
        'Star Wars: A New Hope and The Empire Strikes Back (ILM model shop; Joe Johnston, Colin Cantwell, Lorne Peterson)',
      took: 'The used-future rule: functional industrial hulls with panel lines, greebles from kit-bashed model parts, scuffs and soot; the X-wing (S-foils, four nacelles, red markings, astromech), TIE (pod between hex blades), Y/A-wing pods and Star Destroyer wedge as silhouettes; green and red blaster bolts.',
    },
    {
      title: 'Aliens (1986; Ron Cobb, Syd Mead, Dennis Skotak)',
      took: 'Dark industrial blue and grey with sodium-orange lamps, hard single-source shadows, heavy machinery with hazard stripes, the UD-4L dropship as the gunship, orange tracers, fog and glare in a mostly dark frame.',
    },
    {
      title: 'Alien (1979; Ron Cobb, Chris Foss, H. R. Giger)',
      took: 'Sparse dim lighting and a sense of heavy tonnage: slow debris, long burning smoke, the Nostromo-style lit window rows on a big hull.',
    },
    {
      title: 'Battlestar Galactica (2004) and The Expanse',
      took: 'Restraint in the explosions: fireballs with sparks and smoke, no rings, chunks that tumble slowly; the realistic sound parent.',
    },
  ],
  status: 'idea',
  notes:
    'Models are layered parts (src/render/style.ts: ShapeDef.parts). Every ship slot is designed, including wingman liveries (wingmanB, wingmanC) and the Prototype 5 kinds (gunship, lancer, capital and its parts). Reference sheet: docs/reference/used-future/. The audit (scripts/contrast-audit.mjs) passes; the planet and sodium glare are kept dim on purpose so that every hull reads 3:1 against them. Sounds: only the three guns are overridden (blaster zaps), everything else is the realistic parent.',
};
