import type { StyleManifest } from '../../../src/render/style';

/** The anime-80s look with a spectacle presentation: HUD, menus, camera feel and readability (see presentation.ts). */
export const manifest: StyleManifest = {
  id: 'anime-spectacle',
  name: 'Anime Spectacle',
  intent:
    'The anime-80s dogfight turned into the opening of an OVA: angled neon HUD panels, pilot comm windows, title cards, a camera that punches, rolls and freezes on the big hits.',
  parent: 'anime-80s',
  references: [
    {
      title: 'Macross Plus / Macross Zero (HUD and comm-window layouts)',
      took: 'Angled readout panels, pilot comm windows sliding in with name and callsign, lock reticles that collapse onto the target.',
    },
    {
      title: 'Gunbuster / Gurren Lagann (camera and title cards)',
      took: 'Zoom punches on big kills, freeze frames with speed-line flashes, bold diagonal title cards.',
    },
    {
      title: 'Ace Combat 5 (HUD)',
      took: 'Off-screen threat arrows with distance, kill-feed and rank-style combo calls, tension vignette at low hull.',
    },
  ],
  status: 'idea',
  notes:
    'Presentation lives in presentation.ts (read by src/ui/spectacle, not by core). Turn the parts off in the dev panel (Spectacle section) or with ?spectacle=calm|off.',
};
