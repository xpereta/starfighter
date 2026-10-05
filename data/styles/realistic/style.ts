import type { StyleManifest } from '../../../src/render/style';

/** Grounded, layered combat sound design: sounds only. Looks fall back to the parent (`plain`). */
export const manifest: StyleManifest = {
  id: 'realistic',
  name: 'Realistic',
  intent:
    'Believable jet and space-fighter combat audio: layered mechanical guns with a decaying tail, metal and hull impacts, big explosions with a sub thump and a long tail in a reverberant space, soft cockpit instrument tones, radio squelch and beeps, and a very low engine and space bed. Quieter and more textured than the arcade packs. Sounds only; the look is the parent (plain).',
  parent: 'plain',
  references: [
    {
      title: 'The Expanse (TV series), sound design',
      took: 'Weight and grit over sparkle: guns as heavy mechanical thumps, explosions as a sub hit followed by debris and a long tail, no cartoon lasers.',
    },
    {
      title: 'Jet and helicopter cockpit audio (modern fighters)',
      took: 'Soft, narrow instrument tones for lock and warnings; a constant low engine bed that follows throttle; wind-like rumble at speed.',
    },
    {
      title: 'Apollo and Space Shuttle air-to-ground radio',
      took: 'The short squelch and the single beep that bracket every transmission (quindar tones), for orders, check-ins and pilot events.',
    },
    {
      title: 'Battlestar Galactica (2004)',
      took: 'Restraint: impacts and gunfire felt in the low end, most of the combat quiet and grounded.',
    },
  ],
  status: 'idea',
  notes:
    'First pass, tuned only by measurement (levels, no clipping, no constant buzz), never listened to yet. Every sound is a recipe in sounds.ts: edit the numbers, or use the panel Sound section (volume, reverb send, loops). Hold the gun gaps (minGap) up if automatic fire blurs.',
};
